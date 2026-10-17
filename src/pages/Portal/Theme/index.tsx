import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  ColorPicker,
  Drawer,
  Empty,
  Form,
  Input,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { portalApi } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { PortalTheme, PortalThemeSaveData } from '@/services/portal';
import ThemeAppointPanel from './ThemeAppointPanel';
import ThemeSearchPanel from './ThemeSearchPanel';

const { Text } = Typography;

/** 解析 list 接口返回的 themeConfig（JSON 字符串，脏数据降级为空对象） */
const parseConfig = (raw?: string): Record<string, any> => {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
};

const toHex = (c: any): string | undefined => {
  if (!c) return undefined;
  if (typeof c === 'string') return c;
  if (c.toHexString) return c.toHexString();
  return undefined;
};

/**
 * 门户主题中心（对标泛微 themestyle / themeappoint / themesearch 三件套，§15.5 A1/A3/A4）
 *
 * 三个页签：
 * - 主题库：维护主题（配色/Logo/背景/定时），页面可绑定主题；
 * - 批量指定：按人员范围指定主题 + 按主题整体迁移（themeappoint）；
 * - 使用查询：反查主题使用人员 + 查人员当前主题（themesearch）。
 * 写接口门禁复用后端 PERM_THEME_MAINT（PortalRight.MAIN_PORTAL 独立权限码）。
 */
