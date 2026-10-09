import { useModel } from '@umijs/max';
import {
  Badge,
  Flex,
  Input,
  Modal,
  Select,
  Tabs,
  Typography,
  theme,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as userApi from '@/services/system/user';
import {
  connectMessageSocket,
  onNewMessage,
  onReadChange,
  onUnreadChange,
} from '@/utils/messageSocket';
import ChatPanel from './components/ChatPanel';
import ContactList from './components/ContactList';
import NoticeList from './components/NoticeList';
import type { MessageSendDTO, SessionVO } from './data';
import {
  createSession,
  getSessions,
  markSessionRead,
  sendMessage,
} from './service';
import { useMessageHistory } from './useMessageHistory';

/** 每页联系人数量：首屏只取一页，其余滚到可视区域再取 */
const PAGE_SIZE = 20;

/** 系统通知会话类型（流程消息，每人一条；对齐后端 MessageConstant.SESSION_TYPE_NOTICE） */
const SESSION_TYPE_NOTICE = 3;

/** 生成与后端同款的时间串（YYYY-MM-DD HH:mm:ss），供本地置顶排序使用 */
function nowText() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * 就地更新（而非插入）一个联系人，返回新数组。
 *
 * <p>纯函数、不改原数组，让 React 能正确感知变化。若该联系人尚未被分页加载到，
 * 则直接忽略 —— 后续翻页时服务端会带上它的最新摘要，不会因此产生错误顺序。</p>
 */
function patchContact(
  list: SessionVO[],
  id: string,
  patch: Partial<SessionVO>,
): SessionVO[] {
  const idx = list.findIndex((c) => String(c.id) === id);
  if (idx < 0) return list;
  const next = [...list];
  next[idx] = { ...next[idx], ...patch };
  return next;
}

export default function MessageCenterPage() {
  const { token } = theme.useToken();
  const { initialState } = useModel('@@initialState');
  const currentUserId = initialState?.currentUser?.userid;

  // 联系人：分页累积，只保存「已加载」的部分
  const [contacts, setContacts] = useState<SessionVO[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // 用 ref 镜像当前列表与页码：避免把 contacts 塞进 loadPage 依赖导致回调反复重建
  const contactsRef = useRef<SessionVO[]>([]);
  contactsRef.current = contacts;
  const pageRef = useRef(0);
  const inFlightRef = useRef(false);

  // 消息历史分页（初始定位最新一页 + 向上滚动加载更早历史），与悬浮消息框共用
  const {
    messages,
    loading: loadingMessages,
    loadingMore: loadingMoreMessages,
    hasMore: hasMoreMessages,
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

  /** 按页拉取联系人；silent=true 表示后台同步，不闪 loading */
  const loadContactsPage = useCallback((page: number, silent = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (!silent) {
      if (page === 1) setLoadingContacts(true);
      else setLoadingMore(true);
    }
    getSessions({ current: page, pageSize: PAGE_SIZE })
      .then((res) => {
        const data = (res as any)?.data;
        const records: SessionVO[] = data?.records ?? [];
        const total = Number(data?.total ?? 0);
        const prev = contactsRef.current;
        const seen = new Set(prev.map((c) => String(c.id)));
        const merged = [
          ...prev,
          ...records.filter((c) => !seen.has(String(c.id))),
        ];
        setContacts(merged);
        setHasMore(merged.length < total);
        pageRef.current = page;
      })
      .catch(() => {
        if (!silent && page === 1) setContacts([]);
      })
      .finally(() => {
        inFlightRef.current = false;
        setLoadingContacts(false);
        setLoadingMore(false);
      });
  }, []);

  /** 滚动到可视区域底部时由 ContactList 回调，取下一页 */
  const loadMoreContacts = useCallback(() => {
    if (!hasMore || inFlightRef.current) return;
    loadContactsPage(pageRef.current + 1);
  }, [hasMore, loadContactsPage]);

  const selectSession = useCallback(
    (id: string) => {
      setSelectedId(id);
      loadInitial(id);
      // 本地清零未读即可，不必重拉整个列表（此前每次点击都会整列表刷新）
      setContacts((prev) => patchContact(prev, id, { unreadCount: 0 }));
      markSessionRead(id);
    },
    [loadInitial],
  );

  useEffect(() => {
    connectMessageSocket();
    loadContactsPage(1);

    const offMsg = onNewMessage((msg: any) => {
      const sid = String(msg?.sessionId);
      const isCurrent = sid === String(selectedId);
      if (isCurrent) {
        // 幂等追加（hook 内按 id 去重 + 排序）：REST 兜底刷新与 WS 自推可能竞态
        appendLocal(msg);
        // 正在查看的会话收到新消息：仅当浏览器页签可见时才自动置为已读，
        // 否则切走页签时会被"后台静默已读"。
        if (document.visibilityState === 'visible') {
          markSessionRead(sid);
        }
      }
      // 新消息 → 就地更新该联系人的摘要与时间：
      // sortContacts 按 lastTime 倒序，更新后它会自动落到列表最前（活跃会话置顶），
      // 全程不重拉列表，避免"收到一条消息就整列表刷新"。
      setContacts((prev) => {
        const next = patchContact(prev, sid, {
          lastMessage: msg?.content ?? '',
          lastTime: msg?.createTime ?? nowText(),
        });
        if (isCurrent) return next;
        const idx = next.findIndex((c) => String(c.id) === sid);
        if (idx < 0) return next;
        const inc = [...next];
        inc[idx] = {
          ...inc[idx],
          unreadCount: (inc[idx].unreadCount ?? 0) + 1,
        };
        return inc;
      });
    });

    // 页签切回且正停留在某会话时，补一次已读（覆盖页签隐藏期间到达的消息）
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedId) {
        markSessionRead(selectedId);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 未读红点：用推送 payload 在本地精准合并，不触发列表刷新
    const offUnread = onUnreadChange((evt: any) => {
      const list = evt?.sessionUnread;
      if (Array.isArray(list) && list.length > 0) {
        setContacts((prev) =>
          prev.map((c) => {
            const hit = list.find(
              (u: any) => String(u.sessionId) === String(c.id),
            );
            return hit ? { ...c, unreadCount: hit.unreadCount ?? 0 } : c;
          }),
        );
      }
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
  }, [appendLocal, refreshSilent, selectedId, loadContactsPage]);

  const handleSend = (dto: MessageSendDTO) => {
    sendMessage(dto)
      .then(() => {
        // 消息本体由 WS 自推实时追加（appendLocal 已按 id 去重），
        // 这里只同步会话摘要，让该联系人依 lastTime 排到最前
        if (dto?.sessionId) {
          setContacts((prev) =>
            patchContact(prev, String(dto.sessionId), {
              lastMessage: dto.content ?? '',
              lastTime: nowText(),
            }),
          );
          refreshSilent(String(dto.sessionId));
        }
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
        const s = ((res as any)?.data ?? {}) as SessionVO;
        if (s?.id) {
          // 新会话直接并入列表（置顶由 sortContacts 依据 lastTime 决定）
          setContacts((prev) => {
            const seen = new Set(prev.map((c) => String(c.id)));
            return seen.has(String(s.id)) ? prev : [s, ...prev];
          });
          selectSession(String(s.id));
        }
        setNewOpen(false);
        setMembers([]);
        setNewName('');
      })
      .catch(() => {});
  };

  const selectedSession = contacts.find(
    (s) => String(s.id) === String(selectedId),
  );

  // 消息中心分类层（§10.6）：
  //   聊天 tab  = 人员会话（type≠3）；流程通知 tab = 系统通知会话（type=3，每人一条），
  //   通知以卡片列表呈现，不进聊天气泡流。
  const chatContacts = useMemo(
    () => contacts.filter((c) => c.type !== SESSION_TYPE_NOTICE),
    [contacts],
  );
  const noticeSession = useMemo(
    () => contacts.find((c) => c.type === SESSION_TYPE_NOTICE),
    [contacts],
  );
  const [activeTab, setActiveTab] = useState<'chat' | 'notice'>('chat');

  // 切到「流程通知」即整会话已读：本地清零 + 调后端（红点经 /queue/unread 同步给铃铛）
  useEffect(() => {
    if (activeTab !== 'notice') return;
    const sid = noticeSession?.id ? String(noticeSession.id) : undefined;
    if (sid && (noticeSession?.unreadCount ?? 0) > 0) {
      setContacts((prev) => patchContact(prev, sid, { unreadCount: 0 }));
      markSessionRead(sid);
    }
  }, [activeTab, noticeSession?.id, noticeSession?.unreadCount]);

  return (
    <Flex
      style={{ height: 'calc(100vh - 112px)', background: token.colorBgLayout }}
    >
      <div
        style={{
          width: 320,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: token.colorBgContainer,
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'chat' | 'notice')}
          centered
          style={{ marginBottom: 0 }}
          items={[
            { key: 'chat', label: '聊天' },
            {
              key: 'notice',
              label: (
                <Badge
                  count={noticeSession?.unreadCount ?? 0}
                  size="small"
                  offset={[10, 0]}
                >
                  流程通知
                </Badge>
              ),
            },
          ]}
        />
        <div style={{ flex: 1, minHeight: 0 }}>
          {activeTab === 'chat' ? (
            <ContactList
              contacts={chatContacts}
              selectedId={selectedId}
              loading={loadingContacts}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMoreContacts}
              onSelect={selectSession}
              onNew={() => setNewOpen(true)}
            />
          ) : (
            <NoticeList
              session={noticeSession}
              onJump={(type, id) => {
                if (type === 'WF_TASK')
                  window.open(`/workflow/task/${id}`, '_blank');
                else if (type === 'WF_INSTANCE')
                  window.open(`/workflow/instance/${id}`, '_blank');
              }}
            />
          )}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <ChatPanel
          session={selectedSession}
          messages={messages}
          currentUserId={currentUserId}
          loading={loadingMessages}
          hasMore={hasMoreMessages}
          loadingMore={loadingMoreMessages}
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
