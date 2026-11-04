import { Drawer, Button, Popconfirm, Modal, Space, Input, message } from 'antd';
import { useState, useEffect } from 'react';
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
  monitorRejectableNodes,
  monitorRejectTo,
  getInstanceProgress,
  resolveArchiveRecall,
  isNodeArchiveApplicable,
} from '@/services/workflow';
import { pickPayload } from '@/utils/utils';
import type { MonitorInstanceItem, ResolvedArchiveRecall } from '@/services/workflow';
import RejectNodePicker from '@/components/Workflow/RejectNodePicker';

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
  /**
   * 该流程的归档 / 撤回策略（由外层按 defId 从流程定义取，监控端不另存配置）。
   *
   * <p>用于让抽屉底部的监管按钮与列表「更多 ▾」<strong>保持同一显隐口径</strong>，
   * 避免出现「列表隐藏了、抽屉还能点」的越权入口。</p>
   */
  policy?: ResolvedArchiveRecall;
}

const MonitorDetailDrawer: React.FC<MonitorDetailDrawerProps> = ({
  open,
  record,
  onClose,
  onOperated,
  policy,
}) => {
  /** 策略缺省按「既有能力开启、全新能力关闭」处理（与 resolveArchiveRecall 的归一口径一致） */
  const policyOfRecord: ResolvedArchiveRecall = policy || resolveArchiveRecall(null);
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
  /** 归档态（status=1）：归档已删除引擎运行态，收回/回退走「复活」路径 */
  const archived = record?.status === 1;
  /**
   * 有效待办任务ID判定。
   * ⚠️ blade 全局 Jackson nullToEmpty 会把 null 数字渲染成 -1（同 null 字符串渲染成 ""），
   *    所以「无待办」在前端表现为 "-1" 而非缺失，不能只做真值判断。
   */
  const currentTaskId =
    record?.taskId && record.taskId !== '-1' && record.taskId !== '' ? record.taskId : undefined;
  // 是否管理员：委托人(被授权监控的非管理员)只读，强制动作按钮隐藏（点动作后端会 403）
  const { canAdmin } = useAccess();

  /** 流程图四色进度（含实例绑定的 BPMN XML）：监控详情「流程图」页签依赖它渲染；
   * 若不给 InstanceFlow 传 bpmnXml / progress，流程图页签会显示「暂无流程图」。 */
  const [progress, setProgress] = useState<any>(undefined);
  useEffect(() => {
    if (!open || !record?.id) {
      setProgress(undefined);
      return;
    }
    let alive = true;
    getInstanceProgress(record.id)
      .then((r: any) => {
        if (alive) setProgress(pickPayload(r) || undefined);
      })
      .catch(() => alive && setProgress(undefined));
    return () => {
      alive = false;
    };
  }, [open, record?.id]);

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

  // 监控「回退」：拉取已办理过的节点 + 创建节点，弹窗选目标（区别于「强制收回」全流程候选）
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectCandidates, setRejectCandidates] = useState<any>(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const handleReject = async () => {
    if (record?.isTest === 1) {
      message.warning('测试实例不支持回退');
      return;
    }
    try {
      const res: any = await monitorRejectableNodes(id);
      const data = res?.data || {};
      const list: any[] = Array.isArray(data.nodes) ? data.nodes : [];
      if (!list.length) {
        message.warning('该实例当前无可退回节点（无已办理的节点）');
        return;
      }
      setRejectCandidates(data);
      setRejectOpen(true);
    } catch (e: any) {
      message.error(e?.msg || e?.message || '查询可退回节点失败');
    }
  };
  const handleRejectOk = async (params: {
    targetNodeKey: string;
    opinion: string;
    resubmitMode: number;
    runPreOperate: boolean;
  }) => {
    setRejectLoading(true);
    try {
      await monitorRejectTo(id, params);
      message.success('已回退');
      setRejectOpen(false);
      onOperated?.();
      onClose();
    } catch (e: any) {
      message.error(e?.msg || e?.message || '回退失败');
    } finally {
      setRejectLoading(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={1100}
      destroyOnHidden
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
              {running && policyOfRecord.recallEnabled && (
                <Popconfirm
                  title="确认强制收回（原地回退到创建节点）？"
                  onConfirm={() => run(() => forceRecallInstance(id, '监控强制收回'), '已强制收回')}
                >
                  <Button>强制收回</Button>
                </Popconfirm>
              )}
              {running && policyOfRecord.rejectEnabled && record?.isTest !== 1 && (
                <Button onClick={handleReject}>回退</Button>
              )}
              {running && policyOfRecord.forceArchiveEnabled && (
                <Popconfirm
                  title="确认强制归档（强制办结，保留历史）？"
                  onConfirm={() => run(() => forceArchiveInstance(id, '监控强制归档'), '已强制归档')}
                >
                  <Button>强制归档</Button>
                </Popconfirm>
              )}
              {/* 归档实例：按「归档后允许强制收回 / 允许流程干预」放开（此前该分支只有「强制删除」） */}
              {archived && policyOfRecord.recallFromArchiveEnabled && (
                <Popconfirm
                  title="确认强制收回（归档实例复活，回到创建节点继续办理）？"
                  onConfirm={() => run(() => forceRecallInstance(id, '监控强制收回'), '已强制收回')}
                >
                  <Button>强制收回</Button>
                </Popconfirm>
              )}
              {archived && policyOfRecord.interveneFromArchiveEnabled && record?.isTest !== 1 && (
                <Button onClick={handleReject}>回退</Button>
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
          progress={progress}
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
      <RejectNodePicker
      open={rejectOpen}
      candidates={rejectCandidates}
      confirmLoading={rejectLoading}
      onCancel={() => setRejectOpen(false)}
      onOk={handleRejectOk}
      />
      </Drawer>
  );
};

export default MonitorDetailDrawer;
