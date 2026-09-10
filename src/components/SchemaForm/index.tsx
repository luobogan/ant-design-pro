import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormInstance } from 'antd';
import { Button, Form, Input, InputNumber, Modal, Radio, Select, Switch, Table, message } from 'antd';
import type { FormField, FormFieldOption } from '@/services/workflow';

/**
 * SchemaForm —— 由后端下发的字段描述（condition）动态渲染表单。
 *
 * 对齐 ecology「路径设置」的 conditioninfo 机制：字段的增减、标签、必填、
 * 控件类型、选项、校验与提示均由后端决定，前端只做通用渲染。
 *
 * 支持的 control：input / textarea / number / select / switch / formSelect / browser / hidden
 */

export type DataSourceResolver = () => Promise<FormFieldOption[]> | FormFieldOption[];

export interface SchemaFormProps {
  fields: FormField[];
  form: FormInstance;
  /** 动态数据源：dataSource 键 -> 选项或取数函数 */
  dataSources?: Record<string, DataSourceResolver>;
  /** 浏览框数据源：dataSource 键 -> (关键字) => 选项列表（control=browser 时使用） */
  browserResolvers?: Record<string, (keyword?: string) => Promise<FormFieldOption[]> | FormFieldOption[]>;
  /** 浏览框刷新键：变化时重新拉取浏览框选项（如在弹窗中新增了选项后） */
  browserRefreshKey?: number | string;
  /** 点击字段「+」新增按钮 */
  onFieldAdd?: (field: FormField) => void;
  /** 动态数据源刷新键：变化时清空缓存并重新拉取（如在表设计器新建表单后） */
  dataSourceRefreshKey?: number | string;
  /** 点击数据源「刷新」按钮：参数为该字段的 dataSource 键 */
  onRefreshDataSource?: (dataSourceKey?: string) => void;
}

/**
 * formSelect 复合控件：表单类型（自定义/系统）+ 表单，值为 { type, id }。
 *
 * 对齐 ecology「对应表单」isBill 联动：切换表单类型时只展示同类型的表单，
 * 并清空已选表单，避免跨类型选中导致流程渲染时取不到表单布局。
 * 自定义表单额外提供「新建」入口，跳转表设计器（formmode/tabledesign）创建新表。
 */
const FormSelectControl: React.FC<{
  value?: { type?: any; id?: any };
  onChange?: (v: { type?: any; id?: any }) => void;
  typeOptions: FormFieldOption[];
  formOptions: FormFieldOption[];
  loading?: boolean;
  disabled?: boolean;
  /** 是否展示「新建」入口（仅自定义表单有效） */
  allowAdd?: boolean;
  onAdd?: () => void;
  /** 刷新表单列表（在表设计器新建表之后载入新数据） */
  onRefresh?: () => void;
}> = ({ value, onChange, typeOptions, formOptions, loading, disabled, allowAdd, onAdd, onRefresh }) => {
  const val = value || {};
  const currentType = String(val.type ?? 0);
  const isCustom = currentType === '0';

  // 只展示与当前表单类型一致的表单（自定义/系统）
  const matched = useMemo(
    () => formOptions.filter((o) => String(o.type ?? 0) === currentType),
    [formOptions, currentType],
  );

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Select
        style={{ width: 150 }}
        value={val.type}
        options={typeOptions}
        disabled={disabled}
        onChange={(t) => onChange?.({ type: t, id: undefined })}
      />
      <Select
        style={{ flex: 1 }}
        showSearch
        allowClear
        value={val.id}
        options={matched}
        loading={loading}
        disabled={disabled}
        placeholder={isCustom ? '请选择自定义表单' : '请选择系统表单'}
        notFoundContent={
          loading
            ? '加载中...'
            : isCustom
              ? '暂无自定义表单，可点击「新建」前往表设计器创建'
              : '暂无系统预置表单'
        }
        filterOption={(input, option) => String(option?.label ?? '').includes(input)}
        onChange={(id) => onChange?.({ ...val, id })}
      />
      {allowAdd && isCustom && (
        <Button onClick={() => onAdd?.()} title="前往表设计器新建自定义表">
          新建
        </Button>
      )}
      {onRefresh && (
        <Button onClick={() => onRefresh?.()} title="刷新表单列表">
          刷新
        </Button>
      )}
    </div>
  );
};

