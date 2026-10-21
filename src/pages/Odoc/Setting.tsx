import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, Select, Switch, message } from 'antd';
import { odocSettingApi, type OdocSetting } from '@/services/workflow';

const LAYOUT_FORMAT = [
  { label: '不启用（L1 纯 docx/pdf）', value: 0 },
  { label: 'PDF（12）', value: 12 },
  { label: 'OFD（13，需厂商 SDK）', value: 13 },
];

/**
 * 公文通用设置（模块级开关 + 新建流程默认值）。
 * 对应后端 WfOdocSettingController（/odoc/setting）；被「流程建文设置」消费。
 */
const OdocSettingPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await odocSettingApi.get();
      const s = (res?.data || {}) as OdocSetting;
      form.setFieldsValue({
        isOpenOfd: s.isOpenOfd === 1,
        defaultLayoutFormat: s.defaultLayoutFormat ?? 0,
        defaultMustTaohong: s.defaultMustTaohong !== 0,
        defaultSealRequired: s.defaultSealRequired === 1,
        defaultTaohongMouldId: s.defaultTaohongMouldId != null ? String(s.defaultTaohongMouldId) : undefined,
        defaultProcessDefId: s.defaultProcessDefId,
        remark: s.remark,
      });
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSave = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await odocSettingApi.save({
        isOpenOfd: v.isOpenOfd ? 1 : 0,
        defaultLayoutFormat: v.defaultLayoutFormat,
        defaultMustTaohong: v.defaultMustTaohong ? 1 : 0,
        defaultSealRequired: v.defaultSealRequired ? 1 : 0,
        defaultTaohongMouldId: v.defaultTaohongMouldId ? Number(v.defaultTaohongMouldId) : undefined,
        defaultProcessDefId: v.defaultProcessDefId || undefined,
        remark: v.remark,
      });
      message.success('已保存');
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 8, maxWidth: 640 }}>
      <Card title="公文通用设置" loading={loading}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="isOpenOfd"
            label="开放 OFD 版式"
            valuePropName="checked"
            extra="关闭后，「流程建文设置」的版式格式不再显示 OFD(13) 选项"
          >
            <Switch />
          </Form.Item>
          <Form.Item name="defaultLayoutFormat" label="新建流程默认版式格式">
            <Select options={LAYOUT_FORMAT} />
          </Form.Item>
          <Form.Item name="defaultMustTaohong" label="新建流程默认强制套红" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="defaultSealRequired" label="新建流程默认必须电子签章" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            name="defaultTaohongMouldId"
            label="新建流程默认红头模板"
            tooltip="新建公文流程时自动带入的红头模板；留空表示不默认（仍可在流程建文设置里改）"
          >
            <Input placeholder="红头模板ID（关联 wf_odoc_mould）" />
          </Form.Item>
          <Form.Item
            name="defaultProcessDefId"
            label="默认流程"
            tooltip="新建公文默认带入的流程定义ID或流程key；留空表示不默认"
          >
            <Input placeholder="如：odocFaWen 或 proc_def_id" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" loading={saving} onClick={handleSave}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default OdocSettingPage;
