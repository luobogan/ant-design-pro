import React, { useEffect, useRef, useState } from 'react';
import { Alert, Card, Spin } from 'antd';
import { loadScript } from './loadScript';

/**
 * PDF 预览（PDF 文件只读预览）。
 *
 * 渲染策略：PDF.js canvas 为主，浏览器原生预览为兜底。
 *
 * 根因修复：此前「PDF.js 资源不可达 / 空白」并非资源缺失，而是 PDF 二进制内容请求因缺少网关令牌被 401 拦截。
 * 现统一经网关取回（带鉴权头 + /api 路由），转为同源 Blob 交给 PDF.js；任何失败（资源不可达 / 渲染异常 / 超时）
 * 一律回落浏览器原生预览（同源 Blob 或 OSS 直链），并在出错时显式提示，避免静默空白。
 *
 * 直链场景（documentUrl 为可直接加载的地址，浏览器原生 iframe 预览，无需取字节）：
 *  - 外部文件 OSS 绝对直链（http(s)://...）；
 *  - 本地附件静态直链（/api/blade-doc/uploads/...、/blade-doc/uploads/...、/uploads/...，由网关白名单免鉴权）。
 * 其余本地文件（/doc/file/... token 签名）仍走「网关鉴权取字节 + PDF.js canvas」，失败回落原生预览。
 */
interface Props {
  cfg: any;
}

const PDFJS_LOCAL = '/scripts/pdfjs/pdf.min.js';
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = '/scripts/pdfjs/pdf.worker.min.js';
const RENDER_TIMEOUT = 5000;

const loadScriptAny = (srcs: string[]): Promise<void> =>
  srcs.reduce<Promise<void>>((p, src) => p.catch(() => loadScript(src)), Promise.reject());

type Status = 'loading' | 'rendered' | 'native' | 'error';

const PdfViewer: React.FC<Props> = ({ cfg }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [src, setSrc] = useState<string>('');
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    let createdUrl = '';
    let timer: any;

    (async () => {
      const url = cfg?.documentUrl;
      if (!url) {
        setStatus('error');
        setMsg('未找到附件文件，或预览地址缺失');
        return;
      }
      // 直链（OSS 绝对地址 / 本地 uploads 静态直链）：原生 iframe 直接预览，不取字节
      const isDirectLink =
        /^https?:\/\//i.test(url) ||
        url.startsWith('/api/blade-doc/uploads/') ||
        url.startsWith('/blade-doc/uploads/') ||
        url.startsWith('/uploads/');
      if (isDirectLink) {
        setSrc(url);
        setStatus('native');
        return;
      }
      try {
        // 本地文件：经网关鉴权取回（避免裸 URL 被网关 401），转 Blob 交给 PDF.js
        const apiUrl = url.startsWith('/api') ? url : '/api/blade-doc' + url;
        const token =
          (typeof localStorage !== 'undefined' && localStorage.getItem('sword-token')) || '';
        const headers: any = {
          'blade-auth': 'bearer ' + token,
          'tenant-id': '000000',
          authorization: 'Basic c3dvcmQ6c3dvcmRfc2VjcmV0',
        };
        const res = await fetch(apiUrl, { headers });
        if (!res.ok) {
          setStatus('error');
          setMsg(`PDF 加载失败（HTTP ${res.status}）：无权限或文件不可读`);
          return;
        }
        const blob = await res.blob();
        if (!blob.size) {
          setStatus('error');
          setMsg('PDF 文件为空，无法预览');
          return;
        }
        const blobUrl = URL.createObjectURL(blob);
        createdUrl = blobUrl;
        setSrc(blobUrl);

        // 超时未渲染则回落原生预览，保证任何环境都能看到 PDF
        timer = setTimeout(() => {
          if (!cancelled) {
            setStatus((s) => (s === 'rendered' ? s : 'native'));
          }
        }, RENDER_TIMEOUT);

        await loadScriptAny([PDFJS_LOCAL, PDFJS_CDN]);
        if (cancelled) return;
        const pdfjs = (window as any).pdfjsLib;
        if (!pdfjs) {
          // 资源不可达 → 原生预览兜底
          setStatus('native');
          return;
        }
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        pdfjs.disableWorker = true; // 主线程渲染，规避受限环境下 Worker 无法初始化
        const data = new Uint8Array(await blob.arrayBuffer());
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: ctx, viewport }).promise;
        setStatus('rendered');
      } catch (e: any) {
        if (!cancelled) {
          // 任何渲染异常 → 同源 Blob 原生预览兜底
          if (createdUrl) {
            setStatus('native');
          } else {
            setStatus('error');
            setMsg('PDF 渲染失败：' + (e?.message || String(e)));
          }
        }
      } finally {
        if (timer) clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [cfg]);

  const onIframeError = () => {
    setStatus('error');
    setMsg('附件打开失败（文件可能已失效或无访问权限）');
  };

  return (
    <Card size="small" title="PDF 预览（PDF.js）" style={{ marginTop: 12 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="PDF 文件只读预览（PDF.js 优先，原生预览兜底）"
        description={`文件地址：${cfg?.documentUrl || '-'}（只读）`}
      />
      {status === 'loading' && <Spin tip="正在加载 PDF…" />}
      {status === 'rendered' && <canvas ref={canvasRef} style={{ width: '100%' }} />}
      {status === 'native' && (
        <iframe
          ref={iframeRef}
          title="pdf"
          src={src}
          onError={onIframeError}
          style={{ width: '100%', height: 560, border: '1px solid #eee' }}
        />
      )}
      {status === 'error' && (
        <Alert type="error" showIcon message="PDF 预览失败" description={msg || '未知错误'} />
      )}
    </Card>
  );
};

export default PdfViewer;
