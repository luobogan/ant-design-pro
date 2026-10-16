import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, InputNumber, Radio, Space, Switch, Tabs, Typography, message } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { portalApi } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { AccountMoreSaveData, AccountMoreVO, PortalSetting, PortalSettingSaveData } from '@/services/portal';

const { Text } = Typography;

/** 布局类型选项（对标 accountmore layouttype） */
const LAYOUT_OPTIONS = [
  { value: 1, label: '舒适' },
  { value: 2, label: '标准' },
  { value: 3, label: '紧凑' },
];

/** 字体选项（对标 accountmore/HrmUserSetting fontsize） */
const FONT_OPTIONS = [
  { value: 1, label: '大' },
  { value: 2, label: '中' },
  { value: 3, label: '默认' },
];

/** 全局设置表单值（开关 0/1 由 Switch 转布尔） */
interface SettingFormValues {
  needRefresh: boolean;
  refreshScope: number;
  refreshMins: number;
  rsstype: number;
  showLastHp: boolean;
  showNoRightElement: boolean;
  hiddenMyPortal: boolean;
  autoSortTopMenu: boolean;
  defaultExpandLeft: boolean;
  showTopMenuFullName: boolean;
  showFreqMenu: boolean;
  quickSearchEnabled: boolean;
  layoutType: number;
  fontSize: number;
}

/** 个人设置表单值（null=沿用全局） */
interface AccountFormValues {
  fontSize: number | null;
  layoutType: number | null;
}

const bool = (v?: number) => v === 1;
const num = (v: boolean) => (v ? 1 : 0);

/**
 * 门户应用设置（对标泛微 portalsetting §16.3 + accountmore §14.2 I）
 *
 * - 全局设置页签：首页自动刷新/RSS/记住上次访问/显示无权限元素/隐藏我的门户/
 *   菜单频率排序/展开左侧菜单/顶部菜单全称/常用菜单/快捷搜索总开关/布局/字体，
 *   支持「同步到所有人」（把全局字体布局同步到已个性化用户）。
 * - 个人通用设置页签：个人字体/布局（留空=沿用全局），对标 accountmore。
 */
