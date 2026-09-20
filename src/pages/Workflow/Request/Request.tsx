import { useModel } from '@umijs/max';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Alert, Badge, Button, Popconfirm, message } from 'antd';
import { useRef, useState } from 'react';
import { usePageButtons } from '@/hooks/usePageButtons';
import { listMyRequests, withdrawInstance, stopInstance } from '@/services/workflow';
import type { MyRequestItem } from '@/services/workflow';
import { pickPayload } from '@/utils/utils';

/** 实例状态：0运行中 1通过 2不通过 3撤销 4暂停 */
const INSTANCE_STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '运行中', color: 'processing' },
  1: { text: '通过', color: 'success' },
  2: { text: '不通过', color: 'error' },
  3: { text: '撤销', color: 'default' },
  4: { text: '暂停', color: 'warning' },
};

/**
 * 我的请求：我发起的流程实例列表。
 * 后端 GET /instance/mine 暂未提供（见 workflow service 注释），接口未就绪时降级为空态 + 提示；
 * 后端就绪后无需改动前端即可生效。
 */
const MyRequestList: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const userId = initialState?.currentUser?.userid;
  const { buttons } = usePageButtons('workflow_request');
  const actionRef = useRef<ActionType>();
  const [backendMissing, setBackendMissing] = useState(false);

  const openProgress = (record: MyRequestItem) => {
    window.open(`/formmode/approval/ApprovalPage?instanceId=${record.id}`, '_blank');
  };

  const handleWithdraw = async (record: MyRequestItem) => {
    try {
      // 19 位雪花 ID 必须按字符串传：Number() 会丢精度（...538 → ...500）导致后端查不到实例
      await withdrawInstance(record.id as string, '申请人撤回');
      message.success('已撤回');
      actionRef.current?.reload();
    } catch (e: any) {
      message.error(e?.msg || '撤回失败');
    }
  };

  const handleStop = async (record: MyRequestItem) => {
    try {
      // 同上：ID 按字符串传，避免 Number() 丢精度
      await stopInstance(record.id as string);
      message.success('已终止');
      actionRef.current?.reload();
    } catch (e: any) {
      message.error(e?.msg || '终止失败');
    }
  };

  const columns: ProColumns<MyRequestItem>[] = [
    { title: '流程标题', dataIndex: 'title', ellipsis: true, render: (_, r) => <a onClick={() => openProgress(r)}>{r.title || '-'}</a> },
    { title: '流程名称', dataIndex: 'defName', ellipsis: true, hideInSearch: true },
    { title: '当前节点', dataIndex: 'currentNodeName', hideInSearch: true },
    { title: '发起时间', dataIndex: 'startTime', valueType: 'dateTime', hideInSearch: true },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: Object.fromEntries(Object.entries(INSTANCE_STATUS).map(([k, v]) => [k, { text: v.text }])),
      render: (_, r) => {
        const s = INSTANCE_STATUS[r.status || 0] || { text: '未知', color: 'default' };
        return <Badge status={s.color as any} text={s.text} />;
      },
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => {
        const running = record.status === 0 || record.status === 4;
        return [
          <a key="progress" onClick={() => openProgress(record)}>进度</a>,
          running ? (
            <Popconfirm key="withdraw" title="确认撤回该流程？" onConfirm={() => handleWithdraw(record)}>
              <a>撤回</a>
            </Popconfirm>
          ) : null,
          running ? (
            <Popconfirm key="stop" title="确认终止该流程？" onConfirm={() => handleStop(record)}>
              <a style={{ color: '#ff4d4f' }}>终止</a>
            </Popconfirm>
          ) : null,
        ].filter(Boolean);
      },
    },
  ];

  return (
    <PageContainer header={{ title: '我的请求' }}>
      {backendMissing && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="「我的请求」加载失败"
          description="请稍后重试；若持续失败，请联系管理员检查 blade-workflow 服务与登录态（GET /api/blade-workflow/instance/mine）。"
        />
      )}
      <ProTable<MyRequestItem>
        actionRef={actionRef}
        rowKey={(r) => r.id || `${r.title}`}
        columns={columns}
        scroll={{ x: 1000 }}
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 20 }}
        request={async (params) => {
          try {
            const res: any = await listMyRequests({
              current: params.current,
              pageSize: params.pageSize,
              title: params.title as string | undefined,
            });
            // 后端返回 MyBatis-Plus 分页对象 { records, total, current, size }；
            // 兼容「直接返回数组」的形态，避免后端调整载荷时白屏。
            const page: any = pickPayload(res) || {};
            const list: MyRequestItem[] = Array.isArray(page) ? page : page.records || [];
            setBackendMissing(false);
            return {
              data: list,
              success: true,
              total: Array.isArray(page) ? list.length : page.total ?? list.length,
            };
          } catch {
            // 接口异常（服务未启动 / 403 等）：降级空态 + 顶部提示
            setBackendMissing(true);
            return { data: [], success: true, total: 0 };
          }
        }}
        options={{ reload: true, density: true, setting: true }}
      />
    </PageContainer>
  );
};

export default MyRequestList;