const PortalThemeManage: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_theme_manage');

  const [list, setList] = useState<PortalTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PortalTheme | null>(null);
  const [form] = Form.useForm<{ themeName: string; themeKey: string; primaryColor?: string; bgColor?: string; logoUrl?: string; advancedJson?: string; openTimer?: boolean; timerStart?: string; timerEnd?: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.getThemeList();
      setList(data || []);
    } catch (e) {
      console.error('[portal] 加载主题列表失败', e);
      message.error('加载主题列表失败');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ primaryColor: '#1677FF', bgColor: '#F5F7FA', openTimer: false });
    setDrawerOpen(true);
  };

  const openEdit = (record: PortalTheme) => {
    setEditing(record);
    const cfg = parseConfig(record.themeConfig);
    form.resetFields();
    form.setFieldsValue({
      themeName: record.themeName,
      themeKey: record.themeKey,
      primaryColor: cfg.primaryColor || '#1677FF',
      bgColor: cfg.bgColor || '#F5F7FA',
      logoUrl: cfg.logoUrl || '',
      advancedJson: JSON.stringify(cfg, null, 2),
      openTimer: record.openTimer === 1,
      timerStart: record.timerStart,
      timerEnd: record.timerEnd,
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      // 高级 JSON 作为基础，结构化字段叠加覆盖（任一变更都生效）
      let config: Record<string, any> = {};
      if (values.advancedJson?.trim()) {
        try {
          config = JSON.parse(values.advancedJson);
        } catch {
          message.error('高级配置不是合法 JSON');
          setSaving(false);
          return;
        }
      }
      config = {
        ...config,
        primaryColor: toHex(values.primaryColor) || config.primaryColor,
        bgColor: toHex(values.bgColor) || config.bgColor,
        logoUrl: values.logoUrl ?? config.logoUrl,
      };
      Object.keys(config).forEach((k) => {
        if (config[k] === undefined) delete config[k];
      });

      const payload: PortalThemeSaveData = {
        themeId: editing?.id,
        themeName: values.themeName,
        themeKey: values.themeKey,
        themeConfig: config,
        openTimer: values.openTimer ? 1 : 0,
        timerStart: values.openTimer ? values.timerStart : undefined,
        timerEnd: values.openTimer ? values.timerEnd : undefined,
      };
      const id = await portalApi.submitTheme(payload);
      if (id) {
        message.success(editing ? '主题已更新' : '主题已创建');
        setDrawerOpen(false);
        load();
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存主题失败', e);
      message.error('保存失败，请检查主题标识是否重复');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (record: PortalTheme) => {
    try {
      const ok = await portalApi.setDefaultTheme(record.id as number);
      if (ok) {
        message.success(`「${record.themeName}」已设为默认主题`);
        load();
      } else {
        message.error('设置失败');
      }
    } catch (e) {
      console.error('[portal] 设为默认主题失败', e);
      message.error('设置失败');
    }
  };

  const handleRemove = async (record: PortalTheme) => {
    try {
      const ok = await portalApi.removeTheme(record.id as number);
      if (ok) {
        message.success(`「${record.themeName}」已删除`);
        load();
      } else {
        message.error('删除失败（默认主题不可删）');
      }
    } catch (e) {
      console.error('[portal] 删除主题失败', e);
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '主题名称',
      dataIndex: 'themeName',
      key: 'themeName',
      render: (v: string, r: PortalTheme) => (
        <Space>
          <Text strong>{v}</Text>
          {r.isDefault === 1 && <Tag color="gold">默认</Tag>}
          {r.openTimer === 1 && <Tag color="orange">定时</Tag>}
        </Space>
      ),
    },
    { title: '主题标识', dataIndex: 'themeKey', key: 'themeKey', width: 160 },
    {
      title: '主色',
      key: 'primaryColor',
      width: 80,
      render: (_: any, r: PortalTheme) => {
        const c = parseConfig(r.themeConfig).primaryColor;
        return c ? (
          <span
            style={{
              display: 'inline-block',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: c,
              border: '1px solid #e5e5e5',
              verticalAlign: 'middle',
            }}
          />
        ) : (
          <Text type="secondary">—</Text>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_: any, record: PortalTheme) => (
        <Space size={4}>
          {record.isDefault !== 1 && (
            <Button type="link" size="small" icon={<StarOutlined />} onClick={() => handleSetDefault(record)}>
              设为默认
            </Button>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} disabled={!canManage} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="删除主题"
            description="删除后绑定该主题的页面将回退到默认主题。"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            disabled={record.isDefault === 1}
            onConfirm={() => handleRemove(record)}
          >
            <Button type="link" size="small" danger disabled={!canManage || record.isDefault === 1}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>
            门户主题
          </Typography.Title>
          <Text type="secondary">主题库 + 批量指定 + 使用查询（对标泛微 themestyle/themeappoint/themesearch）</Text>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} disabled={!canManage} onClick={openCreate}>
            新建主题
          </Button>
        </Space>
      </Space>

      <Tabs
        defaultActiveKey="lib"
        items={[
          {
            key: 'lib',
            label: '主题库',
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="说明"
                  description="生效优先级：用户个人偏好 > 页面绑定主题 > 定时生效主题 > 租户默认主题。默认主题不可删除。"
                />
                <Table
                  rowKey="id"
                  loading={loading}
                  columns={columns as any}
                  dataSource={list}
                  pagination={false}
                  locale={{ emptyText: <Empty description="暂无主题，点击右上角新建" /> }}
                />
              </>
            ),
          },
          {
            key: 'appoint',
            label: '批量指定',
            children: <ThemeAppointPanel themes={list} canManage={canManage} />,
          },
          {
            key: 'search',
            label: '使用查询',
            children: <ThemeSearchPanel themes={list} />,
          },
        ]}
      />

      <Drawer
        title={editing ? '编辑主题' : '新建主题'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={420}
        extra={
          <Button type="primary" loading={saving} onClick={handleSubmit}>
            保存
          </Button>
        }
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="themeName"
            label="主题名称"
            rules={[{ required: true, message: '请输入主题名称' }]}
          >
            <Input placeholder="如：科技蓝、政务红" maxLength={64} />
          </Form.Item>
          <Form.Item
            name="themeKey"
            label="主题标识"
            rules={[
              { required: true, message: '请输入主题标识' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: '仅支持字母、数字、下划线与连字符' },
            ]}
            extra="租户内唯一，页面绑定主题时使用"
          >
            <Input placeholder="如：tech-blue" maxLength={64} disabled={!!editing} />
          </Form.Item>
          <Form.Item name="primaryColor" label="主色">
            <ColorPicker showText format="hex" />
          </Form.Item>
          <Form.Item name="bgColor" label="背景色">
            <ColorPicker showText format="hex" />
          </Form.Item>
          <Form.Item name="logoUrl" label="Logo 链接" extra="配置后门户首页顶部展示机构 Logo">
            <Input placeholder="https://.../logo.png" maxLength={255} />
          </Form.Item>
          <Form.Item
            name="openTimer"
            label="定时切换"
            valuePropName="checked"
            extra="开启后在设定时间段内，本主题优先于「租户默认主题」（仍低于用户偏好与页面绑定）"
          >
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, n) => p.openTimer !== n.openTimer}>
            {() =>
              form.getFieldValue('openTimer') ? (
                <>
                  <Form.Item
                    name="timerStart"
                    label="定时开始"
                    rules={[{ required: true, message: '请填写定时开始时间' }]}
                  >
                    <Input placeholder="2026-12-20 00:00:00" maxLength={32} />
                  </Form.Item>
                  <Form.Item
                    name="timerEnd"
                    label="定时结束"
                    rules={[{ required: true, message: '请填写定时结束时间' }]}
                  >
                    <Input placeholder="2026-12-31 23:59:59" maxLength={32} />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
          <Form.Item
            name="advancedJson"
            label="高级配置（themeConfig 原始 JSON）"
            extra="留空则仅使用上方结构化字段；填入将作为 themeConfig 基础并叠加上述字段"
          >
            <Input.TextArea
              autoSize={{ minRows: 4, maxRows: 12 }}
              placeholder='{ "primaryColor": "#1677FF", "bgColor": "#F5F7FA", "logoUrl": "" }'
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default PortalThemeManage;
