import { useEffect, useRef } from 'react';
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
  List,
  Spin,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { SessionVO } from '../data';

interface Props {
  sessions: SessionVO[];
  selectedId?: string;
  loading?: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** 「还没有消息」的会话：哨兵滚动进可视区域时触发按需加载 */
  onLoadEmpty?: () => void;
  /** 是否还在拉取无消息会话 */
  loadingEmpty?: boolean;
  /** 是否还有未加载的无消息会话（false 时不再渲染哨兵） */
  hasMoreEmpty?: boolean;
}

function titleOf(s: SessionVO) {
  if (s.name) return s.name;
  if (s.memberCount && s.memberCount > 2) return `群聊（${s.memberCount}）`;
  return '私聊会话';
}

export default function SessionList({
  sessions,
  selectedId,
  loading,
  onSelect,
  onNew,
  onLoadEmpty,
  loadingEmpty,
  hasMoreEmpty,
}: Props) {
  const { token } = theme.useToken();
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 无消息会话按需加载：仅当哨兵进入「会话列表滚动容器」的可视区域才拉取，
  // 首屏无需为它们付出装配成本。root 用滚动容器而非浏览器视口，避免外层布局影响判定。
  useEffect(() => {
    if (!hasMoreEmpty || !onLoadEmpty) return undefined;
    const target = sentinelRef.current;
    if (!target) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadEmpty();
        }
      },
      { root: listRef.current, rootMargin: '120px', threshold: 0.01 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreEmpty, onLoadEmpty, loadingEmpty]);

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
        style={{ padding: 12, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <Input.Search
          placeholder="搜索会话"
          allowClear
          style={{ flex: 1, marginRight: 8 }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={onNew}>
          发起会话
        </Button>
      </Flex>
      <div ref={listRef} style={{ flex: 1, overflow: 'auto' }}>
        {sessions.length === 0 && !loading ? (
          <Empty description="暂无会话" style={{ marginTop: 60 }} />
        ) : (
          <List
            loading={loading}
            dataSource={sessions}
            renderItem={(s) => (
              <List.Item
                onClick={() => onSelect(String(s.id))}
                style={{
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: String(s.id) === selectedId ? token.colorPrimaryBg : token.colorBgContainer,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Badge
                      count={s.unreadCount || 0}
                      size="small"
                      offset={[-4, 28]}
                    >
                      <Avatar src={s.avatar || undefined} style={{ background: token.colorPrimary }}>
                        {titleOf(s).slice(0, 1)}
                      </Avatar>
                    </Badge>
                  }
                  title={
                    <Flex align="center" justify="space-between">
                      <span style={{ fontWeight: 500 }}>{titleOf(s)}</span>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12, fontWeight: 400 }}
                      >
                        {String(s.lastTime || '').slice(11, 16) || ''}
                      </Typography.Text>
                    </Flex>
                  }
                  description={
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
                  }
                />
              </List.Item>
            )}
          />
        )}
        {hasMoreEmpty ? (
          <div ref={sentinelRef} style={{ padding: 14, textAlign: 'center' }}>
            {loadingEmpty ? (
              <Spin size="small" />
            ) : (
              <Typography.Text type="secondary">
                滚动加载「还没有消息」的会话
              </Typography.Text>
            )}
          </div>
        ) : null}
      </div>
    </Flex>
  );
}
