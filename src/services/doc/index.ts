import { request } from 'umi';

/**
 * 内容引擎服务（对应后端 blade-doc，前缀 /api/blade-doc）。
 *
 * 对齐 blade-service/blade-doc 控制器：目录 / 详情保存 / 检索 / 模板 / 回收站 / 下载签名 / 在线编辑。
 * `request` 返回 R 包装（{ code, success, data, msg }），统一取 `.data`。
 * 写操作一律 POST/DELETE（守 G1）；下载经签名 URL（守 DOC-P0-4）。
 */

const DOC = '/api/blade-doc';

// ───────────── 目录 ─────────────
export interface DocSecCategory {
  id?: number | string;
  name?: string;
  parentId?: number | string;
  manageRoleId?: number | string;
  subCompanyId?: number | string;
  isOpenWater?: number;
  coder?: string;
  maxUploadFileSize?: number;
  nodownload?: number;
  editionIsOpen?: number;
  editionPrefix?: string;
  readerCanViewHistoryEdition?: number;
  isOpenApproveWf?: number;
  approveWorkflowId?: number | string;
}

export async function listCategoryTree(): Promise<DocSecCategory[]> {
  const r: any = await request(`${DOC}/doc/category/tree`, { method: 'GET' });
  return r?.data ?? [];
}

export async function submitCategory(data: DocSecCategory): Promise<DocSecCategory | undefined> {
  const r: any = await request(`${DOC}/doc/category/submit`, { method: 'POST', data });
  return r?.data;
}

export async function removeCategory(id: number | string): Promise<boolean> {
  const r: any = await request(`${DOC}/doc/category/${id}`, { method: 'DELETE' });
  return !!r?.success;
}

// ───────────── 文档详情 / 保存 / 提交 ─────────────
export interface DocDetail {
  id?: number | string;
  secCategoryId?: number | string;
  docSubject?: string;
  docStatus?: number;
  docEditionId?: number | string;
  docEdition?: number;
  isHistory?: number;
  mainFileId?: number | string;
  contentId?: number | string;
  subCompanyId?: number | string;
  isTop?: number;
  isValid?: number;
  selectedPubMouldId?: number | string;
  checkOutStatus?: number;
  checkOutUserId?: number | string;
  createUser?: number | string;
  createTime?: string;
}

export async function getDocDetail(id: number | string): Promise<DocDetail | null> {
  const r: any = await request(`${DOC}/doc/detail/${id}`, { method: 'GET' });
  return r?.data ?? null;
}

export async function saveDoc(data: DocDetail): Promise<DocDetail | undefined> {
  const r: any = await request(`${DOC}/doc/detail/save`, { method: 'POST', data });
  return r?.data;
}

export async function submitDoc(id: number | string): Promise<DocDetail | undefined> {
  const r: any = await request(`${DOC}/doc/detail/submit`, { method: 'POST', params: { id } });
  return r?.data;
}

// ───────────── 文档生命周期（发布/失效/归档/重新打开/作废，状态机流转）─────────────
async function lifecycle(action: string, id: number | string): Promise<DocDetail | undefined> {
  const r: any = await request(`${DOC}/doc/detail/${action}`, { method: 'POST', params: { id } });
  return r?.data;
}
export function publishDoc(id: number | string) { return lifecycle('publish', id); }
export function invalidateDoc(id: number | string) { return lifecycle('invalidate', id); }
export function archiveDoc(id: number | string) { return lifecycle('archive', id); }
export function reopenDoc(id: number | string) { return lifecycle('reopen', id); }
export function voidDoc(id: number | string) { return lifecycle('void', id); }

// ───────────── 知识中心 ─────────────
export interface RankRow { docId?: number | string; docSubject?: string; cnt?: number; avg?: number | string }
export async function centerRank(limit = 10): Promise<RankRow[]> {
  const r: any = await request(`${DOC}/doc/center/rank`, { method: 'GET', params: { limit } });
  return r?.data ?? [];
}
export async function centerLatest(limit = 10): Promise<DocDetail[]> {
  const r: any = await request(`${DOC}/doc/center/latest`, { method: 'GET', params: { limit } });
  return r?.data ?? [];
}
export async function centerRecommend(limit = 10): Promise<RankRow[]> {
  const r: any = await request(`${DOC}/doc/center/recommend`, { method: 'GET', params: { limit } });
  return r?.data ?? [];
}
export async function centerMine(): Promise<{ total?: number; draft?: number; effective?: number }> {
  const r: any = await request(`${DOC}/doc/center/mine`, { method: 'GET' });
  return r?.data ?? {};
}

