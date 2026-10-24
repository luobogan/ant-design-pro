import React, { useEffect, useRef, useState } from 'react';
import { Alert, Card, Progress, Space, Spin } from 'antd';
// 预览策略：只取字节(带鉴权) → 同源 Blob → 浏览器原生 iframe 预览（多页/缩放/搜索）。

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

const FETCH_TIMEOUT = 30000;   // 下载字节超时(避免大文件/慢网络时一直转圈)

type Status = 'loading' | 'rendered' | 'native' | 'error';

const PdfViewer: React.FC<Props> = ({ cfg }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [src, setSrc] = useState<string>('');
  const [msg, setMsg] = useState<string>('');
  const [progress, setProgress] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 });

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
        const t0 = Date.now();
        console.log('[PdfViewer] 开始下载', apiUrl);
        const ctrl = new AbortController();
        const fetchTimer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
        let res: Response;
        try {
          res = await fetch(apiUrl, { headers, signal: ctrl.signal });
        } finally {
          clearTimeout(fetchTimer);
        }
        console.log(
          '[PdfViewer] 收到响应 status=', res.status,
          'content-length=', res.headers.get('Content-Length'),
          'type=', res.headers.get('Content-Type'),
          '耗时=', Date.now() - t0, 'ms',
        );
        if (!res.ok) {
          let detail = '';
          try {
            const j = await res.json();
            if (j && j.msg) detail = '：' + j.msg;
          } catch (e) { /* ignore */ }
          setStatus('error');
          setMsg(`PDF 加载失败（HTTP ${res.status}）${detail || '：无权限或文件不可读'}`);
          return;
        }
        // 流式读取，实时反馈下载进度（大文件/慢网络时不再像卡死）
        let blob: Blob;
        const reader = res.body && res.body.getReader();
        if (reader) {
          const total = Number(res.headers.get('Content-Length') || 0);
          const chunks: Uint8Array[] = [];
          let loaded = 0;
          let reads = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            reads += 1;
            if (reads === 1 || reads % 10 === 0) {
              console.log('[PdfViewer] 读取中 loaded=', loaded, 'total=', total, 'chunks=', reads,
                '耗时=', Date.now() - t0, 'ms');
            }
            if (!cancelled) setProgress({ loaded, total });
          }
          console.log('[PdfViewer] 读取完成 loaded=', loaded, 'chunks=', reads, '耗时=', Date.now() - t0, 'ms');
          blob = new Blob(chunks as any, { type: 'application/pdf' });
        } else {
          blob = await res.blob();
        }
        if (!blob.size) {
          setStatus('error');
          setMsg('PDF 文件为空，无法预览');
          return;
        }
        const blobUrl = URL.createObjectURL(blob);
        createdUrl = blobUrl;
        setSrc(blobUrl);

        console.log('[PdfViewer] blob 完成 size=', blob.size, '耗时=', Date.now() - t0, 'ms');
        // 直接用浏览器原生预览（iframe + 同源 Blob）：
        // ① pdf.js 需额外解析，且 disableWorker 在 3.x 已废弃会让 getDocument 挂起（此前一直转圈的根因）；
        // ② 原生预览支持多页滚动/缩放/搜索，对“只读预览”是更好选择（pdf.js 方案原本只渲染第一页）。
        setStatus('native');
        console.log('[PdfViewer] 就绪(原生预览) 耗时=', Date.now() - t0, 'ms');
        return;
      } catch (e: any) {
        if (!cancelled) {
          if (e?.name === 'AbortError') {
            setStatus('error');
            setMsg('PDF 下载超时（文件较大或网络较慢），请重试');
            return;
          }
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
      {status === 'loading' && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Spin tip="正在下载 PDF…" />
          <Progress
            percent={
              progress.total
                ? Math.min(99, Math.round((progress.loaded / progress.total) * 100))
                : Math.min(90, Math.round(progress.loaded / 10240))
            }
            status="active"
            format={() =>
              `${(progress.loaded / 1024 / 1024).toFixed(2)} MB${
                progress.total ? ' / ' + (progress.total / 1024 / 1024).toFixed(2) + ' MB' : ''
              }`
            }
          />
          <span style={{ color: '#888', fontSize: 12 }}>文件较大或网络较慢时请稍候…</span>
        </Space>
      )}
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
