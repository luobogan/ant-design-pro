import React, { useEffect, useRef } from 'react';
import { Alert, Modal } from 'antd';
import type { OdocDocInit, OdocEditorConfig } from '@/services/workflow';
import WpsEditor from '@/pages/DocEngine/Editor/WpsEditor';

interface OdocEditorModalProps {
  open: boolean;
  /** 正文初始化返回（含 editorType 与对应编辑器配置）；仅 OnlyOffice 时为 editorConfig 非 null */
  init: OdocDocInit | null;
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
 * 正文在线编辑弹窗（WPS 统一改造 P2）。
 *
 * <p>按后端 {@code editorType} 分流：
 * - wps：复用知识管理侧 {@link WpsEditor}（WebOfficeSDK），后端 {@code wpsEditorConfig} 已算好
 *   appId/fileId/token/jssdkUrl；保存由 WPS 中台三阶段回调后端完成。
 * - onlyoffice（默认）：加载 DOCS 的 api.js 并 new DocEditor 渲染，保存由 OnlyOffice 异步回调完成。</p>
 */
const OdocEditorModal: React.FC<OdocEditorModalProps> = ({ open, init, onClose, onSaved }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const isWps = init?.editorType === 'wps';
  const onlyofficeCfg: OdocEditorConfig | null | undefined = init?.editorConfig;

  useEffect(() => {
    if (!open || isWps || !onlyofficeCfg?.docServerUrl) {
      return;
    }
    let cancelled = false;
    const docConfig = {
      document: onlyofficeCfg.document,
      documentType: onlyofficeCfg.documentType || 'word',
      editorConfig: {
        ...onlyofficeCfg.editorConfig,
        events: {
          onRequestClose: () => {
            if (!cancelled) {
              onSaved();
            }
          },
        },
      },
    };
    loadApiJs(`${onlyofficeCfg.docServerUrl}/web-apps/apps/api/documents/api.js`)
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
  }, [open, init]);

  return (
    <Modal
      open={open}
      title="正文在线编辑"
      footer={null}
      width="82%"
      style={{ top: 24 }}
      onCancel={() => onSaved()}
      destroyOnHidden
    >
      {isWps ? (
        init?.wpsEditorConfig ? (
          <WpsEditor cfg={init.wpsEditorConfig} />
        ) : (
          <Alert type="warning" showIcon message="WPS 配置缺失" description="后端未返回 WPS 编辑配置，请确认已配置 WPS 应用且 editor=wps。" />
        )
      ) : (
        <div ref={containerRef} style={{ height: '72vh', border: '1px solid #eee' }} />
      )}
    </Modal>
  );
};

export default OdocEditorModal;
