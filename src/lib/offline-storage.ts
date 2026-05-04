const DB_NAME = 'ralph-offline';
const DB_VERSION = 1;

interface EvaluationRecord {
  'repo.fullName': string;
  data: unknown;
  timestamp: number;
}

interface FavoriteRecord {
  fullName: string;
  timestamp: number;
}

interface SearchHistoryRecord {
  timestamp: number;
  query: string;
  resultCount: number;
}

type StoreNames = 'evaluations' | 'favorites' | 'searchHistory';

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('evaluations')) {
          db.createObjectStore('evaluations', { keyPath: 'repo.fullName' });
        }
        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites', { keyPath: 'fullName' });
        }
        if (!db.objectStoreNames.contains('searchHistory')) {
          db.createObjectStore('searchHistory', { keyPath: 'timestamp' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });

    return this.initPromise;
  }

  private async getStore(mode: IDBTransactionMode, storeName: StoreNames): Promise<IDBObjectStore> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  async saveEvaluation(data: Record<string, unknown>): Promise<void> {
    const store = await this.getStore('readwrite', 'evaluations');
    const record = { ...data, timestamp: Date.now() } as EvaluationRecord;
    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getEvaluation(fullName: string): Promise<Record<string, unknown> | null> {
    const store = await this.getStore('readonly', 'evaluations');
    return new Promise((resolve, reject) => {
      const request = store.get(fullName);
      request.onsuccess = () => resolve(request.result?.data || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllEvaluations(): Promise<Record<string, unknown>[]> {
    const store = await this.getStore('readonly', 'evaluations');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result?.map((r: EvaluationRecord) => r.data as Record<string, unknown>) || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteEvaluation(fullName: string): Promise<void> {
    const store = await this.getStore('readwrite', 'evaluations');
    return new Promise((resolve, reject) => {
      const request = store.delete(fullName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async addFavorite(fullName: string): Promise<void> {
    const store = await this.getStore('readwrite', 'favorites');
    const record: FavoriteRecord = { fullName, timestamp: Date.now() };
    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async removeFavorite(fullName: string): Promise<void> {
    const store = await this.getStore('readwrite', 'favorites');
    return new Promise((resolve, reject) => {
      const request = store.delete(fullName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFavorites(): Promise<string[]> {
    const store = await this.getStore('readonly', 'favorites');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result?.map((r: FavoriteRecord) => r.fullName) || []);
      request.onerror = () => reject(request.error);
    });
  }

  async addSearchHistory(query: string, resultCount: number): Promise<void> {
    const store = await this.getStore('readwrite', 'searchHistory');
    const record: SearchHistoryRecord = { timestamp: Date.now(), query, resultCount };
    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSearchHistory(limit: number = 50): Promise<SearchHistoryRecord[]> {
    const store = await this.getStore('readonly', 'searchHistory');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = (request.result as SearchHistoryRecord[] || [])
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    const stores: StoreNames[] = ['evaluations', 'favorites', 'searchHistory'];
    for (const storeName of stores) {
      const store = await this.getStore('readwrite', storeName);
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}

export const offlineStorage = new OfflineStorage();
export type { EvaluationRecord, FavoriteRecord, SearchHistoryRecord };
