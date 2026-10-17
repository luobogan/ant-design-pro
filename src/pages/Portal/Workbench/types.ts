import type { ReactNode } from 'react';

/** 字段控件类型（右侧表单/查询区/表格共用同一份字段声明） */
export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'date' | 'switch' | 'tag';

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldDef {
  /** 字段名，同时作为记录的主键属性 */
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: FieldOption[];
  /** 24 栅格占位，默认 12 */
  span?: number;
  /** 查询区隐藏 */
  hideInQuery?: boolean;
  /** 表格列隐藏 */
  hideInTable?: boolean;
  /** 表单隐藏 */
  hideInForm?: boolean;
  /** 新增时的默认值 */
  initialValue?: unknown;
  /** 自定义渲染（表格 / 详情） */
  render?: (value: any, record: PortalRecord) => ReactNode;
}

/** 业务记录：id 由仓储统一分配 */
export type PortalRecord = { id: number } & Record<string, any>;

/** 左侧工作台菜单树节点（由后端门户菜单树转换而来） */
export interface WorkbenchMenuNode {
  key: string;
  label: string;
  icon?: string;
  routeUrl?: string;
  linkMode?: number;
  /** 命中的内容模块 key；为空表示该节点仅作分组 */
  moduleKey?: string;
  children: WorkbenchMenuNode[];
}

/** 种子数据（无 id） */
export type SeedRecord = Record<string, any>;

export interface ModuleDef {
  /** 模块 key，与菜单 routeUrl 末段一致，如 noticedetail */
  key: string;
  title: string;
  subtitle?: string;
  /** 额外匹配的路由（完整路径），用于菜单路径与模块 key 不一致时兜底 */
  matchPaths?: string[];
  fields: FieldDef[];
  seed: SeedRecord[];
  /** 只读模块：仅展示数据/详情，不提供新增编辑删除 */
  readOnly?: boolean;
}