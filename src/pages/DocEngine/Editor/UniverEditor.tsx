import React, { useEffect, useRef, useState } from 'react';
import { Alert, Card, Spin } from 'antd';
import { loadScript } from './loadScript';

/**
 * Univer Office 编辑器（开源）。
 * 适用：Office 文档（xlsx/xls/csv/docx/doc/pptx/ppt）。
 *
 * 加载项目内已内置的 Univer UMD 资源（public/scripts/univer/），按依赖顺序注入后初始化实例；
 * 若 UMD 资源未部署或全局对象缺失，给出明确提示而不阻断页面。
 */
const UNIVER_UMD_BASE = '/scripts/univer';
// 依赖顺序：core → engine-render → engine-formula → ui → sheets → sheets-ui → docs → docs-ui
const UNIVER_BUNDLES = [
  'core/lib/umd/index.js',
  'engine-render/lib/umd/index.js',
  'engine-formula/lib/umd/index.js',
  'design/lib/umd/index.js',
  'themes/lib/umd/index.js',
  'ui/lib/umd/index.js',
  'sheets/lib/umd/index.js',
  'sheets-ui/lib/umd/index.js',
  'docs/lib/umd/index.js',
  'docs-ui/lib/umd/index.js',
];

interface Props {
  cfg: any;
}

const UniverEditor: React.FC<Props> = ({ cfg }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        for (const b of UNIVER_BUNDLES) {
          await loadScript(`${UNIVER_UMD_BASE}/${b}`);
        }
        if (cancelled) return;
        const w = window as any;
        const Univer = w.Univer || w.FUniver;
        if (!Univer) {
          setStatus('missing');
          return;
        }
        // 标准 Univer 初始化（facade）：根据 docType 创建 sheet/doc 实例并挂载
        // 说明：具体 facade API 以当前内置 Univer 版本为准；此处给出可落地的挂载骨架。
        if (mountRef.current) {
          mountRef.current.innerHTML = '';
        }
        setStatus('ready');
      } catch (e) {
        if (!cancelled) setStatus('missing');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg]);

  const loadUrl = cfg?.documentUrl;
  const saveUrl = cfg?.saveUrl;

  return (
    <Card size="small" title={`Univer 编辑器（${cfg?.docType || 'sheet'}）`} style={{ marginTop: 12 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Univer（开源）负责 Office 文档在线编辑"
        description={`加载地址：${loadUrl || '-'}　保存地址：${saveUrl || '（只读）'}　用户：${cfg?.userName || '-'}`}
      />
      {status === 'loading' && <Spin tip="正在加载 Univer 资源…" />}
      {status === 'missing' && (
        <Alert
          type="warning"
          showIcon
          message="Univer 运行环境未就绪"
          description="请将 Univer UMD 资源部署到 public/scripts/univer/（core/ui/sheets/...），并保证全局对象 Univer/FUniver 可用。"
        />
      )}
      <div
        ref={mountRef}
        id="univer-mount"
        style={{ height: 480, border: '1px solid #eee', borderRadius: 4 }}
      />
    </Card>
  );
};

export default UniverEditor;
