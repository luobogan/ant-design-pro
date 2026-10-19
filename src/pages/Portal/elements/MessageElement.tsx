import { Badge, Button, Empty, List, Space, Statistic, Typography, theme } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { useNavigate } from '@umijs/max';
import dayjs from 'dayjs';
import type { ElementDataRow } from '@/services/portal';

const { Text } = Typography;

export interface MessageElementProps {
  rows: ElementDataRow[];
  perPage?: number;
}

/** 消息分类（对齐 blade_message.category）：1 普通消息 / 2 流程通知 / 3 系统通知 */
const CATEGORY_LABEL: Record<string, string> = {
  '1': '消息',
  '2': '流程通知',
  '3': '系统通知',
};

/**
 * 消息提醒元素
 * rows[0] = 汇总行（unread 未读数 + url 入口）；其余行 = 最近消息摘要
 * 数据源：blade-portal → Feign → blade-message /feign/client/message/*
 */
const MessageElement: React.FC<MessageElementProps> = ({ rows, perPage }) => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  if (!rows.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无消息" />;
  }
  const summary = rows[0] || {};
  const unread = Number(summary.unread ?? 0);
  const recent = rows.slice(1);
  const limit = perPage && perPage > 0 ? perPage : recent.length;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Statistic
        title={
          <Space size={6}>
            <MessageOutlined style={{ color: token.colorPrimary }} />
            <Text type="secondary">未读消息</Text>
            {unread > 0 ? <Badge count={unread} overflowCount={999} /> : null}
          </Space>
        }
        value={unread}
        valueStyle={{ fontSize: 28, fontWeight: 600 }}
      />
      <Button type="primary" ghost block onClick={() => navigate(summary.url || '/message')}>
        进入消息中心
      </Button>
      {recent.length > 0 && (
        <List
          size="small"
          dataSource={recent.slice(0, limit)}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Text ellipsis style={{ maxWidth: '100%' }}>
                    {String(item.content ?? '')}
                  </Text>
                }
                description={
                  <Space size={8} wrap>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {CATEGORY_LABEL[String(item.category ?? '')] || '消息'}
                    </Text>
                    {item.createTime && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(String(item.createTime)).format('MM-DD HH:mm')}
                      </Text>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Space>
  );
};

export default MessageElement;
