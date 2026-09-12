import React from 'react';
import { Button, Input, Select, Space } from 'antd';

/**
 * 出口条件可视化构造器。
 *
 * 由「表单字段 + 运算符 + 值」组合出 BPMN 条件表达式（conditionExpr）与中文描述（conditionCn）。
 * 支持多行，行间以 && 连接；字段来自流程绑定表单的字段定义（见 fieldDefinitionApi）。
 */

export interface CondRow {
  field: string;
  op: string;
  value: string;
}

export interface CondField {
  /** 限定字段名（主表 fieldName；明细表 dt{idx}.fieldName） */
  key: string;
  label: string;
}

export const COND_OPS = [
  { value: '>', label: '大于' },
  { value: '>=', label: '大于等于' },
  { value: '<', label: '小于' },
  { value: '<=', label: '小于等于' },
  { value: '==', label: '等于' },
  { value: '!=', label: '不等于' },
  { value: 'contains', label: '包含' },
];

const OP_CN: Record<string, string> = {
  '>': '大于',
  '>=': '大于等于',
  '<': '小于',
  '<=': '小于等于',
  '==': '等于',
  '!=': '不等于',
  contains: '包含',
};

const isNumberLike = (v: string) => v !== '' && !Number.isNaN(Number(v));

/** 由条件行生成条件表达式与中文描述 */
export function buildCondExpr(rows: CondRow[]): { expr: string; cn: string } {
  const valid = (rows || []).filter((r) => r.field && r.op && r.value !== '');
  if (valid.length === 0) return { expr: '', cn: '' };
  const exprParts: string[] = [];
  const cnParts: string[] = [];
  valid.forEach((r) => {
    if (r.op === 'contains') {
      exprParts.push(`${r.field}.contains('${r.value}')`);
      cnParts.push(`${r.field} 包含 "${r.value}"`);
    } else {
      const val = isNumberLike(r.value) ? r.value : `'${r.value}'`;
      exprParts.push(`${r.field} ${r.op} ${val}`);
      cnParts.push(`${r.field} ${OP_CN[r.op] || r.op} ${r.value}`);
    }
  });
  return { expr: `\${${exprParts.join(' && ')}}`, cn: `当 ${cnParts.join(' 且 ')}` };
}

/** 尽力从表达式反解条件行（仅支持本构造器生成的形态，解析失败返回空） */
export function parseCondExpr(expr?: string): CondRow[] {
  if (!expr) return [];
  const m = expr.match(/^\$\{([\s\S]*)\}$/);
  const body = m ? m[1] : expr;
  return body
    .split('&&')
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => {
      const cm = seg.match(/^([\w.]+)\.contains\(['"](.*)['"]\)$/);
      if (cm) return { field: cm[1], op: 'contains', value: cm[2] } as CondRow;
      const mm = seg.match(/^([\w.]+)\s*(>=|<=|==|!=|>|<)\s*(.*)$/);
      if (mm) {
        const raw = mm[3].trim().replace(/^['"]|['"]$/g, '');
        return { field: mm[1], op: mm[2], value: raw } as CondRow;
      }
      return null;
    })
    .filter(Boolean) as CondRow[];
}

export interface ConditionBuilderProps {
  rows: CondRow[];
  onChange: (rows: CondRow[]) => void;
  fields: CondField[];
}

const ConditionBuilder: React.FC<ConditionBuilderProps> = ({ rows, onChange, fields }) => {
  const update = (i: number, patch: Partial<CondRow>) => {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () =>
    onChange([...(rows || []), { field: fields[0]?.key || '', op: '>', value: '' }]);
  const remove = (i: number) => onChange((rows || []).filter((_, idx) => idx !== i));

  return (
    <div>
      {(rows || []).map((r, i) => (
        <Space key={i} style={{ marginBottom: 8 }} wrap>
          <Select
            style={{ width: 200 }}
            value={r.field || undefined}
            placeholder="表单字段"
            options={fields.map((f) => ({ value: f.key, label: f.label }))}
            onChange={(v) => update(i, { field: v })}
          />
          <Select
            style={{ width: 120 }}
            value={r.op}
            options={COND_OPS}
            onChange={(v) => update(i, { op: v })}
          />
          <Input
            style={{ width: 160 }}
            value={r.value}
            placeholder="比较值"
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <Button type="link" danger onClick={() => remove(i)}>
            删除
          </Button>
        </Space>
      ))}
      <Button type="dashed" block onClick={add} disabled={fields.length === 0}>
        + 添加条件
      </Button>
      {fields.length === 0 && (
        <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
          当前流程未绑定表单或表单无字段，暂无法可视化配置条件。
        </div>
      )}
    </div>
  );
};

export default ConditionBuilder;
