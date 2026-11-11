import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Input, Select, Switch, Button, Space, Tooltip, Typography, Empty, Segmented, Tag, message } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  FORMULA_FUNCTION_GROUPS,
  FORMULA_TRIGGER_OPTIONS,
  validateFormulaExpression,
  type FormulaConfig,
  type FormulaFunctionDef,
  type CustomFormula,
} from '../utils/formulaUtils';

const { Text } = Typography;

/** 公式弹框「数据」面板的字段项：scope 用于按主表/明细表/标签页分组（对齐 E9 WeaTransferList） */
export interface FormulaDataField {
  label: string;
  value: string;
  scope: string;
}

export interface FormulaDialogPayload {
  /** 主公式表达式（= 列表第 1 条） */
  expr: string;
  /** 主公式配置（= 列表第 1 条，不含 expr） */
  cfg: FormulaConfig;
  /** 全量公式列表（一格多公式，index 0 = 主公式，其 expr 即 cell.f） */
  list?: FormulaConfig[];
}

interface FormulaDialogProps {
  open: boolean;
  /** 「选择单元格」期间临时隐藏（不卸载，保留已编辑内容） */
  hidden?: boolean;
  /** 初始值（编辑已有公式格时回显） */
  initial?: { expr: string; cfg: FormulaConfig; list?: FormulaConfig[] } | null;
  /** 目标字段下拉（表单字段定义） */
  fieldOptions: { label: string; value: string }[];
  /** 数据面板字段（按 scope 分组） */
  dataFields?: FormulaDataField[];
  onCancel: () => void;
  onSave: (payload: FormulaDialogPayload) => void;
  onClear: () => void;
  /** 选择单元格：收起弹框让玩家点画布，结果通过 onCellPicked 回填 */
  onPickCell?: () => void;
  /** 画布点选完成后回填的引用文本（由父组件置入，回填后置空） */
  pickedRef?: string | null;
  /** 已定义的自定义函数（从后端 workflow_formula 加载），合并进函数面板 */
  customFunctions?: CustomFormula[];
  /** 打开「自定义函数管理」弹框 */
  onManageCustomFunctions?: () => void;
}

/** E9 计算符：+ - > ≥ = × ÷ < ≤ ≠ ( ) % 空格 + 退格 */
const OPERATORS = ['+', '-', '*', '/', '>', '>=', '=', '<', '<=', '<>', '(', ')', ',', ' '];

const HELP = [
  '表达式以 = 开头，例如：=SUM(A1:A10)',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: 公式里的字段引用语法（${字段名}）不是模板字符串
  '字段用 ${字段名} 引用，例如：=${借款金额}*0.05',
  '运算符：+ - * / > >= = < <= <> ( ) ,',
  '支持多行；每行一条赋值表达式',
].join('\n');

/** 把一条公式配置拆成「表达式 + 其余配置」（expr 单独维护，避免与配置项混淆） */
const splitFormulaCfg = (item: any): { expr: string; cfg: FormulaConfig } => {
  const { expr, ...rest } = (item || {}) as any;
  return { expr: String(expr || ''), cfg: rest as FormulaConfig };
};

/**
 * E9 风格「插入公式」弹框（轻量版）。
 *
 * 对齐 `FormularDialog.js`(830×690 WeaDialog) 的布局：
 *  - 顶部：公式名称 / 目标字段 / 触发动作 / 金额大写
 *  - 中部：多行表达式编辑区 + 14 个计算符按钮 + 语法帮助 + 选择单元格
 *  - 底部左「数据」面板（按主表/明细表/标签页分组 + 搜索 + 双击插入字段引用）
 *  - 底部右「函数」面板（分类 + 搜索 + 说明 + 双击插入函数）
 *  - 保存前校验（非空 / = 开头 / 括号匹配），底部保存 / 清除 / 取消
 *
 * 表达式口径：Univer 原生 =SUM(A1:A10) 为主，另支持 ${字段名} 字段引用。
 */
