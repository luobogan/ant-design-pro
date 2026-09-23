import React, { useEffect, useMemo, useState } from 'react';
import { Empty, Spin } from 'antd';
import { getBpmn, getInstance, listLinks, listNodes } from '@/services/workflow';
import { pickPayload } from '@/utils/utils';
import InstanceFlow from '@/pages/Workflow/Create/InstanceFlow';

/**
 * 生产办理页（路由 `/formmode/approval/ApprovalPage`）
 *
 * <p>本页已与「发起页 instance 态」「流程测试页」合并为<b>同一个办理组件</b> InstanceFlow，
 * 这里只做三件事：解析 URL 的 instanceId/taskId → 取流程定义上下文
 * （BPMN / 节点 / 出口 / 当前节点 / 标题）→ 渲染 InstanceFlow。</p>
 *
 * <p>全部办理能力（操作菜单、退回选节点、传阅、自定义操作、附件、意见三档必填、
 * 意见显示范围、过期复检、提交前服务端复核、自动关页）均在 InstanceFlow 内实现，
 * 生产 / 发起页 / 测试页三处共用一份，不再两处维护、行为也不会漂移。</p>
 *
 * <p>注：taskId 必须透传 —— 会签 / 并行下同一节点有多条待办，
 * 若让 InstanceFlow 自行查询可能取到别人的那条。</p>
 */
const ApprovalPage: React.FC = () => {
  const params = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return { instanceId: sp.get('instanceId'), taskId: sp.get('taskId') };
  }, []);
  const instanceId = params.instanceId;
  const taskId = params.taskId;

  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState<{
    defName: string;
    bpmnXml: string;
    nodes: any[];
    links: any[];
    currentNodeKey?: string;
  }>({ defName: '', bpmnXml: '', nodes: [], links: [], currentNodeKey: undefined });

  useEffect(() => {
    let alive = true;
    if (!instanceId) {
      setLoading(false);
      return () => {};
    }
    setLoading(true);
    (async () => {
      try {
        const inst: any = pickPayload(await getInstance(instanceId));
        const defId = inst?.defId;
        const [bpmnRes, nodesRes, linksRes] = await Promise.all([
          defId ? getBpmn(defId).catch(() => null) : Promise.resolve(null),
          defId ? listNodes(defId).catch(() => null) : Promise.resolve(null),
          defId ? listLinks(defId as any).catch(() => null) : Promise.resolve(null),
        ]);
        if (!alive) return;
        setCtx({
          defName: inst?.title || '',
          bpmnXml: (bpmnRes as any)?.data || '',
          nodes: (nodesRes as any)?.data || [],
          links: (linksRes as any)?.data || [],
          currentNodeKey: inst?.currentNodeKey || undefined,
        });
      } catch {
        if (alive) {
          setCtx({ defName: '', bpmnXml: '', nodes: [], links: [], currentNodeKey: undefined });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [instanceId]);

  if (!instanceId) {
    return (
      <div style={{ padding: 48 }}>
        <Empty description="缺少流程实例参数（instanceId）" />
      </div>
    );
  }
  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: 16 }}>
      <InstanceFlow
        instanceId={String(instanceId)}
        taskId={taskId || undefined}
        defName={ctx.defName}
        bpmnXml={ctx.bpmnXml}
        nodes={ctx.nodes}
        links={ctx.links}
        currentNodeKey={ctx.currentNodeKey}
        embedded={false}
      />
    </div>
  );
};

export default ApprovalPage;
