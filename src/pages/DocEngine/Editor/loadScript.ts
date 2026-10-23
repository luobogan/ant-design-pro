/**
 * 动态脚本/样式加载工具（在线编辑三方 SDK 共用）。
 * 已加载则直接 resolve，避免重复注入。
 */
const loaded = new Set<string>();

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (loaded.has(src)) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => {
      loaded.add(src);
      resolve();
    };
    el.onerror = () => reject(new Error('加载失败: ' + src));
    document.body.appendChild(el);
  });
}

export function loadStyle(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (loaded.has(href)) {
      resolve();
      return;
    }
    const el = document.createElement('link');
    el.rel = 'stylesheet';
    el.href = href;
    el.onload = () => {
      loaded.add(href);
      resolve();
    };
    el.onerror = () => reject(new Error('样式加载失败: ' + href));
    document.head.appendChild(el);
  });
}
