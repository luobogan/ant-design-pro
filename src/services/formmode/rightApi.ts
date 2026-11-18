import { request } from '@umijs/max';

const API_BASE_PATH = '/api/blade-formmode';

/**
 * 模块权限项（对应 moderightinfo）。
 *
 * ⚠️ 编码坑：本表 objtype 用「1角色 2部门 3岗位 4人员」，与 modedatasharerule
 * 的「1人员 2部门 3角色 4岗位」两套编码不同，前端下拉选项必须分别定义。
 */
export interface ModeRightInfo {
  id?: number | string;
  modeid?: number | string;
  /** 权限类型：1可见 2新建 3编辑 4删除 5详情 6导入 7导出 */
  righttype?: number;
  /** 授权对象类型：1角色 2部门 3岗位 4人员 5分部 */
  objtype?: number;
  objid?: number;
  objname?: string;
  /** 是否含子级：1是 0否 */
  includesub?: number;
  /** 密级下限（E9 showlevel，0~100） */
  showlevel?: number;
  /** 密级上限（E9 showlevel2，NULL=不封顶） */
  showlevel2?: number;
  tenantId?: string;
}

/**
 * 字段授权项（对应 modefieldauthorize）。
 * objtype 编码同 moderightinfo（1角色 2部门 3岗位 4人员）。
 */
export interface ModeFieldAuthorize {
  id?: number | string;
  modeid?: number | string;
  /** 字段ID（workflow_billfield.id） */
  fieldid?: number;
  /** 授权对象类型：1角色 2部门 3岗位 4人员 5分部 */
  objtype?: number;
  objid?: number;
  /** 授权部门是否含子部门：1是 0否（仅 objtype=2 有效） */
  includesub?: number;
  /** 权限：1可见 2可编辑 */
  rightvalue?: number;
  tenantId?: string;
}

/**
 * 数据范围共享规则（对应 modedatasharerule）。
 * objtype 编码（2026-10-20 已统一）：1角色 2部门 3岗位 4人员。
 */
export interface ModeDataShareRule {
  id?: number | string;
  modeid?: number | string;
  /** 权限类型：1查看 2维护 */
  type?: number;
  /** 授权对象类型：1角色 2部门 3岗位 4人员 5分部 */
  objtype?: number;
  /** 授权对象ID */
  objid?: number;
  /** 是否含子级：1是 0否 */
  includeSub?: number;
  /** 仅本人创建的数据可见（与共享叠加）：1是 0否 */
  creatorSelf?: number;
  /** 条件化授权：启用开关 1是 0否 */
  conditionEnabled?: number;
  /** 条件化授权：条件字段（数据库列名） */
  conditionField?: string;
  /** 条件化授权：操作符 eq/ne/gt/ge/lt/le/like/in */
  conditionOp?: string;
  /** 条件化授权：条件值（in 用逗号分隔） */
  conditionValue?: string;
  /** 矩阵主体（objtype=7）：矩阵结果字段名 */
  matrixValueField?: string;
  /** 密级下限（E9 showlevel，0~100） */
  showlevel?: number;
  /** 密级上限（E9 showlevel2，NULL=不封顶） */
  showlevel2?: number;
  tenantId?: string;
}

/** 由表单ID反查模块ID（modeinfo.id）；无模块返回 null */
export const resolveModeId = async (formId: string | number): Promise<number | null> => {
  try {
    const res: any = await request(`${API_BASE_PATH}/right/resolve-mode/${formId}`, { method: 'GET' });
    const data = res?.data;
    // ⚠️ 兜底：线上后端在「无模块」时返回的是空对象 {}（而非 Long 或 null），
    // 若直接把 {} 当 modeId 拼进 URL → /right/mode/[object Object]（400）。
    // 仅当返回值为有限数字时才视为有效 moduleId，其余一律视为「无模块」。
    if (data == null || typeof data === 'object') return null;
    const num = Number(data);
    return Number.isFinite(num) ? num : null;
  } catch (e) {
    return null;
  }
};

/** 获取模块权限 */
export const getModeRights = async (modeId: string | number): Promise<ModeRightInfo[]> => {
  const res: any = await request(`${API_BASE_PATH}/right/mode/${modeId}`, { method: 'GET' });
  return Array.isArray(res?.data) ? res.data : [];
};

/** 保存模块权限（全量替换） */
export const saveModeRights = async (modeId: string | number, rights: ModeRightInfo[]): Promise<boolean> => {
  const res: any = await request(`${API_BASE_PATH}/right/mode/${modeId}`, { method: 'POST', data: rights });
  return !!res?.success;
};

/** 获取字段权限 */
export const getFieldAuthorizes = async (modeId: string | number): Promise<ModeFieldAuthorize[]> => {
  const res: any = await request(`${API_BASE_PATH}/right/field/${modeId}`, { method: 'GET' });
  return Array.isArray(res?.data) ? res.data : [];
};

/** 保存字段权限（全量替换） */
export const saveFieldAuthorizes = async (modeId: string | number, auths: ModeFieldAuthorize[]): Promise<boolean> => {
  const res: any = await request(`${API_BASE_PATH}/right/field/${modeId}`, { method: 'POST', data: auths });
  return !!res?.success;
};

/** 获取数据范围规则 */
export const getModeDataScopes = async (modeId: string | number): Promise<ModeDataShareRule[]> => {
  const res: any = await request(`${API_BASE_PATH}/right/scope/${modeId}`, { method: 'GET' });
  return Array.isArray(res?.data) ? res.data : [];
};

/** 保存数据范围规则（全量替换） */
export const saveModeDataScopes = async (modeId: string | number, rules: ModeDataShareRule[]): Promise<boolean> => {
  const res: any = await request(`${API_BASE_PATH}/right/scope/${modeId}`, { method: 'POST', data: rules });
  return !!res?.success;
};

/**
 * 一次性保存模块权限 + 字段权限 + 数据范围（后端单事务）。
 *
 * 替代前端 Promise.all 并发调三个独立接口，避免跨表不一致中间态。
 */
export const saveAllRights = async (
  modeId: string | number,
  batch: {
    rights: ModeRightInfo[];
    fieldAuthorizes: ModeFieldAuthorize[];
    dataScopes: ModeDataShareRule[];
    expectedVersion?: number | null;
  },
): Promise<boolean> => {
  const res: any = await request(`${API_BASE_PATH}/right/all/${modeId}`, { method: 'POST', data: batch });
  return !!res?.success;
};

/**
 * 查询当前用户对某表单的模块操作权限码（1可见 2新建 3编辑 4删除 5详情）。
 * 供通用列表按建模权限驱动操作按钮；失败返回空数组（菜单按钮体系继续工作）。
 */
export const getUserRightTypes = async (formId: string | number): Promise<number[]> => {
  try {
    const res: any = await request(`${API_BASE_PATH}/right/user-right-types/${formId}`, { method: 'GET' });
    return Array.isArray(res?.data) ? res.data.map(Number) : [];
  } catch (_e) {
    return [];
  }
};

/** 读取权限配置当前版本号（乐观锁），保存时作为 expectedVersion 带回 */
export const getRightVersion = async (modeId: string | number): Promise<number> => {
  const res: any = await request(`${API_BASE_PATH}/right/version/${modeId}`, { method: 'GET' });
  return Number(res?.data ?? 0);
};
