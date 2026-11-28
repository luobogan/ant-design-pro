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
  objid?: number | string;
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
  objid?: number | string;
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
  /** 授权对象ID，统一按字符串处理以兼容雪花 ID */
  objid?: number | string;
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
export const resolveModeId = async (formId: string | number): Promise<string | null> => {
  try {
    const res: any = await request(`${API_BASE_PATH}/right/resolve-mode/${formId}`, { method: 'GET' });
    const data = res?.data;
    // ⚠️ modeId 是雪花ID（19位），JS Number 会丢精度，必须保持字符串透传。
    // 后端「无模块」时可能返回空对象 {} 或 null，均视为无模块。
    if (data == null || typeof data === 'object' || String(data).trim() === '') return null;
    return String(data);
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

export interface FieldAuthGroupSubjectVO {
  objtype: number;
  objid: number | string;
  includesub?: number;
}

export interface FieldAuthGroupVO {
  id?: string;
  groupName?: string;
  /** 稳定组标识，作为 Univer 布局 nodeKey */
  groupKey?: string;
  subjects: FieldAuthGroupSubjectVO[];
  fields: Array<{ fieldId: number; rightvalue: 0 | 1 | 2 }>;
}

/** 查询字段权限授权对象组（多选对象共享一份字段权限） */
export const getFieldAuthGroups = async (modeId: string | number): Promise<FieldAuthGroupVO[]> => {
  const res: any = await request(`${API_BASE_PATH}/right/field/groups/${modeId}`, { method: 'GET' });
  const rows = Array.isArray(res?.data) ? res.data : [];
  return rows.map((g: any) => ({
    id: g.id == null ? undefined : String(g.id),
    groupName: g.group_name || g.groupName || '',
    groupKey: g.group_key || g.groupKey || (g.id != null ? `group-${g.id}` : undefined),
    subjects: Array.isArray(g.subjects) ? g.subjects.map((s: any) => ({
      objtype: Number(s.objtype),
      objid: String(s.objid),
      includesub: Number(s.includesub || 0),
    })) : [],
    fields: Array.isArray(g.fields) ? g.fields.map((f: any) => ({
      fieldId: Number(f.fieldId ?? f.fieldid),
      rightvalue: Number(f.rightvalue) as 0 | 1 | 2,
    })) : [],
  }));
};

/** 保存字段权限（全量替换） */
export const saveFieldAuthorizes = async (modeId: string | number, auths: ModeFieldAuthorize[]): Promise<boolean> => {
  const res: any = await request(`${API_BASE_PATH}/right/field/${modeId}`, { method: 'POST', data: auths });
  return !!res?.success;
};

/** 按主体字段权限保存请求（所有雪花ID用字符串） */
export interface FieldSubjectSavePayload {
  objtype: number;
  objid: string;
  tenantId?: string;
  modeVersions?: Record<string, number>;
  modes: Array<{
    modeId: string;
    formId?: string;
    fields: Array<{ fieldId: number; rightvalue: 0 | 1 | 2 }>;
  }>;
}

/** 按主体查询跨模块字段权限 */
export const getFieldAuthorizesBySubject = async (
  objtype: number,
  objid: string | number,
): Promise<ModeFieldAuthorize[]> => {
  const res: any = await request(`${API_BASE_PATH}/right/field/subject`, {
    method: 'GET',
    params: { objtype, objid: String(objid) },
  });
  return Array.isArray(res?.data) ? res.data : [];
};

/** 按主体差异保存跨模块字段权限 */
export const saveFieldAuthorizesBySubject = async (payload: FieldSubjectSavePayload): Promise<boolean> => {
  const res: any = await request(`${API_BASE_PATH}/right/field/subject/batch`, {
    method: 'PUT',
    data: payload,
  });
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

/** 系统菜单可见范围：1角色 2人员 3部门 4分部 5岗位 6安全级别 7全员 */
export interface MenuShare {
  id?: string;
  menuId?: string;
  shareType: number;
  shareId?: string;
  includeSub?: number;
  showlevel?: number;
  showlevel2?: number;
}

/** 按模块查询表单数据菜单可见范围 */
export const getFormMenuShares = async (modeId: string | number): Promise<MenuShare[]> => {
  try {
    const res: any = await request(`${API_BASE_PATH}/right/menu-shares/${modeId}`, { method: 'GET' });
    return Array.isArray(res?.data) ? res.data : [];
  } catch {
    return [];
  }
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
    fieldGroups?: FieldAuthGroupVO[];
    dataScopes: ModeDataShareRule[];
    expectedVersion?: number | null;
    /** 是否同步授权「表单数据」菜单给模块权限中配置的角色（默认 true） */
    grantMenuAccess?: boolean;
    /** 方案C：一表单一菜单 */
    formId?: string;
    formMenuName?: string;
    roleMenuNames?: Record<string, string>;
    menuShares?: MenuShare[];
  },
): Promise<boolean> => {
  const res: any = await request(`${API_BASE_PATH}/right/all/${modeId}`, { method: 'POST', data: batch });
  return !!res?.success;
};

/** 授权方案：一个方案对应一个授权对象 */
export interface AuthScheme {
  id?: string;
  formId?: string;
  schemeName?: string;
  subjectType: number;
  subjectId?: string;
  subjectName?: string;
  includeSub?: number;
  matrixValueField?: string;
  showlevel?: number;
  showlevel2?: number;
  priority?: number;
  rights?: Array<{ id?: string; righttype: number; objname?: string; includesub?: number; showlevel?: number; showlevel2?: number }>;
  fieldGroups?: Array<{ id?: string; groupKey?: string; sourceGroupKey?: string; groupName?: string; fields?: Array<{ fieldId: string; rightvalue: 0 | 1 | 2 }> }>;
  dataScopes?: Array<{
    id?: string; type?: number; objtype?: number; objid?: string; includeSub?: number; creatorSelf?: number;
    conditionField?: string; conditionOp?: string; conditionValue?: string; conditionEnabled?: number;
    matrixValueField?: string; showlevel?: number; showlevel2?: number;
    scopeType?: number; scopeColumn?: string; scopeValue?: string;
    rightTypes?: number[];
    subjects?: Array<{ objtype: number; objid?: string; includeSub?: number }>;
  }>;
  formManageScope?: { scopeType?: number; scopeValue?: string };
  menu?: {
    menuId?: string;
    formMenuName?: string;
    parentId?: string;
    menuPath?: string;
    menuIcon?: string;
    menuAlias?: string;
    menuSort?: number;
    menuStatus?: number;
    menuShares?: MenuShare[];
    roleMenuNames?: Record<string, string>;
  };
}

export const listAuthSchemes = async (formId: string | number): Promise<AuthScheme[]> => {
  const res: any = await request(`${API_BASE_PATH}/right/schemes/${formId}`, { method: 'GET' });
  return Array.isArray(res?.data) ? res.data : [];
};

export const getAuthScheme = async (schemeId: string | number): Promise<AuthScheme | null> => {
  const res: any = await request(`${API_BASE_PATH}/right/scheme/${schemeId}`, { method: 'GET' });
  return res?.data || null;
};

export const saveAuthScheme = async (scheme: AuthScheme): Promise<string> => {
  const res: any = await request(`${API_BASE_PATH}/right/scheme/save`, { method: 'POST', data: scheme });
  if (!res?.success) throw new Error(res?.msg || '授权方案保存失败');
  return String(res.data);
};

export const copyAuthScheme = async (schemeId: string | number): Promise<string> => {
  const res: any = await request(`${API_BASE_PATH}/right/scheme/copy/${schemeId}`, { method: 'POST' });
  if (!res?.success) throw new Error(res?.msg || '授权方案复制失败');
  return String(res.data);
};

export const deleteAuthScheme = async (schemeId: string | number): Promise<boolean> => {
  const res: any = await request(`${API_BASE_PATH}/right/scheme/${schemeId}`, { method: 'DELETE' });
  return !!res?.success;
};

export const saveAuthSchemes = async (schemes: AuthScheme[]): Promise<string[]> => {
  if (!schemes.length) return [];
  const res: any = await request(`${API_BASE_PATH}/right/scheme/save-batch`, {
    method: 'POST',
    data: schemes,
  });
  if (!res?.success) throw new Error(res?.msg || '授权方案批量保存失败');
  return (res.data || []).map((id: any) => String(id));
};

export const deleteAuthSchemes = async (schemeIds: Array<string | number>): Promise<number> => {
  if (!schemeIds.length) return 0;
  const res: any = await request(`${API_BASE_PATH}/right/scheme/delete-batch`, {
    method: 'POST',
    data: schemeIds.map((id) => Number(id)),
  });
  if (!res?.success) throw new Error(res?.msg || '授权方案批量删除失败');
  return Number(res.data || 0);
};

/**
 * 查询当前用户对某表单的模块操作权限码（1可见 2新建 3编辑 4删除 5详情）。
 * 供通用列表按建模权限驱动操作按钮；失败返回空数组（菜单按钮体系继续工作）。
 */
export interface FormManagePermission {
  all: boolean;
  formIds: string[];
  rightTypes: number[];
  formRights: Record<string, number[]>;
}

export const getFormManagePermission = async (): Promise<FormManagePermission> => {
  try {
    const res: any = await request(`${API_BASE_PATH}/right/form-manage-permission`, { method: 'GET' });
    const formRights: Record<string, number[]> = {};
    Object.entries(res?.data?.formRights || {}).forEach(([id, types]: [string, any]) => {
      formRights[id] = (types || []).map((type: any) => Number(type));
    });
    return {
      all: !!res?.data?.all,
      formIds: (res?.data?.formIds || []).map((id: any) => String(id)),
      rightTypes: (res?.data?.rightTypes || []).map((type: any) => Number(type)),
      formRights,
    };
  } catch (_e) {
    return { all: true, formIds: [], rightTypes: [], formRights: {} };
  }
};

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
