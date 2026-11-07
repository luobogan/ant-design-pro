import React, { useEffect, useState } from 'react';
import { Tooltip, Empty, Spin } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import ElementRenderer from '@/pages/Portal/components/ElementRegistry';
import { portalApi } from '@/services/portal';
import {
  buildBarcodeUrl,
  isSheetBackgroundImage,
  normalizeLinkHref,
  parseTabConfig,
  pickMultiLang,
  resolveIframeSrc,
} from '../elementSchema';

/**
 * 运行期「插入元素」渲染组件集合。
 *
 * 对齐泛微 E9 两处实现：
 *  - SPA 渲染 `D:\Weaver2020\ecology\src4js\pc4mobx\workflowForm\components\layout\CellType.js:42-258`
 *  - 后台拼 HTML `E:\project\ecology\ecology\src\weaver\workflow\exceldesign\ParseExcelLayout.java:1440-1689`
 *
 * 之所以单独成文件：ExcelPreview 的 `renderElementNode` 是模块级普通函数（不能调 hooks），
 * 而多语言、二维码取图、门户取数、iframe 自适应都需要 hooks / 副作用，故以 React 组件形式
 * 被它返回。全部组件只依赖 `elementConfig`（≈ E9 jsonparam），不读写表单字段值。
 */

export interface ElementRuntimeContext {
  /** 流程实例ID（SpringBlade requestId；前端运行期上下文记作 instanceId） */
  instanceId?: any;
  /** 流程定义ID（SpringBlade workflowid；前端记作 defId） */
  defId?: any;
  /** 审批节点标识（SpringBlade 节点 Key） */
  nodeId?: any;
  /** 表单ID（workflow_bill.id） */
  formId?: any;
  /** 待办任务ID（SpringBlade taskId） */
  taskId?: any;
  /** 表单值，用于条码 $字段名$ 变量替换 */
  formValues?: Record<string, any>;
}

/** 元素格运行期上下文：由 ExcelPreview 顶层注入，元素组件直接消费，避免逐层透传 */
export const ElementContext = React.createContext<ElementRuntimeContext>({});

/** 把 cfg.content 里的 $字段名$ 用运行期表单值替换（对齐 E9 扫码 relatefield 联动） */
const resolveContentVars = (content: string, formValues?: Record<string, any>): string =>
  String(content || '').replace(/\$([A-Za-z0-9_]+)\$/g, (m, name) => {
    const v = formValues?.[name];
    return v === undefined || v === null ? m : String(v);
  });

const placeholder = (text: string) => <span style={{ color: '#bbb', fontSize: 12 }}>{text}</span>;

/** 解析 `k:v;k:v` 形式的自定义 style 文本（对齐 E9 setCustomAttr.jsp 的自定义属性） */
const parseInlineStyle = (raw?: string): React.CSSProperties => {
  if (!raw) return {};
  const parsed: Record<string, string> = {};
  String(raw)
    .split(';')
    .filter(Boolean)
    .forEach((pair) => {
      const idx = pair.indexOf(':');
      if (idx < 0) return;
      const key = pair.slice(0, idx).trim().replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      const value = pair.slice(idx + 1).trim();
      if (key && value) parsed[key] = value;
    });
  return parsed as React.CSSProperties;
};

// ── 多语言标签：按当前 locale 取 zh / en / tw（零后端改动） ──
export const MultiLangLabel: React.FC<{ cfg: Record<string, any> }> = ({ cfg }) => {
  const intl = useIntl();
  const locale = intl?.locale || 'zh-CN';
  const text = pickMultiLang(cfg, locale);
  return <span>{text || placeholder('多语言标签（未配置文本）')}</span>;
};

// ── 说明：E9 etype 25 → WeaHelpfulTip 问号提示（CellType.js:238-246） ──
export const NoteTip: React.FC<{ cfg: Record<string, any>; fallback?: string }> = ({ cfg, fallback }) => {
  const content = String(cfg.content || fallback || '').trim();
  return (
    <Tooltip
      placement={cfg.placement || 'top'}
      title={<div style={{ whiteSpace: 'pre-wrap', maxWidth: 320 }}>{content || '暂无说明'}</div>}
    >
      <span style={{ color: '#1890ff', cursor: 'help' }}>
        <InfoCircleOutlined style={{ marginRight: 4 }} />
        说明
      </span>
    </Tooltip>
  );
};