// ───────────── 统计（统一维度抽象）─────────────
export interface StatRow { name?: string | number | null; cnt?: number }
export async function statOverview(): Promise<{ total?: number; draft?: number; effective?: number; recycled?: number }> {
  const r: any = await request(`${DOC}/doc/stat/overview`, { method: 'GET' });
  return r?.data ?? {};
}
export async function statCount(dim: string, fromDate?: string, toDate?: string): Promise<StatRow[]> {
  const r: any = await request(`${DOC}/doc/stat/count`, { method: 'GET', params: { dim, fromDate, toDate } });
  return r?.data ?? [];
}

// ───────────── 交互（回复/点赞/评分）─────────────
export interface DocReplyItem {
  id?: number | string;
  docId?: number | string;
  parentId?: number | string;
  userId?: number | string;
  content?: string;
}
export async function listReply(docId: number | string): Promise<DocReplyItem[]> {
  const r: any = await request(`${DOC}/doc/interact/reply/list`, { method: 'GET', params: { docId } });
  return r?.data ?? [];
}
export async function saveReply(docId: number | string, content: string, parentId?: number | string): Promise<DocReplyItem | undefined> {
  const r: any = await request(`${DOC}/doc/interact/reply/save`, { method: 'POST', params: { docId, content, parentId } });
  return r?.data;
}
export async function deleteReply(id: number | string): Promise<boolean> {
  const r: any = await request(`${DOC}/doc/interact/reply/delete`, { method: 'POST', params: { id } });
  return !!r?.success;
}
export async function praiseInfo(docId: number | string): Promise<{ count?: number; praised?: boolean }> {
  const r: any = await request(`${DOC}/doc/interact/praise/info`, { method: 'GET', params: { docId } });
  return r?.data ?? {};
}
export async function togglePraise(docId: number | string): Promise<boolean> {
  const r: any = await request(`${DOC}/doc/interact/praise/toggle`, { method: 'POST', params: { docId } });
  return !!r?.data;
}
export async function scoreInfo(docId: number | string): Promise<{ avg?: number; count?: number; myScore?: number | null }> {
  const r: any = await request(`${DOC}/doc/interact/score/info`, { method: 'GET', params: { docId } });
  return r?.data ?? {};
}
export async function saveScore(docId: number | string, score: number): Promise<any> {
  const r: any = await request(`${DOC}/doc/interact/score/save`, { method: 'POST', params: { docId, score } });
  return r?.data;
}

// ───────────── 附件管理 ─────────────
export interface DocAttachment {
  id?: number | string;
  docId?: number | string;
  versionId?: number | string;
  fileId?: number | string;
  fileName?: string;
  fileSize?: number;
  docFileType?: number;
  isExtFile?: number;
  filePath?: string;
  ossFileId?: string;
  ossFileUrl?: string;
}
export async function listAttachment(docId: number | string): Promise<DocAttachment[]> {
  const r: any = await request(`${DOC}/doc/attach/list`, { method: 'GET', params: { docId } });
  return r?.data ?? [];
}
/**
 * 上传附件：直接由后端落盘到本地 springBlade/uploads/{docId}/{文件名}（带扩展名），
 * 预览走网关白名单静态直链（/api/blade-doc/uploads/**），无需云端。
 */
export async function uploadAttachment(docId: number | string, file: File, docFileType?: number): Promise<DocAttachment | undefined> {
  const fd = new FormData();
  fd.append('file', file);
  const r: any = await request(`${DOC}/doc/attach/upload`, {
    method: 'POST',
    params: { docId, docFileType },
    data: fd,
    requestType: 'form',
  });
  return r?.data;
}
export async function deleteAttachment(id: number | string, physical?: boolean): Promise<boolean> {
  const params: any = { id };
  // physical 不传时由后端引擎设置 attach_delete_physical 决定
  if (physical !== undefined) params.physical = physical;
  const r: any = await request(`${DOC}/doc/attach/delete`, { method: 'POST', params });
  return !!r?.success;
}