const FormulaDialog: React.FC<FormulaDialogProps> = ({
  open,
  hidden = false,
  initial,
  fieldOptions,
  dataFields = [],
  onCancel,
  onSave,
  onClear,
  onPickCell,
  pickedRef,
  customFunctions = [],
  onManageCustomFunctions,
}) => {
  const [expr, setExpr] = useState('');
  const [cfg, setCfg] = useState<FormulaConfig>({});
  // 公式列表（一格多公式，对齐 E9 workflow_formula_htmllayout）：index 0 = 主公式
  const [list, setList] = useState<FormulaConfig[]>([]);
  // 当前正在编辑的公式在列表中的下标
  const [activeIdx, setActiveIdx] = useState(0);
  const [fieldScope, setFieldScope] = useState<string>('全部');
  const [fieldSearch, setFieldSearch] = useState('');
  const [funGroup, setFunGroup] = useState<string>('all');
  const [funSearch, setFunSearch] = useState('');
  const textRef = useRef<any>(null);
  // 只在「关闭 → 打开」的上升沿回显初始值：父组件每次渲染都会新建 initial 对象，
  // 若把它放进依赖数组，用户编辑过程中任何父级重渲染都会把表达式/配置重置掉。
  const wasOpenRef = useRef(false);
  // 画布点选回填去重标记：声明必须早于引用它的 effect，避免 TDZ
  const lastPickedRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      // 公式列表：优先用初始列表（旧数据无列表时按单条公式构造）
      const raw = Array.isArray(initial?.list) ? initial?.list : [];
      const base: FormulaConfig[] = raw.length
        ? raw.map((c) => ({ ...c }))
        : [{ ...(initial?.cfg || {}), expr: initial?.expr || '=' }];
      setList(base);
      setActiveIdx(0);
      const first = splitFormulaCfg(base[0] || {});
      setExpr(first.expr || initial?.expr || '=');
      setCfg(first.cfg);
      setFieldScope('全部');
      setFieldSearch('');
      setFunGroup('all');
      setFunSearch('');
      // 新一轮打开重置去重标记，否则再次点选同一个单元格引用会被误判为重复
      lastPickedRef.current = null;
    }
    wasOpenRef.current = open;
  }, [open]);

  // 画布点选回填：把引用插到光标处。用 ref 去重，避免父组件重渲染时重复插入同一引用。
  useEffect(() => {
    if (!open || !pickedRef || pickedRef === lastPickedRef.current) return;
    lastPickedRef.current = pickedRef;
    insertAtCursor(pickedRef);
  }, [pickedRef, open]);

  const insertAtCursor = (text: string) => {
    const ta = textRef.current?.resizableTextArea?.textArea || textRef.current?.textarea;
    if (!ta) {
      setExpr((prev) => prev + text);
      return;
    }
    const start = ta.selectionStart ?? expr.length;
    const end = ta.selectionEnd ?? expr.length;
    const next = expr.slice(0, start) + text + expr.slice(end);
    setExpr(next);
    requestAnimationFrame(() => {
      try {
        ta.focus();
        const pos = start + text.length;
        ta.setSelectionRange(pos, pos);
      } catch { /* 光标恢复失败不影响内容 */ }
    });
  };

  const backspace = () => {
    const ta = textRef.current?.resizableTextArea?.textArea || textRef.current?.textarea;
    const start = ta?.selectionStart ?? expr.length;
    const end = ta?.selectionEnd ?? expr.length;
    if (start !== end) {
      setExpr(expr.slice(0, start) + expr.slice(end));
    } else if (start > 0) {
      setExpr(expr.slice(0, start - 1) + expr.slice(start));
      requestAnimationFrame(() => {
        try { ta?.focus(); ta?.setSelectionRange(start - 1, start - 1); } catch { /* ignore */ }
      });
    }
  };

  const patchCfg = (patch: Partial<FormulaConfig>) => setCfg((prev) => ({ ...prev, ...patch }));

  // ── 公式列表操作（一格多公式）────────────────────────────────────────────
  /** 把编辑缓冲写回列表当前项 */
  const commitActive = () => {
    setList((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      next[activeIdx] = { ...(next[activeIdx] || {}), ...cfg, expr };
      return next;
    });
  };

  /** 切换正在编辑的公式 */
  const selectFormula = (idx: number) => {
    if (idx === activeIdx) return;
    commitActive();
    const target = splitFormulaCfg(list[idx] || {});
    setActiveIdx(idx);
    setExpr(target.expr || '=');
    setCfg(target.cfg);
  };

  /** 新增一条公式 */
  const addFormula = () => {
    commitActive();
    const nextIdx = list.length;
    setList((prev) => [...prev, { expr: '=', name: '' }]);
    setActiveIdx(nextIdx);
    setExpr('=');
    setCfg({});
  };

  /** 删除一条公式 */
  const removeFormula = (idx: number) => {
    const nextLen = Math.max(list.length - 1, 0);
    setList((prev) => prev.filter((_, i) => i !== idx));
    if (idx < activeIdx) {
      setActiveIdx((p) => Math.max(p - 1, 0));
    } else if (idx === activeIdx) {
      const ni = Math.min(activeIdx, Math.max(nextLen - 1, 0));
      setActiveIdx(ni);
      if (nextLen === 0) {
        // 删空：清空编辑缓冲（列表已空，保存时会提示「至少添加一条公式」）
        setExpr('=');
        setCfg({});
        return;
      }
      const target = splitFormulaCfg(list[ni] || list[idx] || {});
      setExpr(target.expr || '=');
      setCfg(target.cfg);
    }
  };

  /** 上移 / 下移一条公式（改变主公式顺序） */
  const moveFormula = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= list.length) return;
    setList((prev) => {
      const next = [...prev];
      const tmp = next[idx];
      next[idx] = next[to];
      next[to] = tmp;
      return next;
    });
    if (activeIdx === idx) setActiveIdx(to);
    else if (activeIdx === to) setActiveIdx(idx);
  };

  const scopes = useMemo(() => {
    const set = new Set(dataFields.map((f) => f.scope));
    return ['全部', ...Array.from(set)];
  }, [dataFields]);

  const filteredFields = useMemo(() => {
    const kw = fieldSearch.trim().toLowerCase();
    return dataFields.filter(
      (f) =>
        (fieldScope === '全部' || f.scope === fieldScope) &&
        (!kw || f.label.toLowerCase().includes(kw) || f.value.toLowerCase().includes(kw)),
    );
  }, [dataFields, fieldScope, fieldSearch]);

  const allFunctionGroups = useMemo(() => {
    const base = FORMULA_FUNCTION_GROUPS.map((g) => ({ ...g, items: g.items }));
    const customItems = (customFunctions || []).map<FormulaFunctionDef>((f) => ({
      name: f.name,
      group: 'custom',
      desc: f.formulaDesc || f.fnCode || '',
    }));
    if (customItems.length) {
      base.push({ group: 'custom', label: '自定义函数', items: customItems });
    }
    return base;
  }, [customFunctions]);


  const filteredFunctions = useMemo(() => {
    const kw = funSearch.trim().toLowerCase();
    const groups = funGroup === 'all'
      ? allFunctionGroups
      : allFunctionGroups.filter((g) => g.group === funGroup);
    return groups.flatMap((g) => g.items).filter(
      (f) => !kw || f.name.toLowerCase().includes(kw) || f.desc.toLowerCase().includes(kw),
    );
  }, [funGroup, funSearch, allFunctionGroups]);

  const doSave = () => {
    // 提交前把编辑缓冲写回列表当前项
    const finalList = list.map((c, i) => (i === activeIdx ? { ...c, ...cfg, expr } : { ...c }));
    if (!finalList.length) {
      message.warning('请至少添加一条公式');
      return;
    }
    // 逐条校验（空 / = 开头 / 括号匹配）
    for (let i = 0; i < finalList.length; i++) {
      const err = validateFormulaExpression(finalList[i]?.expr || '');
      if (err) {
        message.warning(`第 ${i + 1} 条公式：${err}`);
        return;
      }
    }
    const main = splitFormulaCfg(finalList[0]);
    onSave({ expr: main.expr.trim(), cfg: main.cfg, list: finalList });
  };

  return (
    <Modal
      title="插入公式"
      open={open}
      onCancel={onCancel}
      width={900}
      // 选择单元格期间：只隐藏弹框本体并去掉遮罩，让画布可点击；组件不卸载以保留编辑内容
      rootClassName={hidden ? 'formula-dialog-picking' : undefined}
      mask={!hidden}
      style={hidden ? { visibility: 'hidden' } : undefined}
      // 与承载设计器的 Modal 一致：关闭 focus trap，避免嵌套弹层焦点互抢
      focusable={{ trap: false }}
      footer={
        <Space>
          <Button danger onClick={onClear}>清除</Button>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" onClick={doSave}>保存</Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── 公式列表（一格多公式，对齐 E9 workflow_formula_htmllayout） ── */}
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text strong style={{ fontSize: 12 }}>
              公式列表（一个单元格可配置多条公式，第 1 条为主公式）
            </Text>
            <Button size="small" type="link" icon={<PlusOutlined />} onClick={addFormula}>
              新增公式
            </Button>
          </div>
          <div style={{ maxHeight: 150, overflow: 'auto', marginTop: 6 }}>
            {list.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无公式，点击「新增公式」添加" />
            ) : (
              list.map((c, i) => {
                const active = i === activeIdx;
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: 公式列表按下标标识，顺序即语义
                    key={i}
                    onClick={() => selectFormula(i)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 6px',
                      cursor: 'pointer',
                      fontSize: 12,
                      borderRadius: 4,
                      background: active ? '#e6f4ff' : 'transparent',
                    }}
                  >
                    <Tag color={active ? 'blue' : 'default'}>{i === 0 ? '主' : i + 1}</Tag>
                    <Text
                      style={{
                        width: 110,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.name || '（未命名）'}
                    </Text>
                    <Text
                      code
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.expr || '='}
                    </Text>
                    {c.destField ? <Tag>{c.destField}</Tag> : null}
                    <Button
                      size="small"
                      type="text"
                      icon={<ArrowUpOutlined />}
                      disabled={i === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveFormula(i, -1);
                      }}
                    />
                    <Button
                      size="small"
                      type="text"
                      icon={<ArrowDownOutlined />}
                      disabled={i === list.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveFormula(i, 1);
                      }}
                    />
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFormula(i);
                      }}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── 顶部：公式名称 / 目标字段 / 触发动作 / 金额大写 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>公式名称</Text>
            <Input
              size="small"
              placeholder="例如：合计金额"
              value={cfg.name || ''}
              onChange={(e) => patchCfg({ name: e.target.value })}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>目标字段（结果写入）</Text>
            <Select
              size="small"
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="选择公式结果要写入的字段"
              value={cfg.destField}
              options={fieldOptions}
              onChange={(v) => patchCfg({ destField: v })}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>触发动作</Text>
            <Select
              size="small"
              style={{ width: '100%' }}
              placeholder="值改变 / 载入时"
              value={cfg.trigger}
              options={FORMULA_TRIGGER_OPTIONS}
              onChange={(v) => patchCfg({ trigger: v })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 14 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>金额大写</Text>
            <Switch size="small" checked={!!cfg.chinese} onChange={(v) => patchCfg({ chinese: v })} />
            <Text type="secondary" style={{ fontSize: 12 }}>公式描述</Text>
            <Input
              size="small"
              placeholder="可选"
              value={cfg.desc || ''}
              onChange={(e) => patchCfg({ desc: e.target.value })}
            />
          </div>
        </div>

        {/* ── 中部：表达式 + 计算符 ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong style={{ fontSize: 12 }}>
              公式内容
              {list.length > 0 ? `（第 ${activeIdx + 1} 条 / 共 ${list.length} 条）` : ''}
            </Text>
            <Space size={4}>
              {onPickCell && <Button size="small" onClick={onPickCell}>选择单元格</Button>}
              <Tooltip title={<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{HELP}</pre>}>
                <Button size="small" type="link">语法说明</Button>
              </Tooltip>
            </Space>
          </div>
          <Input.TextArea
            ref={textRef}
            rows={4}
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            // biome-ignore lint/suspicious/noTemplateCurlyInString: 公式里的字段引用语法（${字段名}）不是模板字符串
            placeholder={'=SUM(A1:A10)\n=${借款金额}*0.05'}
            style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 13 }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {OPERATORS.map((op) => (
              <Button key={op} size="small" style={{ minWidth: 30 }} onClick={() => insertAtCursor(op)}>
                {op === ' ' ? '␣' : op}
              </Button>
            ))}
            <Button size="small" onClick={backspace}>← 退格</Button>
          </div>
        </div>

        {/* ── 底部：数据面板 / 函数面板 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}>
            <Text strong style={{ fontSize: 12 }}>数据</Text>
            <div style={{ display: 'flex', gap: 6, margin: '6px 0' }}>
              <Segmented
                size="small"
                value={fieldScope}
                onChange={(v) => setFieldScope(String(v))}
                options={scopes}
                style={{ maxWidth: '100%', overflowX: 'auto' }}
              />
            </div>
            <Input.Search
              size="small"
              allowClear
              placeholder="搜索字段"
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
            />
            <div style={{ maxHeight: 170, overflow: 'auto', marginTop: 6 }}>
              {filteredFields.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无匹配字段" />
              ) : filteredFields.map((f) => (
                <Tooltip key={`${f.scope}_${f.value}`} title={`双击插入 \${${f.value}}`}>
                  <div
                    onDoubleClick={() => insertAtCursor(`\${${f.value}}`)}
                    style={{
                      padding: '3px 6px', cursor: 'pointer', fontSize: 12,
                      borderRadius: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                    className="formula-field-row"
                  >
                    <Text type="secondary" style={{ fontSize: 11 }}>[{f.scope}] </Text>{f.label}
                  </div>
                </Tooltip>
              ))}
            </div>
          </div>

          <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text strong style={{ fontSize: 12 }}>函数</Text>
              <Button type="link" size="small" onClick={onManageCustomFunctions}>
                管理自定义函数
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 6, margin: '6px 0' }}>
              <Select
                size="small"
                style={{ flex: 1 }}
                value={funGroup}
                onChange={setFunGroup}
                options={[
                  { label: '全部函数', value: 'all' },
                  ...allFunctionGroups.map((g) => ({ label: g.label, value: g.group })),
                ]}
              />
              <Input.Search
                size="small"
                allowClear
                style={{ flex: 1 }}
                placeholder="搜索函数"
                value={funSearch}
                onChange={(e) => setFunSearch(e.target.value)}
              />
            </div>
            <div style={{ maxHeight: 170, overflow: 'auto', marginTop: 6 }}>
              {filteredFunctions.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无匹配函数" />
              ) : filteredFunctions.map((f) => (
                <Tooltip key={f.name} title={f.desc}>
                  <div
                    onDoubleClick={() => insertAtCursor(`${f.name}()`)}
                    style={{
                      padding: '3px 6px', cursor: 'pointer', fontSize: 12,
                      borderRadius: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                    className="formula-field-row"
                  >
                    <Text code>{f.name}</Text>
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>{f.desc}</Text>
                  </div>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default FormulaDialog;
