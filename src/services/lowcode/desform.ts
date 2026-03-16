import { request } from '@umijs/max';
import { stringify } from 'qs';

export interface DesformQuery {
  pageNo?: number;
  pageSize?: number;
  desformName?: string;
  isOpen?: string;
  isTemplate?: string;
}

export interface DesformItem {
  id?: number;
  desformName?: string;
  desformJson?: string;
  isOpen?: string;
  isTemplate?: string;
  tenantId?: string;
  createUserName?: string;
  createDept?: number;
  createTime?: string;
  updateTime?: string;
}

export async function desformPage(params: DesformQuery) {
  const { pageNo, pageSize, ...rest } = params;
  return request('/api/blade-system/lowcode/desform/page', {
    method: 'GET',
    params: {
      pageNo,
      pageSize,
      ...rest,
    },
  });
}

export async function desformDetail(id: number, lock?: boolean) {
  return request('/api/blade-system/lowcode/desform/detail', {
    method: 'GET',
    params: { id, lock },
  });
}

export async function desformUnlock(id: number) {
  return request(`/api/blade-system/lowcode/desform/unlock/${id}`, {
    method: 'POST',
  });
}

export async function desformSave(data: DesformItem) {
  return request('/api/blade-system/lowcode/desform/save', {
    method: 'POST',
    data,
  });
}

export async function desformUpdate(data: DesformItem) {
  return request('/api/blade-system/lowcode/desform/update', {
    method: 'POST',
    data,
  });
}

export async function desformRemove(ids: (number | string)[]) {
  const idStr = ids.join(',');
  return request(`/api/blade-system/lowcode/desform/remove?${stringify({ ids: idStr })}`, {
    method: 'POST',
  });
}

export async function desformTemplates(params: { pageNo?: number; pageSize?: number }) {
  return request('/api/blade-system/lowcode/desform/template', {
    method: 'GET',
    params,
  });
}

export async function groupList() {
  return request('/api/blade-system/lowcode/group/desform/list', {
    method: 'GET',
  });
}

export async function groupSave(data: { name: string }) {
  return request('/api/blade-system/lowcode/group/desform/save', {
    method: 'POST',
    data,
  });
}