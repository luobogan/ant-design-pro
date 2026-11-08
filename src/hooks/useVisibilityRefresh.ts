import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { ActionType } from '@ant-design/pro-components';

/** 切回可见补拉的最小间隔：合并短时间内的重复触发，避免一次切标签产生多次请求 */
const MIN_REFRESH_INTERVAL = 800;

type ActionRef = MutableRefObject<ActionType | undefined>;

/**
 * 列表页「切回可见时补拉」（本期 L1，纯前端）。
 *
 * 场景：用户看到消息铃铛红点 → 切回待办/已办/我的请求标签，列表自动重新取数；
 * 或在新标签办完流程、办理页自动关闭后切回列表标签。
 *
 * 设计约束（见 doc/md/流程列表实时刷新方案与分页性能决策.md 第 10.2 节）：
 * - 只监听 visibilitychange + pageshow，不引入 WS、不读后端配置、不做常驻轮询；
 * - 用 reload() 而非 reloadAndReset()，保留用户当前所在页码；
 * - 后台标签不产生任何请求；用户长期不切回时该标签保持旧数据（既定取舍）；
 * - 标签内节流；卸载时清理监听，避免重复注册。
 */
export function useVisibilityRefresh(actionRef: ActionRef, enabled = true): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let lastRefreshAt = 0;
    let firstPageShow = true;

    const refresh = () => {
      const now = Date.now();
      if (now - lastRefreshAt < MIN_REFRESH_INTERVAL) {
        return;
      }
      lastRefreshAt = now;
      actionRef.current?.reload();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      // 首次加载的 pageshow 与 ProTable 首次 request 重叠，跳过以免双请求；
      // bfcache 恢复（persisted=true）或后续重新显示需要补拉。
      if (firstPageShow) {
        firstPageShow = false;
        return;
      }
      if (e.persisted || document.visibilityState === 'visible') {
        refresh();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [actionRef, enabled]);
}

export default useVisibilityRefresh;
