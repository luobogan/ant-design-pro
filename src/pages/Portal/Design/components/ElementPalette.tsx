import { Typography, theme } from 'antd';
import { useDraggable } from '@dnd-kit/core';
import { ELEMENT_TYPE_META } from '@/services/portal';
import type { ElementType } from '@/services/portal';

const { Text } = Typography;

interface PaletteItemProps {
  type: ElementType;
  /** 点击添加（拖拽的降级/快捷路径：无需精确拖拽即可把元素加入画布） */
  onAdd?: (type: ElementType) => void;
}

/** 单个可拖拽元素卡片 */
const PaletteItem: React.FC<PaletteItemProps> = ({ type, onAdd }) => {
  const meta = ELEMENT_TYPE_META[type];
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { from: 'palette', type },
  });

  return (
    <div
      ref={setNodeRef}
      data-testid="palette-item"
      data-element-type={type}
      {...attributes}
      {...listeners}
      onClick={() => onAdd?.(type)}
      title={`拖拽或点击添加到画布：${meta?.label || type}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 8,
        cursor: 'grab',
        background: token.colorBgElevated,
        border: '1px solid #333B49',
        opacity: isDragging ? 0.55 : 1,
        transition: 'transform .15s ease, border-color .15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = token.colorPrimary;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = token.colorBorder;
        e.currentTarget.style.transform = 'none';
      }}
    >
      <span style={{ fontSize: 16, lineHeight: '20px' }}>{meta?.icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: token.colorText, fontSize: 13, fontWeight: 500 }}>{meta?.label}</div>
        <Text
          type="secondary"
          style={{ fontSize: 12, color: token.colorTextSecondary, display: 'block', lineHeight: 1.4 }}
        >
          {meta?.desc}
        </Text>
      </div>
    </div>
  );
};

interface ElementPaletteProps {
  /** 已注册的元素类型（与后端 Provider 一一对应） */
  types: ElementType[];
  /** 点击添加元素（拖拽之外的快捷路径） */
  onAdd?: (type: ElementType) => void;
}

/**
 * 设计器左侧元素面板
 * 深色分组：数据类（待办/通知/消息）+ 展示类（图表/富文本/快捷链接）
 * 支持「拖拽到画布」与「点击添加」两种方式（后者同时作为触屏/自动化环境的降级路径）。
 */
const ElementPalette: React.FC<ElementPaletteProps> = ({ types, onAdd }) => {
  const { token } = theme.useToken();
  const dataGroup: ElementType[] = types.filter((t) =>
    ['todo', 'notice', 'message'].includes(t),
  );
  const displayGroup: ElementType[] = types.filter(
    (t) => !['todo', 'notice', 'message'].includes(t),
  );

  return (
    <div
      style={{
        width: 236,
        flex: 'none',
        background: token.colorBgElevated,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        overflowY: 'auto',
      }}
    >
      <div>
        <div style={{ color: token.colorText, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>元素面板</div>
        <Text type="secondary" style={{ fontSize: 12, color: token.colorTextSecondary }}>
          拖拽元素到右侧画布即可添加
        </Text>
      </div>

      <div>
        <div style={{ color: token.colorTextSecondary, fontSize: 12, marginBottom: 8 }}>数据类</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dataGroup.map((t) => (
            <PaletteItem key={t} type={t} onAdd={onAdd} />
          ))}
        </div>
      </div>

      <div>
        <div style={{ color: token.colorTextSecondary, fontSize: 12, marginBottom: 8 }}>展示类</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayGroup.map((t) => (
            <PaletteItem key={t} type={t} onAdd={onAdd} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ElementPalette; 
