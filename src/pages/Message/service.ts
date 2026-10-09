import { request } from 'umi';
import type { ApiResponse } from '@/services/formmode/typings';
import type {
  MessageSendDTO,
  MessageVO,
  SessionCreateDTO,
  SessionVO,
  UnreadCountVO,
} from './data.d';

// 消息中心 API 前缀（Umi dev proxy 剥离 /api，网关路由 /blade-message/**）
const BASE = '/api/blade-message';

/** 我的会话分页（含当前用户未读） */
export async function getSessions(params?: {
  current?: number;
  pageSize?: number;
  /**
   * 按需加载开关（后端 lastMessage 是否为空的过滤）：
   * true  = 只取「已有消息」的会话 —— 首屏优先加载，量小、装配快；
   * false = 只取「还没有消息」的会话 —— 等用户滚动到可视区域时再拉取；
   * 不传  = 不过滤（兼容旧调用）。
   */
  hasMessage?: boolean;
}) {
  // 后端 Query 绑定的是 current/size，pageSize 不会被识别 → size 恒为 null。
  // 这里统一把 pageSize 转成 size，避免服务端对 null 的 size 拆箱报错。
  const { pageSize, ...rest } = params ?? {};
  return request<ApiResponse<{ records: SessionVO[]; total: number }>>(
    `${BASE}/message/session/page`,
    {
      method: 'GET',
      params: { ...rest, size: pageSize },
    },
  );
}

/** 创建/复用会话（两人会话幂等），返回会话视图 */
export async function createSession(data: SessionCreateDTO) {
  return request<ApiResponse<SessionVO>>(`${BASE}/message/session/create`, {
    method: 'POST',
    data,
  });
}

/** 会话消息分页（按时间正序） */
export async function getMessages(
  sessionId: string,
  params?: { current?: number; pageSize?: number },
) {
  // 同 getSessions：后端识别的是 size，不是 pageSize
  const { pageSize, ...rest } = params ?? {};
  return request<ApiResponse<{ records: MessageVO[]; total: number }>>(
    `${BASE}/message/session/${sessionId}/messages`,
    { method: 'GET', params: { ...rest, size: pageSize } },
  );
}

/** 发送消息 */
export async function sendMessage(data: MessageSendDTO) {
  return request<ApiResponse<boolean>>(`${BASE}/message/message/send`, {
    method: 'POST',
    data,
  });
}

/**
 * 标记会话已读。
 * 前端多处几乎同时触发（打开会话 / WS 新消息自动已读 / 展开补已读 / 页签切回），
 * 同一会话的在途请求复用同一个 Promise，避免并发重复调用后端标记接口
 * （后端已做 INSERT IGNORE 幂等，这里进一步减少无谓请求）。
 */
const markReadInflight = new Map<string, Promise<ApiResponse<boolean>>>();

export async function markSessionRead(sessionId: string) {
  const inflight = markReadInflight.get(sessionId);
  if (inflight) return inflight;
  const p = request<ApiResponse<boolean>>(`${BASE}/message/message/read`, {
    method: 'POST',
    params: { sessionId },
  }).finally(() => markReadInflight.delete(sessionId));
  markReadInflight.set(sessionId, p);
  return p;
}

/** 全局未读红点 */
export async function getUnreadCount() {
  return request<ApiResponse<UnreadCountVO>>(
    `${BASE}/message/message/unread-count`,
    { method: 'GET' },
  );
}

/** 本租户在线用户ID列表（用于人员列表在线角标） */
export async function getOnlineUsers() {
  return request<ApiResponse<(string | number)[]>>(
    `${BASE}/message/presence/online`,
    { method: 'GET' },
  );
}
