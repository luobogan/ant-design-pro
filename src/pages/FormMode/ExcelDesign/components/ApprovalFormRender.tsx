import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Result, Spin } from 'antd';
import ExcelPreview, { NodePermissionResolver } from './ExcelPreview';
import { collectFieldValues, expandInitialValues } from '../utils/collectFieldValues';
import { renderForm, renderFormPreview } from '@/services/workflow';

/**
 * 明细表字段筛选：按节点「显示时」规则（detailFilters）隐藏不匹配的明细行。
 * 对齐 ecology「明细表数据根据操作者筛选显示」。纯数据变换，永不抛异常：
 * 当布局缺该明细表或规则字段不在布局内时，安全跳过该规则/明细表，不误删数据。
 *
 * 数据键形如 `dt{idx}__r{n}__{sheetId}__{row}__{col}`；规则按 (dt, fieldName) 命中单元格坐标。
 */
const applyDetailFilter = (
  dataJson: Record<string, any> | undefined,
  filters: any[] | undefined,
  layout: any,
): Record<string, any> => {
  if (!dataJson || !filters || !filters.length || !layout) return dataJson || {};

  // 1) 明细表 fieldName → 单元格坐标（取首个命中字段格）
  const fieldMap = new Map<number, Map<string, { sid: string; r: string; c: string }>>();
  const detailTables = layout?.detailTables || {};
  Object.keys(detailTables).forEach((dk) => {
    const idx = Number(dk);
    const sub = detailTables[dk];
    const sheets = sub?.sheets;
    if (!sheets) return;
    const m = new Map<string, { sid: string; r: string; c: string }>();
    (sub.sheetOrder || Object.keys(sheets)).forEach((sid: string) => {
      const sheet = sheets[sid];
      const cellData = sheet?.cellData || {};
      Object.entries(cellData).forEach(([rk, rowData]) => {
        Object.entries((rowData as any) || {}).forEach(([ck, cell]) => {
          const meta = (cell as any)?.fieldMeta;
          if (!meta || !meta.fieldName) return;
          const t = meta.cellType;
          if (t != null && t !== '' && t !== 'field') return;
          if (!m.has(String(meta.fieldName))) {
            m.set(String(meta.fieldName), { sid: String(sheet.id ?? sid), r: rk, c: ck });
          }
        });
      });
    });
    fieldMap.set(idx, m);
  });

  // 2) 规则按明细表分组
  const rulesByDt = new Map<number, any[]>();
  filters.forEach((f) => {
    const dt = Number(f.dtIndex);
    if (!rulesByDt.has(dt)) rulesByDt.set(dt, []);
    rulesByDt.get(dt)!.push(f);
  });

  const out: Record<string, any> = { ...dataJson };
  rulesByDt.forEach((rules, dt) => {
    const fm = fieldMap.get(dt);
    if (!fm) return; // 布局无该明细表 → 无法判定，安全跳过
    const rowSet = new Set<number>();
    Object.keys(out).forEach((k) => {
      const mm = new RegExp(`^dt${dt}__r(\\d+)__`).exec(k);
      if (mm) rowSet.add(Number(mm[1]));
    });
    rowSet.forEach((n) => {
      const pass = rules.every((rule) => {
        const cell = fm.get(String(rule.fieldName));
        if (!cell) return true; // 规则字段不在布局内：视为不约束该行，避免误删
        const v = out[`dt${dt}__r${n}__${cell.sid}__${cell.r}__${cell.c}`];
        const targets = String(rule.compareValue ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (!targets.length) return true;
        const sv = v == null ? '' : String(v);
        const hit = targets.includes(sv);
        const contains = targets.some((t) => sv.includes(t));
        switch (Number(rule.compareType)) {
          case 1: return hit; // 等于
          case 2: return !hit; // 不等于
          case 3: return contains; // 包含
          case 4: return !contains; // 不包含
          default: return hit;
        }
      });
      if (!pass) {
        Object.keys(out).forEach((k) => {
          if (new RegExp(`^dt${dt}__r${n}__`).test(k)) delete out[k];
        });
      }
    });
  });
  return out;
};

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
   * 是否来自「测试入口」（方案 §6.4 C8 + C12）。
   * 测试面板 / 真人模式必须传 true —— 否则后端对 is_test=1 的实例拒绝渲染；
   * 生产办理页与发起页**不传**。
   */
  testMode?: boolean;
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
  testMode,
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
      let layout: any = null;
      try {
        layout = pkg.layoutJson ? JSON.parse(pkg.layoutJson) : null;
      } catch {
        layout = null;
      }
      setLayoutData(layout);
      // 明细表「显示时」字段筛选：隐藏不匹配规则的明细行（不影响原始 dataJson 之外的数据）
      setValues(applyDetailFilter(pkg.dataJson, pkg.detailFilters, layout));
      // 构建节点权限解析器：B5 行级按「scope|field」登记，解析时 dt{idx}_r{row} → dt{idx} → main 回退
      const permByScopeField = new Map<string, any>();
      (pkg.fieldPerms || []).forEach((p: any) => {
        permByScopeField.set(`${p.scope || 'main'}|${p.fieldName}`, p);
      });
      const scopeChain = (scope?: string): string[] => {
        const s = scope || 'main';
        if (/^dt\d+_r\d+$/.test(s)) return [s, s.replace(/_r\d+$/, ''), 'main'];
        if (/^dt\d+$/.test(s)) return [s, 'main'];
        return ['main'];
      };
      setNodePermission(() => (fieldName: string, scope?: string) => {
        for (const sc of scopeChain(scope)) {
          const p = permByScopeField.get(`${sc}|${fieldName}`);
          if (p) {
            // 三维度（visible/editable/required）为权威值；三者全缺省视为老数据，回退到 perm 兼容列
            const legacy = p.visible == null && p.editable == null && p.required == null;
            const visible = legacy ? p.perm !== 0 : !!p.visible;
            const editable = legacy ? p.perm === 2 || p.perm === 3 : !!p.editable;
            const required = legacy ? p.perm === 3 : !!p.required;
            return { readonly: !editable, required, hidden: !visible };
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
    // testMode 透传：测试面板 / 真人模式要渲染 is_test=1 的实例；生产办理页不传 → 后端拒绝渲染测试单
    renderForm(instanceId, taskId, nodeKey, testMode)
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
  }, [instanceId, taskId, nodeKey, isPreview, previewDefId, previewFormId, testMode]);

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
          // 具体缺失哪些字段已由 ExcelPreview 的校验提示（带字段名）给出，这里不再重复弹一次
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