/** 重命名附件（canManage 校验） */
export async function renameAttachment(id: number | string, fileName: string): Promise<DocAttachment | undefined> {
  const r: any = await request(`${DOC}/doc/attach/rename`, { method: 'POST', params: { id, fileName } });
  return r?.data;
}
/** 文档版本/文件列表 */
export async function listVersions(docId: number | string): Promise<DocAttachment[]> {
  const r: any = await request(`${DOC}/doc/version/${docId}`, { method: 'GET' });
  return r?.data ?? [];
}

// ───────────── 正文 + 签出/签入 ─────────────
export async function getDocContent(docId: number | string): Promise<string> {
  const r: any = await request(`${DOC}/doc/detail/content`, { method: 'GET', params: { docId } });
  return typeof r?.data === 'string' ? r.data : '';
}
export async function saveDocContent(docId: number | string, content: string): Promise<boolean> {
  const r: any = await request(`${DOC}/doc/detail/content/save`, { method: 'POST', params: { docId, content } });
  return !!r?.success;
}
export async function checkOutDoc(id: number | string): Promise<DocDetail | undefined> {
  const r: any = await request(`${DOC}/doc/detail/check-out`, { method: 'POST', params: { id } });
  return r?.data;
}
export async function checkInDoc(id: number | string): Promise<DocDetail | undefined> {
  const r: any = await request(`${DOC}/doc/detail/check-in`, { method: 'POST', params: { id } });
  return r?.data;
}
export async function forceCheckInDoc(id: number | string): Promise<DocDetail | undefined> {
  const r: any = await request(`${DOC}/doc/detail/force-check-in`, { method: 'POST', params: { id } });
  return r?.data;
}

// ───────────── 目录配置（编号规则/属性可见性/审批明细）─────────────
export interface DocCategoryCoder {
  id?: number | string;
  categoryId?: number | string;
  memberType?: number;
  memberValue?: string;
  seqLength?: number;
  orderNum?: number;
}
export async function listCoder(categoryId: number | string): Promise<DocCategoryCoder[]> {
  const r: any = await request(`${DOC}/doc/category-config/coder/list`, { method: 'GET', params: { categoryId } });
  return r?.data ?? [];
}
export async function saveCoder(data: DocCategoryCoder): Promise<DocCategoryCoder | undefined> {
  const r: any = await request(`${DOC}/doc/category-config/coder/submit`, { method: 'POST', data });
  return r?.data;
}
export async function deleteCoder(id: number | string): Promise<boolean> {
  const r: any = await request(`${DOC}/doc/category-config/coder/delete`, { method: 'POST', params: { id } });
  return !!r?.success;
}

export interface DocCategoryProperty {
  id?: number | string;
  categoryId?: number | string;
  fieldName?: string;
  isView?: number;
  isRequired?: number;
  viewIndex?: number;
}
export async function listProperty(categoryId: number | string): Promise<DocCategoryProperty[]> {
  const r: any = await request(`${DOC}/doc/category-config/property/list`, { method: 'GET', params: { categoryId } });
  return r?.data ?? [];
}
export async function saveProperty(data: DocCategoryProperty): Promise<DocCategoryProperty | undefined> {
  const r: any = await request(`${DOC}/doc/category-config/property/submit`, { method: 'POST', data });
  return r?.data;
}
export async function deleteProperty(id: number | string): Promise<boolean> {
  const r: any = await request(`${DOC}/doc/category-config/property/delete`, { method: 'POST', params: { id } });
  return !!r?.success;
}

export interface DocCategoryApprove {
  id?: number | string;
  categoryId?: number | string;
  approveType?: number;
  workflowId?: number | string;
  workflowFieldId?: number | string;
  docPropertyFieldId?: number | string;
}
export async function listApprove(categoryId: number | string): Promise<DocCategoryApprove[]> {
  const r: any = await request(`${DOC}/doc/category-config/approve/list`, { method: 'GET', params: { categoryId } });
  return r?.data ?? [];
}
export async function saveApprove(data: DocCategoryApprove): Promise<DocCategoryApprove | undefined> {
  const r: any = await request(`${DOC}/doc/category-config/approve/submit`, { method: 'POST', data });
  return r?.data;
}
export async function deleteApprove(id: number | string): Promise<boolean> {
  const r: any = await request(`${DOC}/doc/category-config/approve/delete`, { method: 'POST', params: { id } });
  return !!r?.success;
}

