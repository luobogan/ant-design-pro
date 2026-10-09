import {
  BellFilled,
  BellOutlined,
  PlusOutlined,
  PushpinFilled,
} from '@ant-design/icons';
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Flex,
  Input,
  Spin,
  Typography,
  theme,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VirtualList from 'rc-virtual-list';
import type { SessionVO } from '../../data';

/** 单行高度：虚拟列表依赖固定行高来定位与回收节点 */
const ITEM_HEIGHT = 64;

/** 距离底部多少像素内即预取下一页，避免滚到底才出现空白 */
const PREFETCH_OFFSET = 240;

export function titleOf(s: SessionVO) {
  if (s.name) return s.name;
  if (s.memberCount && s.memberCount > 2) return `群聊（${s.memberCount}）`;
  return '私聊会话';
}

/**
 * 联系人排序规则（纯函数：无副作用、同输入必同输出，便于单测与集中维护）。
 *
 * 优先级依次为：
 *   1. 置顶会话永远在最前；
 *   2. 其余按 lastTime 倒序 —— **收到新消息时，父级只需把该联系人的 lastTime/lastMessage
 *      更新为最新，重新排序后它就自然落到最前**，无需额外维护「手动顺序」字段，
 *      也不会因为并发刷新导致顺序抖动；
 *   3. 从未有过消息的会话（lastTime 为空）恒定垫底，不挤占活跃会话；
 *   4. 兜底按 id 比较，保证排序稳定（避免 lastTime 相同的项在每次渲染时互换位置）。
 *
 * 时间比较直接用字符串：后端 lastTime 是固定格式 `YYYY-MM-DD HH:mm:ss`，
 * 字典序即等价于时间序，避免 Date.parse 在不同浏览器/时区下的解析差异。
 */
export function sortContacts(list: SessionVO[]): SessionVO[] {
  return [...list].sort((a, b) => {
    const pa = a.pinned ? 1 : 0;
    const pb = b.pinned ? 1 : 0;
    if (pa !== pb) return pb - pa;
    const ta = a.lastTime ?? '';
    const tb = b.lastTime ?? '';
    if (ta !== tb) return tb.localeCompare(ta);
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
}

interface Props {
  /** 已加载的联系人（分页累积） */
  contacts: SessionVO[];
  selectedId?: string;
  /** 首屏加载中 */
  loading?: boolean;
  /** 是否还有下一页 */
  hasMore?: boolean;
  /** 下一页拉取中 */
  loadingMore?: boolean;
  /** 滚动到接近底部时触发，由父级按页拉取 */
  onLoadMore?: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export default function ContactList({
  contacts,
  selectedId,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  onSelect,
  onNew,
}: Props) {
  const { token } = theme.useToken();
  const [keyword, setKeyword] = useState('');
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [bodyHeight, setBodyHeight] = useState(400);

  // 用 ref 读取「正在拉取」状态：onScroll 触发极其频繁，
  // 若把 loadingMore 放进回调依赖里，会不断重建回调并重复触发请求。
  const loadingMoreRef = useRef(false);
  loadingMoreRef.current = !!loadingMore;

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

  const sorted = useMemo(() => sortContacts(contacts), [contacts]);

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return sorted;
    return sorted.filter((s) => titleOf(s).toLowerCase().includes(kw));
  }, [sorted, keyword]);

  // 滚动到接近底部 → 拉取下一页（虚拟列表下即为「滚动进可视区域才加载」）
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      if (!hasMore || !onLoadMore) return;
      if (loadingMoreRef.current) return;
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= PREFETCH_OFFSET) {
        onLoadMore();
      }
    },
    [hasMore, onLoadMore],
  );

  return (
    <Flex
      vertical
      style={{
        height: '100%',
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      <Flex
        align="center"
        justify="space-between"
        style={{
          padding: 12,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Input.Search
          placeholder="搜索会话"
          allowClear
          style={{ flex: 1, marginRight: 8 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={onNew}>
          发起会话
        </Button>
      </Flex>

      <div ref={bodyRef} style={{ flex: 1, overflow: 'hidden' }}>
        {visible.length === 0 && !loading ? (
          <Empty
            description={keyword ? '没有匹配的会话' : '暂无会话'}
            style={{ marginTop: 60 }}
          />
        ) : (
          <VirtualList
            data={visible}
            height={bodyHeight}
            itemHeight={ITEM_HEIGHT}
            itemKey={(item) => String(item.id)}
            onScroll={handleScroll}
          >
            {(s: SessionVO) => (
              <div
                onClick={() => onSelect(String(s.id))}
                style={{
                  height: ITEM_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 14px',
                  cursor: 'pointer',
                  background:
                    String(s.id) === selectedId
                      ? token.colorPrimaryBg
                      : token.colorBgContainer,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <Badge count={s.unreadCount || 0} size="small" offset={[-4, 28]}>
                  <Avatar
                    src={s.avatar || undefined}
                    style={{ background: token.colorPrimary }}
                  >
                    {titleOf(s).slice(0, 1)}
                  </Avatar>
                </Badge>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    marginLeft: 12,
                    overflow: 'hidden',
                  }}
                >
                  <Flex align="center" justify="space-between">
                    <span
                      style={{
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {titleOf(s)}
                    </span>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 12, fontWeight: 400, flexShrink: 0 }}
                    >
                      {String(s.lastTime || '').slice(11, 16) || ''}
                    </Typography.Text>
                  </Flex>
                  <Flex align="center" gap={4}>
                    {s.pinned ? (
                      <PushpinFilled style={{ color: token.colorWarning }} />
                    ) : null}
                    {s.mute ? (
                      <BellFilled style={{ color: token.colorTextTertiary }} />
                    ) : (
                      <BellOutlined style={{ color: token.colorTextTertiary }} />
                    )}
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: token.colorTextSecondary,
                      }}
                    >
                      {s.lastMessage || '还没有消息'}
                    </span>
                  </Flex>
                </div>
              </div>
            )}
          </VirtualList>
        )}

        {loadingMore ? (
          <div style={{ padding: 10, textAlign: 'center' }}>
            <Spin size="small" />
          </div>
        ) : null}
      </div>
    </Flex>
  );
}
