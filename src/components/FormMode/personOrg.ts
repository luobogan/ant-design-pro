import { pickPayload } from '@/utils/utils';

/**
 * 把接口返回统一剥成数组。
 * 兼容：① 普通数组 ② MyBatis Plus 分页对象 IPage（取 .records）③ 被 .data 包一层 ④ 空/异常。
 */
function extractList(res: any): any[] {
  const p = pickPayload(res);
  if (Array.isArray(p)) return p;
  if (p && Array.isArray(p.records)) return p.records;
  return [];
}
import * as userApi from '@/services/system/user';
import * as deptApi from '@/services/system/dept';
import * as roleApi from '@/services/authority/role';
import * as positionApi from '@/services/system/position';

/**
 * 统一「人员与组织」浏览框数据层（对齐 ecology BrowserBean）。
 *
 * 覆盖 6 类业务字段：操作者 / 指定人（人员）、指定部门、指定分部、指定角色、指定岗位。
 *
 * 数据源采用 blade-system 既有接口（真实数据，非 mock）：
 *  · 人员：GET /api/blade-system/user/list（分页拉全量，本地过滤）
 *  · 部门：GET /api/blade-system/dept/tree（含 children）
 *  · 角色：GET /api/blade-system/role/list
 *  · 岗位：GET /api/blade-system/post/list
 *  · 分部：blade 无独立分部体系 → 取部门树根节点（与流程设计器操作者一致）
 *
 * 值格式与 E9 完全一致：**id 逗号串**（隐藏域存值），显示时按 id → name 反查；
 * 反查不到时原样回退（兼容历史存的是名称串的数据）。
 */

// ==================== 类型元信息 ====================

export type PersonOrgCategory = 'hrm' | 'dept' | 'branch' | 'role' | 'post';

export interface PersonOrgItem {
  /** 主键（字符串，雪花 ID 防精度丢失） */
  id: string;
  /** 显示名 */
  name: string;
  /** 编码（账号/部门编码/角色别名等） */
  code?: string;
  /** 附加描述（部门·角色 等） */
  desc?: string;
  /** 所属部门 id（人员用，逗号串） */
  deptId?: string;
  raw?: any;
}

export interface BrowserTypeMeta {
  /** 浏览按钮类型（对齐 ecology 35+ 类型编号） */
  browserType: number;
  label: string;
  category: PersonOrgCategory;
  /** 是否多选 */
  multiple: boolean;
  /** 是否提供左侧分类树（人员/部门/分部提供） */
  tree: boolean;
}

/** 支持的浏览按钮类型表（对齐 BrowserButtonPreview 的编号；未列出的类型视为暂未实现） */
export const BROWSER_TYPE_META: Record<number, BrowserTypeMeta> = {
  // 人员类
  1: { browserType: 1, label: '人力资源', category: 'hrm', multiple: true, tree: true },
  161: { browserType: 161, label: '多人力资源', category: 'hrm', multiple: true, tree: true },
  166: { browserType: 166, label: '角色人员', category: 'hrm', multiple: true, tree: true },
  167: { browserType: 167, label: '分权单人力资源', category: 'hrm', multiple: false, tree: true },
  168: { browserType: 168, label: '分权多人力资源', category: 'hrm', multiple: true, tree: true },
  // 组织类
  2: { browserType: 2, label: '部门', category: 'dept', multiple: true, tree: true },
  17: { browserType: 17, label: '多部门', category: 'dept', multiple: true, tree: true },
  19: { browserType: 19, label: '分权单部门', category: 'dept', multiple: false, tree: true },
  20: { browserType: 20, label: '分权多部门', category: 'dept', multiple: true, tree: true },
  18: { browserType: 18, label: '分部', category: 'branch', multiple: true, tree: true },
  21: { browserType: 21, label: '分权单分部', category: 'branch', multiple: false, tree: true },
  22: { browserType: 22, label: '分权多分部', category: 'branch', multiple: true, tree: true },
  23: { browserType: 23, label: '多分部', category: 'branch', multiple: true, tree: true },
  // 角色 / 岗位
  3: { browserType: 3, label: '角色', category: 'role', multiple: true, tree: false },
  163: { browserType: 163, label: '多角色', category: 'role', multiple: true, tree: false },
  4: { browserType: 4, label: '岗位', category: 'post', multiple: true, tree: false },
};

