import { request } from '@umijs/max';

/**
 * 明细表组属性API（对齐泛微 E9 modeformgroup）
 *
 * <p>承载明细表的**设计期开关**：</p>
 * <ul>
 *   <li>isadd —— 是否允许新增明细行</li>
 *   <li>isedit —— 是否允许编辑明细行</li>
 *   <li>isdelete —— 是否允许删除明细行</li>
 *   <li>iscopy —— 是否允许复制明细行</li>
 *   <li>isprintserial —— 打印时是否显示明细序号</li>
 *   <li>allowscroll —— 明细表是否允许横向滚动</li>
 * </ul>
 *
 * <p>定位维度：**formId + 明细表序号(order)**（Excel 设计器只有 formId，拿不到 modeId）。</p>
 *
 * <p>⚠️ 语义边界：这是设计期开关，与流程节点级明细权限
 * （blade-workflow 的 wf:detailTablePerm）不是同一层；
 * 运行期最终生效 = 设计期开关 AND 节点权限。</p>
 */

/** 明细表组属性（与后端 ModeFormGroup 实体字段一致） */
export interface ModeFormGroup {
  id?: number;
  /** 表单ID（定位用，保存时必填） */
  formId?: number | string;
  /** 明细表序号（定位用，对应设计器 detailTables 的序号） */
  dsporder?: number;
  /** 组类型：2 = 明细表（后端固定） */
  grouptype?: number;
  groupname?: string;
  /** 1允许 / 0禁止 */
  isadd?: number;
  isedit?: number;
  isdelete?: number;
  iscopy?: number;
  isprintserial?: number;
  allowscroll?: number;
}

/**
 * 获取明细表组属性
 *
 * <p>后端在无配置时返回**默认值**（isadd/isedit/isdelete/iscopy = 1，
 * isprintserial/allowscroll = 0）且**不落库**，因此前端无需自行兜底。</p>
 *
 * @param formId 表单ID
 * @param order  明细表序号（设计器 detailTables 的序号）
 */
export async function getModeFormGroup(formId: string | number, order: number) {
  return request('/api/blade-formmode/form-mode-group/detail', {
    method: 'GET',
    params: { formId, order },
  });
}

/**
 * 保存明细表组属性（按 formId + dsporder 做 upsert）
 *
 * @param data 组属性；formId 必填（缺失时后端拒绝写入）
 */
export async function saveModeFormGroup(data: ModeFormGroup) {
  return request('/api/blade-formmode/form-mode-group/save', {
    method: 'POST',
    data,
  });
}
