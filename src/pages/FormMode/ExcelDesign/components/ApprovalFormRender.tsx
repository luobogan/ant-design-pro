import React, { useEffect, useState } from 'react';
import { App, Result, Spin } from 'antd';
import ExcelPreview, { NodePermissionResolver } from './ExcelPreview';
import { renderForm } from '@/services/workflow';

/**
 * 审批态「真实流程表单」渲染（可内嵌）
 *
 * 把 `ExcelPreviewPage` 里的**审批态渲染**分支抽成可复用组件：
 * 按 `instanceId`（+ 可选 taskId）从服务端 `GET /form/render` 拉渲染包
 * （布局 layoutJson + 业务数据 dataJson + 节点字段权限 fieldPerms），
 * 用权限函数驱动 `ExcelPreview` 的字段可见 / 只读 / 必填，并回填业务数据。
 *
 * 用途：流程测试页右侧展示真实流程表单界面（对齐 ecology「自动测试」页右侧的表单）。
 *
 * 注：以 `standalone` 渲染（不套 Modal），便于直接内嵌到任意面板 / 分栏中。
 */
export interface ApprovalFormRenderProps {
  /** 19 位雪花 ID：后端以字符串下发，务必保持字符串，转 number 会丢精度 */
  instanceId: string | number;
  taskId?: number;
  /** 传入则用它作为当前节点，否则用渲染包回传的 nodeKey */
  nodeKey?: string;
  /** 只读（默认 true：测试页仅展示） */
  readOnly?: boolean;
}

const ApprovalFormRenderContent: React.FC<ApprovalFormRenderProps> = ({
  instanceId,
  taskId,
  nodeKey,
  readOnly = true,
}) => {
  const [layoutData, setLayoutData] = useState<any>(null);
  const [nodePermission, setNodePermission] = useState<NodePermissionResolver | undefined>(undefined);
  const [values, setValues] = useState<Record<string, any>>({});
  const [pkgNodeKey, setPkgNodeKey] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const { message } = App.useApp();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setDone(false);
    renderForm(instanceId, taskId, nodeKey)
      .then((res: any) => {
        const pkg = res?.data;
        if (!alive) return;
        if (!pkg) {
          setLayoutData(null);
          return;
        }
        setPkgNodeKey(pkg.nodeKey);
        setValues(pkg.dataJson || {});
        try {
          setLayoutData(pkg.layoutJson ? JSON.parse(pkg.layoutJson) : null);
        } catch {
          setLayoutData(null);
        }
        // 构建节点权限解析器：B5 行级按「scope|field」登记，解析时 dt{idx}_r{row} → dt{idx} → main 回退
        const permByScopeField = new Map<string, number>();
        (pkg.fieldPerms || []).forEach((p: any) => {
          permByScopeField.set(`${p.scope || 'main'}|${p.fieldName}`, p.perm);
        });
        const scopeChain = (scope?: string): string[] => {
          const s = scope || 'main';
          if (/^dt\d+_r\d+$/.test(s)) return [s, s.replace(/_r\d+$/, ''), 'main'];
          if (/^dt\d+$/.test(s)) return [s, 'main'];
          return ['main'];
        };
        setNodePermission(() => (fieldName: string, scope?: string) => {
          for (const sc of scopeChain(scope)) {
            const perm = permByScopeField.get(`${sc}|${fieldName}`);
            if (perm != null) {
              return { readonly: perm === 1, required: perm === 3, hidden: perm === 0 };
            }
          }
          return undefined;
        });
      })
      .catch(() => {
        if (alive) setLayoutData(null);
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
          setDone(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [instanceId, taskId, nodeKey]);

  if (loading || !done) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (!layoutData) {
    return (
      <Result
        status="info"
        title="没有可渲染的表单数据"
        subTitle="该实例暂无节点布局，请先在「表单内容 → 设计」中生成布局后重试。"
      />
    );
  }

  return (
    <ExcelPreview
      layoutData={layoutData}
      open
      standalone
      readOnly={readOnly}
      nodeId={nodeKey || pkgNodeKey}
      nodePermission={nodePermission}
      initialValues={values}
      title="流程表单"
      onSubmit={async (_values, _errors, valid) => {
        if (!valid) {
          message.warning('必填项未填写完整');
        }
      }}
    />
  );
};

const ApprovalFormRender: React.FC<ApprovalFormRenderProps> = (props) => (
  <App>
    <ApprovalFormRenderContent {...props} />
  </App>
);

export default ApprovalFormRender;
