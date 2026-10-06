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

/** 标记会话已读 */
export async function markSessionRead(sessionId: string) {
  return request<ApiResponse<boolean>>(`${BASE}/message/message/read`, {
    method: 'POST',
    params: { sessionId },
  });
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
