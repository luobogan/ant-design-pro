import { useEffect, useState } from 'react';
import * as dictApi from '@/pages/System/Dict/service';
import { pickPayload } from '@/utils/utils';

export interface DictOption {
  label: string;
  value: number | string;
}

/**
 * 读取后端字典项，转成 Select / valueEnum 可直接使用的选项。
 * 接口：GET /api/blade-system/dict/dictionary?code=xxx
 * 返回结构：[{ dictKey: number, dictValue: string }]
 *
 * @param code 字典编号，如 post_category
 */
export default function useDictOptions(code: string): {
  options: DictOption[];
  loading: boolean;
} {
  const [options, setOptions] = useState<DictOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!code) {
      setOptions([]);
      return;
    }
    let alive = true;
    setLoading(true);
    dictApi
      .dict({ code })
      .then((res: any) => {
        if (!alive) return;
        const list = pickPayload<any[]>(res, []) || [];
        setOptions(
          (Array.isArray(list) ? list : []).map((item: any) => ({
            label: item?.dictValue ?? item?.label,
            value: item?.dictKey ?? item?.value,
          })),
        );
      })
      .catch(() => {
        if (alive) setOptions([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [code]);

  return { options, loading };
}
