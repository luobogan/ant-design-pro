import { Empty } from 'antd';
import type { ElementDataRow } from '@/services/portal';

export interface RichElementProps {
  rows: ElementDataRow[];
}

/**
 * 富文本内容元素
 * 数据来自元素私有配置 config.html（由设计器富文本编辑区维护）
 */
const RichElement: React.FC<RichElementProps> = ({ rows }) => {
  const row = rows[0] || {};
  const html = row.html as string | undefined;
  if (!html) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无内容" />;
  }
  return (
    <div
      style={{ lineHeight: 1.8, color: '#1F2733', fontSize: 14 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default RichElement; 
