import { supabase } from './supabase';
import { offlineStorage } from './offlineStorage';

class SyncManager {
  private syncInterval: number | null = null;
  private isSyncing = false;

  startAutoSync(intervalMs: number = 30000): void {
    if (this.syncInterval) return;

    this.syncInterval = window.setInterval(() => {
      this.syncQueuedActions();
    }, intervalMs);

    window.addEventListener('online', () => {
      console.log('Back online - syncing queued actions');
      this.syncQueuedActions();
    });
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
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
          console.log(`Synced action ${action.type}:`, action.id);
        } catch (error) {
          console.error(`Failed to sync action ${action.id}:`, error);

          action.retryCount++;
          if (action.retryCount > 5) {
            console.error(`Action ${action.id} exceeded retry limit, removing from queue`);
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

      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  async cacheEssentialData(userId: string, companyId: string | null): Promise<void> {
    try {
      const [shiftsRes, sitesRes, checkpointsRes, guardsRes] = await Promise.all([
        supabase
          .from('shifts')
          .select('*, sites(name, address), profiles(full_name)')
          .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),

        companyId
          ? supabase.from('sites').select('*').eq('company_id', companyId)
          : supabase.from('sites').select('*'),

        supabase.from('checkpoints').select('*, patrol_routes(name)'),

        companyId
          ? supabase.from('profiles').select('*').eq('company_id', companyId)
          : supabase.from('profiles').select('*'),
      ]);

      if (shiftsRes.data) await offlineStorage.saveData('shifts', shiftsRes.data);
      if (sitesRes.data) await offlineStorage.saveData('sites', sitesRes.data);
      if (checkpointsRes.data) await offlineStorage.saveData('checkpoints', checkpointsRes.data);
      if (guardsRes.data) await offlineStorage.saveData('guards', guardsRes.data);

      console.log('Essential data cached for offline use');
    } catch (error) {
      console.error('Error caching essential data:', error);
    }
  }
}

export const syncManager = new SyncManager();
