import React, { useState } from 'react';
import { Tabs, Button, Space, Tooltip, Divider, Dropdown, ColorPicker, Select, message } from 'antd';
import {
  SaveOutlined,
  EyeOutlined,
  UploadOutlined,
  DownloadOutlined,
  UndoOutlined,
  RedoOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  BgColorsOutlined,
  FontSizeOutlined,
  EnterOutlined,
  MergeCellsOutlined,
  SplitCellsOutlined,
  InsertRowAboveOutlined,
  InsertRowLeftOutlined,
  DeleteRowOutlined,
  DeleteColumnOutlined,
  LockOutlined,
  EditOutlined,
  CheckCircleOutlined,
  TableOutlined,
} from '@ant-design/icons';

/**
 * Excel 设计器顶部工具条（Ribbon）
 *
 * 对齐 ecology exceldesign 的操作区划分：模板 / 格式 / 插入 / 字段属性 / 明细表。
 * 说明：
 *  - 模板、字段属性、明细表 复用 ExcelDesign 既有处理器；
 *  - 格式、插入（行列）通过 window.univerExcelGrid 的 Facade API
 *    （applyRangeFormat / mergeSelection / unmergeSelection / rowColOp）作用到当前选区。
 */

type FieldAttr = 'readonly' | 'editable' | 'required' | null;

interface ExcelRibbonProps {
  saving?: boolean;
  onSave: () => void;
  onPreview: () => void;
  onImport: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  fieldAttr: FieldAttr;
  fieldAttrDisabled: boolean;
  onFieldAttrChange: (attr: 'readonly' | 'editable' | 'required') => void;
  /** 本表单拥有的明细表序号（用于「插入明细表」下拉） */
  detailTableOptions: { idx: number; count: number }[];
  onInsertDetail: (idx: number) => void;
}

const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28];

// 统一的网格 API 调用：实例缺失 / 无选区时给出明确提示
const callGrid = (fn: string, ...args: any[]): boolean => {
  const grid = (window as any).univerExcelGrid;
  if (!grid || typeof grid[fn] !== 'function') {
    message.warning('Excel 组件尚未初始化');
    return false;
  }
  const ok = grid[fn](...args);
  if (ok === false) {
    message.warning('请先在表格中选中单元格');
  }
  return ok !== false;
};

