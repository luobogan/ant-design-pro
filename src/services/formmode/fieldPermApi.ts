import { request } from '@umijs/max';

const API_BASE_PATH = '/api/blade-formmode';

/**
 * 字段权限项（与后端 `blade-formmode-api` 的 `FieldPermVO` 字段对齐）。
 *
 * ⚠️ blade-workflow 侧有一个**同构** VO（`org.springblade.workflow.vo.FieldPermVO`），
 * 字段名与语义完全一致——因此前端解析器可无差别消费「流程渲染包」与「本接口」两侧数据。
 */
export interface FieldPerm {
  /** 作用域：非流程场景固定 'main' */
  scope?: string;
  /** 字段名（与 formData 的 key 对齐） */
  fieldName: string;
  /** 是否显示 */
  visible?: boolean;
  /** 是否可编辑 */
  editable?: boolean;
  /** 是否必填（非流程场景恒 undefined，由字段定义兜底） */
  required?: boolean;
  /** 兼容派生列：0隐藏 1只读 2可编辑 3必填 */
  perm?: number;
}

/**
 * 按「表单ID」查询<b>当前用户</b>的字段级权限（非流程场景运行期消费）。
 *
 * <p>后端内部由 formId 反查 modeId（modeinfo.id）再聚合 `modefieldauthorize`。</p>
 *
 * <p><b>空数组语义</b>：该表单未配置字段授权（或表单未建模块）→ 调用方按字段定义
 * 默认渲染（fail-open），与流程侧「无节点权限配置」一致。</p>
 *
 * @param formId 表单ID（workflow_bill.id）
 */
export const getFieldPermByForm = async (formId: string | number): Promise<FieldPerm[]> => {
  try {
    const res: any = await request(`${API_BASE_PATH}/right/field-perm/by-form/${formId}`, {
      method: 'GET',
    });
    const list = res?.data;
    return Array.isArray(list) ? list : [];
  } catch (e) {
    // 接口异常 → 空数组（fail-open，不阻断页面渲染）
    return [];
  }
};
