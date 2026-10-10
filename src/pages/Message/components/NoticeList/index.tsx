import { Empty, Spin, Tag, theme } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { onNewMessage } from '@/utils/messageSocket';
import type { MessageVO, SessionVO } from '../../data';
import { getMessages, markMessageRead } from '../../service';

/** 每页通知数量 */
const PAGE_SIZE = 20;

type NoticeListProps = {
  /** 流程通知会话（type=3，每人一条；尚未收到过通知时为 undefined） */
  session?: SessionVO;
  /** 点击卡片跳转业务页：WF_TASK→审批页 / WF_INSTANCE→实例页 */
  onJump: (type: string, id: string) => void;
};

/**
 * 流程通知列表（消息中心 §10.6 规则 3）：
 *
 * <p>通知以「卡片列表」呈现，不进聊天气泡流。数据来源 = 用户的系统通知会话
 * （type=3）消息流，按时间倒序取页（desc=true，首页即最新一页）；
 * WS 推来的新通知实时插到顶部（按消息 id 去重，不重拉列表）。</p>
 */
export default function NoticeList({ session, onJump }: NoticeListProps) {
  const { token } = theme.useToken();
  const [items, setItems] = useState<MessageVO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const inFlight = useRef(false);

  const sessionId = session?.id ? String(session.id) : undefined;

  const loadPage = useCallback(
    (page: number) => {
      if (!sessionId || inFlight.current) return;
      inFlight.current = true;
      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      getMessages(sessionId, { current: page, pageSize: PAGE_SIZE, desc: true })
        .then((res) => {
          const data = (res as any)?.data;
          const records: MessageVO[] = data?.records ?? [];
          setTotal(Number(data?.total ?? 0));
          pageRef.current = page;
          setItems((prev) => {
            const seen = new Set(prev.map((m) => String(m.id)));
            return [...prev, ...records.filter((m) => !seen.has(String(m.id)))];
          });
        })
        .catch(() => {})
        .finally(() => {
          inFlight.current = false;
          setLoading(false);
          setLoadingMore(false);
        });
    },
    [sessionId],
  );

  // 切到流程通知 tab（或收到首条通知、会话首次出现）时加载最新一页
  useEffect(() => {
    setItems([]);
    setTotal(0);
    pageRef.current = 1;
    if (sessionId) loadPage(1);
  }, [sessionId, loadPage]);

  // WS 新通知实时插顶（id 去重，REST 兜底与推送竞态不重复）
  useEffect(() => {
    return onNewMessage((msg: any) => {
      if (!sessionId || String(msg?.sessionId) !== sessionId) return;
      setItems((prev) =>
        prev.some((m) => String(m.id) === String(msg?.id))
          ? prev
          : [msg as MessageVO, ...prev],
      );
      setTotal((t) => t + 1);
    });
  }, [sessionId]);

  const hasMore = () => items.length < total;

  /** 滚动到底加载更早的通知 */
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (
      !hasMore() ||
      loadingMore ||
      el.scrollHeight - el.scrollTop - el.clientHeight > 40
    ) {
      return;
    }
    loadPage(pageRef.current + 1);
  };

  if (!sessionId) {
    return (
      <div style={{ padding: 32 }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无流程通知"
        />
      </div>
    );
  }

  return (
    <Spin spinning={loading}>
      <div
        style={{ height: '100%', overflowY: 'auto' }}
        onScroll={handleScroll}
      >
        {items.length === 0 && !loading ? (
          <div style={{ padding: 32 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无流程通知"
            />
          </div>
        ) : (
          items.map((msg) => {
            const isTodo = msg.bizRefType === 'WF_TASK';
            // 状态标签（§10.6 规则 3 + 二期 T9）：后端回写 bizState 后不再是永久"待办"
            const stateLabel = isTodo
              ? msg.bizState === 1
                ? '已处理'
                : '待办'
              : msg.bizState === 2
                ? '已办结'
                : '办结';
            const stateColor = isTodo
              ? msg.bizState === 1
                ? 'default'
                : 'processing'
              : 'success';
            const unread = msg.read === false;
            return (
              <div
                key={String(msg.id)}
                onClick={() => {
                  // 点击即单条已读（幂等；铃铛红点经 /queue/unread 自动同步）
                  if (unread) {
                    setItems((prev) =>
                      prev.map((m) =>
                        String(m.id) === String(msg.id)
                          ? { ...m, read: true }
                          : m,
                      ),
                    );
                    markMessageRead(String(msg.id));
                  }
                  if (msg.bizRefType && msg.bizRefId) {
                    onJump(msg.bizRefType, msg.bizRefId);
                  }
                }}
                style={{
                  padding: '12px 16px',
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  cursor: msg.bizRefId ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = token.colorBgTextHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <Tag color={stateColor} style={{ marginInlineEnd: 0 }}>
                    {stateLabel}
                  </Tag>
                  <span
                    style={{
                      color: token.colorTextTertiary,
                      fontSize: 12,
                      marginLeft: 'auto',
                    }}
                  >
                    {(msg.createTime ?? '').slice(5, 16)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: '20px',
                    fontWeight: unread ? 600 : 400,
                  }}
                >
                  {unread && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: token.colorPrimary,
                        marginRight: 8,
                        verticalAlign: 'middle',
                      }}
                    />
                  )}
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        {loadingMore && (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <Spin size="small" />
          </div>
        )}
      </div>
    </Spin>
  );
}