const PortalSettingPage: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_setting_manage');

  const [setting, setSetting] = useState<PortalSetting | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form] = Form.useForm<SettingFormValues>();

  const [account, setAccount] = useState<AccountMoreVO | undefined>();
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountForm] = Form.useForm<AccountFormValues>();

  const loadSetting = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.getPortalSetting();
      setSetting(data);
      form.setFieldsValue({
        needRefresh: bool(data?.needRefresh),
        refreshScope: data?.refreshScope ?? 1,
        refreshMins: data?.refreshMins ?? 5,
        rsstype: data?.rsstype ?? 1,
        showLastHp: bool(data?.showLastHp),
        showNoRightElement: bool(data?.showNoRightElement),
        hiddenMyPortal: bool(data?.hiddenMyPortal),
        autoSortTopMenu: bool(data?.autoSortTopMenu),
        defaultExpandLeft: bool(data?.defaultExpandLeft),
        showTopMenuFullName: bool(data?.showTopMenuFullName),
        showFreqMenu: bool(data?.showFreqMenu),
        quickSearchEnabled: bool(data?.quickSearchEnabled),
        layoutType: data?.layoutType ?? 2,
        fontSize: data?.fontSize ?? 3,
      });
    } catch (e) {
      console.error('[portal] 加载门户应用设置失败', e);
      message.error('加载门户应用设置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  const loadAccount = useCallback(async () => {
    try {
      const data = await portalApi.getAccountMore();
      setAccount(data);
      accountForm.setFieldsValue({
        fontSize: data?.personalFontSize ?? null,
        layoutType: data?.personalLayoutType ?? null,
      });
    } catch (e) {
      console.error('[portal] 加载个人设置失败', e);
    }
  }, [accountForm]);

  useEffect(() => {
    loadSetting();
    loadAccount();
  }, [loadSetting, loadAccount]);

  const handleSaveSetting = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload: PortalSettingSaveData = {
        needRefresh: num(values.needRefresh),
        refreshScope: values.refreshScope,
        refreshMins: values.refreshMins,
        rsstype: values.rsstype,
        showLastHp: num(values.showLastHp),
        showNoRightElement: num(values.showNoRightElement),
        hiddenMyPortal: num(values.hiddenMyPortal),
        autoSortTopMenu: num(values.autoSortTopMenu),
        defaultExpandLeft: num(values.defaultExpandLeft),
        showTopMenuFullName: num(values.showTopMenuFullName),
        showFreqMenu: num(values.showFreqMenu),
        quickSearchEnabled: num(values.quickSearchEnabled),
        layoutType: values.layoutType,
        fontSize: values.fontSize,
      };
      const ok = await portalApi.savePortalSetting(payload);
      if (ok) {
        message.success('已保存');
        loadSetting();
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存门户应用设置失败', e);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const rows = await portalApi.syncPortalSetting();
      if (rows >= 0) {
        message.success(`已同步到 ${rows} 个已个性化用户`);
      } else {
        message.error('同步失败');
      }
    } catch (e) {
      console.error('[portal] 同步门户设置失败', e);
      message.error('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveAccount = async () => {
    const values = await accountForm.validateFields();
    setAccountSaving(true);
    try {
      const payload: AccountMoreSaveData = {
        fontSize: values.fontSize ?? null,
        layoutType: values.layoutType ?? null,
      };
      const ok = await portalApi.saveAccountMore(payload);
      if (ok) {
        message.success('已保存个人设置');
        loadAccount();
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存个人设置失败', e);
      message.error('保存失败');
    } finally {
      setAccountSaving(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <Tabs
        defaultActiveKey="global"
        items={[
          {
            key: 'global',
            label: '门户应用设置',
            children: (
              <Card loading={loading} style={{ maxWidth: 860 }}>
                {!canManage && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="只读模式：需要「门户应用设置」按钮权限才能修改全局设置"
                  />
                )}
                <Form form={form} layout="vertical" disabled={!canManage} style={{ maxWidth: 560 }}>
                  <Form.Item label="首页自动刷新" name="needRefresh" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="刷新范围" name="refreshScope">
                    <Radio.Group
                      options={[
                        { value: 1, label: '整页刷新' },
                        { value: 2, label: '仅指定元素' },
                      ]}
                      optionType="button"
                    />
                  </Form.Item>
                  <Form.Item label="自动刷新间隔（分钟）" name="refreshMins">
                    <InputNumber min={1} max={1440} style={{ width: 160 }} />
                  </Form.Item>
                  <Form.Item label="RSS 读取类型" name="rsstype">
                    <Radio.Group
                      options={[
                        { value: 1, label: '客户端读取' },
                        { value: 2, label: '服务器读取' },
                      ]}
                      optionType="button"
                    />
                  </Form.Item>
                  <Form.Item label="记住上次访问首页" name="showLastHp" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="显示无查看权限元素" name="showNoRightElement" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="隐藏「我的门户」入口" name="hiddenMyPortal" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="菜单按使用频率自动排序" name="autoSortTopMenu" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="默认展开左侧菜单" name="defaultExpandLeft" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="顶部菜单显示全称" name="showTopMenuFullName" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="显示常用菜单" name="showFreqMenu" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="快捷搜索总开关" name="quickSearchEnabled" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="门户布局类型" name="layoutType">
                    <Radio.Group options={LAYOUT_OPTIONS} optionType="button" />
                  </Form.Item>
                  <Form.Item label="全局默认字体" name="fontSize">
                    <Radio.Group options={FONT_OPTIONS} optionType="button" />
                  </Form.Item>
                  <Space>
                    <Button type="primary" loading={saving} onClick={handleSaveSetting} disabled={!canManage}>
                      保存
                    </Button>
                    <Button
                      icon={<SyncOutlined />}
                      loading={syncing}
                      onClick={handleSync}
                      disabled={!canManage}
                      title="把全局字体/布局同步到所有已个性化用户"
                    >
                      同步到所有人
                    </Button>
                  </Space>
                </Form>
              </Card>
            ),
          },
          {
            key: 'account',
            label: '个人通用设置',
            children: (
              <Card style={{ maxWidth: 560 }}>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={`当前全局默认：字体「${FONT_OPTIONS.find((f) => f.value === (account?.globalFontSize ?? 3))?.label}」，布局「${LAYOUT_OPTIONS.find((l) => l.value === (account?.globalLayoutType ?? 2))?.label}」`}
                  description="个人设置留空（清除）时沿用全局默认"
                />
                <Form form={accountForm} layout="vertical">
                  <Form.Item label="个人字体" name="fontSize">
                    <Radio.Group
                      options={[...FONT_OPTIONS, { value: null, label: '沿用全局' }]}
                      optionType="button"
                    />
                  </Form.Item>
                  <Form.Item label="个人布局类型" name="layoutType">
                    <Radio.Group
                      options={[...LAYOUT_OPTIONS, { value: null, label: '沿用全局' }]}
                      optionType="button"
                    />
                  </Form.Item>
                  <Button type="primary" loading={accountSaving} onClick={handleSaveAccount}>
                    保存个人设置
                  </Button>
                </Form>
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">
                    提示：个人设置仅影响本人门户展示；「同步到所有人」会把全局字体/布局推送覆盖所有已个性化用户的个人值。
                  </Text>
                </div>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default PortalSettingPage;
