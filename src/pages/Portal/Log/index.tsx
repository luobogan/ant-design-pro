import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { portalApi } from '@/services/portal';
import type { PortalLog } from '@/services/portal';

const { Text } = Typography;

/** 审计操作类型选项（与后端 PortalConstant 对齐） */
const LOG_TYPES = [
  { value: '', label: '全部类型' },
  { value: 'PAGE_CREATE', label: '新建页面' },
  { value: 'PAGE_UPDATE', label: '编辑页面' },
  { value: 'PAGE_DEFAULT', label: '设为默认门户' },
  { value: 'PAGE_DELETE', label: '删除页面' },
  { value: 'PAGE_IMPORT', label: '导入页面' },
  { value: 'ELEMENT_SAVE', label: '保存元素' },
  { value: 'ELEMENT_BATCH', label: '批量保存元素' },
  { value: 'ELEMENT_DELETE', label: '删除元素' },
  { value: 'ELEMENT_SETTING', label: '元素个性化' },
  { value: 'MENU_CREATE', label: '新建菜单' },
  { value: 'MENU_UPDATE', label: '编辑菜单' },
  { value: 'MENU_DELETE', label: '删除菜单' },
  { value: 'MENU_SHARE', label: '菜单授权' },
  { value: 'DEFAULT_APPOINT', label: '机构默认指派' },
  { value: 'DEFAULT_CLEAR', label: '清除机构默认' },
];

const pretty = (json?: string) => {
  if (!json) return '-';
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
};

/**
 * 门户审计日志（对标泛微 PortalLogInfo §13.4）
 * 后端：GET /log/list（分页 + logType/bizKey 过滤）
 */
const PortalLogPage: React.FC = () => {
  const [list, setList] = useState<PortalLog[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [logType, setLogType] = useState<string>('');
  const [bizKey, setBizKey] = useState<string>('');
  const [detail, setDetail] = useState<PortalLog | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.getPortalLogList({
        current,
        size,
        logType: logType || undefined,
        bizKey: bizKey || undefined,
      });
      setList(data?.records || []);
      setTotal(data?.total || 0);
    } catch (e) {
      console.error('[portal] 加载审计日志失败', e);
      message.error('加载审计日志失败');
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [current, size, logType, bizKey]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      title: '操作时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作类型',
      dataIndex: 'logType',
      key: 'logType',
      width: 130,
      render: (v: string) => <Tag color="geekblue">{v || '-'}</Tag>,
    },
    {
      title: '业务',
      key: 'biz',
      width: 150,
      render: (_: any, r: PortalLog) => (
        <Space direction="vertical" size={0}>
          <Text>{r.bizType || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.bizKey || ''}
          </Text>
        </Space>
      ),
    },
    { title: '对象', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '摘要', dataIndex: 'summary', key: 'summary', ellipsis: true },
    { title: '操作人', dataIndex: 'createUser', key: 'createUser', width: 90 },
    {
      title: '结果',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: number) =>
        v === 1 ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>,
    },
    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 140 },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: any, r: PortalLog) => (
        <Button type="link" size="small" onClick={() => setDetail(r)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          门户审计日志
        </Typography.Title>
        <Space>
          <Select
            value={logType}
            style={{ width: 160 }}
            onChange={(v) => {
              setLogType(v);
              setCurrent(1);
            }}
            options={LOG_TYPES}
          />
          <Input
            allowClear
            placeholder="业务标识（页面/元素ID）"
            style={{ width: 200 }}
            value={bizKey}
            onChange={(e) => setBizKey(e.target.value)}
            onPressEnter={() => {
              setCurrent(1);
              load();
            }}
          />
          <Button
            type="primary"
            onClick={() => {
              setCurrent(1);
              load();
            }}
          >
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
        </Space>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns as any}
        dataSource={list}
        pagination={{
          current,
          pageSize: size,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (page, pageSize) => {
            setCurrent(page);
            setSize(pageSize);
          },
        }}
      />

      <Modal
        title="审计详情"
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={<Button onClick={() => setDetail(null)}>关闭</Button>}
        width={640}
      >
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong>对象：</Text>
              <Text>{detail.title || '-'}</Text>
            </div>
            <div>
              <Text strong>摘要：</Text>
              <Text>{detail.summary || '-'}</Text>
            </div>
            {detail.errorMsg ? (
              <div>
                <Text strong>错误：</Text>
                <Text type="danger">{detail.errorMsg}</Text>
              </div>
            ) : null}
            <div>
              <Text strong>变更前：</Text>
              <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 6, maxHeight: 200, overflow: 'auto' }}>
                {pretty(detail.beforeJson)}
              </pre>
            </div>
            <div>
              <Text strong>变更后：</Text>
              <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 6, maxHeight: 200, overflow: 'auto' }}>
                {pretty(detail.afterJson)}
              </pre>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default PortalLogPage;