// ───────────── 检索分页 ─────────────
export interface DocSearchParams {
  current?: number;
  size?: number;
  keyword?: string;
  secCategoryId?: number | string;
}

export async function searchDocPage(
  params: DocSearchParams,
): Promise<{ list: DocDetail[]; total: number }> {
  const r: any = await request(`${DOC}/doc/search/page`, { method: 'GET', params });
  const p = r?.data;
  return { list: p?.records ?? [], total: p?.total ?? 0 };
}

// ───────────── 模板 ─────────────
export interface DocMould {
  id?: number | string;
  mouldName?: string;
  mouldType?: number;
  isDefault?: number;
  imageFileId?: number | string;
  mouldPath?: string;
}

export async function listMould(): Promise<DocMould[]> {
  const r: any = await request(`${DOC}/doc/mould/list`, { method: 'GET' });
  return r?.data ?? [];
}

export async function saveMould(data: DocMould): Promise<DocMould | undefined> {
  const r: any = await request(`${DOC}/doc/mould/submit`, { method: 'POST', data });
  return r?.data;
}

export async function deleteMould(ids: (number | string)[]): Promise<boolean> {
  const r: any = await request(`${DOC}/doc/mould/delete`, { method: 'POST', data: ids });
  return !!r?.success;
}

// ───────────── 回收站 ─────────────
export interface DocRecycleItem {
  id?: number | string;
  docId?: number | string;
  docSubject?: string;
  deleteUser?: number | string;
  deleteTime?: string;
}

export async function listRecycle(secCategoryId?: number | string): Promise<DocRecycleItem[]> {
  const r: any = await request(`${DOC}/doc/recycle/list`, {
    method: 'GET',
    params: secCategoryId ? { secCategoryId } : {},
  });
  return r?.data ?? [];
}

export async function restoreDoc(docId: number | string): Promise<boolean> {
  const r: any = await request(`${DOC}/doc/recycle/restore`, { method: 'POST', params: { docId } });
  return !!r?.success;
}

export async function purgeDoc(docId: number | string): Promise<boolean> {
  const r: any = await request(`${DOC}/doc/recycle/purge`, { method: 'POST', params: { docId } });
  return !!r?.success;
}

/** 移入回收站（删除文档，逻辑删除；可在回收站恢复） */
export async function removeDocToRecycle(docId: number | string): Promise<boolean> {
  const r: any = await request(`${DOC}/doc/recycle/remove`, { method: 'POST', params: { docId } });
  return !!r?.success;
}

// ───────────── 下载签名 + 在线编辑 ─────────────
/** 已登录换取带签名 token 的下载/内容 URL（闭合 DOC-P0-4） */
export async function signContentUrl(type: string, id: number | string): Promise<string> {
  const r: any = await request(`${DOC}/doc/sign-url`, { method: 'GET', params: { type, id } });
  return typeof r?.data === 'string' ? r.data : '';
}

/** 在线编辑器配置（按文件类型 + 方案返回 univer/wps/pdfjs） */
export async function getEditorConfig(docId: number | string, mode?: string, editor?: string, fileId?: number | string): Promise<any> {
  const r: any = await request(`${DOC}/doc/editor/config`, { method: 'GET', params: { docId, mode, editor, fileId } });
  return r?.data;
}

/** 获取编辑器设置（默认编辑方案 + WPS 是否可用） */
export async function getEngineSetting(): Promise<any> {
  const r: any = await request(`${DOC}/doc/engine/setting`, { method: 'GET' });
  return r?.data;
}

/** 保存编辑器设置（默认引擎 + 第三方平台接入配置） */
export async function saveEngineSetting(body: {
  defaultEngine: string;
  thirdPlatform?: string;
  wpsAppId?: string;
  wpsAppSecret?: string;
  wpsJssdkUrl?: string;
}): Promise<boolean> {
  const r: any = await request(`${DOC}/doc/engine/setting`, { method: 'POST', data: body });
  return !!r?.success;
}
