import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Input,
  InputNumber,
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
 * 「表单内容 → 设计」弹框
 *
 * 结构对齐 ecology「设置表单内容」弹框
 * （`pc4backstage/workflow/components/pathSet/nodeSet/formContent/FormContentModal.js` + `ShowTemplate.js`）：
 *   标题「设置表单内容:{节点名}」→ 页签「显示模板 / 打印模板」→ 显示模板页签内为分区：
 *   基本设置（显示模式）/ 显示模板设置（显示模板 + 初始化·设置字段属性·预览 + 表单页边距自定义设置 + 同步节点）/
 *   移动模板设置 / 明细表数据根据操作者筛选显示 → 底部「保存」。
 *
 * 落库位置：`wf_process_node.ext_json.settings.formContent`（沿用既有 schema，不新增后端字段）：
 * {@code
 *   formContent: {
 *     mode,                       // normal(已屏蔽) | custom 节点布局
 *     margin:  { custom, type, top, bottom, left, right },   // 表单页边距自定义设置
 *     mobile:  { templateName, nodeKeys },                   // 移动模板 + 其同步节点
 *     detailFilter: { enabled },                             // 明细表根据操作者筛选
 *     print:   { templateName, nodeKeys },                   // 打印模板 + 其同步节点
 *     syncNodeKeys,                                          // 显示模板的「同步节点」目标
 *   }
 * }
 *
 * ⚠️ 说明：页边距 / 移动模板 / 打印模板 / 明细过滤目前是**持久化配置**（可在本弹框编辑保存），
 *    运行期渲染与引擎消费尚未接入 —— 即"存得住、改得了"，但暂不影响表单实际渲染。
 */
export interface FormContentDesignModalProps {
  open: boolean;
  defId: any;
  node?: WfProcessNode;
  /** 全量节点（「同步节点」选择目标用，排除自身） */
  nodes?: WfProcessNode[];
  formId?: string;
  formName?: string;
  onClose: () => void;
  onPatch?: (nodeKey: string, patch: Partial<WfProcessNode>) => void;
  /** 显示模板 / 初始化：打开现有布局设计器 */
  onEditLayout?: (nodeKey: string) => void;
  /** 设置字段属性：跳到「节点信息 → 字段权限」 */
  onOpenFieldPerm?: (nodeKey: string) => void;
  /** 节点意见：跳到「节点信息 → 节点设置」（复用既有签字意见设置） */
  onOpenNodeSetting?: (nodeKey: string) => void;
  /** 预览：未提供时按钮置灰 */
  onPreview?: (nodeKey: string) => void;
  /** 批量同步完成后的刷新（同步会改其它节点的 extJson） */
  onSynced?: () => void;
}

const NOT_YET = '运行期渲染尚未接入（当前仅持久化配置）';
const MARGIN_TYPES = [
  { value: 0, label: '自定义' },
  { value: 1, label: '继承表单默认' },
];

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

/** E9 形态的「浏览框」：只读输入框 + 放大镜；右侧可挂 + 按钮 */
const BrowserBox: React.FC<{
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  width?: number;
  onClick?: () => void;
  onAdd?: () => void;
  addTooltip?: string;
}> = ({ value, placeholder, disabled, width = 320, onClick, onAdd, addTooltip }) => (
  <Space size={0}>
    <Input
      readOnly
      disabled={disabled}
      value={value}
      placeholder={placeholder}
      onClick={onClick}
      style={{ width, cursor: disabled ? 'not-allowed' : 'pointer' }}
      suffix={
        <SearchOutlined
          style={{ color: disabled ? '#bfbfbf' : '#1677ff', cursor: disabled ? 'not-allowed' : 'pointer' }}
          onClick={onClick}
        />
      }
    />
    <Tooltip title={addTooltip}>
      <Button icon={<PlusOutlined />} disabled={disabled} onClick={onAdd} style={{ marginLeft: -1 }} />
    </Tooltip>
  </Space>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0', paddingLeft: 32 }}>
    <div style={{ width: 150, color: '#333' }}>{label}：</div>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
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
      {title}
    </Typography.Text>
    {children}
  </div>
);

