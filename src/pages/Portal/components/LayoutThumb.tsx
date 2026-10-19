import { useMemo } from 'react';
import { Empty, Typography, theme } from 'antd';
import { ELEMENT_TYPE_META } from '@/services/portal';
import type { ElementType } from '@/services/portal';

const { Text } = Typography;

/** 元素类型 → 缩略图色块配色 */
const TYPE_COLORS: Record<string, string> = {
  todo: '#1677ff',
  notice: '#fa8c16',
  message: '#722ed1',
  chart: '#13c2c2',
  links: '#52c41a',
  rich: '#eb2f96',
};

interface Row {
  rowNo: number;
  items: any[];
}

/** 解析布局元素 JSON → 按行分组（按 sortOrder 排序） */
const parseRows = (elementsJson?: string): Row[] => {
  if (!elementsJson) return [];
  try {
    const els = JSON.parse(elementsJson);
    if (!Array.isArray(els)) return [];
    const grouped = new Map<number, any[]>();
    els.forEach((e: any) => {
      const rowNo = e?.rowNo || 1;
      const bucket = grouped.get(rowNo) || [];
      bucket.push(e);
      grouped.set(rowNo, bucket);
    });
    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rowNo, items]) => ({
        rowNo,
        items: items.sort((a: any, b: any) => (a?.sortOrder || 0) - (b?.sortOrder || 0)),
      }));
  } catch {
    return [];
  }
};

export interface LayoutThumbProps {
  /** 布局元素 JSON（模板的 elementsJson） */
  elementsJson?: string;
  /** 缩略图宽度 */
  width?: number;
  /** 行高 */
  rowHeight?: number;
}

/**
 * 布局模板缩略图：把元素排列渲染成结构示意图（行 → 横向条，元素 → 按 colSpan 占比的色块）。
 * 纯前端解析 elementsJson，无额外请求。
 */
const LayoutThumb: React.FC<LayoutThumbProps> = ({ elementsJson, width = 200, rowHeight = 16 }) => {
  const { token } = theme.useToken();
  const rows = useMemo(() => parseRows(elementsJson), [elementsJson]);

  if (!rows.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无布局" />;
  }

  return (
    <div
      style={{
        width,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 6,
        padding: 6,
        background: token.colorBgContainer,
      }}
    >
      {rows.map((row) => (
        <div key={row.rowNo} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          {row.items.map((e: any, i: number) => {
            const pct = Math.min(Math.max((e?.colSpan || 12) / 24, 0.05), 1) * 100;
            const color = TYPE_COLORS[String(e?.elementType)] || '#91caff';
            return (
              <div
                key={`${row.rowNo}-${i}`}
                title={`${e?.elementName || ''}（${ELEMENT_TYPE_META[String(e?.elementType) as ElementType]?.label || e?.elementType}）`}
                style={{
                  flex: `0 0 ${pct.toFixed(1)}%`,
                  height: rowHeight,
                  borderRadius: 3,
                  background: color,
                  color: '#fff',
                  fontSize: 10,
                  lineHeight: `${rowHeight}px`,
                  textAlign: 'center',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {ELEMENT_TYPE_META[String(e?.elementType) as ElementType]?.icon || ''}
              </div>
            );
          })}
        </div>
      ))}
      <Text type="secondary" style={{ fontSize: 11 }}>
        {rows.length} 行 · {rows.reduce((n, r) => n + r.items.length, 0)} 元素
      </Text>
    </div>
  );
};

export default LayoutThumb;
