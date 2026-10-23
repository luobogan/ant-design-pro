import React, { useEffect, useRef, useState } from 'react';
import { Alert, Card, Spin } from 'antd';
import { loadScript } from './loadScript';

/**
 * WPS 在线编辑（kdocs jssdk）。
 * 适用：同为 Office 文档的可选在线编辑方案；需后端配置 WPS 开放平台 appId/secret。
 *
 * 动态加载 kdocs jssdk 脚本后初始化；若脚本不可用，给出明确提示而不阻断页面。
 */
interface Props {
  cfg: any;
}

const WpsEditor: React.FC<Props> = ({ cfg }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadScript(cfg?.wpsJsSdkUrl || 'https://wwo.wps.cn/office/jssdk/jssdk.js');
        if (cancelled) return;
        const w = window as any;
        if (!w.wpsJSSDK && !w.WpsJSSDK) {
          setStatus('missing');
          return;
        }
        const JSSDK = w.wpsJSSDK || w.WpsJSSDK;
        if (mountRef.current) {
          mountRef.current.innerHTML = '';
          // WPS 文档中台 jssdk 标准初始化参数（appId/fileId/fileName/time/sign/permission/user）
          new JSSDK({
            appId: cfg?.wpsAppId,
            fileId: cfg?.wpsFileId,
            fileName: cfg?.wpsFileName,
            time: cfg?.wpsTimestamp,
            sign: cfg?.wpsSignature,
            permission: cfg?.wpsPermission,
            user: cfg?.wpsUserId,
            mount: mountRef.current,
            onSave: () => {
              // WPS 中台会经控制台注册的保存回调地址回写文件；此处亦可走我方 wpsSaveUrl
            },
          });
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

  return (
    <Card size="small" title="WPS 在线编辑（kdocs jssdk）" style={{ marginTop: 12 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="WPS SDK（WPS 文档中台 / kdocs jssdk）负责 Office 文档在线编辑（可选方案）"
        description={`appId：${cfg?.wpsAppId || '-'}　fileId：${cfg?.wpsFileId || '-'}　权限：${cfg?.wpsPermission || '-'}　签名：${(cfg?.wpsSignature || '').slice(0, 12)}…`}
      />
      {status === 'loading' && <Spin tip="正在加载 WPS jssdk…" />}
      {status === 'missing' && (
        <Alert
          type="warning"
          showIcon
          message="WPS jssdk 未加载"
          description="请确认后端已配置 WPS 开放平台 appId/secret，且 jssdk 脚本地址（wpsJsSdkUrl）可访问。"
        />
      )}
      <div
        ref={mountRef}
        id="wps-mount"
        style={{ height: 480, border: '1px solid #eee', borderRadius: 4 }}
      />
    </Card>
  );
};

export default WpsEditor;
