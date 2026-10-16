import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { portalApi } from '@/services/portal';
import type { ElementDataMap } from '@/services/portal';

export interface ElementDataInput {
  id?: number;
  elementType: string;
  perPage?: number;
}

export interface UseElementDataResult {
  /** 各元素数据与状态，key = String(elementId) */
  dataMap: ElementDataMap;
  loading: boolean;
  /** 整批取数失败（网络/服务不可用）；单元素失败在各自 success 上体现 */
  error?: string;
  /** 重新拉取整批数据 */
  refresh: () => void;
}

/**
 * 门户元素批量取数 hook（元素维度，对应后端 /element-data/batch）
 *
 * 设计要点：
 * 1. **一次请求按 elementId 取本页所有元素**：避免「每元素一个请求」的 N+1；
 * 2. **每元素独立配置 + 个性化 perPage**：同一页面多个同类型元素互不覆盖，
 *    用户把某元素条数调大也立即生效（§22 断点 #5/#6）；
 * 3. **单元素失败不影响整页**：后端按元素降级（success=false），此处原样透出给元素卡片。
 *
 * @param elements 本页元素（含 id/elementType/合并个性化后的 perPage）
 * @param pageId   页面ID（用于服务端读取元素私有配置）
 */
export function useElementData(elements: ElementDataInput[], pageId?: number): UseElementDataResult {
  const [dataMap, setDataMap] = useState<ElementDataMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  // 仅取有 id 与类型的元素；perPage 变化也需重新取数，故纳入 memo 依赖
  const valid = useMemo(
    () => (elements || []).filter((e) => e && e.id != null && !!e.elementType),
    [elements],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!valid.length) {
      setDataMap({});
      return;
    }
    setLoading(true);
    setError(undefined);
    const refs = valid.map((e) => ({
      elementId: e.id as number,
      type: e.elementType,
      perPage: e.perPage,
    }));
    portalApi
      .fetchElementDataBatch({ elements: refs, pageId })
      .then((res) => {
        if (!mounted.current) return;
        // 服务层已拆掉 R 包装，res 即 Map<elementId, ElementDataVO>
        setDataMap((res || {}) as ElementDataMap);
      })
      .catch((e) => {
        if (!mounted.current) return;
        console.error('[portal] 批量取元素数据失败', e);
        setDataMap({});
        setError('门户服务不可用，请稍后重试');
      })
      .finally(() => {
        if (!mounted.current) return;
        setLoading(false);
      });
  }, [valid, pageId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { dataMap, loading, error, refresh };
}

export default useElementData;
