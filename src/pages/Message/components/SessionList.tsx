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
}: Props) {
  const { token } = theme.useToken();
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
      <div style={{ flex: 1, overflow: 'auto' }}>
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
                      <Avatar style={{ background: token.colorPrimary }}>
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
      </div>
    </Flex>
  );
}