const FormContentDesignModal: React.FC<FormContentDesignModalProps> = ({
  open,
  defId,
  node,
  nodes,
  formId,
  formName,
  onClose,
  onPatch,
  onEditLayout,
  onOpenFieldPerm,
  onOpenNodeSetting,
  onPreview,
  onSynced,
}) => {
  const nodeKey = node?.nodeKey;
  const canLayout = !!nodeKey && !!formId;

  // 整份 formContent 直接作为受控状态，保存时统一写回
  const [fc, setFc] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState('show');

  useEffect(() => {
    if (open) {
      const s = readSettings(node);
      setFc({ ...(s.formContent || {}) });
      setTab('show');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nodeKey]);

  const patch = (p: Record<string, any>) => setFc((prev) => ({ ...prev, ...p }));

  const otherNodes = useMemo(
    () => (nodes || []).filter((n) => n.nodeKey && n.nodeKey !== nodeKey),
    [nodes, nodeKey],
  );
  const nodeOptions = otherNodes.map((n) => ({
    value: n.nodeKey!,
    label: n.nodeName || n.nodeKey!,
  }));

  const margin = fc.margin || {};
  const mobile = fc.mobile || {};
  const print = fc.print || {};
  const detailFilter = fc.detailFilter || {};

  const design = () => {
    if (canLayout) onEditLayout?.(nodeKey!);
  };

  /** 保存本节点 */
  const save = async () => {
    if (!defId || !nodeKey) return;
    const settings = readSettings(node);
    const extJson = JSON.stringify({ settings: { ...settings, formContent: fc } });
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

  /** 同步节点：把本节点的 formContent 覆盖到所选节点 */
  const syncTo = async (targetKeys: string[], label: string) => {
    if (!defId || !targetKeys.length) {
      message.warning('请先选择要同步的节点');
      return;
    }
    setSyncing(true);
    try {
      let ok = 0;
      for (const key of targetKeys) {
        const target = (nodes || []).find((n) => n.nodeKey === key);
        if (!target) continue;
        const settings = readSettings(target);
        // 同步过去时清掉各自的「同步目标」自身，避免互相指向
        const next = { ...fc, syncNodeKeys: undefined, mobile: { ...(fc.mobile || {}), nodeKeys: undefined } };
        const extJson = JSON.stringify({ settings: { ...settings, formContent: next } });
        try {
          const r: any = await updateNode(defId, key, { extJson });
          if (r?.success !== false) ok++;
        } catch {
          /* 单个失败不阻断其余 */
        }
      }
      message.success(`已同步${label}到 ${ok}/${targetKeys.length} 个节点`);
      onSynced?.();
    } finally {
      setSyncing(false);
    }
  };

  const showTemplate = (
    <>
      <Section title="基本设置">
        <Row label="显示模式">
          <Select
            style={{ width: 360 }}
            value={fc.mode}
            placeholder="未设置"
            options={FORM_CONTENT_OPTIONS}
            onChange={(v) => patch({ mode: v })}
          />
          <span style={{ marginLeft: 12, color: '#999', fontSize: 12 }}>
            「普通模式」已屏蔽，请选择「节点布局」
          </span>
        </Row>
      </Section>

      <Section title="显示模板设置">
        <Row label="显示模板">
          <Space size={8} wrap>
            <BrowserBox
              value={modeLabel(fc.mode)}
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
            <Switch
              size="small"
              checked={!!margin.custom}
              onChange={(v) => patch({ margin: { ...margin, custom: v, type: v ? margin.type ?? 0 : 1 } })}
            />
            <Tooltip title="不启用，则采用流程表单默认页边距设置。">
              <QuestionCircleOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          </Space>
        </Row>
        {margin.custom && (
          <>
            <Row label="模式选择">
              <Select
                style={{ width: 200 }}
                value={margin.type ?? 0}
                options={MARGIN_TYPES}
                onChange={(v) => patch({ margin: { ...margin, type: v } })}
              />
            </Row>
            <Row label="页边距(px)">
              <Space size={8} wrap>
                {(['top', 'bottom', 'left', 'right'] as const).map((k, i) => (
                  <span key={k}>
                    <span style={{ color: '#888', marginRight: 4 }}>
                      {['上', '下', '左', '右'][i]}
                    </span>
                    <InputNumber
                      size="small"
                      min={0}
                      style={{ width: 80 }}
                      value={margin[k] ?? 0}
                      onChange={(v) => patch({ margin: { ...margin, [k]: v ?? 0 } })}
                    />
                  </span>
                ))}
                <Tooltip title={NOT_YET}>
                  <QuestionCircleOutlined style={{ color: '#faad14' }} />
                </Tooltip>
              </Space>
            </Row>
          </>
        )}

        <Row label="同步节点">
          <Space size={8} wrap>
            <Select
              mode="multiple"
              allowClear
              style={{ width: 320 }}
              placeholder="选择要同步到的节点"
              value={fc.syncNodeKeys || []}
              options={nodeOptions}
              onChange={(v) => patch({ syncNodeKeys: v })}
            />
            <Button
              size="small"
              loading={syncing}
              disabled={!(fc.syncNodeKeys || []).length}
              onClick={() => syncTo(fc.syncNodeKeys || [], '显示模板设置')}
            >
              同步
            </Button>
            <Tooltip title="把本节点的「显示模式 / 页边距 / 明细过滤」等表单内容设置覆盖到所选节点。">
              <QuestionCircleOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          </Space>
        </Row>
      </Section>

      <Section title="移动模板设置">
        <Row label="移动模板">
          <Space size={8}>
            <BrowserBox
              value={mobile.templateName}
              placeholder="未设置"
              disabled={!canLayout}
              onClick={design}
              onAdd={design}
              addTooltip={canLayout ? '进入节点布局设计器（移动端渲染尚未接入）' : '请先绑定表单'}
            />
            <Tooltip title={NOT_YET}>
              <Button size="small" onClick={() => patch({ mobile: { ...mobile, templateName: modeLabel(fc.mode) } })}>
                初始化
              </Button>
            </Tooltip>
          </Space>
        </Row>
        <Row label="同步节点">
          <Space size={8} wrap>
            <Select
              mode="multiple"
              allowClear
              style={{ width: 320 }}
              placeholder="选择要同步到的节点"
              value={mobile.nodeKeys || []}
              options={nodeOptions}
              onChange={(v) => patch({ mobile: { ...mobile, nodeKeys: v } })}
            />
            <Button
              size="small"
              loading={syncing}
              disabled={!(mobile.nodeKeys || []).length}
              onClick={() => syncTo(mobile.nodeKeys || [], '移动模板设置')}
            >
              同步
            </Button>
          </Space>
        </Row>
      </Section>

      <Section title="明细表">
        <Row label="明细表数据根据操作者筛选显示">
          <Space size={8}>
            <Switch
              size="small"
              checked={!!detailFilter.enabled}
              onChange={(v) => patch({ detailFilter: { ...detailFilter, enabled: v } })}
            />
            <Tooltip title={NOT_YET}>
              <QuestionCircleOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          </Space>
        </Row>
      </Section>

      <Section title="节点意见">
        <Row label="签字意见设置">
          <Space size={8}>
            <span style={{ color: '#888', fontSize: 12 }}>
              复用「节点设置 → 签字意见设置」（是否必填 / 默认模板）
            </span>
            <a
              onClick={() => nodeKey && onOpenNodeSetting?.(nodeKey)}
              style={{ color: nodeKey ? '#1677ff' : '#bfbfbf' }}
            >
              去设置
            </a>
          </Space>
        </Row>
      </Section>

      {!formId && (
        <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
          该流程尚未绑定表单，无法进入布局设计。
          {formName ? `（当前表单：${formName}）` : ''}
        </div>
      )}
    </>
  );

  const printTemplate = (
    <>
      <Section title="打印模板设置">
        <Row label="打印模板">
          <Space size={8} wrap>
            <BrowserBox
              value={print.templateName}
              placeholder="未设置"
              onClick={() => patch({ print: { ...print, templateName: modeLabel(fc.mode) } })}
              onAdd={() => patch({ print: { ...print, templateName: modeLabel(fc.mode) } })}
              addTooltip="按当前显示模板初始化打印模板（打印渲染尚未接入）"
            />
            <a
              onClick={() => patch({ print: { ...print, templateName: modeLabel(fc.mode) } })}
              style={{ color: '#1677ff' }}
            >
              初始化
            </a>
            <Tooltip title={NOT_YET}>
              <a style={{ color: '#bfbfbf' }}>预览</a>
            </Tooltip>
          </Space>
        </Row>
        <Row label="同步节点">
          <Space size={8} wrap>
            <Select
              mode="multiple"
              allowClear
              style={{ width: 320 }}
              placeholder="选择要同步到的节点"
              value={print.nodeKeys || []}
              options={nodeOptions}
              onChange={(v) => patch({ print: { ...print, nodeKeys: v } })}
            />
            <Button
              size="small"
              loading={syncing}
              disabled={!(print.nodeKeys || []).length}
              onClick={() => syncTo(print.nodeKeys || [], '打印模板设置')}
            >
              同步
            </Button>
          </Space>
        </Row>
      </Section>
      {!print.templateName && <Empty description="尚未设置打印模板" />}
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
        </Space>
      }
    >
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'show', label: '显示模板', children: showTemplate },
          { key: 'print', label: '打印模板', children: printTemplate },
        ]}
      />
    </Modal>
  );
};

export default FormContentDesignModal;
