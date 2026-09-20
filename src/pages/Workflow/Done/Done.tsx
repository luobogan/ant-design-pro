import { useModel } from '@umijs/max';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Badge, Drawer, Tag, Timeline } from 'antd';
import { useRef, useState } from 'react';
import { usePageButtons } from '@/hooks/usePageButtons';
import { listDone, getLogs } from '@/services/workflow';
import type { WfTaskItem } from '@/services/workflow';
import { pickPayload } from '@/utils/utils';

const TASK_STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '待办', color: 'processing' },
  2: { text: '已办', color: 'default' },
  4: { text: '办结', color: 'success' },
  6: { text: '自动提交', color: 'cyan' },
  7: { text: '协办', color: 'blue' },
  8: { text: '抄送', color: 'purple' },
  11: { text: '传阅', color: 'geekblue' },
};

interface LogItem {
  nodeName?: string;
  operatorName?: string;
  opinion?: string;
  operateTime?: string;
  status?: number;
}

/**
 * 已办事宜：当前登录人已处理任务列表（只读）。
 * 「查看」打开审批承载页（不带 taskId，后端按实例渲染只读）；「日志」拉流转记录时间线。
 */
const DoneList: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const userId = initialState?.currentUser?.userid;
  const { buttons } = usePageButtons('workflow_done');
  const actionRef = useRef<ActionType>();
  const [logVisible, setLogVisible] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logTitle, setLogTitle] = useState('');

  const openApproval = (record: WfTaskItem) => {
    // 已办无待办任务，仅带实例ID打开只读审批页
    window.open(`/formmode/approval/ApprovalPage?instanceId=${record.instId}`, '_blank');
  };

  const openLogs = async (record: WfTaskItem) => {
    setLogTitle(record.title || '流转记录');
    try {
      const res: any = await getLogs(record.instId as any);
      setLogs(pickPayload(res) || []);
    } catch {
      setLogs([]);
    }
    setLogVisible(true);
  };

  const columns: ProColumns<WfTaskItem>[] = [
    { title: '流程标题', dataIndex: 'title', ellipsis: true, render: (_, r) => <a onClick={() => openApproval(r)}>{r.title || '-'}</a> },
    { title: '流程名称', dataIndex: 'defName', ellipsis: true, hideInSearch: true },
    { title: '当前节点', dataIndex: 'nodeName', hideInSearch: true },
    { title: '发起人', dataIndex: 'starter', hideInSearch: true },
    { title: '办理时间', dataIndex: 'operateTime', valueType: 'dateTime', hideInSearch: true },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: Object.fromEntries(Object.entries(TASK_STATUS).map(([k, v]) => [k, { text: v.text }])),
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
        <a key="view" onClick={() => openApproval(record)}>查看</a>,
        <a key="log" onClick={() => openLogs(record)}>日志</a>,
      ],
    },
  ];

  return (
    <PageContainer header={{ title: '已办事宜' }}>
      <ProTable<WfTaskItem>
        actionRef={actionRef}
        rowKey={(r) => r.id || `${r.instId}-${r.nodeKey}`}
        columns={columns}
        scroll={{ x: 1100 }}
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 20 }}
        request={async (params) => {
          const res: any = await listDone(userId);
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

      <Drawer title={logTitle} open={logVisible} onClose={() => setLogVisible(false)} width={480}>
        {logs.length === 0 ? (
          <span style={{ color: '#999' }}>暂无流转记录</span>
        ) : (
          <Timeline
            items={logs.map((l) => ({
              children: (
                <div>
                  <div>
                    <Tag color="blue">{l.nodeName || '节点'}</Tag>
                    <span style={{ marginLeft: 8 }}>{l.operatorName || '-'}</span>
                    <span style={{ float: 'right', color: '#999', fontSize: 12 }}>{l.operateTime}</span>
                  </div>
                  {l.opinion ? <div style={{ marginTop: 4, color: '#595959' }}>{l.opinion}</div> : null}
                </div>
              ),
            }))}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default DoneList;
