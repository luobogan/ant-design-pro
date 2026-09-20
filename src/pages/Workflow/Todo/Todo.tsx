import { useModel } from '@umijs/max';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Badge, Modal, Space, Tag, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { usePageButtons } from '@/hooks/usePageButtons';
import { PermissionButton } from '@/components/PermissionButton';
import { PersonOrgField } from '@/components/FormMode/PersonOrgPicker';
import { listTodo, forwardTask, addSignTask, urgeTask } from '@/services/workflow';
import type { WfTaskItem } from '@/services/workflow';
import { pickPayload } from '@/utils/utils';

/** 任务状态：0待办 2已办 4办结 6自动提交 7协办 8抄送 11传阅 */
const TASK_STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '待办', color: 'processing' },
  2: { text: '已办', color: 'default' },
  4: { text: '办结', color: 'success' },
  6: { text: '自动提交', color: 'cyan' },
  7: { text: '协办', color: 'blue' },
  8: { text: '抄送', color: 'purple' },
  11: { text: '传阅', color: 'geekblue' },
};

const URGENCY: Record<number, { text: string; color: string }> = {
  0: { text: '普通', color: 'default' },
  1: { text: '重要', color: 'orange' },
  2: { text: '紧急', color: 'red' },
};

/**
 * 待办事宜：当前登录人待办任务列表。
 * 「办理」新标签打开审批承载页（ApprovalPage）；转办/加签走弹窗选人；催办一步到位。
 */
const TodoList: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const userId = initialState?.currentUser?.userid;
  const { buttons } = usePageButtons('workflow_todo');
  const actionRef = useRef<ActionType>();
  const [modal, setModal] = useState<{ type: 'forward' | 'sign'; record?: WfTaskItem; assignee?: any; addSignType?: number } | null>(null);

  useEffect(() => {
    console.log('待办页按钮权限:', buttons);
  }, [buttons]);

  /** 打开审批承载页（独立 layout，靠 URL 参数定位实例与任务） */
  const openApproval = (record: WfTaskItem) => {
    const url = `/formmode/approval/ApprovalPage?instanceId=${record.instId}&taskId=${record.id}`;
    window.open(url, '_blank');
  };

  const handleUrge = async (record: WfTaskItem) => {
    try {
      await urgeTask(Number(record.id), {});
      message.success('已催办');
    } catch (e: any) {
      message.error(e?.msg || '催办失败');
    }
  };

  const handleModalOk = async () => {
    if (!modal?.record) return;
    if (!modal.assignee) return message.warning('请选择人员');
    try {
      if (modal.type === 'forward') {
        await forwardTask(Number(modal.record.id), { assignee: Number(modal.assignee) });
        message.success('已转办');
      } else {
        await addSignTask(Number(modal.record.id), { assignee: Number(modal.assignee), addSignType: modal.addSignType || 0 });
        message.success('已加签');
      }
      setModal(null);
      actionRef.current?.reload();
    } catch (e: any) {
      message.error(e?.msg || '操作失败');
    }
  };

  const columns: ProColumns<WfTaskItem>[] = [
    {
      title: '流程标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (_, r) => <a onClick={() => openApproval(r)}>{r.title || '-'}</a>,
    },
    { title: '流程名称', dataIndex: 'defName', ellipsis: true, hideInSearch: true },
    { title: '当前节点', dataIndex: 'nodeName', hideInSearch: true },
    { title: '发起人', dataIndex: 'starter', hideInSearch: true },
    {
      title: '紧急程度',
      dataIndex: 'urgency',
      hideInSearch: true,
      render: (_, r) => {
        const u = URGENCY[r.urgency || 0] || URGENCY[0];
        return <Tag color={u.color}>{u.text}</Tag>;
      },
    },
    { title: '到达时间', dataIndex: 'receiveTime', valueType: 'dateTime', hideInSearch: true },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(TASK_STATUS).map(([k, v]) => [k, { text: v.text }]),
      ),
      render: (_, r) => {
        const s = TASK_STATUS[r.status || 0] || { text: '未知', color: 'default' };
        return <Badge status={s.color as any} text={s.text} />;
      },
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => [
        <a key="handle" onClick={() => openApproval(record)}>
          办理
        </a>,
        <PermissionButton
          key="forward"
          hasPermission={buttons.some((b: any) => b.code === 'workflow_todo_forward')}
        >
          <a onClick={() => setModal({ type: 'forward', record })}>转办</a>
        </PermissionButton>,
        <PermissionButton
          key="sign"
          hasPermission={buttons.some((b: any) => b.code === 'workflow_todo_sign')}
        >
          <a onClick={() => setModal({ type: 'sign', record })}>加签</a>
        </PermissionButton>,
        <a key="urge" onClick={() => handleUrge(record)}>
          催办
        </a>,
      ],
    },
  ];

  return (
    <PageContainer
      header={{ title: '待办事宜', subTitle: userId ? `当前处理人：${userId}` : undefined }}
    >
      <ProTable<WfTaskItem>
        actionRef={actionRef}
        rowKey={(r) => r.id || `${r.instId}-${r.nodeKey}`}
        columns={columns}
        scroll={{ x: 1100 }}
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 20 }}
        request={async (params) => {
          const res: any = await listTodo(userId);
          let list: WfTaskItem[] = pickPayload(res) || [];
          if (params.status !== undefined && params.status !== null) {
            list = list.filter((i) => i.status === params.status);
          }
          if (params.title) {
            list = list.filter((i) => (i.title || '').includes(String(params.title)));
          }
          return { data: list, success: true, total: list.length };
        }}
        options={{ reload: true, density: true, setting: true }}
      />

      <Modal
        title={modal?.type === 'sign' ? '加签' : '转办'}
        open={!!modal}
        onOk={handleModalOk}
        onCancel={() => setModal(null)}
        destroyOnClose
      >
        {modal?.type === 'sign' && (
          <Space style={{ marginBottom: 12 }}>
            <span>加签方式：</span>
            <Radio.Group
              value={modal.addSignType || 0}
              onChange={(e) => setModal((m) => ({ ...(m as any), addSignType: e.target.value }))}
            >
              <Radio value={0}>前加签</Radio>
              <Radio value={1}>后加签</Radio>
            </Radio.Group>
          </Space>
        )}
        <div style={{ marginTop: 8 }}>
          <span style={{ display: 'block', marginBottom: 6 }}>选择人员</span>
          <PersonOrgField
            browserType={1}
            multiple={false}
            value={modal?.assignee}
            onChange={(v: any) => setModal((m) => ({ ...(m as any), assignee: v || undefined }))}
            placeholder="请选择人员"
          />
        </div>
      </Modal>
    </PageContainer>
  );
};

export default TodoList;