// ── 标签页：E9 etype 12 → TabLayout（CellType.js:133-139 / tabpage_wev8.js:197-216） ──
// 真正的标签头与内容联动提升到了 ExcelPreview 的 SheetPreviewForm（表格外层，受控 activeTab
// + 按页行区间过滤 <tr>）。单元格里的这个元素只作为「配置载体」显示摘要；若在这里再渲染一套
// antd Tabs，会与外层标签头出现两套独立选中态，正是此前「切换不联动」的根因。
export const TabElement: React.FC<{ cfg: Record<string, any> }> = ({ cfg }) => {
  const parsed = parseTabConfig(cfg);
  if (!parsed.names.length) return placeholder('标签页（未配置标签名）');
  return (
    <span style={{ fontSize: 12, color: '#666' }}>
      🗂️ 标签页区域：{parsed.names.length} 页（{parsed.names.join(' / ')}）
      <span style={{ color: '#999' }}> — 由表格上方标签头切换</span>
    </span>
  );
};

// ── 图片：E9 srcdtype 1=单元格背景 2=整表背景 3=浮动图（excelUploadImg.jsp:180-200） ──
export const ImageElement: React.FC<{ cfg: Record<string, any> }> = ({ cfg }) => {
  // srcdtype=2 整表背景图：单元格这里只是「配置载体」（属性面板可改地址/用途），
  // 真正的图由 ExcelPreview 的表格容器按 layoutJson.backgroundImage 渲染，避免重复出图。
  if (isSheetBackgroundImage(cfg)) {
    return (
      <span style={{ fontSize: 12, color: '#1890ff' }}>
        🖼️ 整表背景图{cfg.src ? '（由表格容器渲染）' : '（未配置地址）'}
      </span>
    );
  }
  if (!cfg.src) return placeholder('图片（未配置地址）');
  const w = cfg.width || 120;
  const h = cfg.height || 80;
  if (Number(cfg.srcdtype) === 1) {
    return (
      <div
        title={cfg.alt || ''}
        style={{
          width: '100%',
          minHeight: h,
          backgroundImage: `url("${cfg.src}")`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      />
    );
  }
  return (
    <img
      src={cfg.src}
      alt={cfg.alt || ''}
      style={{ maxWidth: '100%', width: Number(cfg.srcdtype) === 3 ? w : undefined, height: h }}
    />
  );
};

// ── 链接：E9 parseHref 协议补全（excelUploadLink.jsp:36-43 / ParseExcelLayout.java:1970-1993） ──
export const LinkElement: React.FC<{ cfg: Record<string, any>; fallback?: string }> = ({ cfg, fallback }) => {
  const href = normalizeLinkHref(cfg);
  if (!href) return <span>{fallback || ' '}</span>;
  return (
    <a href={href} target={cfg.target || '_blank'} rel="noreferrer">
      {cfg.text || cfg.href || href}
    </a>
  );
};

// ── Iframe 区域：SpringBlade 原生变量（$requestId$/$workflowid$/$nodeId$/$formId$/$taskId$）
//    + 自适应高度：同源 onLoad 兜底；跨域走 postMessage 桥（子页约定上报高度） ──
export const IframeArea: React.FC<{ cfg: Record<string, any> }> = ({ cfg }) => {
  const ctx = React.useContext(ElementContext);
  const src = resolveIframeSrc(cfg.src, {
    requestId: ctx.instanceId,
    workflowid: ctx.defId,
    nodeId: ctx.nodeId,
    formId: ctx.formId,
    taskId: ctx.taskId,
  });
  const baseHeight = Number(cfg.height) || 240;
  const [height, setHeight] = useState<number>(baseHeight);
  React.useEffect(() => setHeight(baseHeight), [baseHeight]);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // 跨域自适应高度：子页通过 postMessage 上报自身高度（同源由 onLoad 兜底）
  // 子页约定：parent.postMessage({ type: 'excelp-iframe-resize', height: <px> }, '*')
  React.useEffect(() => {
    if (cfg.heightMode !== 'auto') return;
    const onMessage = (e: MessageEvent) => {
      // 仅接受来自本 iframe 源窗口的消息，避免页面内多个 iframe 互相串扰
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      const d = e.data as any;
      if (!d || d.type !== 'excelp-iframe-resize') return;
      if (cfg.setId && d.id && d.id !== cfg.setId) return;
      const h = Number(d.height);
      if (!Number.isFinite(h) || h <= 0) return;
      setHeight(Math.max(h + 16, 120));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [cfg.setId, cfg.heightMode]);

  if (!src) return placeholder('Iframe区域（未配置地址）');
  return (
    <iframe
      id={cfg.setId || undefined}
      title={cfg.setName || 'iframe-area'}
      ref={iframeRef}
      src={src}
      loading="lazy"
      referrerPolicy={cfg.referrerPolicy || 'strict-origin-when-cross-origin'}
      sandbox={cfg.sandbox || undefined}
      allow={cfg.allow || undefined}
      style={{ width: '100%', height, border: '1px solid #eee', ...parseInlineStyle(cfg.style) }}
      onLoad={(e) => {
        // 同源兜底：跨域时 contentDocument 为 null，交给 postMessage 桥
        if (cfg.heightMode !== 'auto') return;
        try {
          const doc = (e.target as HTMLIFrameElement).contentDocument;
          if (doc?.body?.scrollHeight) setHeight(Math.max(doc.body.scrollHeight + 16, 120));
        } catch {
          /* 跨域：忽略，等待子页 postMessage */
        }
      }}
    />
  );
};

// ── 二维码 / 条形码：后端 ZXing 接口（对齐 E9 /createQRCode、/createWfBarCode） ──
export const BarcodeImage: React.FC<{
  cfg: Record<string, any>;
  fallback?: string;
}> = ({ cfg, fallback }) => {
  const ctx = React.useContext(ElementContext);
  const content = resolveContentVars(String(cfg.content || fallback || ''), ctx.formValues);
  const cfgKey = JSON.stringify({ ...cfg, content });
  const [src, setSrc] = useState<string>('');
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    if (!content) {
      setSrc('');
      setErr('');
      return;
    }
    (async () => {
      try {
        // 走 fetch 带鉴权头再转 Blob，避免 <img> 无法携带 Blade-Auth 而需要改网关白名单。
        const token = localStorage.getItem('sword-token') || '';
        const res = await fetch(buildBarcodeUrl({ ...cfg, content }), {
          headers: {
            'Blade-Auth': `bearer ${token}`,
            'Tenant-Id': localStorage.getItem('tenant-id') || '000000',
            Authorization: 'Basic c3dvcmQ6c3dvcmRfc2VjcmV0',
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setSrc(objectUrl);
          setErr('');
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || '生成失败');
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgKey]);

  const w = cfg.width || 100;
  const h = cfg.height || 100;
  if (!content) return placeholder('二维/条形码（未配置编码内容）');
  if (err) {
    return (
      <div style={{ width: w, height: h, border: '1px dashed #bbb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#999' }}>
        码图生成失败：{err}
      </div>
    );
  }
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {src ? (
        <img src={src} alt={content} style={{ width: cfg.type === 'barcode' ? w : Math.min(w, h), height: cfg.type === 'barcode' ? Math.min(h, 60) : Math.min(w, h) }} />
      ) : (
        <Spin size="small" />
      )}
      {!cfg.hidetext && <span style={{ fontSize: 11, color: '#888' }}>{content}</span>}
    </div>
  );
};

// ── 门户元素：复用 Portal/components/ElementRegistry 的 ElementRenderer ──
export const PortalElement: React.FC<{ cfg: Record<string, any> }> = ({ cfg }) => {
  const type = String(cfg.elementType || 'todo');
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const elementId = Number(cfg.elementId);
        const params: any = Number.isFinite(elementId) && elementId > 0
          ? { elements: [{ elementId, type, perPage: cfg.perPage || 5 }] }
          : { types: [type], limit: cfg.perPage || 5 };
        const map: any = await portalApi.fetchElementDataBatch(params);
        const vo = map?.[String(elementId)] || map?.[type] || Object.values(map || {})[0];
        if (!cancelled) setRows((vo as any)?.data || []);
      } catch {
        // 预览态不因门户数据接口不可用而中断整张表单渲染
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, cfg.elementId, cfg.perPage]);

  return (
    <div style={{ minHeight: Math.min(cfg.height || 300, 320), maxHeight: cfg.height || 300, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 4, padding: 4 }}>
      {failed ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="门户数据暂不可用" />
      ) : (
        <>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
            门户元素：{type}{cfg.hpid ? `（hpid ${cfg.hpid}）` : ''}
          </div>
          <ElementRenderer elementType={type} rows={rows} perPage={cfg.perPage || 5} />
        </>
      )}
    </div>
  );
};

// ── 文本：E9 setCustomAttr.jsp 自定义 class / style / hide ──
export const TextElement: React.FC<{ cfg: Record<string, any>; fallback?: string }> = ({ cfg, fallback }) => {
  if (cfg.hide) return null;
  const content = String(cfg.content || fallback || '');
  const extra: React.CSSProperties = { whiteSpace: 'pre-wrap', ...parseInlineStyle(cfg.style) };
  return <span className={cfg.cssClass || undefined} style={extra}>{content || ' '}</span>;
};
