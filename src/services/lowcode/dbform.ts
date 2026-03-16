import { request } from '@umijs/max';

export type DbformItem = {
  id: string;
  tableName: string;
  tableDescribe: string;
  tableType: number;
  tableClassify?: number;
  tableIdType?: string;
  tableSelect?: string;
  isDbSync?: string;
  isDesForm?: string;
  subTableMapping?: string;
  subTableSort?: number;
  subTableTitle?: string;
  themeTemplate?: string;
  desformWebId?: string;
  treeStyle?: string;
  treeMode?: string;
  treeLabelField?: string;
  operateMenuStyle?: string;
  formStyle?: number;
  subTableListStr?: string;
  viewDefaultField?: string;
  groupDbformId?: string;
  orderbyConfig?: string;
  whereConfig?: string;
  dataConfig?: string;
  basicFunction?: string;
  basicConfig?: string;
  tableConfig?: string;
  dataSourcesConfig?: string;
  tableStyle?: string;
  tenantId?: string;
  createTime?: string;
  createUser?: string;
};

export type DbformFieldItem = {
  id: string;
  dbformId: string;
  fieldCode: string;
  fieldName: string;
  fieldLen?: number;
  fieldPointLen?: number;
  fieldDefaultVal?: string;
  fieldType?: string;
  fieldRemark?: string;
  isPrimaryKey?: string;
  isNull?: string;
  sortNum?: number;
  isDb?: string;
};

export type DbformFieldWebItem = {
  id: string;
  dbformId: string;
  fieldCode: string;
  isDbSelect?: string;
  isShowList?: string;
  isShowForm?: string;
  isShowColumn?: string;
  isShowSort?: string;
  isRequired?: string;
  controlType?: string;
  controlsConfig?: string;
  cellWidth?: string;
  cellWidthType?: string;
  verifyConfig?: string;
  formatConfig?: string;
};

export type DbformButtonItem = {
  id: string;
  dbformId: string;
  buttonName: string;
  buttonCode: string;
  buttonIcon?: string;
  buttonLocation?: string;
  buttonType?: string;
  buttonSort?: number;
  buttonExp?: string;
  buttonShow?: string;
  buttonAuth?: string;
};

export type GroupDbformItem = {
  id: string;
  groupName: string;
  groupIcon?: string;
  groupSort?: number;
  parentId?: string;
  tenantId?: string;
};

export async function getDbformDetail(id: string, options?: { [key: string]: any }) {
  return request<{ code: number; data: DbformItem; msg: string }>(
    '/api/blade-system/lowcode/dbform/detail',
    {
      method: 'GET',
      params: { id },
      ...(options || {}),
    },
  );
}

export async function getDbformPage(
  params: {
    pageNo?: number;
    pageSize?: number;
    tableName?: string;
    tableDescribe?: string;
    tableType?: number;
    groupDbformId?: string;
  },
  options?: { [key: string]: any },
) {
  return request<{ code: number; data: { records: DbformItem[]; total: number }; msg: string }>(
    '/api/blade-system/lowcode/dbform/page',
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}

export async function getDbformList(params?: { [key: string]: any }, options?: { [key: string]: any }) {
  return request<{ code: number; data: DbformItem[]; msg: string }>(
    '/api/blade-system/lowcode/dbform/list',
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}

export async function saveDbform(data: DbformItem, options?: { [key: string]: any }) {
  return request<{ code: number; data: string; msg: string }>(
    '/api/blade-system/lowcode/dbform/save',
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}

export async function updateDbform(data: DbformItem, options?: { [key: string]: any }) {
  return request<{ code: number; data: boolean; msg: string }>(
    '/api/blade-system/lowcode/dbform/update',
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}

export async function removeDbform(ids: string, options?: { [key: string]: any }) {
  return request<{ code: number; data: boolean; msg: string }>(
    '/api/blade-system/lowcode/dbform/remove',
    {
      method: 'POST',
      params: { ids },
      ...(options || {}),
    },
  );
}

export async function syncDbformDb(id: string, options?: { [key: string]: any }) {
  return request<{ code: number; data: boolean; msg: string }>(
    '/api/blade-system/lowcode/dbform/sync-db',
    {
      method: 'POST',
      params: { id },
      ...(options || {}),
    },
  );
}

export async function getDbformFieldList(dbformId: string, options?: { [key: string]: any }) {
  return request<{ code: number; data: DbformFieldItem[]; msg: string }>(
    '/api/blade-system/lowcode/dbform/field/list',
    {
      method: 'GET',
      params: { dbformId },
      ...(options || {}),
    },
  );
}

export async function saveDbformField(data: DbformFieldItem[], options?: { [key: string]: any }) {
  return request<{ code: number; data: boolean; msg: string }>(
    '/api/blade-system/lowcode/dbform/field/save',
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}

export async function removeDbformField(ids: string, options?: { [key: string]: any }) {
  return request<{ code: number; data: boolean; msg: string }>(
    '/api/blade-system/lowcode/dbform/field/remove',
    {
      method: 'POST',
      params: { ids },
      ...(options || {}),
    },
  );
}

export async function getDbformButtonList(dbformId: string, options?: { [key: string]: any }) {
  return request<{ code: number; data: DbformButtonItem[]; msg: string }>(
    '/api/blade-system/lowcode/dbform/button/list',
    {
      method: 'GET',
      params: { dbformId },
      ...(options || {}),
    },
  );
}

export async function saveDbformButton(data: DbformButtonItem[], options?: { [key: string]: any }) {
  return request<{ code: number; data: boolean; msg: string }>(
    '/api/blade-system/lowcode/dbform/button/save',
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}

export async function removeDbformButton(ids: string, options?: { [key: string]: any }) {
  return request<{ code: number; data: boolean; msg: string }>(
    '/api/blade-system/lowcode/dbform/button/remove',
    {
      method: 'POST',
      params: { ids },
      ...(options || {}),
    },
  );
}

export async function getGroupDbformList(options?: { [key: string]: any }) {
  return request<{ code: number; data: GroupDbformItem[]; msg: string }>(
    '/api/blade-system/lowcode/group-dbform/list',
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function getGroupDbformTree(options?: { [key: string]: any }) {
  return request<{ code: number; data: GroupDbformItem[]; msg: string }>(
    '/api/blade-system/lowcode/group-dbform/tree',
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function saveGroupDbform(data: GroupDbformItem, options?: { [key: string]: any }) {
  return request<{ code: number; data: string; msg: string }>(
    '/api/blade-system/lowcode/group-dbform/save',
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}

export async function updateGroupDbform(data: GroupDbformItem, options?: { [key: string]: any }) {
  return request<{ code: number; data: boolean; msg: string }>(
    '/api/blade-system/lowcode/group-dbform/update',
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}

export async function removeGroupDbform(ids: string, options?: { [key: string]: any }) {
  return request<{ code: number; data: boolean; msg: string }>(
    '/api/blade-system/lowcode/group-dbform/remove',
    {
      method: 'POST',
      params: { ids },
      ...(options || {}),
    },
  );
}
