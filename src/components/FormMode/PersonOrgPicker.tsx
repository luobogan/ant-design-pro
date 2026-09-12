import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Empty, Input, Modal, Spin, Table, Tag, Tooltip, Tree, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import {
  BROWSER_TYPE_META,
  BrowserTypeMeta,
  PersonOrgCategory,
  PersonOrgItem,
  collectDeptIds,
  itemsOfCategory,
  joinIds,
  loadPersonOrgData,
  resolveItemNames,
  splitIds,
} from './personOrg';

/**
 * 统一「人员与组织」选择组件（对齐 ecology 浏览按钮 BrowserBean）。
 *
 * 三类导出：
 *  · {@link PersonOrgPicker}       —— 选择弹窗（左侧分类树 + 右侧列表 + 勾选）
 *  · {@link PersonOrgField}        —— 表单字段壳（E9 风格：标签值 + 蓝色浏览按钮）
 *  · {@link PersonOrgValueText}    —— 只读展示（id 串 → 名称串）
 *
 * 类型映射（操作者/指定人/指定部门/指定分部/指定角色/指定岗位）：
 *   1/161/167/168 → 人员    2/17/19/20 → 部门    18/21/22/23 → 分部
 *   3/163 → 角色            4 → 岗位
 *
 * 数据格式与 E9 一致：值为 **id 逗号串**（如 "123,456"），显示名由 id 反查。
 */

// ==================== 选择弹窗 ====================

export interface PersonOrgPickerProps {
  open: boolean;
  /** 浏览按钮类型（E9 编号，35+ 空间），优先级最高 */
  browserType?: number;
  /** 或直接指定类别（不传 browserType 时使用） */
  category?: PersonOrgCategory;
  /** 覆盖多选（默认取类型元信息，E9 浏览按钮默认多选） */
  multiple?: boolean;
  /** 当前值（id 逗号串） */
  value?: string;
  title?: string;
  onOk: (ids: string[], items: PersonOrgItem[]) => void;
  onCancel: () => void;
}

const CATEGORY_LABEL: Record<PersonOrgCategory, string> = {
  hrm: '人员',
  dept: '部门',
  branch: '分部',
  role: '角色',
  post: '岗位',
};

