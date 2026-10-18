import { List, Space, Typography, theme } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from '@umijs/max';
import type { ElementDataRow } from '@/services/portal';

const { Text } = Typography;

export interface NoticeElementProps {
  rows: ElementDataRow[];
  perPage?: number;
}

/** 公告分类文案（blade_notice.category） */
const categoryLabel: Record<number, string> = { 1: '通知', 2: '公告', 3: '公示', 4: '其他' };

/**
 * 通知公告元素
 * 数据源：blade-portal 直查 blade_notice（多服务共用数据源）
 */
const NoticeElement: React.FC<NoticeElementProps> = ({ rows, perPage = 5 }) => {
  const navigate = useNavigate();
  // 分类标签跟随主题（暗黑下自动变深底，主色跟随用户主题色）
  const { token } = theme.useToken();
  const list = rows.slice(0, perPage);
  return (
    <List
      size="small"
      dataSource={list}
      renderItem={(item) => (
        <List.Item
          style={{ padding: '9px 4px' }}
          extra={
            item.releaseTime ? (
              <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                {dayjs(item.releaseTime).format('YYYY-MM-DD')}
              </Text>
            ) : null
          }
        >
          <Space size={8}>
            <span
              style={{
                fontSize: 12,
                color: token.colorPrimary,
                background: token.colorPrimaryBg,
                borderRadius: 4,
                padding: '0 6px',
                flex: 'none',
              }}
            >
              {categoryLabel[item.category] ?? '公告'}
            </span>
            <a
              href={`/portal/noticedetail?id=${item.id}`}
              onClick={(e) => {
                // 站内详情页走前端路由（保留门户上下文），不再新开标签
                e.preventDefault();
                if (item.id) {
                  navigate(`/portal/noticedetail?id=${item.id}`);
                }
              }}
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {item.title}
            </a>
          </Space>
        </List.Item>
      )}
    />
  );
};

export default NoticeElement;