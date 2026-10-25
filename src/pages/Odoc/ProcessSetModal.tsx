import React, { useEffect, useState } from 'react';
import { Button, Divider, Form, Input, InputNumber, Modal, Select, Space, Spin, Switch, message } from 'antd';
import { listNodes, mouldApi, odocSettingApi, processSetApi, type OdocMould, type OdocProcessSet, type OdocSealConfigItem, type OdocSealSignerItem, type WfProcessNode } from '@/services/workflow';

interface ProcessSetModalProps {
  open: boolean;
  defId?: any;
  onClose: () => void;
  onSaved?: () => void;
}

const officalTypeOptions = [
  { label: '非公文', value: 0 },
  { label: '发文', value: 1 },
  { label: '收文', value: 2 },
  { label: '签报', value: 3 },
];

const layoutFormatOptions = [
  { label: '不启用（L1 纯 docx/pdf）', value: 0 },
  { label: 'PDF（12）', value: 12 },
  { label: 'OFD（13，需厂商 SDK）', value: 13 },
];

/** 逗号分隔 <-> 多选数组 */
const splitCsv = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const joinCsv = (v?: any[]) => (v && v.length ? v.join(',') : undefined);

const signerTypeOptions = [
  { label: '个人', value: 0 },
  { label: '企业', value: 1 },
];

const sealTypeOptions = [
  { label: '个人签字', value: 1 },
  { label: '单位公章', value: 2 },
  { label: '时间戳', value: 3 },
];

/** seal_config(JSON) → 表单值 */
const parseSealConfig = (raw?: string): OdocSealConfigItem | undefined => {
  if (!raw) return undefined;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return undefined;
    return {
      page: o.page,
      offsetX: o.offsetX,
      offsetY: o.offsetY,
      sealType: o.sealType,
      signers: Array.isArray(o.signers) ? o.signers : [],
    };
  } catch {
    return undefined;
  }
};

/** 表单值 → seal_config(JSON)；无有效内容时返回 undefined（不覆盖库里已有值） */
const buildSealConfig = (v?: OdocSealConfigItem): string | undefined => {
  if (!v) return undefined;
  const signers = (v.signers || []).filter((s) => s && (s.psnAccount || s.orgName || s.accountId));
  const hasPosition = v.page != null || v.offsetX != null || v.offsetY != null || v.sealType != null;
  if (!hasPosition && signers.length === 0) return undefined;
  return JSON.stringify({
    page: v.page,
    offsetX: v.offsetX,
    offsetY: v.offsetY,
    sealType: v.sealType,
    signers,
  });
};

/**
 * 流程建文设置弹窗：按流程定义配置公文开关（正文/标题字段、套红节点与强制套红、
 * 文号字段、定稿/签章/转版式节点、版式格式等）。L1/L2 流程级灰度核心。
 */
