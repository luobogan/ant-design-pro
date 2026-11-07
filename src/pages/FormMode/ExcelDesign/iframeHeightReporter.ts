import { useEffect } from 'react';

/**
 * 当本页被嵌入到 iframe 中时，持续向父窗口上报自身高度，
 * 配合 ExcelPreview 的 IframeArea（监听 `excelp-iframe-resize`）实现跨域自适应高度。
 *
 * 仅在该页处于 iframe 内（window.self !== window.top）时生效，正常独立打开不动作。
 * 上报协议：parent.postMessage({ type: 'excelp-iframe-resize', height: <px> }, '*')。
 */
export const useIframeHeightReporter = (): void => {
  useEffect(() => {
    if (typeof window === 'undefined' || window.self === window.top) return;

    const report = () => {
      const h = Math.max(
        document.body?.scrollHeight || 0,
        document.documentElement?.scrollHeight || 0,
        document.body?.offsetHeight || 0,
        document.documentElement?.offsetHeight || 0,
      );
      if (h > 0) {
        window.parent.postMessage({ type: 'excelp-iframe-resize', height: h }, '*');
      }
    };

    // 初始兜底（等首屏布局稳定），之后由 ResizeObserver 接管动态内容
    const timer = window.setTimeout(report, 300);
    const ro = new ResizeObserver(report);
    if (document.body) ro.observe(document.body);
    if (document.documentElement) ro.observe(document.documentElement);
    window.addEventListener('resize', report);
    window.addEventListener('load', report);

    return () => {
      window.clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener('resize', report);
      window.removeEventListener('load', report);
    };
  }, []);
};
