import { request } from '@umijs/max';

/**
 * 组织矩阵接口（对应后端 blade-workflow WfMatrixController，前缀 /api/blade-workflow/matrix）。
 * 后端：矩阵主表 / 字段定义 / 数据行 / 条件匹配取人。
 */
const BASE = '/api/blade-workflow/matrix';

export interface WfMatrix {
  id?: string | number;
  matrixName?: string;
  matrixDesc?: string;
  /** 0自定义 1分部系统矩阵 2部门系统矩阵 */
  isSystem?: number;
  /** 1启用 0停用 */
  status?: number;
}

export interface WfMatrixField {
  id?: string | number;
  matrixId?: string | number;
  /** 字段唯一键（data_json 的 key） */
  fieldKey?: string;
  displayName?: string;
  /** 浏览按钮类型 1人力资源 17多人力资源 4/57部门 164/194分部 */
  browserType?: number;
  /** 0=条件维度 1=结果维度 */
  fieldType?: number;
  fieldOrder?: number;
  colWidth?: number;
}

export interface WfMatrixData {
  id?: string | number;
  matrixId?: string | number;
  dataOrder?: number | string;
  /** { fieldKey: 值 } */
  dataJson?: Record<string, any>;
}

export interface MatrixMatchVO {
  matrixId?: string | number;
  matrixName?: string;
  valueFieldKey?: string;
  effectiveConditions?: Record<string, string>;
  hitRows?: number;
  userIds?: (string | number)[];
}

// ───────────── 矩阵主表 ─────────────
export const list = () => request(`${BASE}/list`);

export const detail = (matrixId: any) => request(`${BASE}/${matrixId}`);

export const create = (matrixName: string, matrixDesc?: string) => {
  const qs = `matrixName=${encodeURIComponent(matrixName)}${
    matrixDesc ? `&matrixDesc=${encodeURIComponent(matrixDesc)}` : ''
  }`;
  return request(`${BASE}?${qs}`, { method: 'POST' });
};

export const removeMatrix = (matrixId: any) =>
  request(`${BASE}/${matrixId}`, { method: 'DELETE' });

// ───────────── 字段定义 ─────────────
export const fields = (matrixId: any) => request(`${BASE}/${matrixId}/fields`);

export const saveFields = (matrixId: any, data: WfMatrixField[]) =>
  request(`${BASE}/${matrixId}/fields`, { method: 'PUT', data });

// ───────────── 数据行 ─────────────
export const dataList = (matrixId: any) => request(`${BASE}/${matrixId}/data`);

export const nextOrder = (matrixId: any) =>
  request(`${BASE}/${matrixId}/data/next-order`);

export const saveData = (matrixId: any, dataOrder: number | string, values: Record<string, any>) =>
  request(`${BASE}/${matrixId}/data?dataOrder=${dataOrder}`, {
    method: 'POST',
    data: values,
  });

export const removeData = (dataId: any) =>
  request(`${BASE}/data/${dataId}`, { method: 'DELETE' });

// ───────────── 条件匹配取人 ─────────────
export const match = (matrixId: any, valueField: string, conditions: Record<string, string>) =>
  request(`${BASE}/match?matrixId=${matrixId}&valueField=${encodeURIComponent(valueField)}`, {
    method: 'POST',
    data: conditions,
  });
