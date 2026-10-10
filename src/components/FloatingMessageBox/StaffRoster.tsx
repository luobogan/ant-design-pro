import { MessageOutlined, SearchOutlined } from '@ant-design/icons';
import { Avatar, Badge, Empty, Flex, Input, Spin, Tooltip, Typography, theme } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VirtualList from 'rc-virtual-list';
import * as userApi from '@/services/system/user';

/** 单行高度：虚拟列表依赖固定行高定位与回收节点 */
const ITEM_HEIGHT = 52;

/** 距底部多少像素内预取下一页 */
const PREFETCH_OFFSET = 200;

/** 人员条目（来自 /blade-system/user/list，天然限本租户） */
export interface RosterUser {
  id: string;
  name?: string;
  realName?: string;
  account?: string;
  avatar?: string;
}

interface Props {
  /** 在线用户ID集合（字符串形式，避免大整数精度问题） */
  onlineIds: Set<string>;
  /** 当前正在聊天的人员ID */
  activeUserId?: string;
  /** 人员 → 未读消息数（两人私聊会话未读映射到对方人员），>0 时头像右上角显示红色角标 */
  unreadByUser?: Record<string, number>;
  /**
   * 人员 → 最近聊天时间（'YYYY-MM-DD HH:mm:ss'，字符串即可比大小）。
   * 有值说明「最近聊过天」，该人员会被排到在线/离线之前；同层级内按时间倒序（越近越靠前）。
   */
  lastTimeByUser?: Record<string, string>;
  /** 点击某人员：发起/打开两人会话 */
  onSelect: (user: RosterUser) => void;
}

/**
 * 人员列表：本租户全公司人员。
 *
 * 性能与交互设计：
 *  1. **虚拟列表**：只渲染可视区域内的行，几百人也不卡；
 *  2. **滚动分页**：首屏只拉一页，滚动接近底部时再取下一页（服务端分页，不全量加载）；
 *  3. **未读置顶**：有未读消息的联系人按未读数倒序排在最前，其余保持服务端原序（JS sort 稳定）。
 *     收到新消息时父级 unreadByUser 变化 → useMemo 重算 → 该联系人自动置顶，
 *     无需手动维护顺序字段，也不会因刷新导致顺序抖动；
 *  4. 搜索为服务端过滤（关键词变化重置回第 1 页）。
 */
