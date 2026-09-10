import React, { useEffect, useMemo, useState } from 'react';
import { App, Result, Spin } from 'antd';
import ExcelPreview, { NodePermissionResolver } from './components/ExcelPreview';
import { renderForm, validateForm } from '@/services/workflow';

/**
 * 设计器写入、预览页读取的布局数据键。
 *
 * 用 localStorage（而非 sessionStorage）是因为预览在**新标签页**中打开：
 * sessionStorage 按标签页隔离，新标签页读不到；localStorage 同源共享，可稳定传递。
 */
export const EXCEL_PREVIEW_DATA_KEY = 'excelPreviewData';

/**
 * 表单预览独立页面
 *
 * 对齐 ecology 的 excelPreView：预览以独立页面承载（新标签页打开），按 Excel 网格还原布局。
 *
 * 双模式：
 * 1. **设计态预览**（默认）：布局由设计器「预览」按钮写入 localStorage，本页读取渲染。
 * 2. **审批态渲染**（文档 §6.4）：URL 携带 `instanceId` + `nodeId`（或 `taskId`）时，
 *    改为按 `formId + dataId + nodeId` 从服务端拉「审批态渲染包」
 *    （布局 + 业务数据 + 节点字段权限），并以权限函数驱动 ExcelPreview 的字段可见/只读/必填/隐藏。
 */
const ExcelPreviewPageContent: React.FC = () => {
  const [layoutData, setLayoutData] = useState<any>(null);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [readOnly, setReadOnly] = useState<boolean>(false);
  const [nodeId, setNodeId] = useState<string | undefined>(undefined);
  const [nodePermission, setNodePermission] = useState<NodePermissionResolver | undefined>(undefined);
  const [renderPkg, setRenderPkg] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { message } = App.useApp();

  // URL 中的审批上下文：instanceId + nodeId 或 taskId
  const params = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return {
      instanceId: sp.get('instanceId'),
      nodeId: sp.get('nodeId'),
      taskId: sp.get('taskId'),
    };
  }, []);

  useEffect(() => {
    const isApproval = params.instanceId && (params.nodeId || params.taskId);
    if (isApproval) {
      // 审批态：从服务端拉渲染包（布局 + 业务数据 + 节点权限）
      setLoading(true);
      const instanceId = Number(params.instanceId);
      const taskId = params.taskId ? Number(params.taskId) : undefined;
      renderForm(instanceId, taskId)
        .then((res: any) => {
          const pkg = res?.data;
          if (!pkg) {
            setLayoutData(null);
            return;
          }
          setNodeId(params.nodeId || pkg.nodeKey);
          setReadOnly(!!pkg.readonly);
          setRenderPkg(pkg);
          try {
            setLayoutData(pkg.layoutJson ? JSON.parse(pkg.layoutJson) : null);
            // 构建节点权限解析器（文档 §3.3-3：以权限函数替代布尔 readOnly）
            // B5 行级：按「scope|field」登记；解析时按 dt{idx}_r{row} → dt{idx} → main 回退
            const permByScopeField = new Map<string, number>();
            (pkg.fieldPerms || []).forEach((p: any) => {
              const sc = p.scope || 'main';
              permByScopeField.set(`${sc}|${p.fieldName}`, p.perm);
            });
            const scopeChain = (scope?: string): string[] => {
              const s = scope || 'main';
              if (/^dt\d+_r\d+$/.test(s)) {
                return [s, s.replace(/_r\d+$/, ''), 'main'];
              }
              if (/^dt\d+$/.test(s)) {
                return [s, 'main'];
              }
              return ['main'];
            };
            setNodePermission(() => (fieldName: string, scope?: string) => {
              for (const sc of scopeChain(scope)) {
                const perm = permByScopeField.get(`${sc}|${fieldName}`);
                if (perm != null) {
                  return {
                    readonly: perm === 1, // 1=只读（可编辑/必填均非只读）
                    required: perm === 3, // 3=必填
                    hidden: perm === 0, // 0=隐藏
                  };
                }
              }
              return undefined;
            });
            // 业务数据注入表单值（审批态展示已提交数据）
            (window as any).__approvalFormData = pkg.dataJson || {};
          } catch (e) {
            console.error('[ExcelPreviewPage] 解析渲染包失败:', e);
            setLayoutData(null);
          }
        })
        .catch((e) => {
          console.error('[ExcelPreviewPage] 拉取审批态渲染包失败:', e);
          setLayoutData(null);
        })
        .finally(() => {
          setLoading(false);
          setLoaded(true);
        });
      return;
    }

    // 设计态：读 localStorage
    try {
      const raw = localStorage.getItem(EXCEL_PREVIEW_DATA_KEY);
      setLayoutData(raw ? JSON.parse(raw) : null);
    } catch (e) {
      console.error('[ExcelPreviewPage] 解析预览数据失败:', e);
      setLayoutData(null);
    }
    setLoaded(true);
  }, [params]);

  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else if (window.history.length > 1) {
      window.history.back();
    }
  };

  if (!loaded || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin description="加载中…" />
      </div>
    );
  }

  if (!layoutData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Result
          status="info"
          title="没有可预览的数据"
          subTitle="请回到 Excel 设计器，点击「预览」按钮重新打开本页。"
        />
      </div>
    );
  }

  return (
    <ExcelPreview
      layoutData={layoutData}
      open
      standalone
      readOnly={readOnly}
      nodeId={nodeId}
      nodePermission={nodePermission}
      initialValues={(window as any).__approvalFormData || renderPkg?.dataJson || {}}
      onSubmit={async (values, _errors, valid) => {
        if (!valid) return; // 前端必填矩阵未通过，已标红
        try {
          // 前端校验通过后再由服务端按节点必填矩阵复核（前端校验不可信）
          await validateForm({
            instanceId: renderPkg?.instanceId ?? Number(params.instanceId),
            nodeKey: renderPkg?.nodeKey ?? params.nodeId ?? undefined,
            // 审批态数据来自渲染包 dataJson，叠加用户本次编辑值
            formData: { ...(renderPkg?.dataJson || {}), ...values },
          });
          message.success('服务端校验通过');
        } catch (e: any) {
          message.error(`服务端校验未通过：${e?.msg || e?.message || '请检查必填项'}`);
        }
      }}
      onClose={handleClose}
      title="表单预览"
    />
  );
};

const ExcelPreviewPage: React.FC = () => (
  <App>
    <ExcelPreviewPageContent />
  </App>
);

export default ExcelPreviewPage;
