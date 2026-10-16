import { Col, Empty, Row, Space, Tag, Typography } from 'antd';
import { HolderOutlined } from '@ant-design/icons';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ELEMENT_TYPE_META } from '@/services/portal';
import type { DesignerElement } from '../types';

const { Text } = Typography;

interface CanvasItemProps {
  element: DesignerElement;
  selected: boolean;
  onSelect: (uid: string) => void;
  onRemove: (uid: string) => void;
}

/** 画布中的单个元素块（整卡可拖拽排序，点击选中） */
const CanvasItem: React.FC<CanvasItemProps> = ({ element, selected, onSelect, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: element.uid,
    data: { from: 'canvas', uid: element.uid },
  });
  const meta = ELEMENT_TYPE_META[element.elementType];

  return (
    <Col xs={24} xl={element.colSpan || 12} style={{ marginBottom: 16 }}>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
          background: '#FFFFFF',
          borderRadius: 10,
          border: selected ? '1px solid #1677FF' : '1px solid #E6EDF5',
          boxShadow: selected ? '0 4px 14px rgba(22,119,255,.18)' : '0 2px 8px rgba(31,39,51,.06)',
          padding: 14,
          cursor: 'grab',
          height: '100%',
        }}
        data-testid="canvas-item"
        data-element-type={element.elementType}
        data-element-name={element.elementName}
        onClick={() => onSelect(element.uid)}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space size={6}>
            <HolderOutlined style={{ color: '#86909C' }} />
            <Text strong style={{ fontSize: 14 }}>
              {meta?.icon} {element.elementName || meta?.label}
            </Text>
          </Space>
          <Text
            type="secondary"
            style={{ fontSize: 12, cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(element.uid);
            }}
          >
            删除
          </Text>
        </div>
        <div style={{ marginTop: 10 }}>
          <Space size={4} wrap>
            <Tag color="blue">{meta?.label}</Tag>
            <Tag>行 {element.rowNo}</Tag>
            <Tag>宽 {element.colSpan}/24</Tag>
          </Space>
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {element.config?.perPage ? `显示 ${element.config.perPage} 条` : '无条数限制'} · 排序{' '}
          {element.sortOrder}
        </Text>
      </div>
    </Col>
  );
};

interface DesignCanvasProps {
  elements: DesignerElement[];
  selectedUid?: string;
  onSelect: (uid: string) => void;
  onRemove: (uid: string) => void;
}

/**
 * 设计器中间画布
 * - 24 栅格占位（按配置 colSpan）
 * - useDroppable 接收左侧拖入；useSortable 排序
 */
const DesignCanvas: React.FC<DesignCanvasProps> = ({
  elements,
  selectedUid,
  onSelect,
  onRemove,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-drop', data: { from: 'canvas' } });

  const rows = new Map<number, DesignerElement[]>();
  elements.forEach((el) => {
    const bucket = rows.get(el.rowNo) || [];
    bucket.push(el);
    rows.set(el.rowNo, bucket);
  });
  const rowList = Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <div
      ref={setNodeRef}
      data-testid="design-canvas"
      style={{
        flex: 1,
        padding: 20,
        overflowY: 'auto',
        background: isOver ? '#EAF3FF' : '#F5F7FA',
        backgroundImage:
          'linear-gradient(rgba(22,119,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(22,119,255,.05) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        transition: 'background .15s ease',
      }}
    >
      {rowList.length === 0 ? (
        <div style={{ padding: 100, textAlign: 'center' }}>
          <Empty description="从左侧拖入元素开始搭建门户" />
        </div>
      ) : (
        rowList.map(([rowNo, list]) => (
          <Row key={rowNo} gutter={[16, 0]} align="stretch">
            {list.map((el) => (
              <CanvasItem
                key={el.uid}
                element={el}
                selected={selectedUid === el.uid}
                onSelect={onSelect}
                onRemove={onRemove}
              />
            ))}
          </Row>
        ))
      )}
    </div>
  );
};

export default DesignCanvas; 
