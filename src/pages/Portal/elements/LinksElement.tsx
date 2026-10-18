import { Empty, theme } from 'antd';
import type { ElementDataRow } from '@/services/portal';

export interface LinksElementProps {
  rows: ElementDataRow[];
}

/** 快捷链接元素：数据来自元素私有配置 config.links */
const LinksElement: React.FC<LinksElementProps> = ({ rows }) => {
  // 跟随全局主题（暗黑下自动变深、主色浅底跟随用户主题色）
  const { token } = theme.useToken();
  if (!rows.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无快捷入口" />;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
      {rows.map((item, index) => (
        <a
          key={`${item.name}-${index}`}
          href={item.url || '#'}
          target="_blank"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 8,
            background: token.colorFillQuaternary,
            color: token.colorText,
            fontSize: 13,
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              flex: 'none',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              background: token.colorPrimaryBg,
              color: token.colorPrimary,
            }}
          >
            {item.icon || '🔗'}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </span>
        </a>
      ))}
    </div>
  );
};

export default LinksElement; 
