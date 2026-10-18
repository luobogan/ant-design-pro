/**
 * 门户「个人通用设置菜单」（对标泛微 ecology portalmenu accountmore）
 *
 * 菜单路由：/portal/accountmore → 组件 ./pages/Portal/AccountMore/index.tsx
 *   （path 末段 accountmore 经 toPascalCase → Accountmore，目录名一致）
 *
 * 后端：GET /portal/account-more/get（个人值优先、NULL 回退全局）、
 *      POST /portal/account-more/save（字段传 null = 回退全局）
 * 落库：blade_portal_account_setting（用户单例）
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Radio, Space, Spin, Switch, Typography, message } from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { portalApi } from '@/services/portal';
import type { AccountMoreSaveData, AccountMoreVO } from '@/services/portal';

/** 字体大小（对齐 blade_portal_setting.font_size 注释：1大 2中 3默认） */
const FONT_SIZE_OPTIONS = [
  { value: 1, label: '大' },
  { value: 2, label: '中' },
  { value: 3, label: '默认' },
];

/** 门户布局类型（1舒适 2标准 3紧凑） */
const LAYOUT_TYPE_OPTIONS = [
  { value: 1, label: '舒适' },
  { value: 2, label: '标准' },
  { value: 3, label: '紧凑' },
];

/** 「更多」菜单显隐项（对标 ACCOUNTMOREMENUINFO，如 {"font":1,"language":1}） */
const MORE_MENU_ITEMS = [
  { key: 'font', label: '字体设置' },
  { key: 'language', label: '语言切换' },
  { key: 'theme', label: '主题切换' },
  { key: 'refresh', label: '刷新门户' },
  { key: 'fullscreen', label: '全屏显示' },
  { key: 'myPortal', label: '我的门户' },
];

const AccountMore: React.FC = () => {
  const [vo, setVo] = useState<AccountMoreVO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<AccountMoreSaveData & { moreMenu?: Record<string, boolean> }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.getAccountMore();
      setVo(data || null);
      form.setFieldsValue({
        // null = 沿用全局；单选框用 0 表示「沿用全局」
        fontSize: (data?.personalFontSize ?? 0) as any,
        layoutType: (data?.personalLayoutType ?? 0) as any,
        moreMenu: (data?.menuConfig || {}) as any,
      });
    } catch (e) {
      console.error('[portal] 加载个人通用设置失败', e);
      message.error('加载个人通用设置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const ok = await portalApi.saveAccountMore({
        // 0 = 沿用全局 → 传 null（后端 update 时显式置 NULL）
        fontSize: values.fontSize ? Number(values.fontSize) : null,
        layoutType: values.layoutType ? Number(values.layoutType) : null,
        menuConfig: values.moreMenu || {},
      });
      if (ok) {
        message.success('个人通用设置已保存');
        load();
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存个人通用设置失败', e);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const moreMenu = Form.useWatch('moreMenu', form) || {};

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>
            个人通用设置菜单
          </Typography.Title>
          <Typography.Text type="secondary">
            对标泛微 portalmenu accountmore（ACCOUNTMOREMENUINFO + HrmUserSetting 个人字体/布局）
          </Typography.Text>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={submit}>
            保存
          </Button>
        </Space>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="个人值优先：留空/选择「沿用全局」即回退到「门户应用设置」的全局默认值（字段落库为 NULL）。"
      />

      <Spin spinning={loading}>
        <Form form={form} layout="vertical">
          <Card title="显示偏好" size="small" style={{ marginBottom: 16 }}>
            <Space size={48} wrap>
              <Form.Item name="fontSize" label="字体大小" extra="留空 = 沿用全局">
                <Radio.Group options={[{ value: 0, label: '沿用全局' }, ...FONT_SIZE_OPTIONS]} />
              </Form.Item>
              <Form.Item name="layoutType" label="门户布局" extra="留空 = 沿用全局">
                <Radio.Group options={[{ value: 0, label: '沿用全局' }, ...LAYOUT_TYPE_OPTIONS]} />
              </Form.Item>
            </Space>
            {vo && (
              <Typography.Text type="secondary">
                当前生效值：字体
                {FONT_SIZE_OPTIONS.find((f) => f.value === vo.fontSize)?.label || '默认'}，布局
                {LAYOUT_TYPE_OPTIONS.find((l) => l.value === vo.layoutType)?.label || '标准'}；全局默认：字体
                {FONT_SIZE_OPTIONS.find((f) => f.value === vo.globalFontSize)?.label || '默认'}，布局
                {LAYOUT_TYPE_OPTIONS.find((l) => l.value === vo.globalLayoutType)?.label || '标准'}。
              </Typography.Text>
            )}
          </Card>

          <Card title="「更多」菜单项显隐" size="small">
            {/* 开关组手写 checked/onChange，Form.Item 只做取值载体（name 不能再直接包 Switch：
                否则 Form 会注入 value/onChange 覆盖我们的事件） */}
            <Form.Item name="moreMenu" hidden>
              <Input />
            </Form.Item>
            <Space direction="vertical" style={{ width: '100%' }}>
              {MORE_MENU_ITEMS.map((it) => (
                <Space key={it.key} size={8}>
                  <Switch
                    size="small"
                    checked={!!moreMenu?.[it.key]}
                    onChange={(checked) =>
                      form.setFieldValue('moreMenu', { ...moreMenu, [it.key]: checked ? 1 : 0 })
                    }
                  />
                  <Typography.Text>{it.label}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {it.key}
                  </Typography.Text>
                </Space>
              ))}
            </Space>
            <Typography.Text type="secondary">
              落库字段 <code>menu_config_json</code>（形如 <code>{'{"font":1,"language":1}'}</code>
              ），未勾选项前端按 0/缺省隐藏。
            </Typography.Text>
          </Card>
        </Form>
      </Spin>
    </div>
  );
};

export default AccountMore;