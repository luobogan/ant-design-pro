import React, { useEffect, useRef } from 'react';
import { Modal } from 'antd';
import type { OdocEditorConfig } from '@/services/workflow';

interface OdocEditorModalProps {
  open: boolean;
  config: OdocEditorConfig | null;
  onClose: () => void;
  /** 关闭后（编辑已通过 callback 落库）刷新版本 */
  onSaved: () => void;
}

let apiPromise: Promise<void> | null = null;

function loadApiJs(src: string): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('OnlyOffice api.js 加载失败: ' + src));
    document.head.appendChild(s);
  });
  return apiPromise;
}

/**
 * OnlyOffice 在线编辑弹窗。
 *
 * <p>后端 {@code editorConfig} 已算好 document/editorConfig（含 callbackUrl）；
 * 本组件仅负责加载 DOCS 的 api.js 并 new DocEditor 渲染。保存由 OnlyOffice 异步回调后端完成，
 * 关闭弹窗即触发 onSaved 刷新版本列表。</p>
 */
const OdocEditorModal: React.FC<OdocEditorModalProps> = ({ open, config, onClose, onSaved }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (!open || !config?.docServerUrl) {
      return;
    }
    let cancelled = false;
    const docConfig = {
      document: config.document,
      documentType: config.documentType || 'word',
      editorConfig: {
        ...config.editorConfig,
        events: {
          onRequestClose: () => {
            if (!cancelled) {
              onSaved();
            }
          },
        },
      },
    };
    loadApiJs(`${config.docServerUrl}/web-apps/apps/api/documents/api.js`)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const DocsAPI = (window as any).DocsAPI;
        if (!DocsAPI) {
          return;
        }
        editorRef.current = new DocsAPI.DocEditor(containerRef.current, docConfig);
      })
      .catch(() => {
        /* 加载失败：弹窗内保持空白，父级会提示 */
      });
    return () => {
      cancelled = true;
      if (editorRef.current) {
        try {
          editorRef.current.destroyEditor?.();
        } catch (_e) {
          /* ignore */
        }
        editorRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, config]);

  return (
    <Modal
      open={open}
      title="正文在线编辑"
      footer={null}
      width="82%"
      style={{ top: 24 }}
      onCancel={() => onSaved()}
      destroyOnClose
    >
      <div ref={containerRef} style={{ height: '72vh', border: '1px solid #eee' }} />
    </Modal>
  );
};

export default OdocEditorModal;
