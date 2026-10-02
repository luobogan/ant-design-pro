/**
 * 节点操作者读写入口（共享层）——路线 B 的单一事实源收敛点。
 *
 * 背景：面板写操作者已经统一写 BPMN `wf:node.operator`，但列表（NodeInfoTable）曾仍从
 * REST（wf_node_operator）读取，形成「写 BPMN / 读 REST」的读源漂移——P6 停写 wf_* 后
 * 列表会读不到刚保存的数据。故把「读」也收口到本模块，所有面板共用同一实现。
 *
 * 读策略：
 * · BPMN `wf:node.operator` 优先；
 * · BPMN 无该节点数据时回退 REST（过渡期老定义），并**就地迁移写回 BPMN**，
 *   使一次加载即完成迁源，后续不再依赖 wf_*；
 * · 画布未就绪（无 modeler / 无元素）时纯 REST 回填（只读，不迁移）。
 *
 * 写策略：由各面板经 `setWfNodeExt` 直接覆盖 `wf:node.operator`（本模块只提供双向映射）。
 */
import { getNodeOperators, WfNodeOperator } from '@/services/workflow';
import { getActiveModeler } from './bpmnModelerHolder';
import { getWfNodeExt, setWfNodeExt, WfOperator } from './bpmnExtension';

/** 按 nodeKey 取画布元素（路线 B：元素 id 即 wf_process_node.node_key） */
const elementOf = (nodeKey?: string) =>
  nodeKey ? getActiveModeler()?.get('elementRegistry')?.get(nodeKey) : undefined;

/** BPMN/REST 操作者 → 本地编辑模型（数字字段统一 parse，缺省保留为 null） */
export const toLocalOp = (o: any): WfNodeOperator => ({
  id: o?.id,
  opType: parseInt(o?.opType ?? '3', 10),
  objId: o?.objId ?? null,
  bhxj: parseInt(o?.bhxj ?? '0', 10),
  batchNo: parseInt(o?.batchNo ?? '0', 10),
  groupNo: parseInt(o?.groupNo ?? '1', 10),
  groupName: o?.groupName ?? null,
  levelMin: o?.levelMin != null ? parseInt(o.levelMin, 10) : null,
  levelMax: o?.levelMax != null ? parseInt(o.levelMax, 10) : null,
  signOrder: o?.signOrder != null ? parseInt(o.signOrder, 10) : null,
  canView: o?.canView != null ? parseInt(o.canView, 10) : null,
  conditionJson: o?.conditionJson ?? null,
  isCoadjutant: o?.isCoadjutant != null ? parseInt(o.isCoadjutant, 10) : null,
  coadjutants: o?.coadjutants ?? null,
  isPending: o?.isPending != null ? parseInt(o.isPending, 10) : null,
  isModify: o?.isModify != null ? parseInt(o.isModify, 10) : null,
  signType: o?.signType != null ? parseInt(o.signType, 10) : null,
});

/** 本地编辑模型 → BPMN 扩展字符串型操作者（保留完整字段，迁移时不错损） */
export const toExtOp = (r: WfNodeOperator): WfOperator => ({
  groupNo: r.groupNo != null ? String(r.groupNo) : undefined,
  opType: r.opType != null ? String(r.opType) : undefined,
  objId: r.objId ?? undefined,
  bhxj: r.bhxj != null ? String(r.bhxj) : undefined,
  levelMin: r.levelMin != null ? String(r.levelMin) : undefined,
  levelMax: r.levelMax != null ? String(r.levelMax) : undefined,
  signOrder: r.signOrder != null ? String(r.signOrder) : undefined,
  batchNo: r.batchNo != null ? String(r.batchNo) : undefined,
  groupName: r.groupName ?? undefined,
  canView: r.canView != null ? String(r.canView) : undefined,
  conditionJson: r.conditionJson ?? undefined,
  isCoadjutant: r.isCoadjutant != null ? String(r.isCoadjutant) : undefined,
  coadjutants: r.coadjutants ?? undefined,
  isPending: r.isPending != null ? String(r.isPending) : undefined,
  isModify: r.isModify != null ? String(r.isModify) : undefined,
  signType: r.signType != null ? String(r.signType) : undefined,
});

/** REST 读单个节点操作者（失败降级为空数组，不抛） */
const fetchRest = async (defId: any, nodeKey: string): Promise<WfNodeOperator[]> => {
  if (defId == null) return [];
  try {
    const r: any = await getNodeOperators(defId, nodeKey);
    return ((r?.data || []) as any[]).map(toLocalOp);
  } catch {
    return [];
  }
};

/**
 * 读取单个节点的操作者：BPMN 优先 → REST 回退并迁移写回 BPMN。
 */
export const readNodeOperators = async (
  defId: any,
  nodeKey: string,
): Promise<WfNodeOperator[]> => {
  const modeler = getActiveModeler();
  const element = elementOf(nodeKey);
  if (!element) return fetchRest(defId, nodeKey);

  const ext = getWfNodeExt(element);
  if (ext?.operator && ext.operator.length) return ext.operator.map(toLocalOp);

  // BPMN 尚无操作者：回退 REST，并把结果迁移进 BPMN（避免后续保存把老数据冲掉）
  const ops = await fetchRest(defId, nodeKey);
  if (ops.length && modeler) {
    try {
      setWfNodeExt(modeler, element, { ...(ext || {}), operator: ops.map(toExtOp) });
    } catch {
      /* 迁移失败不阻塞读取 */
    }
  }
  return ops;
};

/**
 * 批量读取（按 nodeKey 汇总）：同为 BPMN 优先 + REST 回退迁移，
 * 只对「BPMN 无数据」的节点打 REST，避免每个节点都请求。
 */
export const readOperatorsBatch = async (
  defId: any,
  nodeKeys: string[],
): Promise<Record<string, WfNodeOperator[]>> => {
  const modeler = getActiveModeler();
  const result: Record<string, WfNodeOperator[]> = {};
  const missed: string[] = [];

  nodeKeys.forEach((k) => {
    const element = elementOf(k);
    const ext = element ? getWfNodeExt(element) : null;
    if (ext?.operator && ext.operator.length) {
      result[k] = ext.operator.map(toLocalOp);
    } else {
      result[k] = [];
      missed.push(k);
    }
  });

  if (!missed.length) return result;

  await Promise.all(
    missed.map(async (k) => {
      const ops = await fetchRest(defId, k);
      result[k] = ops;
      const element = elementOf(k);
      if (ops.length && element && modeler) {
        try {
          setWfNodeExt(modeler, element, {
            ...(getWfNodeExt(element) || {}),
            operator: ops.map(toExtOp),
          });
        } catch {
          /* 迁移失败不阻塞读取 */
        }
      }
    }),
  );
  return result;
};
