import { Alert, Button, Card, Empty, Skeleton, Space, Typography } from 'antd';
import { ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

const { Text } = Typography;

export interface ElementShellProps {
  /** 卡片标题（元素配置里的 elementName） */
  title?: string;
  /** 是否显示标题（showTitle=0 时只留内容） */
  showTitle?: number;
  /** 右上角「更多」跳转地址 */
  moreUrl?: string;
  moreText?: string;
  /** 加载中 */
  loading?: boolean;
  /** 取数失败（Provider 降级：success=false） */
  error?: string;
  /** 数据为空 */
  empty?: boolean;
  emptyText?: string;
  /** 手动刷新 */
  onRefresh?: () => void;
  /** 打开个性化设置（显示条数 / 标题显隐） */
  onSetting?: () => void;
  children?: ReactNode;
}

/**
 * 门户元素统一卡片外壳
 * - 统一标题 / 更多 / 刷新 / 骨架屏 / 错误态 / 空态
 * - 单元素失败只影响该卡片（错误态在此收敛），不影响整页
 */
const ElementShell: React.FC<ElementShellProps> = ({
  title,
  showTitle = 1,
  moreUrl,
  moreText = '更多',
  loading,
  error,
  empty,
  emptyText = '暂无数据',
  onRefresh,
  onSetting,
  children,
}) => {
  const showHead = showTitle !== 0;

  const renderBody = () => {
    if (loading) {
      return <Skeleton active paragraph={{ rows: 4 }} />;
    }
    if (error) {
      return (
        <Alert
          type="error"
          showIcon
          message={error}
          action={
            onRefresh ? (
              <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh}>
                重试
              </Button>
            ) : undefined
          }
        />
      );
    }
    if (empty) {
      return (
        <div style={{ padding: '18px 0' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
        </div>
      );
    }
    return <div style={{ minHeight: 120 }}>{children}</div>;
  };

  return (
    <Card
      variant="borderless"
      hoverable
      title={
        showHead ? (
          <Text strong style={{ fontSize: 14 }}>
            {title}
          </Text>
        ) : undefined
      }
      extra={
        showHead ? (
          <Space size={4}>
            {onSetting ? (
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={onSetting}
                aria-label="个性化设置"
              />
            ) : null}
            {onRefresh ? (
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                onClick={onRefresh}
                aria-label="刷新"
              />
            ) : null}
            {moreUrl ? (
              <Button type="link" size="small" href={moreUrl} target="_blank" style={{ padding: 0 }}>
                {moreText}
              </Button>
            ) : null}
          </Space>
        ) : null
      }
      style={{
        height: '100%',
        borderRadius: 10,
        boxShadow: '0 2px 10px rgba(31, 39, 51, 0.06)',
        transition: 'transform .18s ease, box-shadow .18s ease',
      }}
    >
      {renderBody()}
    </Card>
  );
};

export default ElementShell;