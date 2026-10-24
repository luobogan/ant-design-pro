import { Drawer, Button, Popconfirm, Modal, Space, Input, message } from 'antd';
import { useState } from 'react';
import { useAccess } from '@umijs/max';
import InstanceFlow from '@/pages/Workflow/Create/InstanceFlow';
import { PersonOrgField } from '@/components/FormMode/PersonOrgPicker';
import {
  forceArchiveInstance,
  forceRecallInstance,
  deleteInstanceById,
  stopInstance,
  resumeInstance,
  cancelInstance,
  urgeTask,
  forwardTask,
} from '@/services/workflow';
import type { MonitorInstanceItem } from '@/services/workflow';

/**
 * 流程监控详情抽屉（只读）。
 *
 * 复用 InstanceFlow 的 表单预览 / 流程图 / 流转记录三个页签（数据仍按 instanceId 真实加载），
 * 通过 readOnly 隐藏全部办理按钮；监管动作集中在抽屉底部，避免与办理动作混淆。
 * 对应设计 §5.3 / §11.10。
 */
export interface MonitorDetailDrawerProps {
  open: boolean;
  record?: MonitorInstanceItem;
  onClose: () => void;
  /** 监管动作执行成功后回调（外层用于刷新列表） */
  onOperated?: () => void;
}

const MonitorDetailDrawer: React.FC<MonitorDetailDrawerProps> = ({
  open,
  record,
  onClose,
  onOperated,
}) => {
  const run = async (fn: () => Promise<any>, okMsg: string) => {
    try {
      await fn();
      message.success(okMsg);
      onOperated?.();
      onClose();
    } catch (e: any) {
      message.error(e?.msg || '操作失败');
    }
  };

  const id = record?.id as string;
  const running = record?.status === 0 || record?.status === 4;
  /**
   * 有效待办任务ID判定。
   * ⚠️ blade 全局 Jackson nullToEmpty 会把 null 数字渲染成 -1（同 null 字符串渲染成 ""），
   *    所以「无待办」在前端表现为 "-1" 而非缺失，不能只做真值判断。
   */
  const currentTaskId =
    record?.taskId && record.taskId !== '-1' && record.taskId !== '' ? record.taskId : undefined;
  // 是否管理员：委托人(被授权监控的非管理员)只读，强制动作按钮隐藏（点动作后端会 403）
  const { canAdmin } = useAccess();

  /** 转办：选人 + 意见弹窗（任务级动作，依赖当前待办任务ID） */
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardAssignee, setForwardAssignee] = useState<string | undefined>(undefined);
  const [forwardOpinion, setForwardOpinion] = useState('');
  const doForward = async () => {
    if (!currentTaskId || !forwardAssignee) {
      message.warning('请选择转办目标人');
      return;
    }
    // ⚠️ assignee 是 19 位雪花 ID：必须按字符串下发（后端 Long 可正确反序列化数字串），
    //    切勿 Number() 转换 —— JS Number 仅 16 位有效精度，会转办给错误的人（对齐 InstanceFlow）。
    await forwardTask(currentTaskId, { opinion: forwardOpinion || undefined, assignee: forwardAssignee });
    message.success('已转办');
    setForwardOpen(false);
    setForwardAssignee(undefined);
    setForwardOpinion('');
    onOperated?.();
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={1100}
      destroyOnClose
      title={`流程监控详情${record?.title ? ` - ${record.title}` : ''}`}
      footer={
        <Space>
          {canAdmin && (
            <>
              {record?.status === 0 && (
                <Popconfirm title="确认暂停该流程？" onConfirm={() => run(() => stopInstance(id), '已暂停')}>
                  <Button>暂停</Button>
                </Popconfirm>
              )}
              {record?.status === 4 && (
                <Popconfirm title="确认恢复该流程？" onConfirm={() => run(() => resumeInstance(id), '已恢复')}>
                  <Button>恢复</Button>
                </Popconfirm>
              )}
              {running && (
                <Popconfirm
                  title="确认强制收回（原地回退到创建节点）？"
                  onConfirm={() => run(() => forceRecallInstance(id, '监控强制收回'), '已强制收回')}
                >
                  <Button>强制收回</Button>
                </Popconfirm>
              )}
              {running && (
                <Popconfirm
                  title="确认强制归档（强制办结，保留历史）？"
                  onConfirm={() => run(() => forceArchiveInstance(id, '监控强制归档'), '已强制归档')}
                >
                  <Button>强制归档</Button>
                </Popconfirm>
              )}
              {running && (
                <Popconfirm
                  title="确认终止（撤销作废，实例终结）？"
                  onConfirm={() => run(() => cancelInstance(id, '监控终止'), '已终止')}
                >
                  <Button>终止</Button>
                </Popconfirm>
              )}
              {/* 催办/督办是任务级动作：依赖实例当前待办任务ID（taskId 由监控列表下发） */}
              {running && currentTaskId && (
                <Popconfirm
                  title="确认向当前办理人催办？"
                  onConfirm={() => run(() => urgeTask(currentTaskId), '已催办')}
                >
                  <Button>催办</Button>
                </Popconfirm>
              )}
              {/* 转办/改派：任务级动作，需选择目标人 */}
              {running && currentTaskId && <Button onClick={() => setForwardOpen(true)}>转办</Button>}
              <Popconfirm
                title="确认强制删除该流程（逻辑删业务行 + 清引擎运行态 + 清历史）？"
                onConfirm={() => run(() => deleteInstanceById(id), '已强制删除')}
              >
                <Button danger>强制删除</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      }
    >
      {record?.id && (
        <InstanceFlow
          instanceId={record.id}
          defName={record.defName}
          currentNodeKey={record.currentNodeKey}
          currentNodeName={record.currentNodeName}
          instanceStatus={record.status}
          embedded
          readOnly
        />
      )}
      <Modal
        title="转办（改派给其他人办理）"
        open={forwardOpen}
        onOk={doForward}
        onCancel={() => setForwardOpen(false)}
        okText="确认转办"
        cancelText="取消"
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 6 }}>转办目标人</div>
          <PersonOrgField
            browserType={1}
            multiple={false}
            value={forwardAssignee}
            onChange={(v: any) => setForwardAssignee(v || undefined)}
            placeholder="选择人员"
          />
        </div>
        <Input.TextArea
          rows={3}
          placeholder="转办意见（可选）"
          value={forwardOpinion}
          onChange={(e) => setForwardOpinion(e.target.value)}
        />
      </Modal>
    </Drawer>
  );
};

export default MonitorDetailDrawer;
