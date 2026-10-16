import { List, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useNavigate } from '@umijs/max';
import type { ElementDataRow } from '@/services/portal';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Text } = Typography;

export interface TodoElementProps {
  rows: ElementDataRow[];
  /** 显示条数（来自元素配置 perPage） */
  perPage?: number;
}

/** 紧急程度 → 颜色（对齐流程紧急度 0普通 1较急 2紧急） */
const urgencyColor: Record<number, string> = { 0: '#86909C', 1: '#FF7D00', 2: '#F53F3F' };

/**
 * 待办事项元素
 * 数据源：blade-portal → Feign → blade-workflow /feign/client/task/todo
 */
const TodoElement: React.FC<TodoElementProps> = ({ rows, perPage = 5 }) => {
  const navigate = useNavigate();
  const list = rows.slice(0, perPage);
  return (
    <List
      size="small"
      dataSource={list}
      renderItem={(item) => (
        <List.Item style={{ padding: '9px 4px' }}>
          <List.Item.Meta
            title={
              <a
                href={item.url || '/workflow/todo'}
                onClick={(e) => {
                  // 站内跳转待办列表（保留登录态与门户上下文）
                  e.preventDefault();
                  navigate(item.url || '/workflow/todo');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: urgencyColor[item.urgency ?? 0],
                    flex: 'none',
                  }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title || '（无标题流程）'}
                </span>
              </a>
            }
            description={
              <Space size={8} wrap>
                {item.defName ? <Text type="secondary">{item.defName}</Text> : null}
                {item.nodeName ? <Tag color="blue">{item.nodeName}</Tag> : null}
                {item.receiveTime ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(item.receiveTime).fromNow()}
                  </Text>
                ) : null}
              </Space>
            }
          />
        </List.Item>
      )}
    />
  );
};

export default TodoElement;