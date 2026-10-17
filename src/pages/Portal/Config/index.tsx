import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Input, Space, Switch, Table, Typography, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { portalApi } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { PortalConfig } from '@/services/portal';

const { Text } = Typography;

/** 开关类配置项编码（取值仅 0/1，用 Switch 编辑；其余按文本编辑） */
const BOOLEAN_CODES = new Set([
  'isOpenMenuCache',
  'canPageMaintainerSettingInViewpage',
  'portalStatEnabled',
]);

/** 行内编辑草稿：ccode -> 新取值 */
type DraftMap = Record<string, string>;

/**
 * 门户配置项管理（对标泛微 portalconfig §16.6）
 * 后端：/config/list、/config/set、/config/value
 * 种子配置项均有真实消费点：isOpenMenuCache（菜单树缓存）、
 * canPageMaintainerSettingInViewpage（查看页编辑布局总开关）、portalStatEnabled（访问统计）。
 */
const PortalConfigPage: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_config_manage');

  const [list, setList] = useState<PortalConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [savingCode, setSavingCode] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.getPortalConfigList();
      setList(data || []);
      setDrafts({});
    } catch (e) {
      console.error('[portal] 加载门户配置项失败', e);
      message.error('加载门户配置项失败');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** 当前生效值（有草稿取草稿，否则取原值） */
  const currentValue = (row: PortalConfig) => drafts[row.ccode as string] ?? row.vvalue ?? '';

  const patchDraft = (ccode: string, v: string) => {
    setDrafts((prev) => ({ ...prev, [ccode]: v }));
  };

  const handleSave = async (row: PortalConfig) => {
    const ccode = row.ccode as string;
    const vvalue = currentValue(row);
    setSavingCode(ccode);
    try {
      const ok = await portalApi.setPortalConfigValue(ccode, vvalue);
      if (ok) {
        message.success(`配置项 ${row.name || ccode} 已保存`);
        load();
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存门户配置项失败', e);
      message.error('保存失败');
    } finally {
      setSavingCode(undefined);
    }
  };

  const columns = [
    { title: '配置项', dataIndex: 'name', key: 'name', width: 220 },
    {
      title: '编码',
      dataIndex: 'ccode',
      key: 'ccode',
      width: 260,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: '取值',
      key: 'vvalue',
      render: (_: any, row: PortalConfig) => {
        const ccode = row.ccode as string;
        const value = currentValue(row);
        if (BOOLEAN_CODES.has(ccode)) {
          return (
            <Switch
              checked={value === '1'}
              disabled={!canManage}
              onChange={(checked) => patchDraft(ccode, checked ? '1' : '0')}
            />
          );
        }
        return (
          <Input
            value={value}
            disabled={!canManage}
            style={{ width: 260 }}
            maxLength={512}
            onChange={(e) => patchDraft(ccode, e.target.value)}
          />
        );
      },
    },
    {
      title: '说明',
      dataIndex: 'note',
      key: 'note',
      render: (v: string) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      title: '操作',
      key: 'op',
      width: 120,
      render: (_: any, row: PortalConfig) => {
        const ccode = row.ccode as string;
        const dirty = drafts[ccode] !== undefined && drafts[ccode] !== row.vvalue;
        return (
          <Button
            type="link"
            size="small"
            disabled={!canManage || !dirty}
            loading={savingCode === ccode}
            onClick={() => handleSave(row)}
          >
            保存
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      {!canManage && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="只读模式：需要「门户配置项」按钮权限才能修改" />
      )}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="配置项为门户级键值开关（对标泛微 portalconfig）；保存后立即生效（后端进程内缓存同步刷新）。"
        description="isOpenMenuCache：菜单树进程内缓存；canPageMaintainerSettingInViewpage：页面维护者查看页编辑布局总开关；portalStatEnabled：访问统计(PV/UV)记录。"
      />
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ReloadOutlined />} onClick={load}>
          刷新
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        columns={columns as any}
        pagination={false}
        size="middle"
      />
    </div>
  );
};

export default PortalConfigPage;
