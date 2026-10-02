import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 路线 B「操作者读源」回归：读必须与写同源（BPMN `wf:node.operator` 优先），
 * 只有 BPMN 无数据时才回退 REST 并就地迁移写回 BPMN。
 */
const mocks = vi.hoisted(() => ({
  getNodeOperators: vi.fn(),
  getActiveModeler: vi.fn(),
  setWfNodeExt: vi.fn(),
}));

vi.mock('@/services/workflow', () => ({ getNodeOperators: mocks.getNodeOperators }));
vi.mock('./bpmnModelerHolder', () => ({ getActiveModeler: mocks.getActiveModeler }));
// 保留真实 getWfNodeExt（用最小假元素驱动），只替换写回以断言迁移行为
vi.mock('./bpmnExtension', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, setWfNodeExt: mocks.setWfNodeExt };
});

import { readNodeOperators, readOperatorsBatch } from './nodeOperatorIO';

/** 最小 wf:Node 假元素（getWfNodeExt 只依赖 $type 与 get/属性） */
const wfNode = (operators: any[] = []) => ({
  $type: 'wf:Node',
  get: (name: string) => (name === 'operator' ? operators : []),
});

/** 带 wf:node 扩展的假 bpmn-js 元素；operators 省略 ⇒ 扩展存在但无操作者 */
const element = (operators?: any[]) => ({
  businessObject: {
    extensionElements: { values: operators === undefined ? [wfNode([])] : [wfNode(operators)] },
  },
});

const modeler = (registry: Record<string, any>) => ({
  get: (svc: string) => (svc === 'elementRegistry' ? { get: (k: string) => registry[k] } : undefined),
});

const bpmnOp = (opType = '1', objId = 'u1') => ({ groupNo: '1', opType, objId, bhxj: '0' });

beforeEach(() => {
  mocks.getNodeOperators.mockReset();
  mocks.getActiveModeler.mockReset();
  mocks.setWfNodeExt.mockReset();
});

describe('readNodeOperators', () => {
  it('BPMN 有操作者时不打 REST，直接按 BPMN 返回（写读同源）', async () => {
    mocks.getActiveModeler.mockReturnValue(modeler({ A: element([bpmnOp('1', 'u1'), bpmnOp('2', 'u2')]) }));

    const ops = await readNodeOperators('999', 'A');

    expect(ops).toHaveLength(2);
    expect(ops[0].opType).toBe(1);
    expect(ops[0].objId).toBe('u1');
    expect(ops[1].opType).toBe(2);
    expect(mocks.getNodeOperators).not.toHaveBeenCalled();
    expect(mocks.setWfNodeExt).not.toHaveBeenCalled();
  });

  it('BPMN 无操作者时回退 REST，并把结果迁移写回 BPMN', async () => {
    const el = element([]);
    mocks.getActiveModeler.mockReturnValue(modeler({ A: el }));
    mocks.getNodeOperators.mockResolvedValue({ data: [{ opType: 3, objId: 'rest-u' }] });

    const ops = await readNodeOperators('999', 'A');

    expect(ops).toHaveLength(1);
    expect(ops[0].opType).toBe(3);
    expect(mocks.getNodeOperators).toHaveBeenCalledWith('999', 'A');
    expect(mocks.setWfNodeExt).toHaveBeenCalledTimes(1);
    const [, migratedEl, migratedExt] = mocks.setWfNodeExt.mock.calls[0];
    expect(migratedEl).toBe(el);
    expect((migratedExt as any).operator[0].opType).toBe('3');
  });

  it('画布未就绪时纯 REST 回填，不写 BPMN', async () => {
    mocks.getActiveModeler.mockReturnValue(null);
    mocks.getNodeOperators.mockResolvedValue({ data: [{ opType: 1, objId: 'x' }] });

    const ops = await readNodeOperators('999', 'A');

    expect(ops).toHaveLength(1);
    expect(mocks.getNodeOperators).toHaveBeenCalledTimes(1);
    expect(mocks.setWfNodeExt).not.toHaveBeenCalled();
  });

  it('REST 失败时降级为空数组，不抛错', async () => {
    mocks.getActiveModeler.mockReturnValue(null);
    mocks.getNodeOperators.mockRejectedValue(new Error('boom'));

    await expect(readNodeOperators('999', 'A')).resolves.toEqual([]);
  });
});

describe('readOperatorsBatch', () => {
  it('只对 BPMN 无数据的节点打 REST，且各自迁移写回', async () => {
    const withBpmn = element([bpmnOp('3', 'bpmn-u')]);
    const emptyBpmn = element([]);
    mocks.getActiveModeler.mockReturnValue(modeler({ A: withBpmn, B: emptyBpmn, C: undefined }));
    mocks.getNodeOperators.mockResolvedValue({ data: [{ opType: 3, objId: 'rest-u' }] });

    const map = await readOperatorsBatch('999', ['A', 'B', 'C']);

    expect(mocks.getNodeOperators).toHaveBeenCalledTimes(2);
    expect(mocks.getNodeOperators).toHaveBeenCalledWith('999', 'B');
    expect(mocks.getNodeOperators).toHaveBeenCalledWith('999', 'C');
    expect(map.A[0].objId).toBe('bpmn-u');
    expect(map.B[0].objId).toBe('rest-u');
    expect(map.C[0].objId).toBe('rest-u');
    // 迁移只对画布存在且 REST 有数据的节点执行（C 无元素 → 不写）
    expect(mocks.setWfNodeExt).toHaveBeenCalledTimes(1);
    expect(mocks.setWfNodeExt.mock.calls[0][1]).toBe(emptyBpmn);
  });

  it('全部来自 BPMN 时不打任何 REST', async () => {
    mocks.getActiveModeler.mockReturnValue(modeler({ A: element([bpmnOp()]), B: element([bpmnOp('2', 'z')]) }));

    const map = await readOperatorsBatch('999', ['A', 'B']);

    expect(mocks.getNodeOperators).not.toHaveBeenCalled();
    expect(map.A).toHaveLength(1);
    expect(map.B[0].objId).toBe('z');
  });
});
