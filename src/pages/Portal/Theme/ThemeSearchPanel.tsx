import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Descriptions, Empty, Select, Space, Table, Typography } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import * as userApi from '@/services/system/user';
import { portalApi } from '@/services/portal';
import type { PortalTheme, ThemeUser, UserThemeInfo } from '@/services/portal';

const { Text } = Typography;

interface Props {
  themes: PortalTheme[];
}

/**
 * 主题使用查询面板（对标泛微 themesearch §15.5 A4）
 * - 反查主题使用人员：某主题被哪些人显式偏好（对标 getAllHrmOfTheme）
 * - 查人员当前主题：显式偏好 + 生效主题（对标 getAllThemesOfUserId）
 * 与「批量指定」构成 指定 → 批量 → 反查 闭环。
 */
const ThemeSearchPanel: React.FC<Props> = ({ themes }) => {
  /* 反查主题使用人员 */
  const [themeId, setThemeId] = useState<number | undefined>(undefined);
  const [rows, setRows] = useState<ThemeUser[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [loading, setLoading] = useState(false);

  const loadUsers = useCallback(
    async (tid: number | undefined, page: number) => {
      if (tid == null) {
        setRows([]);
        setTotal(0);
        return;
      }
      setLoading(true);
      try {
        const data = await portalApi.getThemeUsers({ themeId: tid, current: page, size: 15 });
        setRows(data?.records ?? []);
        setTotal(data?.total ?? 0);
      } catch (e) {
        console.error('[portal] 反查主题使用人员失败', e);
        setRows([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadUsers(themeId, 1);
  }, [loadUsers, themeId]);

  /* 查人员当前主题 */
  const [userOpts, setUserOpts] = useState<{ value: number; label: string }[]>([]);
  const [queryUser, setQueryUser] = useState<number | undefined>(undefined);
  const [info, setInfo] = useState<UserThemeInfo | undefined>(undefined);
  const [infoLoading, setInfoLoading] = useState(false);

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

  const handleQueryUser = async (uid: number | undefined) => {
    setQueryUser(uid);
    setInfo(undefined);
    if (uid == null) return;
    setInfoLoading(true);
    try {
      const data = await portalApi.getThemeUserInfo(uid);
      setInfo(data);
    } catch (e) {
      console.error('[portal] 查询人员主题失败', e);
    } finally {
      setInfoLoading(false);
    }
  };

  const columns = [
    { title: '用户ID', dataIndex: 'userId', key: 'userId', width: 160 },
    { title: '账号', dataIndex: 'account', key: 'account' },
    { title: '姓名', dataIndex: 'realName', key: 'realName', render: (v: string) => v || <Text type="secondary">-</Text> },
    { title: '偏好设置时间', dataIndex: 'updateTime', key: 'updateTime', width: 180 },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert type="info" showIcon message="使用查询与「批量指定」构成闭环：指定 → 批量 → 反查。" />

      <Card
        title="反查主题使用人员"
        size="small"
        extra={
          <Space>
            <Select
              style={{ width: 220 }}
              placeholder="选择主题"
              value={themeId}
              onChange={setThemeId}
              options={themes.map((t) => ({ value: t.id as number, label: t.themeName as string }))}
            />
            <Button icon={<ReloadOutlined />} onClick={() => loadUsers(themeId, current)}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="userId"
          loading={loading}
          dataSource={rows}
          columns={columns as any}
          pagination={{
            current,
            total,
            pageSize: 15,
            showTotal: (t: number) => `共 ${t} 人`,
            onChange: (page: number) => {
              setCurrent(page);
              loadUsers(themeId, page);
            },
          }}
          locale={{ emptyText: <Empty description={themeId == null ? '请先选择主题' : '暂无使用人员'} /> }}
        />
      </Card>

      <Card title="查人员当前主题" size="small" style={{ maxWidth: 720 }}>
        <Space wrap>
          <Select
            showSearch
            filterOption={false}
            onSearch={searchUsers}
            options={userOpts}
            placeholder="搜索人员（账号/姓名）"
            style={{ width: 280 }}
            value={queryUser}
            onChange={handleQueryUser}
            notFoundContent="输入关键词搜索"
          />
          <Button type="primary" icon={<SearchOutlined />} loading={infoLoading} onClick={() => handleQueryUser(queryUser)}>
            查询
          </Button>
        </Space>
        {info && (
          <Descriptions style={{ marginTop: 16 }} column={1} size="small" bordered>
            <Descriptions.Item label="人员">
              {info.realName || info.account || info.userId}
              {info.account ? `（${info.account}）` : ''}
            </Descriptions.Item>
            <Descriptions.Item label="显式主题偏好">
              {info.hasExplicit ? (
                <Text strong>{info.themeName || info.themeId}</Text>
              ) : (
                <Text type="secondary">未设置（跟随页面/定时/默认主题）</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="当前生效主题">{info.effectiveThemeName || <Text type="secondary">无</Text>}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    </Space>
  );
};

export default ThemeSearchPanel;
