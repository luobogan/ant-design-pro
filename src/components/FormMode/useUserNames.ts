import { useEffect, useState } from 'react';
import { fetchUserNames } from './personOrg';

/**
 * 人员 ID → 姓名 映射（按需拉取，不再全量加载人员）
 *
 * 背景：人员候选已改为服务端分页（queryUsers），loadPersonOrgData() 不再返回全量人员，
 * 因此凡是「把后端下发的用户 ID 翻译成姓名」的地方（待办/已办的发起人、审批意见的
 * 历史处理人、节点操作者回显）都不能再遍历全量 users 建字典。
 *
 * 本 hook 自动去重 → 并发精确查（/user/detail）→ 并入本地缓存（已查过的不再请求）。
 * 用法：const userMap = useUserNames(list.map((t) => t.startUserId));
 */
export function useUserNames(ids: Array<string | number | undefined | null>) {
  const [map, setMap] = useState<Record<string, string>>({});

  // 排序拼接成稳定 key，避免数组引用变化导致重复请求
  const key = (ids || [])
    .filter((v) => v != null && v !== '')
    .map(String)
    .sort()
    .join(',');

  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (!list.length) return;
    let alive = true;
    fetchUserNames(list)
      .then((items) => {
        if (!alive) return;
        setMap((m) => {
          const next = { ...m };
          items.forEach((i) => {
            next[i.id] = i.name;
          });
          return next;
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  return map;
}

export default useUserNames;
