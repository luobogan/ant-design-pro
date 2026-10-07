import { useModel } from '@umijs/max';
import { Flex, Input, Modal, Select, Typography, theme } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import * as userApi from '@/services/system/user';
import {
  connectMessageSocket,
  onNewMessage,
  onReadChange,
  onUnreadChange,
} from '@/utils/messageSocket';
import ChatPanel from './components/ChatPanel';
import SessionList from './components/SessionList';
import type { MessageSendDTO, MessageVO, SessionVO } from './data';
import {
  createSession,
  getMessages,
  getSessions,
  markSessionRead,
  sendMessage,
} from './service';

export default function MessageCenterPage() {
  const { token } = theme.useToken();
  const { initialState } = useModel('@@initialState');
  const currentUserId = initialState?.currentUser?.userid;

  const [sessions, setSessions] = useState<SessionVO[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [messages, setMessages] = useState<MessageVO[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [userOptions, setUserOptions] = useState<
    { label: string; value: string }[]
  >([]);

  /** silent=true 表示由 WS 事件触发：不闪 loading，避免聊天界面出现"整页刷新"感 */
  const fetchSessions = useCallback((silent = false) => {
    if (!silent) setLoadingSessions(true);
    getSessions({ current: 1, pageSize: 50 })
      .then((res) => setSessions((res as any)?.data?.records ?? []))
      .catch(() => {
        if (!silent) setSessions([]);
      })
      .finally(() => {
        if (!silent) setLoadingSessions(false);
      });
  }, []);

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

  const selectSession = useCallback(
    (id: string) => {
      setSelectedId(id);
      fetchMessages(id);
      markSessionRead(id).finally(() => fetchSessions(true));
    },
    [fetchMessages, fetchSessions],
  );

  useEffect(() => {
    connectMessageSocket();
    fetchSessions();
    const offMsg = onNewMessage((msg: any) => {
      const isCurrent = String(msg?.sessionId) === String(selectedId);
      if (isCurrent) {
        // 幂等追加：REST 兜底刷新与 WS 自推可能竞态，按 id 去重防重复上屏
        setMessages((prev) =>
          prev.some((m) => String(m.id) === String(msg?.id)) ? prev : [...prev, msg],
        );
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
        fetchMessages(selectedId, true);
      }
    });
    return () => {
      offMsg();
      offUnread();
      offRead();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchSessions, fetchMessages, selectedId]);

  const handleSend = (dto: MessageSendDTO) => {
    sendMessage(dto)
      .then(() => {
        // 消息本体由 WS 自推实时追加（onNewMessage 已按 id 去重），
        // 此处仅静默兜底同步（已读计数/最后消息），不再触发整屏 loading
        if (selectedId) fetchMessages(selectedId, true);
        fetchSessions(true);
      })
      .catch(() => {
        // 发送失败：恢复一次带 loading 的完整刷新以保持一致
        if (selectedId) fetchMessages(selectedId);
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

  const selectedSession = sessions.find(
    (s) => String(s.id) === String(selectedId),
  );

  return (
    <Flex style={{ height: 'calc(100vh - 112px)', background: token.colorBgLayout }}>
      <div style={{ width: 320, flexShrink: 0 }}>
        <SessionList
          sessions={sessions}
          selectedId={selectedId}
          loading={loadingSessions}
          onSelect={selectSession}
          onNew={() => setNewOpen(true)}
        />
      </div>
      <div style={{ flex: 1 }}>
        <ChatPanel
          session={selectedSession}
          messages={messages}
          currentUserId={currentUserId}
          loading={loadingMessages}
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
