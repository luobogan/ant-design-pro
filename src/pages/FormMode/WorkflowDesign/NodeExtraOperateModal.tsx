import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  message,
} from 'antd';
import { DeleteOutlined, HolderOutlined, SearchOutlined } from '@ant-design/icons';
import { updateNode, WfProcessNode } from '@/services/workflow';
import { FormFieldBrief } from './LinkInfoPanel';
import { EXTRA_OPERATE_TYPES, FAIL_MODES } from './wfDict';
import {
  buildExtJson,
  buildExtraOperateConfig,
  extraOperateCommand,
  extraOperateLabel,
  isExtraItemConfigured,
  nodeSettings,
  normalizeExtraOperate,
  ExtraOperateItem,
} from './nodeSettings';

export type ExtraOperateField = 'preOperate' | 'postOperate';

export interface NodeExtraOperateModalProps {
  open: boolean;
  defId: any;
  /** 目标设置项：节点前 / 节点后附加操作 */
  field: ExtraOperateField;
  /** 所属节点（草稿行由调用方组装成带 extJson 的伪节点） */
  node?: WfProcessNode;
  /** 表单字段（「字段赋值」页签的字段下拉来源） */
  formFields?: FormFieldBrief[];
  /** 草稿模式：不落库，仅通过 onSaved 回传新的 extJson */
  draftMode?: boolean;
  onSaved?: (nodeKey: string, extJson: string) => void;
  onClose: () => void;
}

/** 「外部接口」页签的动作类型（对齐 E9：自定义接口动作 / 其它接口类动作） */
const API_TYPES = [
  { value: 'callApi', label: '自定义接口动作' },
  { value: 'updateTable', label: '更新业务表' },
  { value: 'sendMsg', label: '发送消息' },
  { value: 'script', label: '自定义脚本' },
];

/** 动作类型的「来源 / 内容」输入项落到明细的哪个字段（决定映射出的执行命令） */
const API_TARGET_META: Record<string, { field: 'target' | 'payload' | 'script'; label: string; ph: string; hint?: string }> = {
  callApi: {
    field: 'target',
    label: '接口来源',
    ph: 'https://api.xxx.com/notify',
    hint: '执行器仅发 GET；需开启 blade.workflow.action.http-enabled',
  },
  updateTable: {
    field: 'payload',
    label: '执行 SQL',
    ph: 'update biz_order set status=2 where id=${billId}',
    hint: '映射为 dml:内容，请写完整 SQL',
  },
  sendMsg: {
    field: 'payload',
    label: '消息内容',
    ph: '您有一张单据待处理',
    hint: '消息通道尚未接入引擎，仅保存配置',
  },
  script: {
    field: 'script',
    label: '脚本内容',
    ph: 'field:status=2（支持多行）',
    hint: '按前缀分派执行（http(s):// / sql: / field:）',
  },
};

/** 详情编辑弹窗（高级字段：脚本 / 执行失败时 / 备注 / 启用）——等价 E9 的「更多 »」 */
const DETAIL_TYPE_LABELS: Record<string, { target: string; payload: string; targetPh?: string; payloadPh?: string }> = {
  fieldAssign: { target: '目标字段', payload: '赋值表达式', targetPh: '如：amount', payloadPh: '如：${price} * ${qty}' },
  updateTable: { target: '业务表(说明)', payload: '执行 SQL', targetPh: '如：biz_order', payloadPh: '如：update biz_order set status=2 where id=${billId}' },
  callApi: { target: '接口地址', payload: '备注/请求体', targetPh: '如：https://api.xxx.com/notify', payloadPh: '当前执行器仅发 GET' },
  sendMsg: { target: '接收人', payload: '消息内容', targetPh: '如：${operator}', payloadPh: '如：您有一张单据待处理' },
  script: { target: '附加目标(可选)', payload: '执行参数(可选)', targetPh: '可留空', payloadPh: '可留空' },
};

let itemKeySeq = 0;
const newItemKey = () => `op_${Date.now().toString(36)}${itemKeySeq++}`;

/**
 * 节点「前 / 后附加操作」配置弹窗（对齐 ecology E9 的「节点前/后附加操作」对话框）。
 *
 * E9 形态（见设计稿）：
 * · 顶部两个页签：**字段赋值** / **外部接口** —— 切换「新增工具条」；
 * · 工具条就地新增：字段赋值 = 字段 + 值 + 确定；外部接口 = 动作类型 + 动作名称* + 接口来源* + 确定；
 * · 下方「节点…附加操作列表」：勾选框 + 拖柄名称 + **是否启用** + **退回时触发**；支持拖动排序、批量删除；
 * · 点名称进入「详情」编辑（脚本 / 执行失败时 / 备注等高级项）。
 *
 * 存储：ext_json.settings[preOperate|postOperate] = { items, script, scriptOnReject }
 * `script`（正常提交）/ `scriptOnReject`（退回，仅勾选「退回时触发」的条目）均为派生字段，
 * 后端按行依次执行，因此既有读取路径与旧数据行为不变。
 */
