import React, { useEffect, useRef, useState } from 'react';
import { Dropdown, MenuProps } from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  DeleteOutlined,
  CopyOutlined,
} from '@ant-design/icons';

interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  cellInfo?: {
    row: number;
    col: number;
    fieldMeta?: any;
    hasField: boolean;
  };
  onFieldAttrChange?: (attr: 'readonly' | 'editable' | 'required') => void;
  onClearCell?: () => void;
  onFieldProperty?: () => void;
  onClose: () => void;
}

/**
 * Excel 设计器右键菜单
 * 参照 ecology excel 设计器的右键菜单实现
 */
const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  x,
  y,
  cellInfo,
  onFieldAttrChange,
  onClearCell,
  onFieldProperty,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const { hasField, fieldMeta } = cellInfo || {};

  // 构建菜单项
  const items: MenuProps['items'] = [];

  // 字段属性操作（只有字段单元格才显示）
  if (hasField) {
    items.push(
      {
        key: 'readonly',
        label: '只读',
        icon: <EyeOutlined />,
        onClick: () => {
          onFieldAttrChange?.('readonly');
          onClose();
        },
      },
      {
        key: 'editable',
        label: '可编辑',
        icon: <EditOutlined />,
        onClick: () => {
          onFieldAttrChange?.('editable');
          onClose();
        },
      },
      {
        key: 'required',
        label: '必填',
        icon: <CheckCircleOutlined />,
        onClick: () => {
          onFieldAttrChange?.('required');
          onClose();
        },
      },
      { type: 'divider' },
      {
        key: 'property',
        label: '字段属性',
        icon: <SettingOutlined />,
        onClick: () => {
          onFieldProperty?.();
          onClose();
        },
      },
      { type: 'divider' }
    );
  }

  // 通用操作
  items.push(
    {
      key: 'clear',
      label: '清空单元格',
      icon: <DeleteOutlined />,
      onClick: () => {
        onClearCell?.();
        onClose();
      },
    }
  );

  // 计算菜单位置（确保不超出屏幕）
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - 300),
    zIndex: 1000,
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    minWidth: 150,
  };

  return (
    <div ref={menuRef} style={menuStyle}>
      <Dropdown
        menu={{ items }}
        open={visible}
        trigger={['contextMenu']}
      >
        <div style={{ width: '100%', height: '100%' }} />
      </Dropdown>
      {visible && (
        <div style={{ padding: '4px 0' }}>
          {items.map((item, index) => {
            if (!item || item.type === 'divider') {
              return <div key={`divider-${index}`} style={{ height: 1, background: '#f0f0f0', margin: '4px 0' }} />;
            }
            const menuItem = item as any;
            const isActive = fieldMeta?.fieldAttr === menuItem.key;
            return (
              <div
                key={menuItem.key}
                onClick={menuItem.onClick}
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: isActive ? '#e6f7ff' : 'transparent',
                  color: isActive ? '#1890ff' : 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#f5f5f5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {menuItem.icon}
                <span>{menuItem.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContextMenu;
