import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Radio, Select, Switch, message } from 'antd';
import { odocEsignApi, odocSealConfigApi, odocSettingApi, type OdocSealConfig, type OdocSealMode, type OdocSealOption, type OdocSetting } from '@/services/workflow';

const LAYOUT_FORMAT = [
  { label: '不启用（L1 纯 docx/pdf）', value: 0 },
  { label: 'PDF（12）', value: 12 },
  { label: 'OFD（13，需厂商 SDK）', value: 13 },
];

/** 兜底方案（后端未返回 modes 时用） */
const FALLBACK_MODES: OdocSealMode[] = [
  { value: 0, label: '自研印章（本地 CA）' },
  { value: 1, label: '第三方电子签章（e签宝）' },
];

/**
 * 公文通用设置（模块级开关 + 新建流程默认值 + 电子签章方案）。
 * 对应后端 WfOdocSettingController（/odoc/setting、/odoc/setting/seal）；被「流程建文设置」消费。
 */
const OdocSettingPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sealForm] = Form.useForm();
  const [sealCfg, setSealCfg] = useState<OdocSealConfig>({});
  const [sealLoading, setSealLoading] = useState(false);
  const [sealSaving, setSealSaving] = useState(false);
  const [sealList, setSealList] = useState<OdocSealOption[]>([]);

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

  /** 读电子签章方案配置（方案选择 + 第三方接入状态） */
  const reloadSeal = useCallback(async () => {
    setSealLoading(true);
    try {
      const res = await odocSealConfigApi.get();
      const c = (res?.data || {}) as OdocSealConfig;
      setSealCfg(c);
      sealForm.setFieldsValue({
        sealMode: c.sealMode ?? 0,
        esignOrgId: c.esignOrgId || '',
        esignDefaultSealId: c.esignDefaultSealId || '',
        esignNotifyUrl: c.esignNotifyUrl || '',
      });
      // 第三方就绪时拉取印章库（失败不阻断页面）
      if (c.esignReady) {
        odocEsignApi
          .seals()
          .then((r: any) => setSealList((r?.data || []) as OdocSealOption[]))
          .catch(() => setSealList([]));
      }
    } catch (e: any) {
      message.error(e?.msg || '加载签章方案失败');
    } finally {
      setSealLoading(false);
    }
  }, [sealForm]);

  useEffect(() => {
    reload();
    reloadSeal();
  }, [reload, reloadSeal]);

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

  const handleSaveSeal = async () => {
    const v = await sealForm.validateFields();
    setSealSaving(true);
    try {
      await odocSealConfigApi.save({
        sealMode: v.sealMode,
        esignOrgId: v.esignOrgId || '',
        esignDefaultSealId: v.esignDefaultSealId || '',
        esignNotifyUrl: v.esignNotifyUrl || '',
      });
      message.success('签章方案已保存');
      await reloadSeal();
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    } finally {
      setSealSaving(false);
    }
  };

  const modes = sealCfg.modes && sealCfg.modes.length ? sealCfg.modes : FALLBACK_MODES;
  const esignReady = sealCfg.esignReady === true;
  // 响应式读取当前选择的方案（切换到第三方时才展示第三方参数）
  const watchedMode = Form.useWatch('sealMode', sealForm);
  const sealMode = watchedMode ?? sealCfg.sealMode ?? 0;
  const watchedDefaultSeal = Form.useWatch('esignDefaultSealId', sealForm);
  const sealOptions = sealList.map((s) => ({
    label: `${s.sealName || s.sealId || '-'}${s.defaultSeal ? '（默认）' : ''}`,
    value: s.sealId || '',
  }));

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

      <Card title="电子签章方案" loading={sealLoading} style={{ marginTop: 16 }}>
        <Form form={sealForm} layout="vertical">
          <Form.Item
            name="sealMode"
            label="签章方案"
            extra="自研印章走本地 CA 组件同步盖章；第三方电子签章走 e签宝签署流程（异步，签署完成后归档）"
          >
            <Radio.Group>
              {modes.map((m) => (
                <Radio.Button key={m.value} value={m.value} disabled={m.selectable === false}>
                  {m.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>

          <Alert
            style={{ marginBottom: 16 }}
            type={esignReady ? 'success' : 'warning'}
            showIcon
            message={esignReady ? '第三方电子签章已就绪' : '第三方电子签章尚未就绪'}
            description={
              <div>
                <div>总开关：{sealCfg.esignEnabled ? '已启用' : '未启用'}（Nacos：odoc.esign.enabled）</div>
                <div>接入域名：{sealCfg.esignHost || '-'}</div>
                <div>应用ID：{sealCfg.esignAppIdMasked || '未配置'}</div>
                <div style={{ marginTop: 4, color: '#8c8c8c' }}>
                  应用ID/密钥在 Nacos 配置（odoc.esign.app-id / app-secret），页面不维护敏感凭据。
                </div>
              </div>
            }
          />

          {sealMode === 1 ? (
            <>
              <Form.Item
                name="esignOrgId"
                label="第三方机构ID"
                tooltip="e签宝的 orgId；留空则取 Nacos 配置 odoc.esign.org-id"
              >
                <Input placeholder="如：ORG_xxxxxxxx" />
              </Form.Item>
              <Form.Item
                label="默认印章"
                tooltip="默认使用的 e签宝印章 sealId；留空则取 Nacos 配置 odoc.esign.seal.default-seal-id"
              >
                <Space wrap>
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="从印章库选择"
                    style={{ width: 260 }}
                    value={watchedDefaultSeal || undefined}
                    onChange={(v) => sealForm.setFieldValue('esignDefaultSealId', v || '')}
                    options={sealOptions}
                    notFoundContent={sealOptions.length ? null : '未获取到印章（检查机构ID/密钥配置）'}
                  />
                  <Form.Item name="esignDefaultSealId" noStyle>
                    <Input placeholder="或手工填写 sealId" style={{ width: 220 }} />
                  </Form.Item>
                </Space>
              </Form.Item>
              <Form.Item
                name="esignNotifyUrl"
                label="签署回调地址"
                tooltip="e签宝回调本系统的地址（需外网可达）；留空则取 Nacos 配置 odoc.esign.notify-url"
              >
                <Input placeholder="如：https://域名/api/blade-workflow/odoc/esign/callback" />
              </Form.Item>
            </>
          ) : null}

          <Form.Item>
            <Button type="primary" loading={sealSaving} onClick={handleSaveSeal}>
              保存签章方案
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default OdocSettingPage;
