interface QueuedAction {
  id: string;
  type: 'shift_update' | 'incident_create' | 'checkin_create' | 'sos_alert' | 'patrol_scan';
  data: any;
  timestamp: number;
  retryCount: number;
}

class OfflineStorage {
  private dbName = 'securecommand-offline';
  private version = 2;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('shifts')) {
          db.createObjectStore('shifts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('incidents')) {
          db.createObjectStore('incidents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('checkpoints')) {
          db.createObjectStore('checkpoints', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sites')) {
          db.createObjectStore('sites', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('guards')) {
          db.createObjectStore('guards', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('actionQueue')) {
          const store = db.createObjectStore('actionQueue', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('patrolRoutes')) {
          db.createObjectStore('patrolRoutes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('offlineCheckIns')) {
          db.createObjectStore('offlineCheckIns', { keyPath: 'id' });
        }
      };
    });
  }

  async saveData(storeName: string, data: any[]): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      data.forEach(item => store.put(item));
    });
  }

  async getData(storeName: string): Promise<any[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async queueAction(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    if (!this.db) await this.init();

    const queuedAction: QueuedAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['actionQueue'], 'readwrite');
      const store = transaction.objectStore('actionQueue');
      const request = store.add(queuedAction);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getQueuedActions(): Promise<QueuedAction[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['actionQueue'], 'readonly');
      const store = transaction.objectStore('actionQueue');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removeQueuedAction(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['actionQueue'], 'readwrite');
      const store = transaction.objectStore('actionQueue');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateQueuedAction(action: QueuedAction): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['actionQueue'], 'readwrite');
      const store = transaction.objectStore('actionQueue');
      const request = store.put(action);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromStore(storeName: string, id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearStore(storeName: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();