/**
 * 浏览框控件（对齐 ecology BrowserBean / 路径类型 wftype）。
 *
 * 点击弹出选择弹窗（表格 + 关键字搜索），选中后回写 id；编辑场景若已有值则自动
 * 拉取一次列表以解析显示标签。带「+」按钮时由 onAdd 回调（新增功能可在此挂载）。
 * 值统一以字符串存储（与后端 VARCHAR 列一致），避免 JSON 数字反序列化问题。
 */
const BrowserBox: React.FC<{
  value?: any;
  onChange?: (v: any) => void;
  field: FormField;
  resolver?: (keyword?: string) => Promise<FormFieldOption[]> | FormFieldOption[];
  onAdd?: (f: FormField) => void;
  refreshKey?: number | string;
}> = ({ value, onChange, field, resolver, onAdd, refreshKey }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<FormFieldOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');

  const labelMap = useMemo(() => {
    const m: Record<string, string> = {};
    options.forEach((o) => (m[String(o.value)] = o.label));
    return m;
  }, [options]);

  const load = useCallback(
    (kw?: string) => {
      if (!resolver) return;
      setLoading(true);
      Promise.resolve(typeof resolver === 'function' ? resolver(kw) : resolver)
        .then((list) => setOptions(list || []))
        .catch(() => message.error('加载浏览框数据失败'))
        .finally(() => setLoading(false));
    },
    [resolver],
  );

  // 编辑回显：有值但本地无对应标签时，拉一次全量解析
  useEffect(() => {
    if (value != null && value !== '' && !labelMap[String(value)]) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // 刷新键变化（如外部新增了选项）：重新拉取选项列表，使新选项入列且已选值可解析标签
  useEffect(() => {
    if (resolver) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const selectedLabel =
    value != null && value !== '' ? labelMap[String(value)] : undefined;

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input
          readOnly
          value={selectedLabel}
          placeholder={field.placeholder || '请选择'}
          style={{ flex: 1, cursor: 'pointer' }}
          onClick={() => {
            setKeyword('');
            load();
            setOpen(true);
          }}
        />
        {field.browser?.hasAdd && (
          <Button onClick={() => onAdd?.(field)}>+</Button>
        )}
      </div>
      <Modal
        title={field.label || '选择'}
        open={open}
        onCancel={() => setOpen(false)}
        width={640}
        footer={null}
        destroyOnClose
      >
        <Input.Search
          placeholder="搜索"
          allowClear
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={(kw) => load(kw)}
          style={{ marginBottom: 12 }}
        />
        <Table<FormFieldOption>
          rowKey="value"
          size="small"
          loading={loading}
          dataSource={options}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: '名称', dataIndex: 'label' },
            {
              title: '描述',
              dataIndex: 'description',
              render: (t: any) => t || '-',
            },
            {
              title: '操作',
              width: 80,
              render: (_: any, r: FormFieldOption) => (
                <a
                  onClick={() => {
                    onChange?.(String(r.value));
                    setOpen(false);
                  }}
                >
                  选择
                </a>
              ),
            },
          ]}
        />
      </Modal>
    </>
  );
};

