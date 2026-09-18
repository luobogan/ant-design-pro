import React, { useEffect, useState } from 'react';
import {
  Button,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Tabs,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, QuestionCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { updateNode, WfProcessNode } from '@/services/workflow';
import { FORM_CONTENT_OPTIONS } from './wfDict';

/**
 * 「表单内容 → 设计」弹框（核心版）
 *
 * 结构对齐 ecology「设置表单内容」弹框
 * （`pc4backstage/workflow/components/pathSet/nodeSet/formContent/FormContentModal.js` + `ShowTemplate.js`）：
 *   弹框标题「设置表单内容:{节点名}」→ 页签「显示模板 / 打印模板」→
 *   显示模板页签内为可折叠分区：基本设置（显示模式）/ 显示模板设置（显示模板 + 初始化·设置字段属性·预览 +
 *   表单页边距自定义设置 + 同步节点）/ 移动模板设置 / 明细表数据根据操作者筛选显示 → 底部「保存」。
 *
 * ⚠️ 本项目**只做核心版**（用户已确认分期）：
 *   · 显示模式           → 真存 `ext_json.settings.formContent.mode`（普通模式已屏蔽 / 节点布局）；
 *   · 显示模板（浏览框/初始化）→ 打开现有节点级 Excel 布局设计器（按 nodeKey 隔离）；
 *   · 设置字段属性        → 跳到「节点信息 → 字段权限」（复用既有面板）；
 *   · 其余（预览 / 表单页边距 / 同步节点 / 移动模板 / 明细表筛选 / 打印模板）
 *                        → 按 E9 形态**占位渲染**，功能未实现者置灰并提示，避免出现"点了没反应"的空壳。
 */
export interface FormContentDesignModalProps {
  open: boolean;
  defId: any;
  /** 当前设计的节点（未选中时弹框只读） */
  node?: WfProcessNode;
  /** 流程绑定的表单ID（布局设计依赖） */
  formId?: string;
  formName?: string;
  onClose: () => void;
  /** 保存成功后就地更新 nodes */
  onPatch?: (nodeKey: string, patch: Partial<WfProcessNode>) => void;
  /** 显示模板 / 初始化：打开现有布局设计器 */
  onEditLayout?: (nodeKey: string) => void;
  /** 设置字段属性：跳到「节点信息 → 字段权限」 */
  onOpenFieldPerm?: (nodeKey: string) => void;
  /** 预览：未提供时按钮置灰 */
  onPreview?: (nodeKey: string) => void;
}

const NOT_YET = '本系统暂未支持（分期实现）';

/** 取节点 ext_json.settings（坏数据按空处理） */
const readSettings = (node?: WfProcessNode): Record<string, any> => {
  try {
    const parsed = node?.extJson ? JSON.parse(node.extJson) : {};
    return parsed?.settings && typeof parsed.settings === 'object' ? parsed.settings : {};
  } catch {
    return {};
  }
};

const modeLabel = (mode?: string) =>
  FORM_CONTENT_OPTIONS.find((o) => o.value === mode)?.label || (mode ? String(mode) : '未设置');

/** E9 形态的「浏览框」：只读输入框 + 放大镜；右侧可挂 + 按钮与操作链接 */
const BrowserBox: React.FC<{
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onClick?: () => void;
  onAdd?: () => void;
  addTooltip?: string;
}> = ({ value, placeholder, disabled, onClick, onAdd, addTooltip }) => (
  <Space size={0}>
    <Input
      readOnly
      disabled={disabled}
      value={value}
      placeholder={placeholder}
      onClick={onClick}
      style={{ width: 320, cursor: disabled ? 'not-allowed' : 'pointer' }}
      suffix={
        <SearchOutlined
          style={{ color: disabled ? '#bfbfbf' : '#1677ff', cursor: disabled ? 'not-allowed' : 'pointer' }}
          onClick={onClick}
        />
      }
    />
    <Tooltip title={addTooltip}>
      <Button
        icon={<PlusOutlined />}
        disabled={disabled}
        onClick={onAdd}
        style={{ marginLeft: -1 }}
      />
    </Tooltip>
  </Space>
);

/** 标签 + 控件的一行 */
const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0', paddingLeft: 32 }}>
    <div style={{ width: 150, color: '#333' }}>{label}：</div>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

const FormContentDesignModal: React.FC<FormContentDesignModalProps> = ({
  open,
  defId,
  node,
  formId,
  formName,
  onClose,
  onPatch,
  onEditLayout,
  onOpenFieldPerm,
  onPreview,
}) => {
  const nodeKey = node?.nodeKey;
  const [mode, setMode] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('show');

  useEffect(() => {
    if (open) {
      setMode(readSettings(node).formContent?.mode);
      setTab('show');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nodeKey]);

  const canLayout = !!nodeKey && !!formId;

  const design = () => {
    if (!canLayout) return;
    onEditLayout?.(nodeKey!);
  };

  const save = async () => {
    if (!defId || !nodeKey) return;
    const settings = readSettings(node);
    const extJson = JSON.stringify({
      settings: { ...settings, formContent: { ...(settings.formContent || {}), mode } },
    });
    setSaving(true);
    try {
      const r: any = await updateNode(defId, nodeKey, { extJson });
      if (r?.success === false) {
        message.error('保存失败');
        return;
      }
      onPatch?.(nodeKey, { extJson });
      message.success('表单内容已保存');
      onClose();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const showTemplate = (
    <>
      {/* 基本设置 */}
      <div
        style={{
          background: '#fafafa',
          border: '1px solid #f0f0f0',
          borderRadius: 4,
          padding: '4px 16px 12px',
          marginBottom: 12,
        }}
      >
        <Typography.Text strong style={{ display: 'block', padding: '8px 0 4px' }}>
          基本设置
        </Typography.Text>
        <Row label="显示模式">
          <Select
            style={{ width: 360 }}
            value={mode}
            placeholder="未设置"
            options={FORM_CONTENT_OPTIONS}
            onChange={setMode}
          />
          <span style={{ marginLeft: 12, color: '#999', fontSize: 12 }}>
            「普通模式」已屏蔽，请选择「节点布局」
          </span>
        </Row>
      </div>

      {/* 显示模板设置 */}
      <div
        style={{
          background: '#fafafa',
          border: '1px solid #f0f0f0',
          borderRadius: 4,
          padding: '4px 16px 12px',
          marginBottom: 12,
        }}
      >
        <Typography.Text strong style={{ display: 'block', padding: '8px 0 4px' }}>
          显示模板设置
        </Typography.Text>
        <Row label="显示模板">
          <Space size={8} wrap>
            <BrowserBox
              value={modeLabel(mode)}
              placeholder="未设置"
              disabled={!canLayout}
              onClick={design}
              onAdd={design}
              addTooltip={canLayout ? '进入节点布局设计器（初始化）' : '请先绑定表单'}
            />
            <a onClick={design} style={{ color: canLayout ? '#1677ff' : '#bfbfbf' }}>
              初始化
            </a>
            <a
              onClick={() => nodeKey && onOpenFieldPerm?.(nodeKey)}
              style={{ color: nodeKey ? '#1677ff' : '#bfbfbf' }}
            >
              设置字段属性
            </a>
            <Tooltip title={onPreview ? '' : NOT_YET}>
              <a
                onClick={() => onPreview && nodeKey && onPreview(nodeKey)}
                style={{ color: onPreview ? '#1677ff' : '#bfbfbf' }}
              >
                预览
              </a>
            </Tooltip>
          </Space>
        </Row>
        <Row label="表单页边距自定义设置">
          <Space size={8}>
            <Tooltip title={NOT_YET}>
              <Switch disabled size="small" />
            </Tooltip>
            <Tooltip title="不启用，则采用流程表单默认页边距设置。">
              <QuestionCircleOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          </Space>
        </Row>
        <Row label="同步节点">
          <Tooltip title={NOT_YET}>
            <BrowserBox placeholder="" disabled />
          </Tooltip>
        </Row>
      </div>

      {/* 移动模板设置 */}
      <div
        style={{
          background: '#fafafa',
          border: '1px solid #f0f0f0',
          borderRadius: 4,
          padding: '4px 16px 12px',
          marginBottom: 12,
        }}
      >
        <Typography.Text strong style={{ display: 'block', padding: '8px 0 4px' }}>
          移动模板设置
        </Typography.Text>
        <Row label="移动模板">
          <Space size={8}>
            <Tooltip title={NOT_YET}>
              <span>
                <BrowserBox placeholder="" disabled />
              </span>
            </Tooltip>
            <Tooltip title={NOT_YET}>
              <a style={{ color: '#bfbfbf' }}>初始化</a>
            </Tooltip>
          </Space>
        </Row>
        <Row label="同步节点">
          <Tooltip title={NOT_YET}>
            <BrowserBox placeholder="" disabled />
          </Tooltip>
        </Row>
      </div>

      {/* 明细表筛选 */}
      <div
        style={{
          background: '#fafafa',
          border: '1px solid #f0f0f0',
          borderRadius: 4,
          padding: '10px 16px',
        }}
      >
        <Space size={8}>
          <Tooltip title={NOT_YET}>
            <Switch disabled size="small" />
          </Tooltip>
          <span>明细表数据根据操作者筛选显示</span>
          <Tooltip title="启用后，明细表仅显示当前操作者可见的数据。">
            <QuestionCircleOutlined style={{ color: '#faad14' }} />
          </Tooltip>
        </Space>
      </div>

      {!formId && (
        <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
          该流程尚未绑定表单，无法进入布局设计。
          {formName ? `（当前表单：${formName}）` : ''}
        </div>
      )}
    </>
  );

  return (
    <Modal
      title={`设置表单内容${node ? `:${node.nodeName || node.nodeKey}` : ''}`}
      open={open}
      onCancel={onClose}
      width={1000}
      style={{ top: 40 }}
      maskClosable={false}
      destroyOnClose
      footer={
        <Space>
          <Button type="primary" loading={saving} onClick={save} disabled={!nodeKey}>
            保存
          </Button>
          <Tooltip title={NOT_YET}>
            <Button disabled>更多 »</Button>
          </Tooltip>
        </Space>
      }
    >
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'show', label: '显示模板', children: showTemplate },
          {
            key: 'print',
            label: '打印模板',
            children: <Empty description="打印模板暂未支持（分期实现）" />,
          },
        ]}
      />
    </Modal>
  );
};

export default FormContentDesignModal;
