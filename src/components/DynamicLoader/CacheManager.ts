import type { MenuDTO, MenuCacheData, CacheConfig, APIResponse } from '@/types/menu';
import { DEFAULT_CACHE_CONFIG, CACHE_KEYS } from '@/types/menu';

class MenuCacheManager {
  private memoryCache: Map<string, { data: any; expiry: number }> = new Map();

  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  private isExpired(timestamp: number, ttl: number): boolean {
    return Date.now() - timestamp > ttl;
  }

  private isMemoryValid(key: string): boolean {
    const cached = this.memoryCache.get(key);
    if (!cached) return false;
    return !this.isExpired(cached.data.timestamp, this.config.memoryTTL);
  }

  private isLocalValid(): boolean {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.MENU_CACHE);
      if (!cached) return false;
      const data: MenuCacheData = JSON.parse(cached);
      return !this.isExpired(data.timestamp, this.config.localTTL);
    } catch {
      return false;
    }
  }

  getMenuDataFromMemory(): MenuDTO[] | null {
    if (!this.isMemoryValid(CACHE_KEYS.MENU_CACHE)) {
      return null;
    }
    const cached = this.memoryCache.get(CACHE_KEYS.MENU_CACHE);
    return cached?.data.data || null;
  }

  setMenuDataToMemory(menuData: MenuDTO[]): void {
    this.memoryCache.set(CACHE_KEYS.MENU_CACHE, {
      data: {
        data: menuData,
        timestamp: Date.now(),
        version: this.getLocalVersion(),
      },
      expiry: Date.now() + this.config.memoryTTL,
    });
  }

  getMenuDataFromLocal(): MenuDTO[] | null {
    if (!this.isLocalValid()) {
      this.clearLocal();
      return null;
    }
    try {
      const cached = localStorage.getItem(CACHE_KEYS.MENU_CACHE);
      if (!cached) return null;
      const data: MenuCacheData = JSON.parse(cached);
      return data.data;
    } catch {
      this.clearLocal();
      return null;
    }
  }

  setMenuDataToLocal(menuData: MenuDTO[], version?: string): void {
    const cacheData: MenuCacheData = {
      data: menuData,
      version: version || this.generateVersion(),
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(CACHE_KEYS.MENU_CACHE, JSON.stringify(cacheData));
      if (version) {
        localStorage.setItem(CACHE_KEYS.MENU_VERSION, version);
      }
    } catch (e) {
      console.error('Failed to save menu to localStorage:', e);
    }
  }

  getLocalVersion(): string | null {
    try {
      return localStorage.getItem(CACHE_KEYS.MENU_VERSION);
    } catch {
      return null;
    }
  }

  private generateVersion(): string {
    return `v${Date.now()}`;
  }

  async fetchMenuData(
    apiFunc: () => Promise<APIResponse<MenuDTO[]>>,
    forceRefresh = false
  ): Promise<MenuDTO[]> {
    if (!forceRefresh) {
      const memoryData = this.getMenuDataFromMemory();
      if (memoryData) {
        console.log('[CacheManager] Using memory cache');
        return memoryData;
      }

      const localData = this.getMenuDataFromLocal();
      if (localData) {
        console.log('[CacheManager] Using local cache, setting to memory');
        this.setMenuDataToMemory(localData);
        return localData;
      }
    }

    console.log('[CacheManager] Fetching from API');
    try {
      const response = await apiFunc();
      if (response.code === 200 && response.data) {
        const menuData = response.data;
        this.setMenuDataToMemory(menuData);
        this.setMenuDataToLocal(menuData);
        return menuData;
      }
      throw new Error(response.msg || 'Failed to fetch menu data');
    } catch (error) {
      console.error('[CacheManager] Fetch failed:', error);
      const localData = this.getMenuDataFromLocal();
      if (localData) {
        console.log('[CacheManager] Falling back to local cache after error');
        return localData;
      }
      throw error;
    }
  }

  invalidateCache(): void {
    this.memoryCache.delete(CACHE_KEYS.MENU_CACHE);
    this.clearLocal();
    console.log('[CacheManager] Cache invalidated');
  }

  clearMemory(): void {
    this.memoryCache.clear();
  }

  clearLocal(): void {
    try {
      localStorage.removeItem(CACHE_KEYS.MENU_CACHE);
      localStorage.removeItem(CACHE_KEYS.MENU_VERSION);
      localStorage.removeItem(CACHE_KEYS.COMPONENT_MAP);
    } catch (e) {
      console.error('Failed to clear local cache:', e);
    }
  }

  getCacheStatus(): { memory: boolean; local: boolean; version: string | null } {
    return {
      memory: this.isMemoryValid(CACHE_KEYS.MENU_CACHE),
      local: this.isLocalValid(),
      version: this.getLocalVersion(),
    };
  }
}

export const menuCacheManager = new MenuCacheManager();

export default MenuCacheManager;
