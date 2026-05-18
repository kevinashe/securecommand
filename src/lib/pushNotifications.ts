import { supabase } from './supabase';
import { playSosAlert, playIncidentAlert, playMessageAlert, playNotificationAlert } from './soundAlerts';

type NotificationCategory = 'sos' | 'incident' | 'message' | 'shift' | 'general';

interface AppNotification {
  title: string;
  body: string;
  category: NotificationCategory;
  url?: string;
}

let permissionGranted = false;

export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  permissionGranted = result === 'granted';
  return permissionGranted;
}

export function showNotification({ title, body, category }: AppNotification) {
  switch (category) {
    case 'sos': playSosAlert(); break;
    case 'incident': playIncidentAlert(); break;
    case 'message': playMessageAlert(); break;
    default: playNotificationAlert(); break;
  }

  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  try {
    const tag = `${category}-${Date.now()}`;
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          tag,
          icon: '/pwa-192x192.svg',
          badge: '/pwa-192x192.svg',
          vibrate: category === 'sos' ? [200, 100, 200, 100, 200] : [200, 100, 200],
          requireInteraction: category === 'sos',
        } as any);
      });
    } else {
      new Notification(title, { body, tag, icon: '/pwa-192x192.svg' });
    }
  } catch {
    // Notification display failed silently
  }
}

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

export function subscribeToRealtimeNotifications(userId: string, companyId: string | null) {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabase
    .channel('push-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sos_alerts' },
      (payload) => {
        if (payload.new && (payload.new as Record<string, unknown>).company_id === companyId) {
          showNotification({
            title: 'SOS ALERT',
            body: `Emergency alert from a guard at ${(payload.new as Record<string, unknown>).location || 'unknown location'}`,
            category: 'sos',
          });
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'incidents' },
      (payload) => {
        if (payload.new && (payload.new as Record<string, unknown>).company_id === companyId) {
          showNotification({
            title: 'New Incident Reported',
            body: `${(payload.new as Record<string, unknown>).title || 'New incident'} - ${(payload.new as Record<string, unknown>).severity || 'unknown'} severity`,
            category: 'incident',
          });
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      (payload) => {
        const msg = payload.new as Record<string, unknown>;
        if (msg && msg.sender_id !== userId) {
          showNotification({
            title: 'New Message',
            body: typeof msg.content === 'string' ? msg.content.substring(0, 100) : 'You have a new message',
            category: 'message',
          });
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      (payload) => {
        const notif = payload.new as Record<string, unknown>;
        if (notif && notif.user_id === userId) {
          showNotification({
            title: typeof notif.title === 'string' ? notif.title : 'Notification',
            body: typeof notif.message === 'string' ? notif.message : 'You have a new notification',
            category: 'general',
          });
        }
      }
    )
    .subscribe();

  return realtimeChannel;
}

export function unsubscribeFromRealtimeNotifications() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}