const SchemaForm: React.FC<SchemaFormProps> = ({
  fields,
  form,
  dataSources,
  browserResolvers,
  browserRefreshKey,
  onFieldAdd,
  dataSourceRefreshKey,
  onRefreshDataSource,
}) => {
  const values = Form.useWatch([], form) || {};
  const [dsOptions, setDsOptions] = useState<Record<string, FormFieldOption[]>>({});
  const [dsLoading, setDsLoading] = useState<Record<string, boolean>>({});

  // 数据源刷新键变化：清空缓存，由下方加载 effect 重新拉取
  useEffect(() => {
    if (dataSourceRefreshKey === undefined) return;
    setDsOptions({});
  }, [dataSourceRefreshKey]);

  // 解析动态数据源（只加载一次）
  useEffect(() => {
    const keys = Array.from(
      new Set(fields.filter((f) => f.dataSource).map((f) => f.dataSource as string)),
    ).filter((k) => dataSources?.[k] && !dsOptions[k]);
    if (keys.length === 0) return;
    keys.forEach(async (k) => {
      setDsLoading((prev) => ({ ...prev, [k]: true }));
      try {
        const r = dataSources![k];
        const list = typeof r === 'function' ? await r() : r;
        setDsOptions((prev) => ({ ...prev, [k]: list || [] }));
      } catch {
        setDsOptions((prev) => ({ ...prev, [k]: [] }));
      } finally {
        setDsLoading((prev) => ({ ...prev, [k]: false }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, dataSources, dsOptions]);

  const isVisible = (f: FormField) => {
    const w = f.visibleWhen;
    if (!w) return true;
    const v = values[w.key];
    if (w.in) return w.in.map(String).includes(String(v));
    if (Object.prototype.hasOwnProperty.call(w, 'equals')) {
      return String(v) === String(w.equals);
    }
    return true;
  };

  const optionsOf = (f: FormField): FormFieldOption[] =>
    f.options || (f.dataSource ? dsOptions[f.dataSource] || [] : []);

  // 解析 ecology 风格 rules 串：required|stringLength:N（与 f.required / f.maxLength 合并）
  const parseRules = (f: FormField) => {
    const out: { required: boolean; stringLength?: number } = {
      required: !!f.required,
      stringLength: f.maxLength ?? undefined,
    };
    if (f.rules) {
      if (f.rules.includes('required')) out.required = true;
      const m = f.rules.match(/stringLength:(\d+)/);
      if (m) out.stringLength = Number(m[1]);
    }
    return out;
  };

  const buildRules = (f: FormField) => {
    const rules: any[] = [];
    const parsed = parseRules(f);
    if (parsed.required) {
      const verb = f.control === 'select' || f.control === 'formSelect' ? '请选择' : '请输入';
      rules.push({ required: true, message: `${verb}${f.label || ''}` });
    }
    // 跨字段互斥校验：依赖字段值命中时，本字段不通过
    if (f.conflict) {
      const dep = f.conflict;
      rules.push({
        validator: (_: unknown, value: unknown) => {
          // 仅当本字段有值（如开关打开）且依赖字段命中时，才判定互斥
          const hasValue = value !== undefined && value !== null && value !== '' && value !== false;
          if (!hasValue) return Promise.resolve();
          const dv = form.getFieldValue(dep.key);
          const hit = dep.in
            ? dep.in.map(String).includes(String(dv))
            : String(dv) === String(dep.equals);
          return hit
            ? Promise.reject(new Error(f.conflictMessage || '互斥校验未通过'))
            : Promise.resolve();
        },
        dependencies: [dep.key],
      });
    }
    return rules.length ? rules : undefined;
  };

  return (
    <Form form={form} labelCol={{ span: 5 }} wrapperCol={{ span: 19 }} style={{ paddingTop: 8 }}>
      {fields.filter(isVisible).map((f) => {
        const pr = parseRules(f);
        const disabled = !!f.readOnly;
        switch (f.control) {
          case 'hidden':
            return (
              <Form.Item key={f.key} name={f.key} hidden>
                <Input />
              </Form.Item>
            );
          case 'input':
            return (
              <Form.Item key={f.key} name={f.key} label={f.label} rules={buildRules(f)}>
                <Input placeholder={f.placeholder} maxLength={pr.stringLength} disabled={disabled} />
              </Form.Item>
            );
          case 'textarea':
            return (
              <Form.Item key={f.key} name={f.key} label={f.label} rules={buildRules(f)}>
                <Input.TextArea
                  rows={f.rows || 3}
                  maxLength={pr.stringLength}
                  placeholder={f.placeholder}
                  disabled={disabled}
                />
              </Form.Item>
            );
          case 'number':
            return (
              <Form.Item key={f.key} name={f.key} label={f.label} rules={buildRules(f)}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={f.min}
                  max={f.max}
                  precision={0}
                  placeholder={f.placeholder}
                  disabled={disabled}
                />
              </Form.Item>
            );
          case 'switch':
            return (
              <React.Fragment key={f.key}>
                <Form.Item name={f.key} label={f.label} valuePropName="checked" rules={buildRules(f)}>
                  <Switch disabled={disabled} />
                </Form.Item>
                {f.tip && (
                  <div style={{ color: '#999', paddingLeft: '20.8%', marginTop: -8 }}>
                    {f.tip}
                  </div>
                )}
              </React.Fragment>
            );
          case 'select': {
            const opts = optionsOf(f);
            const selectCtl = f.detailtype === 3 ? (
              <Radio.Group options={opts} disabled={disabled} />
            ) : (
              <Select
                showSearch={f.searchable}
                allowClear
                placeholder={f.placeholder}
                options={opts}
                disabled={disabled}
                loading={f.dataSource ? dsLoading[f.dataSource] : false}
                filterOption={(input, option) => String(option?.label ?? '').includes(input)}
              />
            );
            return (
              <Form.Item key={f.key} name={f.key} label={f.label} rules={buildRules(f)}>
                {f.allowAdd ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>{selectCtl}</div>
                    <Button onClick={() => onFieldAdd?.(f)}>+</Button>
                  </div>
                ) : (
                  selectCtl
                )}
              </Form.Item>
            );
          }
          case 'formSelect':
            return (
              <Form.Item key={f.key} name={f.key} label={f.label} rules={buildRules(f)}>
                <FormSelectControl
                  typeOptions={f.options || []}
                  formOptions={optionsOf(f)}
                  loading={f.dataSource ? dsLoading[f.dataSource] : false}
                  disabled={disabled}
                  allowAdd={f.allowAdd !== false}
                  onAdd={() => onFieldAdd?.(f)}
                  onRefresh={
                    f.dataSource ? () => onRefreshDataSource?.(f.dataSource) : undefined
                  }
                />
              </Form.Item>
            );
          case 'browser':
            return (
              <Form.Item key={f.key} name={f.key} label={f.label} rules={buildRules(f)}>
                <BrowserBox
                  field={f}
                  resolver={f.dataSource ? browserResolvers?.[f.dataSource] : undefined}
                  onAdd={onFieldAdd}
                  refreshKey={browserRefreshKey}
                />
              </Form.Item>
            );
          default:
            return null;
        }
      })}
    </Form>
  );
};

/**
 * 依据字段描述 + 源数据生成表单初始值。
 * - switch：0/1 -> 布尔
 * - formSelect：{type,id}（用 emits 从源数据拆分回填）
 */
export function buildInitialValues(
  fields: FormField[],
  source: Record<string, any> = {},
): Record<string, any> {
  const init: Record<string, any> = {};
  fields.forEach((f) => {
    if (f.control === 'formSelect' && f.emits) {
      init[f.key] = {
        type: source[f.emits.typeKey] ?? f.options?.[0]?.value ?? 0,
        id: source[f.emits.idKey] != null ? String(source[f.emits.idKey]) : undefined,
      };
    } else if (f.control === 'switch') {
      const raw = source[f.key] ?? f.defaultValue;
      init[f.key] = raw === 1 || raw === true || raw === '1';
    } else {
      init[f.key] = source[f.key] ?? f.defaultValue;
    }
  });
  return init;
}

/**
 * 依据字段描述把表单值转换为提交载荷。
 * - switch：布尔 -> 0/1
 * - formSelect：{type,id} -> 按 emits 拆成两个字段
 */
export function buildPayload(
  fields: FormField[],
  values: Record<string, any>,
  base: Record<string, any> = {},
): Record<string, any> {
  const out: Record<string, any> = { ...base };
  fields.forEach((f) => {
    if (f.control === 'hidden') return;
    const v = values[f.key];
    if (f.control === 'formSelect' && f.emits) {
      out[f.emits.typeKey] = v?.type;
      out[f.emits.idKey] = v?.id;
    } else if (f.control === 'switch') {
      out[f.key] = v ? 1 : 0;
    } else {
      out[f.key] = v;
    }
  });
  return out;
}

export default SchemaForm;
