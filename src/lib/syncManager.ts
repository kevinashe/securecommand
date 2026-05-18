import { supabase } from './supabase';
import { offlineStorage } from './offlineStorage';

class SyncManager {
  private syncInterval: number | null = null;
  private isSyncing = false;
  private onlineHandler: (() => void) | null = null;

  startAutoSync(intervalMs: number = 30000): void {
    if (this.syncInterval) return;

    this.syncInterval = window.setInterval(() => {
      this.syncQueuedActions();
    }, intervalMs);

    this.onlineHandler = () => {
      this.syncQueuedActions();
    };
    window.addEventListener('online', this.onlineHandler);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
  }

  async syncQueuedActions(): Promise<void> {
    if (this.isSyncing || !navigator.onLine) return;

    this.isSyncing = true;

    try {
      const actions = await offlineStorage.getQueuedActions();

      for (const action of actions) {
        try {
          await this.processAction(action);
          await offlineStorage.removeQueuedAction(action.id);
        } catch (error) {
          console.error(`Failed to sync action ${action.id}:`, error);

          action.retryCount++;
          if (action.retryCount > 5) {
            await offlineStorage.removeQueuedAction(action.id);
          } else {
            await offlineStorage.updateQueuedAction(action);
          }
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async processAction(action: any): Promise<void> {
    switch (action.type) {
      case 'shift_update':
        await supabase
          .from('shifts')
          .update(action.data.updates)
          .eq('id', action.data.shiftId);
        break;

      case 'incident_create':
        await supabase
          .from('incidents')
          .insert(action.data);
        break;

      case 'checkin_create':
        await supabase
          .from('check_ins')
          .insert(action.data);
        break;

      case 'sos_alert':
        await supabase
          .from('sos_alerts')
          .insert(action.data);
        break;

      case 'patrol_scan': {
        let photoUrl = null;

        if (action.data.photoBase64 && action.data.photoPath) {
          const photoData = action.data.photoBase64.split(',')[1];
          const blob = Uint8Array.from(atob(photoData), (c) => c.charCodeAt(0));

          const { error: uploadError } = await supabase.storage
            .from('check-in-photos')
            .upload(action.data.photoPath, blob, {
              contentType: 'image/jpeg',
              upsert: false,
            });

          if (!uploadError) {
            const { data } = supabase.storage.from('check-in-photos').getPublicUrl(action.data.photoPath);
            photoUrl = data.publicUrl;
          }
        }

        const { error } = await supabase.from('check_ins').insert({
          checkpoint_id: action.data.checkpoint_id,
          guard_id: action.data.guard_id,
          checked_in_at: action.data.device_timestamp,
          device_timestamp: action.data.device_timestamp,
          latitude: action.data.latitude,
          longitude: action.data.longitude,
          is_within_geofence: action.data.is_within_geofence,
          distance_from_checkpoint: action.data.distance_from_checkpoint,
          photo_url: photoUrl,
          recorded_offline: true,
          synced_at: new Date().toISOString(),
        });

        if (error) throw error;

        try {
          await offlineStorage.removeFromStore('offlineCheckIns', action.data.offlineId);
        } catch {
          // Best effort cleanup
        }
        break;
      }

      default:
        break;
    }
  }

  async cacheEssentialData(userId: string, companyId: string | null): Promise<void> {
    try {
      const [shiftsRes, sitesRes, checkpointsRes, guardsRes, patrolRoutesRes] = await Promise.all([
        supabase
          .from('shifts')
          .select('*, sites(name, address), profiles!shifts_guard_id_fkey(full_name)')
          .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),

        companyId
          ? supabase.from('sites').select('*').eq('company_id', companyId)
          : supabase.from('sites').select('*'),

        supabase.from('checkpoints').select('*, patrol_routes(name)'),

        companyId
          ? supabase.from('profiles').select('*').eq('company_id', companyId)
          : supabase.from('profiles').select('*'),

        companyId
          ? supabase.from('patrol_routes').select('*, sites(name)').eq('company_id', companyId).eq('is_active', true)
          : supabase.from('patrol_routes').select('*, sites(name)').eq('is_active', true),
      ]);

      if (shiftsRes.data) await offlineStorage.saveData('shifts', shiftsRes.data);
      if (sitesRes.data) await offlineStorage.saveData('sites', sitesRes.data);
      if (checkpointsRes.data) await offlineStorage.saveData('checkpoints', checkpointsRes.data);
      if (guardsRes.data) await offlineStorage.saveData('guards', guardsRes.data);
      if (patrolRoutesRes.data) await offlineStorage.saveData('patrolRoutes', patrolRoutesRes.data);

    } catch (error) {
      // Offline caching is best-effort
    }
  }
}

export const syncManager = new SyncManager();