const ProcessSetModal: React.FC<ProcessSetModalProps> = ({ open, defId, onClose, onSaved }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes] = useState<WfProcessNode[]>([]);
  const [moulds, setMoulds] = useState<OdocMould[]>([]);
  const [setting, setSetting] = useState<any>(null);

  useEffect(() => {
    if (!open || defId == null) return;
    setLoading(true);
    Promise.all([
      listNodes(defId).catch(() => []),
      mouldApi.list(defId, 2).catch(() => []),
      processSetApi.get(defId).catch(() => null),
      odocSettingApi.get().catch(() => null),
    ])
      .then(([nodeList, mouldList, set, setRes]) => {
        setNodes((nodeList?.data || []) as WfProcessNode[]);
        setMoulds((mouldList?.data || []) as OdocMould[]);
        const cfg = (setRes?.data || {}) as any;
        setSetting(cfg);
        const s = (set?.data || {}) as OdocProcessSet;
        form.setFieldsValue({
          defId,
          officalType: s.officalType ?? 1,
          docFieldKey: s.docFieldKey,
          docTitleFieldKey: s.docTitleFieldKey,
          taohongNodeKey: s.taohongNodeKey,
          mustTaohong: s.mustTaohong != null ? s.mustTaohong === 1 : cfg.defaultMustTaohong === 1,
          numberFieldKey: s.numberFieldKey,
          taohongMouldId: s.taohongMouldId,
          finalizeNodeKey: s.finalizeNodeKey,
          layoutNodeKey: s.layoutNodeKey,
          layoutFormat: s.layoutFormat ?? (cfg.defaultLayoutFormat ?? 0),
          signNodeKey: s.signNodeKey,
          sealRequired: s.sealRequired != null ? s.sealRequired === 1 : cfg.defaultSealRequired === 1,
          printNodeKeys: splitCsv(s.printNodeKeys),
          cleanCopyNodeKeys: splitCsv(s.cleanCopyNodeKeys),
          signatureNodeKeys: splitCsv(s.signatureNodeKeys),
          sealCfgItem: parseSealConfig(s.sealConfig),
        });
      })
      .finally(() => setLoading(false));
  }, [open, defId, form]);

  const handleSave = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const payload: OdocProcessSet = {
        defId,
        officalType: v.officalType,
        docFieldKey: v.docFieldKey,
        docTitleFieldKey: v.docTitleFieldKey,
        taohongNodeKey: v.taohongNodeKey,
        mustTaohong: v.mustTaohong ? 1 : 0,
        numberFieldKey: v.numberFieldKey,
        taohongMouldId: v.taohongMouldId,
        finalizeNodeKey: v.finalizeNodeKey,
        layoutNodeKey: v.layoutNodeKey,
        layoutFormat: v.layoutFormat,
        signNodeKey: v.signNodeKey,
        sealRequired: v.sealRequired ? 1 : 0,
        printNodeKeys: joinCsv(v.printNodeKeys),
        cleanCopyNodeKeys: joinCsv(v.cleanCopyNodeKeys),
        signatureNodeKeys: joinCsv(v.signatureNodeKeys),
        sealConfig: buildSealConfig(v.sealCfgItem),
      };
      await processSetApi.save(payload);
      message.success('流程建文设置已保存');
      onSaved?.();
      onClose();
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const nodeOptions = nodes.map((n) => ({
    label: `${n.nodeName || ''}${n.nodeKey ? ` (${n.nodeKey})` : ''}`,
    value: n.nodeKey,
  }));

  return (
    <Modal
      open={open}
      title="流程建文设置"
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="defId" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="公文类型" name="officalType" rules={[{ required: true }]}>
            <Select options={officalTypeOptions} />
          </Form.Item>
          <Space wrap>
            <Form.Item label="正文字段（表单存 docId）" name="docFieldKey">
              <Input placeholder="如 fld_body" style={{ width: 240 }} />
            </Form.Item>
            <Form.Item label="标题字段" name="docTitleFieldKey">
              <Input placeholder="如 fld_title" style={{ width: 200 }} />
            </Form.Item>
          </Space>

          <Space wrap>
            <Form.Item label="套红节点" name="taohongNodeKey">
              <Select allowClear showSearch optionFilterProp="label" options={nodeOptions} style={{ width: 240 }} placeholder="选择节点" />
            </Form.Item>
            <Form.Item label="强制套红（提交前必须套红）" name="mustTaohong" valuePropName="checked">
              <Switch checkedChildren="强制" unCheckedChildren="否" />
            </Form.Item>
            <Form.Item label="默认套红模板" name="taohongMouldId">
              <Select allowClear showSearch optionFilterProp="label" style={{ width: 220 }}
                options={moulds.map((m) => ({ label: m.mouldName, value: m.id }))}
                placeholder="可选" />
            </Form.Item>
          </Space>

          <Form.Item label="文号字段" name="numberFieldKey">
            <Input placeholder="如 fld_docNumber" style={{ width: 260 }} />
          </Form.Item>

          <Space wrap>
            <Form.Item label="定稿节点" name="finalizeNodeKey">
              <Select allowClear showSearch optionFilterProp="label" options={nodeOptions} style={{ width: 200 }} placeholder="选择节点" />
            </Form.Item>
            <Form.Item label="签章节点" name="signNodeKey">
              <Select allowClear showSearch optionFilterProp="label" options={nodeOptions} style={{ width: 200 }} placeholder="选择节点" />
            </Form.Item>
            <Form.Item label="转版式节点" name="layoutNodeKey">
              <Select allowClear showSearch optionFilterProp="label" options={nodeOptions} style={{ width: 200 }} placeholder="选择节点" />
            </Form.Item>
            <Form.Item label="版式格式" name="layoutFormat">
              <Select
                options={layoutFormatOptions.filter((o) => setting?.isOpenOfd === 1 || o.value !== 13)}
                style={{ width: 220 }}
              />
            </Form.Item>
          </Space>

          <Space wrap>
            <Form.Item label="签章节点（多选）" name="signatureNodeKeys">
              <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={nodeOptions} style={{ width: 220 }} placeholder="多选" />
            </Form.Item>
            <Form.Item label="清稿节点（多选）" name="cleanCopyNodeKeys">
              <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={nodeOptions} style={{ width: 220 }} placeholder="多选" />
            </Form.Item>
            <Form.Item label="打印节点（多选）" name="printNodeKeys">
              <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={nodeOptions} style={{ width: 220 }} placeholder="多选" />
            </Form.Item>
            <Form.Item label="必须电子签章" name="sealRequired" valuePropName="checked">
              <Switch checkedChildren="必须" unCheckedChildren="否" />
            </Form.Item>
          </Space>

          <Divider orientation="left" plain>
            用印位置与签署方
          </Divider>
          <Form.Item
            label="用印位置与签署方"
            extra="第三方电子签章（e签宝）按此发起签署：坐标为毫米；未配置签署方时流程会跳过用印并告警"
          >
            <div style={{ width: '100%' }}>
              <Form.List name={['sealCfgItem', 'signers']}>
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field) => (
                      <Space key={field.key} wrap align="baseline" style={{ marginBottom: 8 }}>
                        <Form.Item {...field} name="signerType" label="类型" style={{ marginBottom: 0 }}>
                          <Select options={signerTypeOptions} style={{ width: 100 }} />
                        </Form.Item>
                        <Form.Item {...field} name="order" label="顺序" style={{ marginBottom: 0 }}>
                          <InputNumber min={1} style={{ width: 80 }} placeholder="顺序" />
                        </Form.Item>
                        <Form.Item {...field} name="accountId" label="账号ID" style={{ marginBottom: 0 }}>
                          <Input style={{ width: 150 }} placeholder="psnId/orgId" />
                        </Form.Item>
                        <Form.Item {...field} name="psnAccount" label="手机号" style={{ marginBottom: 0 }}>
                          <Input style={{ width: 140 }} placeholder="个人" />
                        </Form.Item>
                        <Form.Item {...field} name="psnName" label="姓名" style={{ marginBottom: 0 }}>
                          <Input style={{ width: 110 }} placeholder="个人" />
                        </Form.Item>
                        <Form.Item {...field} name="psnIdCardNum" label="证件号" style={{ marginBottom: 0 }}>
                          <Input style={{ width: 150 }} placeholder="个人" />
                        </Form.Item>
                        <Form.Item {...field} name="orgName" label="企业名称" style={{ marginBottom: 0 }}>
                          <Input style={{ width: 180 }} placeholder="企业" />
                        </Form.Item>
                        <Form.Item {...field} name="orgIdCardNum" label="统一信用代码" style={{ marginBottom: 0 }}>
                          <Input style={{ width: 170 }} placeholder="企业" />
                        </Form.Item>
                        <Form.Item {...field} name="sealId" label="印章ID" style={{ marginBottom: 0 }}>
                          <Input style={{ width: 150 }} placeholder="可选" />
                        </Form.Item>
                        <Form.Item {...field} name="autoSign" label="自动落章" valuePropName="checked" style={{ marginBottom: 0 }}>
                          <Switch checkedChildren="是" unCheckedChildren="否" />
                        </Form.Item>
                        <Button type="link" danger onClick={() => remove(field.name)}>
                          删除
                        </Button>
                      </Space>
                    ))}
                    <Button type="dashed" onClick={() => add({ signerType: 0, order: fields.length + 1, autoSign: false })}>
                      添加签署方
                    </Button>
                  </>
                )}
              </Form.List>
              <Space wrap style={{ marginTop: 12 }}>
                <Form.Item {...{ name: ['sealCfgItem', 'page'] }} label="页码" style={{ marginBottom: 0 }}>
                  <InputNumber min={1} style={{ width: 100 }} placeholder="页码" />
                </Form.Item>
                <Form.Item {...{ name: ['sealCfgItem', 'offsetX'] }} label="X(毫米)" style={{ marginBottom: 0 }}>
                  <InputNumber style={{ width: 110 }} placeholder="横坐标" />
                </Form.Item>
                <Form.Item {...{ name: ['sealCfgItem', 'offsetY'] }} label="Y(毫米)" style={{ marginBottom: 0 }}>
                  <InputNumber style={{ width: 110 }} placeholder="纵坐标" />
                </Form.Item>
                <Form.Item {...{ name: ['sealCfgItem', 'sealType'] }} label="章型" style={{ marginBottom: 0 }}>
                  <Select options={sealTypeOptions} style={{ width: 140 }} placeholder="章型" />
                </Form.Item>
              </Space>
            </div>
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  );
};

export default ProcessSetModal;
