import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { App, Result, Spin } from 'antd';
import ExcelPreview, { NodePermissionResolver } from './ExcelPreview';
import { collectFieldValues, expandInitialValues } from '../utils/collectFieldValues';
import { renderForm, renderFormPreview } from '@/services/workflow';

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
  /** 隐藏 ExcelPreview 自带头部/操作栏，由外层统一提供节点栏与操作按钮（嵌套到「流程表单面板」时用） */
  hideHeader?: boolean;
  /** 渲染包加载完成回调：外层据此渲染「节点表单情况」栏与操作按钮 */
  onPackage?: (pkg: any) => void;
  /**
   * 表单值变化回调（可编辑态使用）：外层据此实时读取用户填写的值。
   * 用于流程测试页「手动测试」——提交时把用户改过的值作为流程变量下发引擎。
   */
  onValuesChange?: (values: Record<string, any>) => void;
  /**
   * 预览模式（无需实例）：传入流程定义ID + 表单ID 即可渲染该节点的流程表单布局，
   * 不创建测试实例；与 `instanceId` 互斥。用于测试页「选好流程/发起人即打开表单查看」。
   */
  previewDefId?: number | string;
  previewFormId?: number | string;
  /**
   * 布局级必填校验**通过后**的回调。
   * 由外层自绘「提交」按钮时经 ref.submit() 触发；校验不通过不会回调。
   *
   * @param values      原始表单值（key = 单元格坐标 `{sheetId}__{row}__{col}`）
   * @param fieldValues 同一份值的「字段名 → 值」（供流程变量/出口条件 UEL 使用）
   */
  onSubmit?: (values: Record<string, any>, fieldValues: Record<string, any>) => void;
}

/** 命令式句柄：外层用自绘按钮触发与内置按钮同样的必填校验 */
export interface ApprovalFormHandle {
  /** 跑布局级必填校验；通过则回调 onSubmit(values) */
  submit: () => void;
}

const ApprovalFormRenderContent = React.forwardRef<ApprovalFormHandle, ApprovalFormRenderProps>(({
  instanceId,
  taskId,
  nodeKey,
  readOnly = true,
  hideHeader = false,
  onPackage,
  onValuesChange,
  onSubmit,
  previewDefId,
  previewFormId,
}, ref) => {
  /** 内层 ExcelPreview 的命令式句柄（ref.submit → 必填校验 → onSubmit 回调） */
  const previewRef = useRef<any>(null);
  useImperativeHandle(ref, () => ({ submit: () => previewRef.current?.submit?.() }), []);
  const [layoutData, setLayoutData] = useState<any>(null);
  const [nodePermission, setNodePermission] = useState<NodePermissionResolver | undefined>(undefined);
  const [values, setValues] = useState<Record<string, any>>({});
  const [pkgNodeKey, setPkgNodeKey] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const { message } = App.useApp();

  // onPackage 放进 ref：父组件常传内联箭头函数，若进 useEffect 依赖会每次重渲染都重拉渲染包
  const onPackageRef = useRef<ApprovalFormRenderProps['onPackage']>(undefined);
  onPackageRef.current = onPackage;

  const isPreview = previewDefId != null && previewFormId != null;

  useEffect(() => {
    let alive = true;
    // 把渲染包转换成组件状态（render 与 preview 共用同一套解析逻辑）
    const applyPkg = (res: any) => {
      const pkg = res?.data;
      if (!alive) return;
      if (!pkg) {
        setLayoutData(null);
        onPackageRef.current?.(null);
        return;
      }
      setPkgNodeKey(pkg.nodeKey);
      onPackageRef.current?.(pkg);
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
    };

    // 预览模式：按 流程定义 + 表单 + 节点 取布局，不创建实例
    if (isPreview) {
      setLoading(true);
      setDone(false);
      renderFormPreview(previewDefId as any, previewFormId as any, nodeKey)
        .then(applyPkg)
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
    }

    // 无效实例 ID（-1 / 0 / 空）不发起渲染请求：避免后端因「实例不存在」抛业务异常，
    // 被框架（BladeRestExceptionTranslator 对 ServiceException 标 BAD_REQUEST）映射为 HTTP 400 噪音。
    if (instanceId == null || Number(instanceId) <= 0) {
      setLoading(false);
      setDone(true);
      setLayoutData(null);
      onPackageRef.current?.(null);
      return;
    }
    setLoading(true);
    setDone(false);
    renderForm(instanceId, taskId, nodeKey)
      .then(applyPkg)
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
  }, [instanceId, taskId, nodeKey, isPreview, previewDefId, previewFormId]);

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
      ref={previewRef}
      layoutData={layoutData}
      open
      standalone
      hideHeader={hideHeader}
      readOnly={readOnly}
      nodeId={nodeKey || pkgNodeKey}
      nodePermission={nodePermission}
      // 快照可能是坐标键（Excel 路径）或字段名键（旧 FieldRenderer/测试页场景表单），
      // 后者补成坐标键才能回显
      initialValues={expandInitialValues(layoutData, values)}
      title="流程表单"
      onValuesChange={onValuesChange}
      onSubmit={async (vals, _errors, valid) => {
        if (!valid) {
          message.warning('必填项未填写完整');
          return;
        }
        // 校验通过：交给外层决定后续（发起 / 提交审批）。
        // 同时给出「字段名 → 值」，让出口条件 UEL（如 ${amount > 1000}）拿得到变量。
        onSubmit?.(vals, collectFieldValues(layoutData, vals));
      }}
    />
  );
});

const ApprovalFormRender = React.forwardRef<ApprovalFormHandle, ApprovalFormRenderProps>(
  (props, ref) => (
    <App>
      <ApprovalFormRenderContent ref={ref} {...props} />
    </App>
  ),
);

export default ApprovalFormRender;
