import { useEffect, useMemo, useState } from 'react';
import { getRuntimeFieldPermByForm, type FieldPerm } from '@/services/formmode/fieldPermApi';

export interface RuntimeFieldPermState {
  fieldPerms: FieldPerm[];
  layoutNodeKey?: string;
  layoutType: number;
  layoutGroupName?: string;
  loading: boolean;
  resolve: (fieldName: string, scope?: string) => { readonly?: boolean; hidden?: boolean; required?: boolean } | undefined;
}

/**
 * 运行期字段权限 Hook：字段权限 + 当前用户命中授权对象组的布局标识。
 *
 * 与 useFieldPerm 一样为 fail-open：接口异常时不阻断页面；
 * 只有显式 visible=false / editable=false 才收窄。
 */
export const useRuntimeFieldPerm = (
  formId?: string | number | null,
  layoutType = 0,
): RuntimeFieldPermState => {
  const [state, setState] = useState<Omit<RuntimeFieldPermState, 'resolve'>>({
    fieldPerms: [],
    layoutType,
    loading: true,
  });

  useEffect(() => {
    if (formId == null || formId === '') {
      setState({ fieldPerms: [], layoutType, loading: false });
      return;
    }
    let alive = true;
    setState((prev) => ({ ...prev, loading: true }));
    getRuntimeFieldPermByForm(formId, layoutType)
      .then((res) => {
        if (alive) {
          setState({
            fieldPerms: res.fieldPerms || [],
            layoutNodeKey: res.layoutNodeKey,
            layoutType: res.layoutType ?? layoutType,
            layoutGroupName: res.layoutGroupName,
            loading: false,
          });
        }
      })
      .catch(() => {
        if (alive) setState({ fieldPerms: [], layoutType, loading: false });
      });
    return () => { alive = false; };
  }, [formId, layoutType]);

  const resolve = useMemo(() => {
    if (!state.fieldPerms.length) return () => undefined;
    const byName = new Map<string, FieldPerm>();
    state.fieldPerms.forEach((p) => {
      if (p?.fieldName) byName.set(p.fieldName, p);
    });
    return (fieldName: string) => {
      const p = byName.get(fieldName);
      if (!p) return undefined;
      return {
        hidden: p.visible === false,
        readonly: p.editable === false,
        required: p.required === true ? true : undefined,
      };
    };
  }, [state.fieldPerms]);

  return { ...state, resolve };
};
