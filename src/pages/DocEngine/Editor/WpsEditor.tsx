import React, { useEffect, useRef, useState } from 'react';
import { Alert, Card, Spin } from 'antd';
import { loadScript } from './loadScript';

/**
 * WPS 在线编辑（WPS WebOffice / solution.wps.cn 官方 JSSDK）。
 * 需前端部署 web-office-sdk-solution.umd.js（public 目录）+ 后端配置 WPS 应用 appId/secret。
 *
 * 引入 umd.js 后全局挂载 WebOfficeSDK，用 WebOfficeSDK.init({ officeType, appId, fileId, mount, token }) 初始化；
 * 业务 token 由后端签发，WPS 中台回调时经 X-WebOffice-Token 回传做鉴权。
 */
interface Props {
  cfg: any;
}

const WpsEditor: React.FC<Props> = ({ cfg }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

  // 由扩展名映射 WebOfficeSDK.OfficeType（与文件实际类型不一致会打开失败/乱码）
  const resolveOfficeType = (ext?: string) => {
    const T = (window as any).WebOfficeSDK?.OfficeType;
    if (!T) return undefined;
    switch ((ext || '').toLowerCase()) {
      case 'doc':
      case 'docx':
        return T.Writer;
      case 'xls':
      case 'xlsx':
      case 'csv':
      case 'et':
        return T.Spreadsheet;
      case 'ppt':
      case 'pptx':
      case 'wpp':
        return T.Presentation;
      case 'pdf':
        return T.Pdf;
      default:
        return T.Writer;
    }
  };

  useEffect(() => {
    let cancelled = false;
    let instance: any = null;
    (async () => {
      try {
        // 引入本地部署的 WebOffice umd.js（默认前端 public 下；可经后端 wpsJsSdkUrl 覆盖）
        await loadScript(cfg?.wpsJsSdkUrl || '/web-office-sdk-solution.umd.js');
        if (cancelled) return;
        const SDK = (window as any).WebOfficeSDK;
        if (!SDK || typeof SDK.init !== 'function') {
          setStatus('missing');
          return;
        }
        if (mountRef.current) {
          mountRef.current.innerHTML = '';
          instance = SDK.init({
            officeType: resolveOfficeType(cfg?.fileExt),
            appId: cfg?.wpsAppId,
            fileId: cfg?.wpsFileId,
            mount: mountRef.current,
            token: cfg?.wpsToken,
          });
        }
        setStatus('ready');
      } catch (e) {
        if (!cancelled) setStatus('missing');
      }
    })();
    return () => {
      cancelled = true;
      try {
        instance && typeof instance.destroy === 'function' && instance.destroy();
      } catch {
        /* ignore */
      }
    };
  }, [cfg]);

  return (
    <Card size="small" title="WPS 在线编辑（WebOffice）" style={{ marginTop: 12 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="WPS WebOffice SDK 负责 Office 文档在线编辑（可选方案）"
        description={`appId：${cfg?.wpsAppId || '-'}　fileId：${cfg?.wpsFileId || '-'}　token：${(cfg?.wpsToken || '').slice(0, 12)}…`}
      />
      {status === 'loading' && <Spin tip="正在加载 WPS WebOffice SDK…" />}
      {status === 'missing' && (
        <Alert
          type="warning"
          showIcon
          message="WPS WebOffice SDK 未加载"
          description="请确认前端 public 目录已部署 web-office-sdk-solution.umd.js，且后端已配置 WPS 应用 appId/secret（wpsJsSdkUrl 可覆盖脚本地址）。"
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