export default function StaffRoster({
  onlineIds,
  activeUserId,
  unreadByUser,
  lastTimeByUser,
  onSelect,
}: Props) {
  const { token } = theme.useToken();
  const [users, setUsers] = useState<RosterUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [bodyHeight, setBodyHeight] = useState(400);
  const pageRef = useRef(0);
  const totalRef = useRef(0);
  const inFlightRef = useRef(false);
  const usersRef = useRef<RosterUser[]>([]);
  usersRef.current = users;

  // 虚拟列表需要确定的可视高度：首次测量 + 监听容器尺寸变化
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return undefined;
    const measure = () => setBodyHeight(el.clientHeight || 400);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** 按页拉取人员；有关键词时走服务端搜索（重置回第 1 页） */
  const fetchPage = useCallback((page: number, kw: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    userApi
      .list({
        current: page,
        // 注意：后端 Query 绑定的是 size（非 pageSize），传错会退化为默认每页 10 条
        size: 50,
        account: kw || undefined,
        realName: kw || undefined,
      })
      .then((res: any) => {
        const records: any[] = res?.data?.records ?? [];
        const total = Number(res?.data?.total ?? 0);
        totalRef.current = total;
        // 有关键词=服务端过滤结果，直接替换；否则在已加载基础上累积去重
        const prev = kw ? [] : usersRef.current;
        const seen = new Set(prev.map((u) => u.id));
        const merged = [
          ...prev,
          ...records
            .map((u) => ({
              id: String(u.id),
              name: u.name,
              realName: u.realName,
              account: u.account,
              avatar: u.avatar,
            }))
            .filter((u) => !seen.has(u.id)),
        ];
        setUsers(merged);
        const more = merged.length < total;
        setHasMore(more);
        pageRef.current = page;
        // ⚠️ 排序（未读置顶/在线靠前）只能作用于「已加载」的人员：在线的人若落在
        //    尚未加载的页里，要等用户翻页才会被排上来（实测缺陷）。
        //    故无关键词时在后台把剩余页静默拉齐 —— 虚拟列表渲染开销极低，
        //    首屏仍由第 1 页秒出，后续页到达时排序即时生效、在线者自动顶到上部。
        //    有关键词时是服务端过滤结果，不做全量拉取。
        if (!kw && more) {
          setTimeout(() => fetchPage(page + 1, kw), 0);
        }
      })
      .catch(() => {
        if (page === 1 && !kw) setUsers([]);
      })
      .finally(() => {
        inFlightRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      });
  }, []);

  // 关键词变化：防抖后重新按第 1 页拉取（服务端过滤）
  useEffect(() => {
    const timer = setTimeout(() => fetchPage(1, keyword.trim()), 300);
    return () => clearTimeout(timer);
  }, [keyword, fetchPage]);

  const displayName = (u: RosterUser) =>
    u.name || u.realName || u.account || u.id;

  /**
   * 排序（四级）：有未读 > 最近聊过天 > 在线 > 离线；同层级内保持服务端原序（JS sort 稳定）。
   *  - 收到新消息 → unreadByUser 更新 → 该联系人自动置顶；
   *  - 聊过天的人 → lastTimeByUser 更新 → 按最近聊天时间倒序，不用翻找；
   *  - 有人上线/下线 → onlineIds 更新 → 自动前移/后移。
   */
  const visible = useMemo(() => {
    const unreadOf = (id: string) => unreadByUser?.[id] ?? 0;
    const lastTimeOf = (id: string) => lastTimeByUser?.[id] || '';
    const rank = (u: RosterUser) => {
      if (unreadOf(u.id) > 0) return 0; // 有未读 → 最前（活跃会话）
      if (lastTimeOf(u.id)) return 1; // 最近聊过天 → 次之
      if (onlineIds.has(u.id)) return 2; // 在线 → 再次
      return 3; // 从未聊过且离线 → 最后
    };
    return [...users].sort((a, b) => {
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) {
        return byRank;
      }
      // 有未读组：未读数多的靠前
      if (byRank === 0) {
        return unreadOf(b.id) - unreadOf(a.id);
      }
      // 最近聊过天组：聊天时间越近越靠前
      if (byRank === 1) {
        return lastTimeOf(b.id).localeCompare(lastTimeOf(a.id));
      }
      return 0; // 在线/离线组保持服务端原序
    });
  }, [users, unreadByUser, lastTimeByUser, onlineIds]);

  const onlineCount = useMemo(
    () => users.filter((u) => onlineIds.has(u.id)).length,
    [users, onlineIds],
  );

  // 滚动到接近底部 → 取下一页（虚拟列表下即为「滚动进可视区域才加载」）
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      if (!hasMore || inFlightRef.current) return;
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= PREFETCH_OFFSET) {
        fetchPage(pageRef.current + 1, keyword.trim());
      }
    },
    [hasMore, fetchPage, keyword],
  );

  return (
    <Flex vertical style={{ height: '100%', background: token.colorBgContainer }}>
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            全公司人员
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            <span style={{ color: token.colorSuccess }}>{onlineCount}</span>
            {` / ${users.length} 在线`}
          </Typography.Text>
        </Flex>
        <Input
          size="small"
          allowClear
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder="搜索姓名/账号"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <div ref={bodyRef} style={{ flex: 1, overflow: 'hidden' }}>
        {loading && users.length === 0 ? (
          <Flex align="center" justify="center" style={{ height: 120 }}>
            <Spin />
          </Flex>
        ) : visible.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无人员"
            style={{ marginTop: 24 }}
          />
        ) : (
          <VirtualList
            data={visible}
            height={bodyHeight}
            itemHeight={ITEM_HEIGHT}
            itemKey={(item) => item.id}
            onScroll={handleScroll}
          >
            {(u: RosterUser) => {
              const online = onlineIds.has(u.id);
              const active = String(u.id) === String(activeUserId);
              return (
                <div
                  key={u.id}
                  onClick={() => onSelect(u)}
                  style={{
                    height: ITEM_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    cursor: 'pointer',
                    background: active ? token.colorPrimaryBg : undefined,
                  }}
                >
                  <Flex align="center" gap={10} style={{ width: '100%' }}>
                    {/* 两层 Badge：外层未读数（右上角，0 时自动隐藏），内层在线状态点（右下角） */}
                    <Badge
                      count={unreadByUser?.[u.id] || 0}
                      size="small"
                      offset={[-2, 2]}
                      style={{ boxShadow: `0 0 0 2px ${token.colorBgContainer}` }}
                    >
                      <Badge
                        dot
                        color={online ? token.colorSuccess : token.colorTextTertiary}
                        offset={[-2, 30]}
                      >
                        <Avatar
                          src={u.avatar}
                          style={{ background: token.colorPrimary }}
                        >
                          {displayName(u).slice(0, 1)}
                        </Avatar>
                      </Badge>
                    </Badge>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text
                        ellipsis
                        style={{ fontSize: 13, display: 'block' }}
                      >
                        {displayName(u)}
                      </Typography.Text>
                      <Typography.Text
                        type="secondary"
                        ellipsis
                        style={{ fontSize: 12, display: 'block' }}
                      >
                        {online ? '在线' : '离线'}
                        {u.account ? ` · ${u.account}` : ''}
                      </Typography.Text>
                    </div>
                    <Tooltip title="发消息">
                      <MessageOutlined
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(u);
                        }}
                        style={{
                          color: active ? token.colorPrimary : token.colorTextSecondary,
                          cursor: 'pointer',
                        }}
                      />
                    </Tooltip>
                  </Flex>
                </div>
              );
            }}
          </VirtualList>
        )}

        {loadingMore ? (
          <div style={{ padding: 8, textAlign: 'center' }}>
            <Spin size="small" />
          </div>
        ) : null}
      </div>
    </Flex>
  );
}
