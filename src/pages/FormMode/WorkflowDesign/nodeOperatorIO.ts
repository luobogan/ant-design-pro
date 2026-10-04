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
import { WfNodeOperator } from '@/services/workflow';
import { getActiveModeler } from './bpmnModelerHolder';
import { getWfNodeExt } from './bpmnExtension';

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

/**
 * 读取单个节点的操作者：仅读 BPMN `wf:node.operator`（路线 B 唯一事实源）。
 * 不再回退 REST（wf_node_operator 随 P6 停写；存量经回填作业迁入 BPMN）。缺数据返回空数组，不抛。
 */
export const readNodeOperators = async (
  _defId: any,
  nodeKey: string,
): Promise<WfNodeOperator[]> => {
  const element = elementOf(nodeKey);
  if (!element) return [];
  const ext = getWfNodeExt(element);
  return ext?.operator && ext.operator.length ? ext.operator.map(toLocalOp) : [];
};

/**
 * 批量读取（按 nodeKey 汇总）：仅读 BPMN `wf:node.operator`，缺数据返回空数组。
 */
export const readOperatorsBatch = async (
  _defId: any,
  nodeKeys: string[],
): Promise<Record<string, WfNodeOperator[]>> => {
  const result: Record<string, WfNodeOperator[]> = {};
  nodeKeys.forEach((k) => {
    const element = elementOf(k);
    const ext = element ? getWfNodeExt(element) : null;
    result[k] = ext?.operator && ext.operator.length ? ext.operator.map(toLocalOp) : [];
  });
  return result;
};
