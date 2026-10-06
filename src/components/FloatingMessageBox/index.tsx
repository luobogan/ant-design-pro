import {
  CloseOutlined,
  CommentOutlined,
  MinusOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useModel } from '@umijs/max';
import { Badge, Button, Flex, Spin, Tooltip, Typography, theme } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import ChatPanel from '@/pages/Message/components/ChatPanel';
import type { MessageSendDTO, MessageVO, SessionVO } from '@/pages/Message/data';
import {
  createSession,
  getMessages,
  getOnlineUsers,
  getUnreadCount,
  markSessionRead,
  sendMessage,
} from '@/pages/Message/service';
import {
  connectMessageSocket,
  onNewMessage,
  onReadChange,
  onUnreadChange,
} from '@/utils/messageSocket';
import StaffRoster, { type RosterUser } from './StaffRoster';

/** 在线状态轮询间隔（后端活跃窗口 90s，30s 轮询足够及时） */
const ONLINE_POLL_MS = 30_000;

/**
 * 右下角消息对话框：支持折叠/展开，右侧展示本租户全公司人员与在线角标。
 */
export default function FloatingMessageBox() {
  const { initialState } = useModel('@@initialState');
  const { token } = theme.useToken();
  const currentUserId = initialState?.currentUser?.userid
    ? String(initialState.currentUser.userid)
    : undefined;

  const [collapsed, setCollapsed] = useState(true);
  const [closed, setClosed] = useState(false);
  const [rosterVisible, setRosterVisible] = useState(true);
  const [total, setTotal] = useState(0);

  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [session, setSession] = useState<SessionVO>();
  const [activeUserId, setActiveUserId] = useState<string>();
  const [messages, setMessages] = useState<MessageVO[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const sessionIdRef = useRef<string | undefined>(undefined);
  sessionIdRef.current = session ? String(session.id) : undefined;

  const loadOnline = useCallback(() => {
    getOnlineUsers()
      .then((res) => {
        const list = (res as any)?.data ?? [];
        setOnlineIds(new Set((list as any[]).map((id) => String(id))));
      })
      .catch(() => {});
  }, []);

  /** silent=true 由 WS 事件触发：不闪 loading，避免聊天区整屏刷新感 */
  const fetchMessages = useCallback((id: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    getMessages(id, { current: 1, pageSize: 50 })
      .then((res) => setMessages((res as any)?.data?.records ?? []))
      .catch(() => {
        if (!silent) setMessages([]);
      })
      .finally(() => {
        if (!silent) setLoadingMessages(false);
      });
  }, []);

  // 全局初始化：WS 连接 + 未读红点
  useEffect(() => {
    if (!currentUserId) return;
    connectMessageSocket();
    getUnreadCount()
      .then((res) => setTotal((res as any)?.data?.totalUnread ?? 0))
      .catch(() => {});
    const offUnread = onUnreadChange((payload: any) => {
      if (payload && typeof payload.totalUnread === 'number') {
        setTotal(payload.totalUnread);
      }
    });
    const offMsg = onNewMessage((msg: any) => {
      if (String(msg?.sessionId) === sessionIdRef.current) {
        // 幂等追加：REST 兜底刷新与 WS 自推可能竞态，按 id 去重防重复上屏
        setMessages((prev) =>
          prev.some((m) => String(m.id) === String(msg?.id)) ? prev : [...prev, msg],
        );
        // 正在查看的会话收到新消息：立即置为已读。
        // ① 清掉悬浮窗红点；② 触发后端 publishRead，让对方界面即时变「已读」
        markSessionRead(String(msg.sessionId))
          .then(() =>
            getUnreadCount().then((r) => setTotal((r as any)?.data?.totalUnread ?? 0)),
          )
          .catch(() => {});
      }
    });
    // 已读回执：对方读取后静默刷新当前会话，让「未读」变为「已读」（不闪屏）
    const offRead = onReadChange((evt: any) => {
      if (evt?.sessionId && String(evt.sessionId) === sessionIdRef.current) {
        fetchMessages(String(evt.sessionId), true);
      }
    });
    return () => {
      offMsg();
      offUnread();
      offRead();
    };
  }, [currentUserId, fetchMessages]);

  // 展开时才轮询在线状态，避免无谓请求
  useEffect(() => {
    if (!currentUserId || collapsed || closed) return;
    loadOnline();
    const timer = setInterval(loadOnline, ONLINE_POLL_MS);
    return () => clearInterval(timer);
  }, [currentUserId, collapsed, closed, loadOnline]);

  const openSession = useCallback(
    (s: SessionVO) => {
      setSession(s);
      if (s?.id) {
        fetchMessages(String(s.id));
        markSessionRead(String(s.id))
          .then(() =>
            getUnreadCount().then((r) =>
              setTotal((r as any)?.data?.totalUnread ?? 0),
            ),
          )
          .catch(() => {});
      }
    },
    [fetchMessages],
  );

  /** 点击人员：两人会话幂等创建/复用，然后打开 */
  const handleSelectUser = useCallback(
    (user: RosterUser) => {
      setActiveUserId(user.id);
      createSession({ memberIds: [user.id] })
        .then((res) => {
          const s = (res as any)?.data;
          if (s?.id) openSession(s);
        })
        .catch(() => {});
    },
    [openSession],
  );

  const handleSend = (dto: MessageSendDTO) => {
    sendMessage(dto)
      .then(() => {
        // 消息本体由 WS 自推实时追加（onNewMessage 已按 id 去重），
        // 此处仅静默兜底同步已读计数，不再触发整屏 loading
        if (sessionIdRef.current) fetchMessages(sessionIdRef.current, true);
      })
      .catch(() => {
        // 发送失败：恢复一次带 loading 的完整刷新以保持一致
        if (sessionIdRef.current) fetchMessages(sessionIdRef.current);
      });
  };

  // 未登录不渲染
  if (!currentUserId) return null;

  if (closed) {
    return (
      <Tooltip title="打开消息">
        <Badge count={total} size="small" offset={[-6, 6]}>
          <Button
            shape="circle"
            type="primary"
            icon={<CommentOutlined />}
            onClick={() => {
              setClosed(false);
              setCollapsed(false);
            }}
            style={{
              position: 'fixed',
              right: 24,
              bottom: 24,
              width: 48,
              height: 48,
              zIndex: 1100,
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          />
        </Badge>
      </Tooltip>
    );
  }

  if (collapsed) {
    return (
      <Badge count={total} size="small" offset={[-8, 8]}>
        <Button
          type="primary"
          icon={<CommentOutlined />}
          onClick={() => setCollapsed(false)}
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            height: 40,
            zIndex: 1100,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          消息
        </Button>
      </Badge>
    );
  }

  const title = session
    ? session.name ||
      (session.memberCount && session.memberCount > 2
        ? `群聊（${session.memberCount}）`
        : '私聊会话')
    : '消息';

  const activeOnline = activeUserId ? onlineIds.has(activeUserId) : false;

  return (
    <Flex
      vertical
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        width: 760,
        height: 520,
        maxWidth: 'calc(100vw - 48px)',
        maxHeight: 'calc(100vh - 48px)',
        background: token.colorBgElevated,
        borderRadius: 8,
        boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        zIndex: 1100,
      }}
    >
      {/* 头部：标题 + 在线状态 + 折叠/关闭 */}
      <Flex
        align="center"
        justify="space-between"
        style={{
          padding: '10px 12px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Flex align="center" gap={8} style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis style={{ maxWidth: 260 }}>
            {title}
          </Typography.Text>
          {session && (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, color: activeOnline ? token.colorSuccess : token.colorTextTertiary }}
            >
              {activeOnline ? '在线' : '离线'}
            </Typography.Text>
          )}
        </Flex>
        <Flex align="center" gap={4}>
          <Tooltip title={rosterVisible ? '隐藏人员列表' : '显示人员列表'}>
            <Button
              type="text"
              size="small"
              icon={<TeamOutlined />}
              onClick={() => setRosterVisible((v) => !v)}
            />
          </Tooltip>
          <Tooltip title="收起">
            <Button
              type="text"
              size="small"
              icon={<MinusOutlined />}
              onClick={() => setCollapsed(true)}
            />
          </Tooltip>
          <Tooltip title="关闭">
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setClosed(true)}
            />
          </Tooltip>
        </Flex>
      </Flex>

      {/* 主体：左聊天 + 右人员列表 */}
      <Flex style={{ flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, borderRight: rosterVisible ? `1px solid ${token.colorBorderSecondary}` : undefined }}>
          {loadingMessages && !session ? (
            <Flex align="center" justify="center" style={{ height: '100%' }}>
              <Spin />
            </Flex>
          ) : (
            <ChatPanel
              session={session}
              messages={messages}
              currentUserId={currentUserId}
              loading={loadingMessages}
              onSend={handleSend}
              onOpenBiz={(type, id) => {
                if (type === 'WF_TASK') window.open(`/workflow/task/${id}`, '_blank');
                else if (type === 'WF_INSTANCE')
                  window.open(`/workflow/instance/${id}`, '_blank');
              }}
            />
          )}
        </div>
        {rosterVisible && (
          <div style={{ width: 240, flexShrink: 0 }}>
            <StaffRoster
              onlineIds={onlineIds}
              activeUserId={activeUserId}
              onSelect={handleSelectUser}
            />
          </div>
        )}
      </Flex>
    </Flex>
  );
}
