import React, { useState, useRef, useEffect } from 'react';
import { Card, Input, Button, Space } from 'antd';
import { DragOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';

/**
 * GroupBox组件
 * 支持字段分组框
 */
interface GroupBoxProps {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onDrag: (id: string, x: number, y: number) => void;
  onResize: (id: string, width: number, height: number) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  isSelected: boolean;
}

const GroupBox: React.FC<GroupBoxProps> = ({
  id,
  name,
  x,
  y,
  width,
  height,
  onDrag,
  onResize,
  onDelete,
  onSelect,
  isSelected,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const groupBoxRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.stopPropagation();
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width,
      height,
    });
    e.stopPropagation();
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        onDrag(id, x + dx, y + dy);
      }
      if (isResizing) {
        const dx = e.clientX - resizeStart.x;
        const dy = e.clientY - resizeStart.y;
        onResize(id, Math.max(100, resizeStart.width + dx), Math.max(50, resizeStart.height + dy));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart, id, x, y, width, height, onDrag, onResize]);

  return (
    <div
      ref={groupBoxRef}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        border: isSelected ? '2px solid #1890ff' : '2px solid #d9d9d9',
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        boxShadow: isSelected ? '0 0 8px rgba(24, 144, 255, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
        cursor: isDragging ? 'move' : 'default',
        zIndex: isSelected ? 1000 : 1,
      }}
      onClick={() => onSelect(id)}
    >
      {/* 分组框标题栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          backgroundColor: isSelected ? '#e6f7ff' : '#fafafa',
          borderBottom: '1px solid #d9d9d9',
          cursor: 'move',
          userSelect: 'none',
        }}
        onMouseDown={handleDragStart}
      >
        <Space size={4}>
          <DragOutlined style={{ cursor: 'move', color: '#999' }} />
          <span style={{ fontWeight: 500, fontSize: 12 }}>{name}</span>
        </Space>
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            style={{ fontSize: 12, padding: '0 4px' }}
          />
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            style={{ fontSize: 12, padding: '0 4px', color: '#ff4d4f' }}
            onClick={e => {
              e.stopPropagation();
              onDelete(id);
            }}
          />
        </Space>
      </div>

      {/* 分组框内容区域 */}
      <div
        style={{
          padding: 8,
          height: 'calc(100% - 32px)',
          overflow: 'auto',
        }}
      >
        <div style={{ color: '#999', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
          拖拽字段到此处
        </div>
      </div>

      {/* 调整大小手柄 */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 12,
          height: 12,
          cursor: 'nwse-resize',
          background: 'linear-gradient(135deg, transparent 50%, #1890ff 50%)',
        }}
        onMouseDown={handleResizeStart}
      />
    </div>
  );
};

export default GroupBox;
