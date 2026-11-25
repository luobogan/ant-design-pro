import { request } from '@umijs/max';

const BASE = '/api/blade-formmode/mode/dir';

export interface ModeDir {
  id?: string;
  name?: string;
  parentid?: string;
  level?: number;
  dsporder?: number;
  icon?: string;
}

export interface ModeDirAuth {
  id?: string;
  dirId?: string;
  subjectType?: number;
  subjectId?: string;
  rightType?: number;
  includeSub?: number;
  scopeType?: number;
  scopeValue?: string;
}

export const listModeDirs = async (): Promise<ModeDir[]> => {
  const res: any = await request(`${BASE}/tree`, { method: 'GET' });
  return Array.isArray(res?.data) ? res.data : [];
};

export const saveModeDir = async (dir: ModeDir): Promise<string> => {
  const res: any = await request(`${BASE}/save`, { method: 'POST', data: dir });
  return res?.data;
};

export const deleteModeDir = async (id: string) => {
  await request(`${BASE}/${id}`, { method: 'DELETE' });
};

export const listModeDirAuth = async (dirId: string): Promise<ModeDirAuth[]> => {
  const res: any = await request(`${BASE}/auth/${dirId}`, { method: 'GET' });
  return Array.isArray(res?.data) ? res.data : [];
};

export const saveModeDirAuth = async (dirId: string, auths: ModeDirAuth[]) => {
  await request(`${BASE}/auth/${dirId}`, { method: 'POST', data: auths });
};

export const getFormDir = async (formId: string): Promise<string | undefined> => {
  const res: any = await request(`${BASE}/form/${formId}`, { method: 'GET' });
  return res?.data === null || res?.data === undefined ? undefined : String(res.data);
};

export const moveFormToDir = async (formId: string, dirId?: string) => {
  await request(`${BASE}/move-form`, { method: 'POST', params: { formId, dirId } });
};

export const moveFormsToDir = async (formIds: string[], dirId?: string) => {
  await request(`${BASE}/move-forms`, {
    method: 'POST',
    params: { formIds: formIds.join(','), dirId },
  });
};
