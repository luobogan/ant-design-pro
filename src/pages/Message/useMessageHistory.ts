import { useCallback, useRef, useState } from 'react';
import type { MessageVO } from './data';
import { getMessages } from './service';

/** 历史分页大小：向上滚动按该粒度加载更早的消息 */
export const HISTORY_PAGE_SIZE = 30;

/**
 * 按 id 去重合并并按 createTime 升序排列。
 * 后端 createTime 固定为 "YYYY-MM-DD HH:mm:ss"，字典序即时间序。
 * 用于：历史分页前置合并、WS 本地追加、静默刷新三处，保证列表全局有序且无重复。
 */
function mergeMessages(...lists: (MessageVO[] | undefined)[]): MessageVO[] {
  const map = new Map<string, MessageVO>();
  lists.forEach((list) =>
    (list || []).forEach((m) => {
      if (m && m.id !== undefined && m.id !== null) map.set(String(m.id), m);
    }),
  );
  return [...map.values()].sort((a, b) =>
    String(a.createTime || '').localeCompare(String(b.createTime || '')),
  );
}

export interface MessageHistory {
  messages: MessageVO[];
  /** 首次加载（整屏 loading） */
  loading: boolean;
  /** 向上加载更早历史（顶部小 spinner） */
  loadingMore: boolean;
  /** 是否还有更早的历史（false 时顶部显示「没有更多信息了」） */
  hasMore: boolean;
  /** 打开会话：加载最近一页历史作为初始视图 */
  loadInitial: (sessionId: string) => Promise<void>;
  /** 向上翻页：加载更早一页并前置合并 */
  loadOlder: () => Promise<void>;
  /** 静默刷新当前页（发送/已读回执后同步状态，不闪 loading） */
  refreshSilent: (sessionId?: string) => Promise<void>;
  /** 本地追加 WS 推送的新消息（幂等去重） */
  appendLocal: (msg: MessageVO) => void;
}

/**
 * 消息历史分页 hook（悬浮消息框与 /message 消息中心页共用）。
 *
 * 加载机制（与后端检索方式对齐）：
 * - 后端 `GET /blade-message/message/session/{id}/messages` 按时间【正序】分页
 *   （current/size），即第 1 页是最早的历史，【末页】才是最新消息；
 * - 打开会话时先取第 1 页拿到 total，若 total 超过一页则再取末页作为初始视图
 *   （两次轻量请求仅在历史超过一页时发生）；
 * - 向上滚动由 ChatPanel 触发 loadOlder：请求前一页并前置合并，page 递减至 1 为止；
 * - 发送成功 / 收到已读回执时 refreshSilent 重取当前页并按 id 合并，
 *   同步已读状态与补齐分页间隙；WS 新消息走 appendLocal 本地追加。
 */
export function useMessageHistory(): MessageHistory {
  const [messages, setMessages] = useState<MessageVO[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  /** 当前停在的页码（正序分页），1 = 最早的历史 */
  const pageRef = useRef(1);
  const sessionRef = useRef<string>();
  /** 防抖：避免快速滚动重复触发 loadOlder */
  const busyRef = useRef(false);

  const loadInitial = useCallback(async (sessionId: string) => {
    sessionRef.current = sessionId;
    setLoading(true);
    setMessages([]);
    setHasMore(false);
    try {
      const first: any = await getMessages(sessionId, {
        current: 1,
        pageSize: HISTORY_PAGE_SIZE,
      });
      const total = Number(first?.data?.total ?? 0);
      const records: MessageVO[] = first?.data?.records ?? [];
      let list = records;
      let lastPage = 1;
      if (total > HISTORY_PAGE_SIZE) {
        lastPage = Math.ceil(total / HISTORY_PAGE_SIZE);
        const last: any = await getMessages(sessionId, {
          current: lastPage,
          pageSize: HISTORY_PAGE_SIZE,
        });
        list = last?.data?.records ?? records;
      }
      pageRef.current = lastPage;
      setMessages(mergeMessages(list));
      setHasMore(lastPage > 1);
    } catch {
      setMessages([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOlder = useCallback(async () => {
    const sid = sessionRef.current;
    if (!sid || busyRef.current || pageRef.current <= 1) return;
    busyRef.current = true;
    setLoadingMore(true);
    try {
      const target = pageRef.current - 1;
      const res: any = await getMessages(sid, {
        current: target,
        pageSize: HISTORY_PAGE_SIZE,
      });
      const older: MessageVO[] = res?.data?.records ?? [];
      if (older.length > 0) {
        pageRef.current = target;
        setMessages((prev) => mergeMessages(older, prev));
      }
      setHasMore(target > 1);
    } catch {
      // 加载失败保持原状；用户再次滚动到顶可重试
    } finally {
      busyRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  const refreshSilent = useCallback(async (sessionId?: string) => {
    const sid = sessionId ?? sessionRef.current;
    if (!sid) return;
    try {
      const res: any = await getMessages(sid, {
        current: pageRef.current,
        pageSize: HISTORY_PAGE_SIZE,
      });
      const fetched: MessageVO[] = res?.data?.records ?? [];
      setMessages((prev) => mergeMessages(prev, fetched));
    } catch {
      // 静默刷新失败不打断交互
    }
  }, []);

  const appendLocal = useCallback((msg: MessageVO) => {
    if (!msg || msg.id === undefined || msg.id === null) return;
    setMessages((prev) => mergeMessages(prev, [msg]));
  }, []);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    loadInitial,
    loadOlder,
    refreshSilent,
    appendLocal,
  };
}
