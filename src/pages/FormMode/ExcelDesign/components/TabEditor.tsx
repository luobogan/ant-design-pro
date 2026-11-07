import React, { useState } from 'react';
import { Button, Dropdown, Input, InputNumber, Select, Space, Tooltip, Typography } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  StarFilled,
  StarOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import { TAB_STYLE_PRESETS, type TabGroupConfig } from '../elementSchema';

const { Text } = Typography;

/**
 * 标签页编辑面板（对齐 E9 `excelOperatHead.jsp:414-450` 的 `.tabdiv` 面板）
 *
 * E9 交互：
 *   · 顶部：容器名 / 样式 / 内容区高度（areaheight）
 *   · 中部：页签条（`.tab_head`），每个页签带右键菜单
 *          （重命名 / 删除标签 / 设为默认标签 / 前移 / 后移 / 移至最前 / 移至最后）
 *   · 右下：「+」新增页签（`.tab_add`）、换肤（`.changeskin`）、取消（`.canceltab`）
 *
 * 每个页签对应**一张独立 Excel 布局**（E9 etables[tab_N] → 本项目 layout.tabTables[tabId]），
 * 「编辑内容」即切到该页签的独立画布。
 */
export interface TabEditorProps {
  group: TabGroupConfig;
  /** 当前选中的页签序号 */
  activeIndex: number;
  onSelect: (index: number) => void;
  /** 新增页签（同时创建独立 Excel 布局） */
  onAdd: () => void;
  onRename: (index: number, name: string) => void;
  onDelete: (index: number) => void;
  onSetDefault: (index: number) => void;
  /** 移动页签：from → to */
  onMove: (from: number, to: number) => void;
  /** 容器级配置变更（容器名 / 样式 / 内容区高度） */
  onSettingsChange: (patch: Partial<TabGroupConfig>) => void;
  /** 编辑当前页签内容（切到该页签的独立画布） */
  onEditContent: () => void;
}

const TabEditor: React.FC<TabEditorProps> = ({
  group,
  activeIndex,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onSetDefault,
  onMove,
  onSettingsChange,
  onEditContent,
}) => {
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameText, setRenameText] = useState('');

  const commitRename = () => {
    if (renaming != null && renameText.trim()) onRename(renaming, renameText.trim());
    setRenaming(null);
  };

  // 内容区高度：E9 areaheight = '1'（自适应） | '2,300'（固定 300px + 滚动）
  const areaMode = String(group.areaHeight || '1').startsWith('2') ? 'fixed' : 'auto';
  const fixedHeight = Number(String(group.areaHeight || '').split(',')[1] || 300);

  const menuItems = (i: number) => [
    { key: 'rename', label: '重命名', icon: <EditOutlined />, onClick: () => {
      setRenaming(i);
      setRenameText(group.tabs[i]?.name || '');
    } },
    ...(group.tabs.length > 1
      ? [{ key: 'delete', label: '删除标签', icon: <DeleteOutlined />, danger: true, onClick: () => onDelete(i) }]
      : []),
    { key: 'default', label: '设为默认标签', icon: group.defShow === i ? <StarFilled /> : <StarOutlined />, onClick: () => onSetDefault(i) },
    { type: 'divider' as const },
    ...(i > 0 ? [{ key: 'front', label: '前移', icon: <ArrowUpOutlined />, onClick: () => onMove(i, i - 1) }] : []),
    ...(i < group.tabs.length - 1 ? [{ key: 'behind', label: '后移', icon: <ArrowDownOutlined />, onClick: () => onMove(i, i + 1) }] : []),
    ...(i > 0 ? [{ key: 'mostfront', label: '移至最前', icon: <VerticalAlignTopOutlined />, onClick: () => onMove(i, 0) }] : []),
    ...(i < group.tabs.length - 1 ? [{ key: 'mostbehind', label: '移至最后', icon: <VerticalAlignBottomOutlined />, onClick: () => onMove(i, group.tabs.length - 1) }] : []),
  ];

  return (
    <div
      style={{
        padding: '10px 12px',
        border: '1px solid #e8e8e8',
        borderRadius: 6,
        background: '#fff',
        marginBottom: 12,
      }}
    >
      {/* ── 容器级配置（对齐 E9 .tabdiv 顶部：容器名 / 样式 / 内容区高度）── */}
      <Space size={10} wrap align="center" style={{ marginBottom: 10 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          容器名
        </Text>
        <Input
          size="small"
          style={{ width: 140 }}
          value={group.containerName}
          onChange={(e) => onSettingsChange({ containerName: e.target.value })}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          样式
        </Text>
        <Select
          size="small"
          style={{ width: 190 }}
          value={group.styleId}
          onChange={(v) => onSettingsChange({ styleId: v })}
          options={[
            ...TAB_STYLE_PRESETS.map((p) => ({ label: p.name, value: p.id })),
            { label: '自定义样式', value: 0 },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          内容区高度
        </Text>
        <Select
          size="small"
          style={{ width: 110 }}
          value={areaMode}
          onChange={(v) =>
            onSettingsChange({ areaHeight: v === 'fixed' ? `2,${fixedHeight}` : '1' })
          }
          options={[
            { label: '自适应', value: 'auto' },
            { label: '固定高度', value: 'fixed' },
          ]}
        />
        {areaMode === 'fixed' && (
          <InputNumber
            size="small"
            style={{ width: 100 }}
            min={40}
            value={fixedHeight}
            onChange={(v) => onSettingsChange({ areaHeight: `2,${Number(v) || 300}` })}
            addonAfter="px"
          />
        )}
      </Space>

      {/* ── 页签条（对齐 E9 .tab_head；右键菜单见 menuItems）── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {group.tabs.map((t, i) => (
          <Dropdown key={t.id} menu={{ items: menuItems(i) }} trigger={['contextMenu']}>
            <span>
              {renaming === i ? (
                <Input
                  size="small"
                  autoFocus
                  style={{ width: 120 }}
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  onPressEnter={commitRename}
                  onBlur={commitRename}
                />
              ) : (
                <Button
                  size="small"
                  type={i === activeIndex ? 'primary' : 'default'}
                  onClick={() => onSelect(i)}
                  onDoubleClick={() => {
                    setRenaming(i);
                    setRenameText(t.name);
                  }}
                >
                  {t.name}
                  {group.defShow === i && i !== activeIndex ? (
                    <StarFilled style={{ marginLeft: 4, color: '#faad14', fontSize: 11 }} />
                  ) : null}
                </Button>
              )}
            </span>
          </Dropdown>
        ))}
        <Tooltip title="新增标签页（新建一张独立 Excel 布局）">
          <Button size="small" icon={<PlusOutlined />} onClick={onAdd}>
            新增标签页
          </Button>
        </Tooltip>
        <div style={{ flex: 1 }} />
        <Button size="small" type="primary" onClick={onEditContent}>
          编辑当前页签内容
        </Button>
      </div>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
        每个标签页是一张独立的 Excel 布局（对齐 E9 etables[tab_N]）；右键页签可重命名 / 删除 / 设为默认 / 调整顺序。
      </Text>
    </div>
  );
};

export default TabEditor;
