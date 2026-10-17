import type { PortalRecord, SeedRecord } from './types';

/** 存储适配器：便于单测注入内存实现，运行时使用 localStorage */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 内存存储（SSR / 单测 / localStorage 不可用时兜底） */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

/** 运行时存储：优先 localStorage，异常时降级为内存存储 */
export function defaultStorage(): StorageLike {
  try {
    const ls = typeof window !== 'undefined' ? window.localStorage : undefined;
    if (ls) {
      const probe = '__wb_probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return ls;
    }
  } catch {
    /* 忽略：隐私模式等场景下降级 */
  }
  return createMemoryStorage();
}

export interface ListQuery {
  keyword?: string;
  filters?: Record<string, any>;
  page?: number;
  pageSize?: number;
}

export interface ListResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RepositoryOptions {
  storage?: StorageLike;
  /** 关键字匹配限定字段；缺省匹配全部字段 */
  searchFields?: string[];
}

const STORAGE_PREFIX = 'portal-workbench:v1:';

/**
 * 模块级数据仓储：右侧内联增删改查的唯一数据出口。
 * 首次访问以模块 seed 初始化，之后按模块分键持久化到 localStorage。
 */
export class PortalRepository<T extends PortalRecord = PortalRecord> {
  private readonly storageKey: string;
  private readonly storage: StorageLike;
  private readonly searchFields?: string[];
  private rows: T[];

  constructor(readonly moduleKey: string, seed: SeedRecord[] = [], options: RepositoryOptions = {}) {
    this.storageKey = `${STORAGE_PREFIX}${moduleKey}`;
    this.storage = options.storage || defaultStorage();
    this.searchFields = options.searchFields;
    const restored = this.restore();
    this.rows = restored ?? seed.map((row, index) => ({ ...row, id: index + 1 }) as T);
    if (!restored) this.persist();
  }

  /** 条件查询：关键字 + 精确过滤 + 分页，按 id 倒序（最新在前） */
  list(query: ListQuery = {}): ListResult<T> {
    const { keyword = '', filters = {}, page = 1, pageSize = 10 } = query;
    const kw = keyword.trim().toLowerCase();
    const currentPage = Math.max(1, Number(page) || 1);
    const size = Math.max(1, Number(pageSize) || 10);

    const matched = this.rows.filter((row) => {
      if (kw) {
        const fields = this.searchFields?.length ? this.searchFields : Object.keys(row);
        const hit = fields.some((f) => String(row[f] ?? '').toLowerCase().includes(kw));
        if (!hit) return false;
      }
      return Object.entries(filters).every(([k, v]) => {
        if (v === undefined || v === null || v === '') return true;
        return String(row[k] ?? '') === String(v);
      });
    });

    const sorted = [...matched].sort((a, b) => b.id - a.id);
    const start = (currentPage - 1) * size;
    return { list: sorted.slice(start, start + size), total: sorted.length, page: currentPage, pageSize: size };
  }

  get(id: number): T | undefined {
    return this.rows.find((r) => r.id === id);
  }

  count(): number {
    return this.rows.length;
  }

  create(data: SeedRecord): T {
    const nextId = this.rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
    const row = { ...data, id: nextId } as T;
    this.rows = [...this.rows, row];
    this.persist();
    return row;
  }

  update(id: number, data: SeedRecord): T | undefined {
    const index = this.rows.findIndex((r) => r.id === id);
    if (index < 0) return undefined;
    const row = { ...this.rows[index], ...data, id } as T;
    this.rows = [...this.rows.slice(0, index), row, ...this.rows.slice(index + 1)];
    this.persist();
    return row;
  }

  remove(id: number): boolean {
    const next = this.rows.filter((r) => r.id !== id);
    if (next.length === this.rows.length) return false;
    this.rows = next;
    this.persist();
    return true;
  }

  /** 恢复种子数据 */
  reset(seed: SeedRecord[] = []): void {
    this.rows = seed.map((row, index) => ({ ...row, id: index + 1 }) as T);
    this.persist();
  }

  private restore(): T[] | undefined {
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : undefined;
    } catch {
      return undefined;
    }
  }

  private persist(): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.rows));
    } catch {
      /* 容量超限等场景不影响内存态运行 */
    }
  }
}