/**
 * 表单字段（fieldhtmltype=2 浏览按钮）的 type 映射到浏览按钮编号。
 * 注意：这是字段定义的 10 类编号（1人力资源 2部门 3角色 4资产 5客户 6项目 7文档 8流程 9自定义），
 * 与浏览按钮 35+ 编号不是同一空间，仅前 3 项有对应实现。
 */
const FIELD_TYPE_TO_BROWSER: Record<number, number> = {
  1: 1, // 人力资源
  2: 2, // 部门
  3: 3, // 角色
};

/** 业务字段语义 → 浏览按钮类型（操作者/指定人/指定部门/指定分部/指定角色/指定岗位） */
export const FIELD_SEMANTIC_TO_BROWSER: Record<string, number> = {
  operator: 1, // 操作者（人员）
  user: 1, // 指定人
  hrm: 1,
  dept: 2, // 指定部门
  branch: 18, // 指定分部
  role: 3, // 指定角色
  post: 4, // 指定岗位
};

/** 解析字段对应的浏览按钮元信息；无法识别时返回 undefined（调用方降级展示） */
export function resolveBrowserMeta(fieldType?: any, browType?: any): BrowserTypeMeta | undefined {
  const bt = Number(browType);
  if (bt && BROWSER_TYPE_META[bt]) return BROWSER_TYPE_META[bt];
  const mapped = FIELD_TYPE_TO_BROWSER[Number(fieldType)];
  return mapped ? BROWSER_TYPE_META[mapped] : undefined;
}

// ==================== 值工具（E9 数据格式：id 逗号串） ====================

/** 归一化字段值 → id 数组（兼容 逗号串 / 数组 / 数字） */
export function splitIds(value: any): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinIds(ids: string[]): string {
  return ids.filter(Boolean).join(',');
}

// ==================== 数据源（模块级缓存 + 并发去重） ====================

interface OrgData {
  users: PersonOrgItem[];
  depts: PersonOrgItem[];
  deptTree: any[];
  roles: PersonOrgItem[];
  posts: PersonOrgItem[];
  /** 各数据源加载是否失败（失败时 UI 降级提示） */
  errors: string[];
}

const cache: Partial<OrgData> = {};
let inflight: Promise<OrgData> | null = null;
/** 仅当四类数据全部成功取到（非空）才置位，避免「首次被权限拦截→永久缓存空数据」 */
let loaded = false;

const PAGE_SIZE = 1000;

/** 人员：分页拉全量（本地过滤 + 分类树过滤，避免依赖后端检索参数差异） */
async function fetchAllUsers(): Promise<PersonOrgItem[]> {
  const all: any[] = [];
  for (let current = 1; current <= 10; current += 1) {
    const res: any = await userApi.list({ current, size: PAGE_SIZE });
    const payload = pickPayload(res);
    const records: any[] = Array.isArray(payload) ? payload : payload?.records || [];
    all.push(...records);
    const total = Number(payload?.total ?? all.length);
    if (records.length < PAGE_SIZE || all.length >= total) break;
  }
  return all
    .filter((u) => u && u.id != null)
    .map((u) => ({
      id: String(u.id),
      name: u.realName || u.name || u.account || String(u.id),
      code: u.account || '',
      desc: [u.deptName, u.roleName].filter(Boolean).join(' · '),
      deptId: u.deptId != null ? String(u.deptId) : '',
      raw: u,
    }));
}

/** 部门树 → 扁平列表（含完整树结构用于分类树） */
function normalizeDeptTree(list: any[]): { flat: PersonOrgItem[]; tree: any[] } {
  const flat: PersonOrgItem[] = [];
  const conv = (arr: any[]): any[] =>
    (arr || []).map((d) => {
      const id = d?.id != null ? String(d.id) : '';
      const name = d?.deptName || d?.title || d?.name || id;
      if (id) flat.push({ id, name, code: d?.deptCode || d?.code || '', desc: d?.fullName || '', raw: d });
      const children = Array.isArray(d?.children) && d.children.length ? conv(d.children) : undefined;
      return { key: id, title: name, children, raw: d };
    });
  return { flat, tree: conv(list || []) };
}