export const PersonOrgPicker: React.FC<PersonOrgPickerProps> = ({
  open,
  browserType,
  category,
  multiple,
  value,
  title,
  onOk,
  onCancel,
}) => {
  const meta: BrowserTypeMeta | undefined =
    browserType != null ? BROWSER_TYPE_META[browserType] : undefined;
  const cat: PersonOrgCategory = category || meta?.category || 'hrm';
  // 业务要求：所有弹出框统一为多选交互（默认多选，仅显式传入 false 才单选）
  const isMultiple = multiple !== false;
  const label = meta?.label || CATEGORY_LABEL[cat];

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [treeKey, setTreeKey] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  // 打开时：加载数据 + 回显已选
  useEffect(() => {
    if (!open) return;
    setKeyword('');
    setTreeKey(undefined);
    setPage(1);
    const ids = splitIds(value);
    setSelected(ids);
    setLoading(true);
    (async () => {
      try {
        const d = await loadPersonOrgData();
        setData(d);
        if (ids.length) {
          const named = await resolveItemNames(cat, ids);
          setNameMap((m) => {
            const next = { ...m };
            named.forEach((n) => {
              next[n.id] = n.name;
            });
            return next;
          });
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const allItems: PersonOrgItem[] = useMemo(
    () => (data ? itemsOfCategory(data, cat) : []),
    [data, cat],
  );

  // 分类树（人员/部门/分部）；分部只列根节点
  const treeData = useMemo(() => {
    if (!data || !['hrm', 'dept', 'branch'].includes(cat)) return [];
    if (cat === 'branch') {
      return itemsOfCategory(data, 'branch').map((i) => ({ key: i.id, title: i.name }));
    }
    return data.deptTree || [];
  }, [data, cat]);

  const filtered = useMemo(() => {
    let list = allItems;
    if (data && treeKey && ['hrm', 'dept', 'branch'].includes(cat)) {
      const deptIds = collectDeptIds(data.deptTree, treeKey);
      if (cat === 'hrm') {
        list = list.filter((i) => splitIds(i.deptId).some((d) => deptIds.has(d)));
      } else {
        list = list.filter((i) => deptIds.has(i.id));
      }
    }
    const kw = keyword.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(kw) ||
          (i.code || '').toLowerCase().includes(kw) ||
          (i.desc || '').toLowerCase().includes(kw),
      );
    }
    return list;
  }, [allItems, data, treeKey, keyword, cat]);

  useEffect(() => {
    setPage(1);
  }, [keyword, treeKey, cat]);

  const selectedItems = useMemo(
    () => selected.map((id) => ({ id, name: nameMap[id] || id })),
    [selected, nameMap],
  );

  const toggleRows = (keys: React.Key[]) => {
    const ids = keys.map(String);
    setSelected(ids);
    // 记录名称（含本次勾选的新行）
    setNameMap((m) => {
      const next = { ...m };
      ids.forEach((id) => {
        if (!next[id]) {
          const hit = allItems.find((i) => i.id === id);
          if (hit) next[id] = hit.name;
        }
      });
      return next;
    });
  };

  const handleOk = () => {
    if (selected.length === 0) {
      message.warning(`请选择${label}`);
      return;
    }
    onOk(selected, selectedItems);
  };

  return (
    <Modal
      title={`选择${label}${isMultiple ? '（可多选）' : '（单选）'}`}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="确定"
      cancelText="取消"
      width={780}
      destroyOnClose
      bodyStyle={{ paddingTop: 12 }}
    >
      {data?.errors?.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          message={data.errors.join('；')}
        />
      )}
      <Spin spinning={loading}>
        <div style={{ display: 'flex', gap: 12, minHeight: 380 }}>
          {/* 左侧分类树：按部门分类（人员/部门/分部） */}
          {treeData.length > 0 && (
            <div
              style={{
                width: 200,
                flexShrink: 0,
                borderRight: '1px solid #f0f0f0',
                paddingRight: 8,
                maxHeight: 420,
                overflow: 'auto',
              }}
            >
              <div
                onClick={() => setTreeKey(undefined)}
                style={{
                  cursor: 'pointer',
                  padding: '2px 4px',
                  marginBottom: 4,
                  fontWeight: treeKey ? 400 : 600,
                  color: treeKey ? '#333' : '#0072C6',
                  fontSize: 13,
                }}
              >
                全部{CATEGORY_LABEL[cat]}
              </div>
              <Tree
                treeData={treeData}
                selectedKeys={treeKey ? [treeKey] : []}
                defaultExpandAll
                onSelect={(keys) => setTreeKey(keys.length ? String(keys[0]) : undefined)}
              />
            </div>
          )}

          {/* 右侧列表 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder={`搜索${label}名称/编码`}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
              style={{ marginBottom: 8 }}
            />
            <Table
              rowKey="id"
              size="small"
              dataSource={filtered}
              loading={loading}
              pagination={{
                current: page,
                pageSize: 10,
                size: 'small',
                showSizeChanger: false,
                onChange: (p) => setPage(p),
                showTotal: (t) => `共 ${t} 项`,
              }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" /> }}
              rowSelection={{
                type: isMultiple ? 'checkbox' : 'radio',
                selectedRowKeys: selected,
                onChange: toggleRows,
                columnWidth: 36,
              }}
              columns={[
                {
                  title: '名称',
                  dataIndex: 'name',
                  render: (v: string) => <span style={{ color: '#0072C6' }}>{v}</span>,
                },
                { title: '编码', dataIndex: 'code', width: 140, ellipsis: true },
                { title: '描述', dataIndex: 'desc', width: 220, ellipsis: true },
              ]}
            />
          </div>
        </div>
      </Spin>

      {/* 已选区域（E9 标签样式） */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 8,
          borderTop: '1px solid #f0f0f0',
          minHeight: 32,
          maxHeight: 84,
          overflow: 'auto',
        }}
      >
        <span style={{ color: '#999', fontSize: 12, marginRight: 8 }}>已选 {selected.length} 项：</span>
        {selectedItems.map((it) => (
          <Tag
            key={it.id}
            closable
            color="blue"
            onClose={(e) => {
              e.preventDefault();
              setSelected((prev) => prev.filter((x) => x !== it.id));
            }}
            style={{ marginBottom: 4 }}
          >
            {it.name}
          </Tag>
        ))}
      </div>
    </Modal>
  );
};

// ==================== 表单字段壳（E9 风格） ====================

export interface PersonOrgFieldProps {
  /** 浏览按钮类型（E9 编号） */
  browserType?: number;
  /** 或类别 */
  category?: PersonOrgCategory;
  /** 覆盖多选 */
  multiple?: boolean;
  value?: any;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** 是否只展示（禁用交互） */
  readonly?: boolean;
}

export const PersonOrgField: React.FC<PersonOrgFieldProps> = ({
  browserType,
  category,
  multiple,
  value,
  onChange,
  disabled,
  placeholder,
  readonly,
}) => {
  const meta = browserType != null ? BROWSER_TYPE_META[browserType] : undefined;
  const cat = category || meta?.category;
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const ids = splitIds(value);

  useEffect(() => {
    if (!cat || !ids.length) {
      setNames({});
      return;
    }
    let alive = true;
    resolveItemNames(cat, ids).then((list) => {
      if (!alive) return;
      const m: Record<string, string> = {};
      list.forEach((n) => {
        m[n.id] = n.name;
      });
      setNames(m);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, joinIds(ids)]);

  if (!cat) {
    return (
      <Tooltip title="该浏览框类型暂未实现，可改用 人力资源/部门/角色/岗位 类型">
        <Input disabled value={value} placeholder="暂未支持的浏览框类型" />
      </Tooltip>
    );
  }

  const disabledAll = disabled || readonly;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 0, maxWidth: '100%' }}>
      {/* 值显示区：field{id}span */}
      <div
        onClick={() => !disabledAll && setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 4,
          minWidth: 180,
          minHeight: 32,
          maxWidth: 420,
          border: '1px solid #d9d9d9',
          borderRadius: '6px 0 0 6px',
          padding: '2px 8px',
          background: disabledAll ? '#f5f5f5' : '#fff',
          cursor: disabledAll ? 'not-allowed' : 'pointer',
        }}
      >
        {ids.length === 0 ? (
          <span style={{ color: '#bfbfbf', fontSize: 13 }}>{placeholder || `请选择`}</span>
        ) : (
          ids.map((id) => (
            <Tag
              key={id}
              closable={!disabledAll}
              onClose={(e) => {
                e.preventDefault();
                onChange?.(joinIds(ids.filter((x) => x !== id)));
              }}
              style={{ margin: 0 }}
              color="blue"
            >
              {names[id] || id}
            </Tag>
          ))
        )}
      </div>
      {/* 浏览按钮：field{id}_browserbtn */}
      <span
        onClick={() => !disabledAll && setOpen(true)}
        title={`选择${meta?.label || CATEGORY_LABEL[cat]}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          border: '1px solid #0072C6',
          borderRadius: '0 6px 6px 0',
          background: disabledAll ? '#d9d9d9' : '#0072C6',
          color: '#fff',
          cursor: disabledAll ? 'not-allowed' : 'pointer',
          flexShrink: 0,
        }}
      >
        <SearchOutlined style={{ fontSize: 14 }} />
      </span>

      <PersonOrgPicker
        open={open}
        browserType={browserType}
        category={category}
        multiple={multiple}
        value={joinIds(ids)}
        onOk={(nextIds, items) => {
          const m: Record<string, string> = { ...names };
          items.forEach((i) => {
            m[i.id] = i.name;
          });
          setNames(m);
          onChange?.(joinIds(nextIds));
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
};

// ==================== 只读展示 ====================

export const PersonOrgValueText: React.FC<{
  category?: PersonOrgCategory;
  browserType?: number;
  value?: any;
}> = ({ category, browserType, value }) => {
  const meta = browserType != null ? BROWSER_TYPE_META[browserType] : undefined;
  const cat = category || meta?.category;
  const ids = splitIds(value);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!cat || !ids.length) return;
    let alive = true;
    resolveItemNames(cat, ids).then((list) => {
      if (!alive) return;
      const m: Record<string, string> = {};
      list.forEach((n) => {
        m[n.id] = n.name;
      });
      setNames(m);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, joinIds(ids)]);

  if (!ids.length) return <span>-</span>;
  return <span>{ids.map((id) => names[id] || id).join('、')}</span>;
};
