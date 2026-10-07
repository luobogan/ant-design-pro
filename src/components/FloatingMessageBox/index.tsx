import {
  CloseOutlined,
  CommentOutlined,
  MinusOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useModel } from '@umijs/max';
import { Badge, Button, Flex, Spin, Tooltip, Typography, theme } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChatPanel from '@/pages/Message/components/ChatPanel';
import type { MessageSendDTO, SessionVO } from '@/pages/Message/data';
import {
  createSession,
  getOnlineUsers,
  getSessions,
  getUnreadCount,
  markSessionRead,
  sendMessage,
} from '@/pages/Message/service';
import { useMessageHistory } from '@/pages/Message/useMessageHistory';
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
  // 会话列表 + 每会话未读数（服务端值与 WS 推送合并），用于把两人会话未读映射到人员角标
  const [sessionList, setSessionList] = useState<SessionVO[]>([]);
  const [unreadBySession, setUnreadBySession] = useState<
    Record<string, number>
  >({});
  // 消息历史分页（初始定位最新一页 + 向上滚动加载更早历史），与 /message 页共用
  const {
    messages,
    loading: loadingMessages,
    loadingMore,
    hasMore,
    loadInitial,
    loadOlder,
    refreshSilent,
    appendLocal,
  } = useMessageHistory();

  const sessionIdRef = useRef<string | undefined>(undefined);
  sessionIdRef.current = session ? String(session.id) : undefined;
  /** 悬浮窗展开状态镜像：WS 事件回调是长闭包，直接读 state 会拿到过期值 */
  const expandedRef = useRef(false);
  expandedRef.current = !collapsed && !closed;

  const loadOnline = useCallback(() => {
    getOnlineUsers()
      .then((res) => {
        const list = (res as any)?.data ?? [];
        setOnlineIds(new Set((list as any[]).map((id) => String(id))));
      })
      .catch(() => {});
  }, []);

  /** 拉取会话列表：初始化「人员 → 未读数」映射（两人私聊的未读显示到对方头像角标） */
  const loadSessions = useCallback(() => {
    getSessions({ current: 1, pageSize: 50 })
      .then((res: any) => {
        const records: SessionVO[] = res?.data?.records ?? [];
        setSessionList(records);
        setUnreadBySession((prev) => {
          const next = { ...prev };
          records.forEach((s) => {
            if (s?.id) next[String(s.id)] = s.unreadCount ?? 0;
          });
          return next;
        });
      })
      .catch(() => {});
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
      // 逐会话未读：WS 全量推送，合并进本地映射（人员角标数据源）
      const list = payload?.sessionUnread;
      if (Array.isArray(list) && list.length > 0) {
        setUnreadBySession((prev) => {
          const next = { ...prev };
          list.forEach((u: any) => {
            if (u?.sessionId) next[String(u.sessionId)] = u.unreadCount ?? 0;
          });
          return next;
        });
      }
    });
    const offMsg = onNewMessage((msg: any) => {
      if (String(msg?.sessionId) === sessionIdRef.current) {
        // 幂等追加（hook 内按 id 去重 + 排序）：无论悬浮窗是否展开都先上屏
        appendLocal(msg);
        // 仅当悬浮窗正在展开且浏览器页签可见时才自动置为已读。
        // 否则折叠/关闭/切页签状态下会"后台静默已读"，用户未点开消息却变已读
        if (expandedRef.current && document.visibilityState === 'visible') {
          markSessionRead(String(msg.sessionId))
            .then(() =>
              getUnreadCount().then((r) => setTotal((r as any)?.data?.totalUnread ?? 0)),
            )
            .catch(() => {});
        }
      }
    });
    // 已读回执：对方读取后静默刷新当前会话，让「未读」变为「已读」（不闪屏）
    const offRead = onReadChange((evt: any) => {
      if (evt?.sessionId && String(evt.sessionId) === sessionIdRef.current) {
        refreshSilent(String(evt.sessionId));
      }
    });
    return () => {
      offMsg();
      offUnread();
      offRead();
    };
  }, [currentUserId, appendLocal, refreshSilent]);

  // 展开时才轮询在线状态 + 刷新会话未读，避免无谓请求
  useEffect(() => {
    if (!currentUserId || collapsed || closed) return;
    loadOnline();
    loadSessions();
    const timer = setInterval(loadOnline, ONLINE_POLL_MS);
    return () => clearInterval(timer);
  }, [currentUserId, collapsed, closed, loadOnline, loadSessions]);

  const openSession = useCallback(
    (s: SessionVO) => {
      setSession(s);
      if (s?.id) {
        loadInitial(String(s.id));
        // 本地立即清零该会话未读（人员角标即时消失），服务端随后确认
        setUnreadBySession((prev) =>
          prev[String(s.id)] ? { ...prev, [String(s.id)]: 0 } : prev,
        );
        markSessionRead(String(s.id))
          .then(() =>
            getUnreadCount().then((r) =>
              setTotal((r as any)?.data?.totalUnread ?? 0),
            ),
          )
          .catch(() => {});
      }
    },
    [loadInitial],
  );

  /** 手动展开悬浮窗时补一次已读：覆盖折叠/切页签期间收到、未置已读的消息 */
  const markOpenSessionRead = useCallback(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    setUnreadBySession((prev) => (prev[sid] ? { ...prev, [sid]: 0 } : prev));
    markSessionRead(sid)
      .then(() =>
        getUnreadCount().then((r) => setTotal((r as any)?.data?.totalUnread ?? 0)),
      )
      .catch(() => {});
  }, []);

  // 页签切回且悬浮窗展开时，补已读（处理页签隐藏期间到达的消息）
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && expandedRef.current) {
        markOpenSessionRead();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [markOpenSessionRead]);

  /** 人员 → 未读数：把两人私聊会话的未读映射到对方人员（群聊未读不映射到个人） */
  const unreadByUser = useMemo(() => {
    const map: Record<string, number> = {};
    sessionList.forEach((s) => {
      if (s.type !== 1 || (s.memberCount ?? 2) > 2) return;
      const other = (s.memberIds || []).find(
        (id) => String(id) !== String(currentUserId),
      );
      if (!other) return;
      const unread = unreadBySession[String(s.id)] ?? s.unreadCount ?? 0;
      if (unread > 0) {
        map[String(other)] = Math.max(map[String(other)] || 0, unread);
      }
    });
    return map;
  }, [sessionList, unreadBySession, currentUserId]);

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
        // 消息本体由 WS 自推实时追加（appendLocal 已按 id 去重），
        // 此处仅静默兜底同步已读计数，不再触发整屏 loading
        refreshSilent();
      })
      .catch(() => {
        // 发送失败：静默重取一次当前页保持一致
        refreshSilent();
      });
  };

  // 未登录不渲染
  console.log('[MSG-DIAG] FloatingMessageBox 渲染, currentUserId =', currentUserId, ', total =', total);
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
              markOpenSessionRead();
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
          onClick={() => {
            setCollapsed(false);
            markOpenSessionRead();
          }}
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
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadOlder}
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
              unreadByUser={unreadByUser}
              onSelect={handleSelectUser}
            />
          </div>
        )}
      </Flex>
    </Flex>
  );
}
