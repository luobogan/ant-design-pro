import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Radio, Select, Space, Typography, message } from 'antd';
import * as deptApi from '@/services/system/dept';
import * as userApi from '@/services/system/user';
import * as roleApi from '@/services/system/role';
import { portalApi } from '@/services/portal';
import type { PortalTheme } from '@/services/portal';

const { Text } = Typography;

/** 范围类型选项（对标 scopeType：1全员/2部门/3个人/4角色；分部暂不支持） */
const SCOPE_OPTIONS = [
  { value: 1, label: '全员' },
  { value: 2, label: '部门' },
  { value: 3, label: '个人' },
  { value: 4, label: '角色' },
];

interface Props {
  themes: PortalTheme[];
  canManage: boolean;
}

/**
 * 主题批量指定面板（对标泛微 themeappoint §15.5 A3）
 * - 按人员范围指定：把主题写为范围内所有用户的显式偏好（覆盖自选/旧指定）
 * - 按主题整体迁移：源主题的全部偏好用户 → 目标主题
 */
const ThemeAppointPanel: React.FC<Props> = ({ themes, canManage }) => {
  const [form] = Form.useForm();
  const [migrateForm] = Form.useForm();
  const [scopeType, setScopeType] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [migrating, setMigrating] = useState(false);

  /* 部门树（范围=部门） */
  const [deptTree, setDeptTree] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    deptApi
      .treeScope({})
      .then((res: any) => {
        if (!alive) return;
        const raw = Array.isArray(res) ? res : (res?.data ?? []);
        const toTree = (nodes: any[]): any[] =>
          (nodes || []).map((n: any) => ({
            title: n.deptName || n.fullName || n.name || n.title,
            value: n.id ?? n.key,
            children: toTree(n.children || []),
          }));
        setDeptTree(toTree(raw));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* 角色列表（范围=角色） */
  const [roleOpts, setRoleOpts] = useState<{ value: number; label: string }[]>([]);
  useEffect(() => {
    let alive = true;
    roleApi
      .list({})
      .then((res: any) => {
        if (!alive) return;
        const arr = Array.isArray(res?.data) ? res.data : res?.data?.records || [];
        setRoleOpts((arr || []).map((r: any) => ({ value: r.id, label: r.roleName || String(r.id) })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* 人员搜索（范围=个人） */
  const [userOpts, setUserOpts] = useState<{ value: number; label: string }[]>([]);
  const searchUsers = (kw: string) => {
    if (!kw?.trim()) {
      setUserOpts([]);
      return;
    }
    userApi
      .list({ name: kw, account: kw, current: 1, size: 20 })
      .then((res: any) => {
        const records = res?.data?.records || res?.records || [];
        setUserOpts(
          (records || []).map((u: any) => ({
            value: u.id,
            label: `${u.name || ''}${u.account ? `（${u.account}）` : ''}`,
          })),
        );
      })
      .catch(() => setUserOpts([]));
  };

  const themeOpts = useMemo(
    () => themes.map((t) => ({ value: t.id as number, label: t.themeName as string })),
    [themes],
  );

  const handleAppoint = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const rows = await portalApi.appointTheme(values.themeId, values.scopeType, values.scopeIds || []);
      if (rows >= 0) {
        message.success(`已批量指定给 ${rows} 个用户`);
      } else {
        message.error('指定失败（主题不存在或范围非法）');
      }
    } catch (e) {
      console.error('[portal] 批量指定主题失败', e);
      message.error('指定失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMigrate = async () => {
    const values = await migrateForm.validateFields();
    if (values.fromThemeId === values.toThemeId) {
      message.warning('源主题与目标主题不能相同');
      return;
    }
    setMigrating(true);
    try {
      const rows = await portalApi.migrateTheme(values.fromThemeId, values.toThemeId);
      if (rows >= 0) {
        message.success(`已迁移 ${rows} 个用户的主题偏好`);
      } else {
        message.error('迁移失败（主题不存在）');
      }
    } catch (e) {
      console.error('[portal] 迁移主题失败', e);
      message.error('迁移失败');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="批量指定会把主题写为范围内所有用户的「显式偏好」，覆盖用户此前的自选与旧指定；用户之后仍可在首页自行切换。"
      />
      <Card title="按人员范围指定主题" size="small" style={{ maxWidth: 720 }}>
        <Form form={form} layout="vertical" initialValues={{ scopeType: 1 }}>
          <Form.Item label="目标主题" name="themeId" rules={[{ required: true, message: '请选择目标主题' }]}>
            <Select options={themeOpts} placeholder="选择要指定的主题" />
          </Form.Item>
          <Form.Item label="人员范围" name="scopeType" rules={[{ required: true, message: '请选择人员范围' }]}>
            <Radio.Group
              options={SCOPE_OPTIONS}
              optionType="button"
              onChange={(e) => {
                setScopeType(e.target.value);
                form.setFieldsValue({ scopeIds: [] });
              }}
            />
          </Form.Item>
          {scopeType !== 1 && (
            <Form.Item
              label="范围对象"
              name="scopeIds"
              rules={[{ required: true, message: '请选择范围对象' }]}
              extra={scopeType === 2 ? '部门（不含子部门，可按需多选）' : undefined}
            >
              {scopeType === 2 ? (
                <Select treeData={deptTree} treeCheckable showCheckedStrategy={Select.SHOW_PARENT} placeholder="选择部门" treeDefaultExpandAll />
              ) : scopeType === 3 ? (
                <Select mode="multiple" showSearch filterOption={false} onSearch={searchUsers} options={userOpts} placeholder="搜索人员（账号/姓名）" notFoundContent="输入关键词搜索" />
              ) : (
                <Select mode="multiple" options={roleOpts} placeholder="选择角色" />
              )}
            </Form.Item>
          )}
          <Button type="primary" loading={submitting} onClick={handleAppoint} disabled={!canManage}>
            执行指定
          </Button>
        </Form>
      </Card>

      <Card title="按主题整体迁移" size="small" style={{ maxWidth: 720 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          把「源主题」的全部显式偏好用户一次性迁移到「目标主题」（用于主题下线/合并）。
        </Text>
        <Form form={migrateForm} layout="vertical">
          <Space wrap>
            <Form.Item label="源主题" name="fromThemeId" rules={[{ required: true, message: '请选择源主题' }]}>
              <Select options={themeOpts} placeholder="被迁移的主题" style={{ width: 220 }} />
            </Form.Item>
            <Form.Item label="目标主题" name="toThemeId" rules={[{ required: true, message: '请选择目标主题' }]}>
              <Select options={themeOpts} placeholder="迁移到的主题" style={{ width: 220 }} />
            </Form.Item>
          </Space>
          <div>
            <Button type="primary" danger loading={migrating} onClick={handleMigrate} disabled={!canManage}>
              执行迁移
            </Button>
          </div>
        </Form>
      </Card>
    </Space>
  );
};

export default ThemeAppointPanel;
