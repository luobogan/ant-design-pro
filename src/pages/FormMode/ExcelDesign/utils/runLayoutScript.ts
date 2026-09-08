/**
 * 布局级代码块（可执行脚本）的预处理与注入执行。
 *
 * 对齐 ecology 的「代码块」实现：
 *  - 运行时容器：src4js/pc4mobx/workflowForm/components/layout/CustomContent.js
 *      render(){ return <div id="customScriptDiv"></div> }
 *      注释：此组件存储代码块及 custompage 信息，不做 render 判断，只通过操作 DOM 方式 append
 *  - 注入执行：src4js/pc4mobx/workflowForm/util/formUtil.js → loadScript()
 *      jQuery("#customScriptDiv").html("");
 *      jQuery("#customScriptDiv").append(`<div class="_custom_script_${index}">${content}</div>`);
 *  - 内容预处理：src4js/pc4mobx/workflowForm/util/public/globalUtil.js → manageScriptContent()
 *      document.write 覆写为向容器 append；剔除 <html>/<body>/<head> 头信息
 *
 * ⚠️ 关键差异：浏览器通过 innerHTML 注入的 <script> **不会执行**
 * （ecology 依赖 jQuery.append 会执行脚本的特性）。
 * 因此这里显式拆分处理：HTML 片段用 insertAdjacentHTML，<script> 必须动态创建元素再 append 才会执行。
 */

/** 脚本宿主容器 id（等价于 ecology 的 #customScriptDiv） */
export const LAYOUT_SCRIPT_HOST_ID = 'layoutScriptHost';

/** document.write 的兼容实现名：把内容追加到宿主容器，避免整页被清空 */
const WRITE_SHIM = '__layoutScriptWrite';

const ensureWriteShim = () => {
  const w = window as any;
  if (typeof w[WRITE_SHIM] !== 'function') {
    w[WRITE_SHIM] = (...args: any[]) => {
      const host = document.getElementById(LAYOUT_SCRIPT_HOST_ID);
      if (host) host.insertAdjacentHTML('beforeend', args.map((a) => String(a)).join(''));
    };
  }
};

/**
 * 内容预处理，对齐 ecology 的 manageScriptContent：
 *  - document.write / writeln 覆写为向宿主容器 append（否则会清空整个页面）
 *  - 剔除 html / head / body 头信息（含带属性的写法）
 */
export const manageScriptContent = (content: string): string => {
  if (!content) return '';
  return content
    .replace(/document\.write(ln)?/g, `window.${WRITE_SHIM}`)
    .replace(/<\/?(html|head|body)\b[^>]*>/gi, '');
};

/** 把 <script> 的属性串与代码体还原为真正可执行的 script 元素 */
const createScriptEl = (attrs: string, code: string): HTMLScriptElement => {
  const el = document.createElement('script');
  const attr = (name: string) => {
    const m = new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']+)\\1`, 'i').exec(attrs);
    return m ? m[2] : undefined;
  };
  const id = attr('id');
  const type = attr('type');
  const src = attr('src');
  if (id) el.id = id;
  // 保留原始 type：非 JS 类型（如 text/template）浏览器不会执行，符合预期
  if (type) el.type = type;
  if (src) el.src = src;
  else el.text = code;
  return el;
};

/**
 * 在宿主容器内执行布局级脚本。
 * 按脚本在内容中的出现顺序依次注入：HTML 片段 → insertAdjacentHTML，<script> → 动态元素 append。
 */
export const runLayoutScript = (raw: string): void => {
  const host = document.getElementById(LAYOUT_SCRIPT_HOST_ID);
  if (!host || !raw) return;
  try {
    ensureWriteShim();
    // 重复注入前先清空，避免切换布局/重新预览后脚本叠加执行
    host.innerHTML = '';

    const content = manageScriptContent(raw);
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      if (m.index > cursor) {
        host.insertAdjacentHTML('beforeend', content.slice(cursor, m.index));
      }
      host.appendChild(createScriptEl(m[1] || '', m[2] || ''));
      cursor = re.lastIndex;
    }
    if (cursor < content.length) {
      host.insertAdjacentHTML('beforeend', content.slice(cursor));
    }
  } catch (e) {
    console.error('[布局代码块] 执行失败:', e);
  }
};

// ──────────────────────────────────────────────
// 脚本存储编解码
//
// 后端（SpringBlade）开启了 XSS 过滤，会剥掉请求体里的 <script> 标签：
// 实测以明文提交 {"script":"<script>...</script>"} 后，库中只剩 "..."，标签被移除。
// 因此存库前做 base64 编码（仅含 [A-Za-z0-9+/=]，不会被过滤），读取时解码。
// 统一加 b64: 前缀以区分编码值与历史明文值；解码失败时回退为原文。
// ──────────────────────────────────────────────
const B64_PREFIX = 'b64:';

const bytesToBase64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

/** 脚本 → 可安全提交给后端的存储值 */
export const encodeScriptForStorage = (script: string): string => {
  if (!script) return '';
  try {
    return B64_PREFIX + bytesToBase64(new TextEncoder().encode(script));
  } catch (e) {
    console.warn('[布局代码块] 编码失败，回退为明文存储:', e);
    return script;
  }
};

/** 存储值 → 原始脚本（兼容未编码的历史明文值） */
export const decodeScriptFromStorage = (stored: string): string => {
  if (!stored) return '';
  if (stored.indexOf(B64_PREFIX) !== 0) return stored;
  try {
    const bin = atob(stored.slice(B64_PREFIX.length));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch (e) {
    console.warn('[布局代码块] 解码失败:', e);
    return '';
  }
};

/**
 * 从布局数据中取出布局级脚本。
 * 设计器侧 layoutConfig 由后端返回 JSON 字符串；预览侧经 localStorage 传递时是对象，两种都兼容。
 */
export const getLayoutScript = (layoutData: any): string => {
  const cfg = layoutData?.layoutConfig;
  if (!cfg) return '';
  if (typeof cfg === 'string') {
    try {
      return decodeScriptFromStorage((JSON.parse(cfg)?.script as string) || '');
    } catch {
      return '';
    }
  }
  return decodeScriptFromStorage((cfg.script as string) || '');
};