const NodeExtraOperateModal: React.FC<NodeExtraOperateModalProps> = ({
  open,
  defId,
  field,
  node,
  formFields,
  draftMode,
  onSaved,
  onClose,
}) => {
  const [items, setItems] = useState<ExtraOperateItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'field' | 'api'>('field');
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  /** 拖拽排序：拖动源 / 悬停落点 */
  const [dragKey, setDragKey] = useState<string | undefined>();
  const [dragOverKey, setDragOverKey] = useState<string | undefined>();

  // 新增工具条（字段赋值 / 外部接口各一套草稿）
  const [assignField, setAssignField] = useState('');
  const [assignValue, setAssignValue] = useState('');
  const [apiType, setApiType] = useState('callApi');
  const [apiName, setApiName] = useState('');
  const [apiTarget, setApiTarget] = useState('');

  // 详情编辑
  const [editing, setEditing] = useState<ExtraOperateItem | undefined>();
  const [detailForm] = Form.useForm();
  const [detailType, setDetailType] = useState<string>('none');

  const fieldLabel = field === 'preOperate' ? '节点前附加操作' : '节点后附加操作';

  useEffect(() => {
    if (!open || !node) return;
    setItems(normalizeExtraOperate(nodeSettings(node)[field]).items);
    setSelectedKeys([]);
    setActiveTab('field');
    setEditing(undefined);
    setDragKey(undefined);
    setDragOverKey(undefined);
    setAssignField('');
    setAssignValue('');
    setApiType('callApi');
    setApiName('');
    setApiTarget('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, field, node?.nodeKey, node?.extJson]);

  const fieldOptions = useMemo(
    () =>
      (formFields || []).map((f) => ({
        value: f.fieldName,
        label: `${f.fieldLabel || f.fieldName}（${f.fieldName}）${
          f.scope && f.scope !== 'main' ? `·${f.scope}` : ''
        }`,
      })),
    [formFields],
  );

  // ───────────── 新增 ─────────────

  const addFieldAssign = () => {
    const f = assignField.trim();
    if (!f) {
      message.warning('请先选择或填写字段');
      return;
    }
    const v = assignValue.trim();
    setItems((prev) => [
      ...prev,
      {
        key: newItemKey(),
        name: `${f} = ${v}`.trim(),
        type: 'fieldAssign',
        target: f,
        payload: v,
        failMode: 'continue',
        enabled: true,
        triggerOnReject: false,
      },
    ]);
    setAssignField('');
    setAssignValue('');
  };

  const addApiItem = () => {
    const name = apiName.trim();
    const target = apiTarget.trim();
    if (!name) {
      message.warning('请填写动作名称');
      return;
    }
    if (!target) {
      message.warning(`请填写${API_TARGET_META[apiType]?.label || '接口来源'}`);
      return;
    }
    const meta = API_TARGET_META[apiType] || API_TARGET_META.callApi;
    const item: ExtraOperateItem = {
      key: newItemKey(),
      name,
      type: apiType,
      failMode: 'continue',
      enabled: true,
      triggerOnReject: false,
    };
    (item as any)[meta.field] = target;
    setItems((prev) => [...prev, item]);
    setApiName('');
    setApiTarget('');
  };

  // ───────────── 行内编辑 / 删除 / 排序 ─────────────

  const patchItem = (key: string, patch: Partial<ExtraOperateItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const removeSelected = () => {
    const del = new Set(selectedKeys.map(String));
    setItems((prev) => prev.filter((i) => !del.has(i.key)));
    setSelectedKeys([]);
  };

  const moveTo = (fromKey: string, toKey: string) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.key === fromKey);
      const to = prev.findIndex((i) => i.key === toKey);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [cur] = next.splice(from, 1);
      next.splice(to, 0, cur);
      return next;
    });
  };

  // ───────────── 详情编辑弹窗 ─────────────

  const openDetail = (item: ExtraOperateItem) => {
    setDetailType(item.type || 'none');
    setEditing(item);
    detailForm.setFieldsValue({
      name: item.name || '',
      type: item.type || 'none',
      target: item.target || '',
      payload: item.payload || '',
      script: item.script || '',
      failMode: item.failMode || 'continue',
      remark: item.remark || '',
      enabled: item.enabled !== false,
    });
  };

  const commitDetail = async () => {
    if (!editing) return;
    let values: any;
    try {
      values = await detailForm.validateFields();
    } catch {
      return;
    }
    const t = values.type || 'none';
    const next: ExtraOperateItem = {
      ...editing,
      name: (values.name || '').trim(),
      type: t,
      target: t === 'none' ? '' : values.target || '',
      payload: t === 'none' ? '' : values.payload || '',
      script: values.script || '',
      failMode: values.failMode || 'continue',
      remark: values.remark || '',
      enabled: values.enabled !== false,
    };
    patchItem(next.key, next);
    setEditing(undefined);
  };

  const detailLabels = DETAIL_TYPE_LABELS[detailType] || DETAIL_TYPE_LABELS.script;
  const wTarget = Form.useWatch('target', detailForm);
  const wPayload = Form.useWatch('payload', detailForm);
  const wScript = Form.useWatch('script', detailForm);
  const previewCmd = editing
    ? extraOperateCommand({
        ...editing,
        type: detailType,
        target: wTarget,
        payload: wPayload,
        script: wScript,
      })
    : '';

  // ───────────── 保存 ─────────────

  const handleOk = async () => {
    if (!node?.nodeKey) return;
    if (editing) {
      message.warning('请先完成「详情」弹窗的编辑（点确定或取消）');
      return;
    }
    const kept = items.filter(isExtraItemConfigured);
    if (kept.length !== items.length) {
      message.warning(`已忽略 ${items.length - kept.length} 条未配置的附加操作`);
    }
    const cfg = buildExtraOperateConfig(kept);
    const extJson = buildExtJson(node, (s) => {
      s[field] = cfg;
    });

    setSaving(true);
    try {
      if (draftMode) {
        onSaved?.(node.nodeKey, extJson);
        onClose();
        return;
      }
      const r: any = await updateNode(defId, node.nodeKey, { extJson });
      if (r?.success === false) {
        message.error('保存失败');
        return;
      }
      onSaved?.(node.nodeKey, extJson);
      message.success(`${fieldLabel}已保存`);
      onClose();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const apiMeta = API_TARGET_META[apiType] || API_TARGET_META.callApi;

  const columns: any[] = [
    {
      title: fieldLabel,
      dataIndex: 'name',
      render: (_: any, r: ExtraOperateItem) => (
        <Space size={6}>
          <span
            draggable
            title="按住拖动调整执行顺序"
            style={{ cursor: 'grab', color: '#999', display: 'inline-flex', alignItems: 'center' }}
            onDragStart={(e) => {
              setDragKey(r.key);
              e.dataTransfer.effectAllowed = 'move';
              // Firefox 需 setData 才会真正启动拖拽
              e.dataTransfer.setData('text/plain', String(r.key));
            }}
            onDragEnd={() => {
              setDragKey(undefined);
              setDragOverKey(undefined);
            }}
          >
            <HolderOutlined />
          </span>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            title="点击编辑详情（脚本 / 执行失败时 / 备注）"
            onClick={() => openDetail(r)}
          >
            {extraOperateLabel(r) || '未命名'}
          </Button>
        </Space>
      ),
    },
    {
      title: '是否启用',
      dataIndex: 'enabled',
      width: 120,
      render: (enabled: boolean, r: ExtraOperateItem) => (
        <Switch size="small" checked={enabled !== false} onChange={(v) => patchItem(r.key, { enabled: v })} />
      ),
    },
    {
      title: '退回时触发',
      dataIndex: 'triggerOnReject',
      width: 120,
      render: (v: boolean, r: ExtraOperateItem) => (
        <Checkbox
          checked={v === true}
          onChange={(e) => patchItem(r.key, { triggerOnReject: e.target.checked })}
        />
      ),
    },
  ];

  return (
    <>
      <Modal
        title={fieldLabel}
        open={open}
        onCancel={onClose}
        onOk={handleOk}
        confirmLoading={saving}
        destroyOnClose
        width={920}
        okText="保存"
        cancelText="取消"
      >
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'field' | 'api')}
          items={[
            {
              key: 'field',
              label: '字段赋值',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  <Space wrap>
                    {fieldOptions.length ? (
                      <Select
                        showSearch
                        allowClear
                        optionFilterProp="label"
                        style={{ width: 280 }}
                        value={assignField || undefined}
                        options={fieldOptions}
                        onChange={(v) => setAssignField(v ? String(v) : '')}
                        placeholder="下拉选择字段"
                      />
                    ) : (
                      <Input
                        style={{ width: 280 }}
                        value={assignField}
                        onChange={(e) => setAssignField(e.target.value)}
                        placeholder="表单暂无字段，可手工输入字段名"
                        allowClear
                      />
                    )}
                    <span style={{ color: '#999' }}>=</span>
                    <Input
                      style={{ width: 260 }}
                      value={assignValue}
                      onChange={(e) => setAssignValue(e.target.value)}
                      placeholder="值 / 表达式，如：业务审批"
                      allowClear
                    />
                    <Button type="primary" onClick={addFieldAssign}>
                      确定
                    </Button>
                  </Space>
                  {!fieldOptions.length && (
                    <span style={{ color: '#faad14', fontSize: 12 }}>
                      当前流程未绑定表单（或表单还没有字段），字段只能手工输入；绑定表单后这里会是下拉选择。
                    </span>
                  )}
                </Space>
              ),
            },
            {
              key: 'api',
              label: '外部接口',
              children: (
                <Space wrap>
                  <Select
                    style={{ width: 180 }}
                    value={apiType}
                    options={API_TYPES}
                    onChange={(v) => {
                      setApiType(String(v));
                      setApiTarget('');
                    }}
                  />
                  <Input
                    style={{ width: 200 }}
                    value={apiName}
                    onChange={(e) => setApiName(e.target.value)}
                    placeholder="动作名称"
                    allowClear
                  />
                  <span style={{ color: '#ff4d4f' }}>*</span>
                  <Input
                    style={{ width: 300 }}
                    value={apiTarget}
                    onChange={(e) => setApiTarget(e.target.value)}
                    placeholder={apiMeta.label}
                    suffix={<SearchOutlined style={{ color: '#bbb' }} />}
                    allowClear
                  />
                  <span style={{ color: '#ff4d4f' }}>*</span>
                  <Button type="primary" onClick={addApiItem}>
                    确定
                  </Button>
                </Space>
              ),
            },
          ]}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '4px 0 8px',
          }}
        >
          <span style={{ fontWeight: 600 }}>{fieldLabel}列表</span>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={!selectedKeys.length}
            onClick={removeSelected}
          >
            删除选中{selectedKeys.length ? `（${selectedKeys.length}）` : ''}
          </Button>
        </div>

        <Table
          size="small"
          rowKey="key"
          pagination={false}
          dataSource={items}
          columns={columns}
          scroll={{ y: 300 }}
          locale={{ emptyText: '暂无附加操作，用上方工具条添加' }}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys) => setSelectedKeys(keys),
          }}
          rowClassName={(r: ExtraOperateItem) =>
            dragKey && dragOverKey && r.key === dragOverKey && r.key !== dragKey ? 'wf-row-dragover' : ''
          }
          onRow={(r: ExtraOperateItem) => ({
            onDragOver: (e: React.DragEvent) => {
              if (!dragKey || r.key === dragKey) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverKey !== r.key) setDragOverKey(r.key);
            },
            onDrop: (e: React.DragEvent) => {
              if (!dragKey || r.key === dragKey) return;
              e.preventDefault();
              moveTo(dragKey, r.key);
              setDragKey(undefined);
              setDragOverKey(undefined);
            },
          })}
        />

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 8 }}
          message="列表按顺序依次执行；「是否启用」控制该条是否执行；「退回时触发」勾选后，退回场景也会执行该条（不勾选则仅正常提交时执行）。"
        />
      </Modal>

      <Modal
        title={`附加操作详情（${extraOperateLabel(editing || { key: '', type: 'none' })}）`}
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={commitDetail}
        destroyOnClose
        width={640}
        okText="确定"
        cancelText="取消"
      >
        <Form form={detailForm} layout="vertical" initialValues={{ type: 'none', failMode: 'continue', enabled: true }}>
          <Form.Item name="name" label="操作名称">
            <Input placeholder="留空则按类型/字段自动显示" allowClear />
          </Form.Item>

          <Form.Item name="type" label="操作类型" rules={[{ required: true, message: '请选择操作类型' }]}>
            <Select options={EXTRA_OPERATE_TYPES} onChange={(v) => setDetailType(String(v))} style={{ width: 220 }} />
          </Form.Item>

          {detailType !== 'none' && (
            <>
              <Form.Item name="target" label={detailLabels.target}>
                <Input placeholder={detailLabels.targetPh} allowClear />
              </Form.Item>
              <Form.Item name="payload" label={detailLabels.payload}>
                <Input.TextArea rows={3} placeholder={detailLabels.payloadPh} />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="script"
            label="自定义脚本"
            extra="前缀 http(s):// / sql: / dml: / field: / set: 会被执行器分派；支持多行，按行依次执行"
          >
            <Input.TextArea rows={4} placeholder={'// 例：\n// field:status=2\n// dml:update biz_order set status=2 where id=1'} />
          </Form.Item>

          <Form.Item name="failMode" label="执行失败时">
            <Radio.Group options={FAIL_MODES.map((o) => ({ label: o.label, value: o.value }))} />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input placeholder="便于维护的说明文字" allowClear />
          </Form.Item>

          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>

        {previewCmd && (
          <Alert
            type="success"
            showIcon
            message="该条实际执行命令"
            description={<span style={{ fontFamily: 'monospace' }}>{previewCmd}</span>}
          />
        )}
      </Modal>
    </>
  );
};

export default NodeExtraOperateModal;
