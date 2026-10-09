import { useModel } from '@umijs/max';
import { Flex, Input, Modal, Select, Typography, theme } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as userApi from '@/services/system/user';
import {
  connectMessageSocket,
  onNewMessage,
  onReadChange,
  onUnreadChange,
} from '@/utils/messageSocket';
import ChatPanel from './components/ChatPanel';
import SessionList from './components/SessionList';
import type { MessageSendDTO, SessionVO } from './data';
import {
  createSession,
  getSessions,
  markSessionRead,
  sendMessage,
} from './service';
import { useMessageHistory } from './useMessageHistory';

export default function MessageCenterPage() {
  const { token } = theme.useToken();
  const { initialState } = useModel('@@initialState');
  const currentUserId = initialState?.currentUser?.userid;

  const [sessions, setSessions] = useState<SessionVO[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [loadingSessions, setLoadingSessions] = useState(false);
  // 「还没有消息」的会话：首屏不加载，等滚动到可视区域时按需分页拉取并追加
  const [emptySessions, setEmptySessions] = useState<SessionVO[]>([]);
  const [emptyTotal, setEmptyTotal] = useState(0);
  const [emptyLoaded, setEmptyLoaded] = useState(false);
  const [loadingEmpty, setLoadingEmpty] = useState(false);
  const emptyPageRef = useRef(0);
  const emptyLoadingRef = useRef(false);
  // 消息历史分页（初始定位最新一页 + 向上滚动加载更早历史），与悬浮消息框共用
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
  const [newOpen, setNewOpen] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [userOptions, setUserOptions] = useState<
    { label: string; value: string }[]
  >([]);

  /** silent=true 表示由 WS 事件触发：不闪 loading，避免聊天界面出现"整页刷新"感 */
  const fetchSessions = useCallback((silent = false) => {
    if (!silent) setLoadingSessions(true);
    // 首屏只取「已有消息」的会话：全公司会话里绝大多数是还没有消息的空会话，
    // 一次性全部装配是首屏耗时的主要来源；空会话改为滚动到可视区域时按需加载。
    getSessions({ current: 1, pageSize: 50, hasMessage: true })
      .then((res) => setSessions((res as any)?.data?.records ?? []))
      .catch(() => {
        if (!silent) setSessions([]);
      })
      .finally(() => {
        if (!silent) setLoadingSessions(false);
      });
  }, []);

  /**
   * 无消息会话按需加载：由会话列表底部哨兵在进入可视区域时触发，按页追加。
   * 用 ref 记录页码 / 在途状态，避免闭包读到旧值导致重复请求或漏页。
   */
  const loadEmptySessions = useCallback(() => {
    if (emptyLoadingRef.current) return;
    emptyLoadingRef.current = true;
    setLoadingEmpty(true);
    const next = emptyPageRef.current + 1;
    getSessions({ current: next, pageSize: 20, hasMessage: false })
      .then((res) => {
        const data = (res as any)?.data;
        const records: SessionVO[] = data?.records ?? [];
        emptyPageRef.current = next;
        setEmptySessions((prev) => {
          const seen = new Set(prev.map((s) => String(s.id)));
          return [...prev, ...records.filter((s) => !seen.has(String(s.id)))];
        });
        setEmptyTotal(Number(data?.total ?? 0));
        setEmptyLoaded(true);
      })
      .catch(() => {})
      .finally(() => {
        emptyLoadingRef.current = false;
        setLoadingEmpty(false);
      });
  }, []);

  const selectSession = useCallback(
    (id: string) => {
      setSelectedId(id);
      loadInitial(id);
      markSessionRead(id).finally(() => fetchSessions(true));
    },
    [loadInitial, fetchSessions],
  );

  useEffect(() => {
    connectMessageSocket();
    fetchSessions();
    const offMsg = onNewMessage((msg: any) => {
      const isCurrent = String(msg?.sessionId) === String(selectedId);
      if (isCurrent) {
        // 幂等追加（hook 内按 id 去重 + 排序）：REST 兜底刷新与 WS 自推可能竞态
        appendLocal(msg);
        // 正在查看的会话收到新消息：仅当浏览器页签可见时才自动置为已读，
        // 否则切走页签时会被"后台静默已读"。① 清自己侧红点；② 触发 publishRead 回执
        if (document.visibilityState === 'visible') {
          markSessionRead(String(msg.sessionId)).finally(() => fetchSessions(true));
        }
      }
      fetchSessions(true);
    });
    // 页签切回且正停留在某会话时，补一次已读（覆盖页签隐藏期间到达的消息）
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedId) {
        markSessionRead(selectedId).finally(() => fetchSessions(true));
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    // 未读红点：用推送 payload 在本地精准合并，避免全量刷新闪烁；再静默兜底同步最后消息/排序
    const offUnread = onUnreadChange((evt: any) => {
      const list = evt?.sessionUnread;
      if (Array.isArray(list) && list.length > 0) {
        setSessions((prev) =>
          prev.map((s) => {
            const hit = list.find((u: any) => String(u.sessionId) === String(s.id));
            return hit ? { ...s, unreadCount: hit.unreadCount ?? 0 } : s;
          }),
        );
      }
      fetchSessions(true);
    });
    // 已读回执：对方读取后静默刷新当前会话消息，让「未读」变「已读」（不闪屏）
    const offRead = onReadChange((evt: any) => {
      if (selectedId && String(evt?.sessionId) === String(selectedId)) {
        refreshSilent(selectedId);
      }
    });
    return () => {
      offMsg();
      offUnread();
      offRead();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchSessions, appendLocal, refreshSilent, selectedId]);

  const handleSend = (dto: MessageSendDTO) => {
    sendMessage(dto)
      .then(() => {
        // 消息本体由 WS 自推实时追加（appendLocal 已按 id 去重），
        // 此处仅静默兜底同步（已读计数/最后消息），不再触发整屏 loading
        if (selectedId) refreshSilent(selectedId);
        fetchSessions(true);
      })
      .catch(() => {
        // 发送失败：静默重取一次当前页保持一致
        if (selectedId) refreshSilent(selectedId);
      });
  };

  const handleCreate = () => {
    if (members.length === 0) return;
    createSession({ memberIds: members, name: newName || undefined })
      .then((res) => {
        const s = (res as any)?.data;
        if (s?.id) selectSession(String(s.id));
        setNewOpen(false);
        setMembers([]);
        setNewName('');
      })
      .catch(() => {});
  };

  // 展示顺序：已有消息的会话（后端按 lastTime 倒序）在前，按需加载的无消息会话追加在后。
  // 若某个空会话期间收到了消息，它会同时出现在两个列表里 —— 以 sessions（有消息）为准去重。
  const allSessions = useMemo(() => {
    const ids = new Set(sessions.map((s) => String(s.id)));
    return [...sessions, ...emptySessions.filter((s) => !ids.has(String(s.id)))];
  }, [sessions, emptySessions]);

  // 首次拉取完成前先显示哨兵；拉取后按总数判断是否还有下一页
  const hasMoreEmpty = !emptyLoaded || emptySessions.length < emptyTotal;

  const selectedSession = allSessions.find(
    (s) => String(s.id) === String(selectedId),
  );

  return (
    <Flex style={{ height: 'calc(100vh - 112px)', background: token.colorBgLayout }}>
      <div style={{ width: 320, flexShrink: 0 }}>
        <SessionList
          sessions={allSessions}
          selectedId={selectedId}
          loading={loadingSessions}
          onSelect={selectSession}
          onNew={() => setNewOpen(true)}
          onLoadEmpty={loadEmptySessions}
          loadingEmpty={loadingEmpty}
          hasMoreEmpty={hasMoreEmpty}
        />
      </div>
      <div style={{ flex: 1 }}>
        <ChatPanel
          session={selectedSession}
          messages={messages}
          currentUserId={currentUserId}
          loading={loadingMessages}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadOlder}
          onSend={handleSend}
          onOpenBiz={(type, id) => {
            if (type === 'WF_TASK')
              window.open(`/workflow/task/${id}`, '_blank');
            else if (type === 'WF_INSTANCE')
              window.open(`/workflow/instance/${id}`, '_blank');
          }}
        />
      </div>

      <Modal
        title="发起会话"
        open={newOpen}
        onOk={handleCreate}
        onCancel={() => setNewOpen(false)}
        okButtonProps={{ disabled: members.length === 0 }}
      >
        <Flex vertical gap={12}>
          <div>
            <Typography.Text type="secondary">选择成员</Typography.Text>
            <Select
              mode="multiple"
              style={{ width: '100%', marginTop: 6 }}
              placeholder="搜索并选择成员"
              showSearch
              filterOption={false}
              onSearch={(kw) =>
                userApi
                  .list({ current: 1, pageSize: 20, account: kw, realName: kw })
                  .then((r: any) =>
                    setUserOptions(
                      ((r?.data?.records as any[]) ?? []).map((u) => ({
                        label: `${u.name || u.realName}（${u.account}）`,
                        value: String(u.id),
                      })),
                    ),
                  )
                  .catch(() => setUserOptions([]))
              }
              options={userOptions}
              value={members}
              onChange={setMembers}
            />
          </div>
          <Input
            placeholder="群名称（选填，两人会话可留空）"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </Flex>
      </Modal>
    </Flex>
  );
}