async function fetchAll(): Promise<OrgData> {
  const errors: string[] = [];
  const [usersR, deptR, roleR, postR] = await Promise.allSettled([
    fetchAllUsers(),
    deptApi.tree({}).then((r: any) => extractList(r)),
    roleApi.list({}).then((r: any) => extractList(r)),
    positionApi.list({}).then((r: any) => extractList(r)),
  ]);

  let users: PersonOrgItem[] = [];
  if (usersR.status === 'fulfilled') users = usersR.value;
  else {
    errors.push('人员数据加载失败（用户列表接口需要管理员权限）');
    console.warn('[personOrg] 人员数据加载失败:', usersR.reason);
  }

  let depts: PersonOrgItem[] = [];
  let deptTree: any[] = [];
  if (deptR.status === 'fulfilled') {
    const norm = normalizeDeptTree(deptR.value as any[]);
    depts = norm.flat;
    deptTree = norm.tree;
  } else {
    errors.push('部门数据加载失败');
    console.warn('[personOrg] 部门数据加载失败:', deptR.reason);
  }

  let roles: PersonOrgItem[] = [];
  if (roleR.status === 'fulfilled') {
    roles = ((roleR.value as any[]) || [])
      .filter((r) => r && r.id != null)
      .map((r) => ({
        id: String(r.id),
        name: r.roleName || r.roleAlias || String(r.id),
        code: r.roleAlias || '',
        desc: r.remark || '',
        raw: r,
      }));
  } else {
    errors.push('角色数据加载失败');
    console.warn('[personOrg] 角色数据加载失败:', roleR.reason);
  }

  let posts: PersonOrgItem[] = [];
  if (postR.status === 'fulfilled') {
    posts = ((postR.value as any[]) || [])
      .filter((p) => p && p.id != null)
      .map((p) => ({
        id: String(p.id),
        name: p.postName || p.name || p.postCode || String(p.id),
        code: p.postCode || p.code || '',
        desc: p.remark || '',
        raw: p,
      }));
  } else {
    errors.push('岗位数据加载失败');
    console.warn('[personOrg] 岗位数据加载失败:', postR.reason);
  }

  Object.assign(cache, { users, depts, deptTree, roles, posts, errors } satisfies OrgData);
  // 四类数据全部非空才标记已加载，否则下次打开重新拉取（不把失败缓存成空）
  if (users.length && depts.length && roles.length && posts.length) {
    loaded = true;
  }
  return cache as OrgData;
}

/** 加载（或取缓存）全部人员与组织数据 */
export function loadPersonOrgData(): Promise<OrgData> {
  if (loaded && cache.users && cache.depts && cache.roles && cache.posts) {
    return Promise.resolve(cache as OrgData);
  }
  if (!inflight) {
    inflight = fetchAll().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** 清空缓存（如后台新增了用户/部门后可调用刷新） */
export function clearPersonOrgCache() {
  (Object.keys(cache) as (keyof OrgData)[]).forEach((k) => delete cache[k]);
  loaded = false;
}

/** 按类别取候选列表 */
export function itemsOfCategory(data: OrgData, category: PersonOrgCategory): PersonOrgItem[] {
  switch (category) {
    case 'hrm':
      return data.users;
    case 'dept':
      return data.depts;
    case 'branch':
      // 分部 = 部门树根节点
      return data.depts.filter((d) => {
        const parentId = d.raw?.parentId;
        return parentId == null || parentId === '0' || parentId === 0;
      });
    case 'role':
      return data.roles;
    case 'post':
      return data.posts;
    default:
      return [];
  }
}

/** 取某部门的全部子孙部门 id（含自身），用于「含下级」过滤 */
export function collectDeptIds(tree: any[], rootId: string, acc: Set<string> = new Set()): Set<string> {
  const walk = (nodes: any[]) => {
    (nodes || []).forEach((n) => {
      if (String(n.key) === rootId) {
        const gather = (x: any) => {
          acc.add(String(x.key));
          (x.children || []).forEach(gather);
        };
        gather(n);
      } else if (n.children?.length) {
        walk(n.children);
      }
    });
  };
  walk(tree);
  if (!acc.size && rootId) acc.add(rootId);
  return acc;
}

/** 解析 id → 显示名（用于字段回显 / 只读展示） */
export async function resolveItemNames(
  category: PersonOrgCategory,
  ids: string[],
): Promise<{ id: string; name: string }[]> {
  if (!ids.length) return [];
  try {
    const data = await loadPersonOrgData();
    const list = itemsOfCategory(data, category);
    const map = new Map(list.map((i) => [i.id, i.name]));
    return ids.map((id) => ({ id, name: map.get(id) || id }));
  } catch {
    return ids.map((id) => ({ id, name: id }));
  }
}