const ExcelRibbon: React.FC<ExcelRibbonProps> = ({
  saving,
  onSave,
  onPreview,
  onImport,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  fieldAttr,
  fieldAttrDisabled,
  onFieldAttrChange,
  detailTableOptions,
  onInsertDetail,
}) => {
  const [activeKey, setActiveKey] = useState<string>('format');
  // 加粗/斜体/下划线为开关态：仅作视觉反馈，实际每次点击都作用于当前选区
  const [toggles, setToggles] = useState<Record<string, boolean>>({ bold: false, italic: false, underline: false });

  const toggle = (key: string, action: string) => {
    const next = !toggles[key];
    setToggles((prev) => ({ ...prev, [key]: next }));
    callGrid('applyRangeFormat', action, next);
  };

  const tabItems = [
    // ── 模板：整体保存 / 预览 / 导入导出 ──
    {
      key: 'template',
      label: '模板',
      children: (
        <Space wrap size={8}>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
            保存
          </Button>
          <Button icon={<EyeOutlined />} onClick={onPreview}>
            预览
          </Button>
          <Divider type="vertical" />
          <Button icon={<UploadOutlined />} onClick={onImport}>
            导入
          </Button>
          <Button icon={<DownloadOutlined />} onClick={onExport}>
            导出
          </Button>
        </Space>
      ),
    },
    // ── 格式：撤销重做 + 字体 + 对齐 + 背景 + 合并 ──
    {
      key: 'format',
      label: '格式',
      children: (
        <Space wrap size={8}>
          <Tooltip title="撤销">
            <Button icon={<UndoOutlined />} disabled={!canUndo} onClick={onUndo} />
          </Tooltip>
          <Tooltip title="重做">
            <Button icon={<RedoOutlined />} disabled={!canRedo} onClick={onRedo} />
          </Tooltip>
          <Divider type="vertical" />
          <Tooltip title="加粗">
            <Button
              icon={<BoldOutlined />}
              type={toggles.bold ? 'primary' : 'default'}
              onClick={() => toggle('bold', 'bold')}
            />
          </Tooltip>
          <Tooltip title="斜体">
            <Button
              icon={<ItalicOutlined />}
              type={toggles.italic ? 'primary' : 'default'}
              onClick={() => toggle('italic', 'italic')}
            />
          </Tooltip>
          <Tooltip title="下划线">
            <Button
              icon={<UnderlineOutlined />}
              type={toggles.underline ? 'primary' : 'default'}
              onClick={() => toggle('underline', 'underline')}
            />
          </Tooltip>
          <Select
            size="small"
            style={{ width: 90 }}
            placeholder="字号"
            suffixIcon={<FontSizeOutlined />}
            onChange={(v) => callGrid('applyRangeFormat', 'fontSize', v)}
            options={FONT_SIZES.map((s) => ({ label: `${s}`, value: s }))}
          />
          <Divider type="vertical" />
          <Tooltip title="左对齐">
            <Button icon={<AlignLeftOutlined />} onClick={() => callGrid('applyRangeFormat', 'align', 'left')} />
          </Tooltip>
          <Tooltip title="居中">
            <Button icon={<AlignCenterOutlined />} onClick={() => callGrid('applyRangeFormat', 'align', 'center')} />
          </Tooltip>
          <Tooltip title="右对齐">
            <Button icon={<AlignRightOutlined />} onClick={() => callGrid('applyRangeFormat', 'align', 'right')} />
          </Tooltip>
          <Tooltip title="自动换行">
            <Button icon={<EnterOutlined />} onClick={() => callGrid('applyRangeFormat', 'wrap', true)} />
          </Tooltip>
          <Divider type="vertical" />
          <Tooltip title="背景色">
            <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>
              <ColorPicker
                size="small"
                onChange={(_, hex) => callGrid('applyRangeFormat', 'bg', hex)}
              >
                <Button icon={<BgColorsOutlined />} />
              </ColorPicker>
            </span>
          </Tooltip>
          <Divider type="vertical" />
          <Tooltip title="合并单元格">
            <Button icon={<MergeCellsOutlined />} onClick={() => callGrid('mergeSelection')}>
              合并
            </Button>
          </Tooltip>
          <Tooltip title="取消合并">
            <Button icon={<SplitCellsOutlined />} onClick={() => callGrid('unmergeSelection')}>
              取消合并
            </Button>
          </Tooltip>
        </Space>
      ),
    },
    // ── 插入：行列增删 + 明细表标记 ──
    {
      key: 'insert',
      label: '插入',
      children: (
        <Space wrap size={8}>
          <Button icon={<InsertRowAboveOutlined />} onClick={() => callGrid('rowColOp', 'insertRow')}>
            插入行
          </Button>
          <Button icon={<InsertRowLeftOutlined />} onClick={() => callGrid('rowColOp', 'insertCol')}>
            插入列
          </Button>
          <Button icon={<DeleteRowOutlined />} onClick={() => callGrid('rowColOp', 'removeRow')}>
            删除行
          </Button>
          <Button icon={<DeleteColumnOutlined />} onClick={() => callGrid('rowColOp', 'removeCol')}>
            删除列
          </Button>
        </Space>
      ),
    },
    // ── 字段属性：只读 / 可编辑 / 必填（对齐 ecology viewAttr）──
    {
      key: 'fieldAttr',
      label: '字段属性',
      children: (
        <Space wrap size={8}>
          <Tooltip title="设置字段为只读">
            <Button
              icon={<LockOutlined />}
              type={fieldAttr === 'readonly' ? 'primary' : 'default'}
              disabled={fieldAttrDisabled}
              onClick={() => onFieldAttrChange('readonly')}
            >
              只读
            </Button>
          </Tooltip>
          <Tooltip title="设置字段为可编辑">
            <Button
              icon={<EditOutlined />}
              type={fieldAttr === 'editable' ? 'primary' : 'default'}
              disabled={fieldAttrDisabled}
              onClick={() => onFieldAttrChange('editable')}
            >
              编辑
            </Button>
          </Tooltip>
          <Tooltip title="设置字段为必填">
            <Button
              icon={<CheckCircleOutlined />}
              type={fieldAttr === 'required' ? 'primary' : 'default'}
              disabled={fieldAttrDisabled}
              onClick={() => onFieldAttrChange('required')}
            >
              必填
            </Button>
          </Tooltip>
        </Space>
      ),
    },
    // ── 明细表：插入各序号的明细表标记 ──
    {
      key: 'detail',
      label: '明细表',
      children: (
        <Space wrap size={8}>
          <Dropdown
            disabled={detailTableOptions.length === 0}
            menu={{
              disabled: detailTableOptions.length === 0,
              items: detailTableOptions.map((o) => ({
                key: String(o.idx),
                label: `明细表${o.idx}（${o.count} 字段）`,
                onClick: () => onInsertDetail(o.idx),
              })),
            }}
          >
            <Button icon={<TableOutlined />} disabled={detailTableOptions.length === 0}>
              插入明细表
            </Button>
          </Dropdown>
          {detailTableOptions.length === 0 && (
            <span style={{ color: '#999', fontSize: 12 }}>该表单未定义明细表字段</span>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div
      style={{
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 6,
        marginBottom: 12,
        padding: '4px 8px',
      }}
    >
      <Tabs size="small" activeKey={activeKey} onChange={setActiveKey} items={tabItems} />
    </div>
  );
};

export default ExcelRibbon;
