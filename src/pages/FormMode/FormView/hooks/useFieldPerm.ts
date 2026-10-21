import { useEffect, useMemo, useState } from 'react';
import { getFieldPermByForm, type FieldPerm } from '@/services/formmode/fieldPermApi';

/**
 * 字段权限解析器类型。
 *
 * 与 `ExcelDesign/components/ExcelPreview.tsx` 导出的 `NodePermissionResolver`
 * **签名一致**，因此流程侧（审批渲染包 fieldPerms）与非流程侧（本 hook）可共用
 * 同一份渲染逻辑，无需为两套来源写两套解析。
 */
export type FieldPermResolver = (
  fieldName: string,
  scope?: string,
) => { readonly?: boolean; hidden?: boolean; required?: boolean } | undefined;

/**
 * 按 formId 拉取「当前用户」的字段级权限，返回解析器。
 *
 * <p>设计要点（fail-open）：</p>
 * <ul>
 *   <li>加载中 / 请求失败 / 无授权配置 → 解析器对所有字段返回 undefined，
 *       调用方按字段定义（{@code workflow_billfield}）默认渲染，<b>不阻断页面</b>；</li>
 *   <li>只有<b>显式</b> {@code visible===false} 才隐藏、{@code editable===false} 才只读，
 *       避免 VO 字段缺省被误判为「无权限」。</li>
 * </ul>
 *
 * @param formId 表单ID（workflow_bill.id）
 */
export const useFieldPerm = (formId?: string | number | null): FieldPermResolver => {
  const [perms, setPerms] = useState<FieldPerm[]>([]);

  useEffect(() => {
    if (formId == null || formId === '') {
      setPerms([]);
      return;
    }
    let alive = true;
    (async () => {
      const list = await getFieldPermByForm(formId);
      if (alive) {
        setPerms(list);
      }
    })();
    return () => {
      alive = false;
    };
  }, [formId]);

  return useMemo<FieldPermResolver>(() => {
    if (!perms.length) {
      return () => undefined;
    }
    const byName = new Map<string, FieldPerm>();
    perms.forEach((p) => {
      if (p && p.fieldName) {
        byName.set(p.fieldName, p);
      }
    });
    return (fieldName: string) => {
      const p = byName.get(fieldName);
      if (!p) {
        return undefined;
      }
      return {
        hidden: p.visible === false,
        readonly: p.editable === false,
        required: p.required === true ? true : undefined,
      };
    };
  }, [perms]);
};
