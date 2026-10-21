import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Empty, Form, Input, Modal, Spin, Table, Tag, Tooltip, Tree, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { Button, CheckList, Empty as AdmEmpty, NavBar, Popup, SearchBar, Selector, Toast } from 'antd-mobile';
import type { FieldVariant } from './fieldTokens';
import { resolveVariant, useIsMobileViewport } from './fieldTokens';
import {
  BROWSER_TYPE_META,
  BrowserTypeMeta,
  PersonOrgCategory,
  PersonOrgItem,
  USER_PAGE_SIZE,
  collectDeptIds,
  fetchAllowedUnitIds,
  itemsOfCategory,
  joinIds,
  loadPersonOrgData,
  queryUsers,
  resolveItemNames,
  splitIds,
  OdocPersonOrgConfig,
  resolveOdocPersonOrgConfig,
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
  /**
   * 公文密级名（公开/秘密/机密/绝密）。仅对「收发文单位」(cat=unit) 生效：
   * 传入后按 wf_odoc_secret_rule 过滤出「允许该密级收发」的单位，候选与左侧树同步收敛。
   * 为空/不传则不限制（展示全部单位）。
   */
  secretLevel?: string;
  title?: string;
  /**
   * 外观变体：desktop=antd Modal（左右分栏表格）｜mobile=antd-mobile 底部弹层
   * （搜索 + 分类胶囊 + 列表 + 底部已选）｜auto=按视口自动。
   * 默认 'desktop'，保持既有调用行为不变。
   */
  variant?: FieldVariant;
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
  secretLevel,
  title,
  variant = 'desktop',
  onOk,
  onCancel,
}) => {
  // 响应式：variant='auto' 时按视口宽度决定用桌面弹窗还是手机弹层
  const isMobileViewport = useIsMobileViewport();
  const isMobile = resolveVariant(variant, isMobileViewport) === 'mobile';
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
  // 按密级过滤：允许收发的单位 id 集合（null = 不限制 / 加载中）
  const [allowedIds, setAllowedIds] = useState<string[] | null>(null);

  /** 递归裁剪单位树：仅保留 id 在 allowed 中、或含有 allowed 子孙的节点 */
  const pruneUnitTree = (nodes: any[], allowed: Set<string>): any[] => {
    const walk = (arr: any[]): any[] =>
      (arr || [])
        .map((n) => {
          const children = n.children ? walk(n.children) : undefined;
          if (allowed.has(String(n.key))) return { ...n, children: children && children.length ? children : undefined };
          if (children && children.length) return { ...n, children };
          return null;
        })
        .filter(Boolean);
    return walk(nodes);
  };

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

  // 收发文单位：按密级过滤（仅 cat=unit 且传入了 secretLevel 时生效）
  useEffect(() => {
    if (!open) return;
    let alive = true;
    if (cat === 'unit' && secretLevel) {
      fetchAllowedUnitIds(secretLevel).then((ids) => {
        if (alive) setAllowedIds(ids);
      });
    } else {
      setAllowedIds(null);
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cat, secretLevel]);

  const allItems: PersonOrgItem[] = useMemo(
    () => (data ? itemsOfCategory(data, cat) : []),
    [data, cat],
  );

  // ★ 人员（hrm）：服务端搜索 + 服务端分页 + 服务端部门树过滤
  //   （部门/角色/岗位数量级小，仍走客户端全量列表）
  const isHrm = cat === 'hrm';
  const [rows, setRows] = useState<PersonOrgItem[]>([]);
  const [total, setTotal] = useState(0);
  const [debouncedKw, setDebouncedKw] = useState('');
  // 每页条数：默认 10（与服务端分页联���，切换后回到第 1 页）
  const [pageSize, setPageSize] = useState(10);

  // 关键字防抖：避免每次按键都打服务端
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKw(keyword.trim()), 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (!open || !isHrm) return;
    let alive = true;
    setLoading(true);
    queryUsers({
      keyword: debouncedKw,
      // 部门树选中节点：后端会自动展开子孙并匹配 CSV 多部门
      deptId: treeKey,
      current: page,
      size: pageSize,
    })
      .then((r) => {
        if (!alive) return;
        setRows(r.records);
        setTotal(r.total);
        // 记录本页名称，供勾选/回显
        setNameMap((m) => {
          const next = { ...m };
          r.records.forEach((i) => {
            next[i.id] = i.name;
          });
          return next;
        });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, isHrm, debouncedKw, treeKey, page, pageSize]);

  // 分类树（人员/部门/分部）；分部只列根节点
  const treeData = useMemo(() => {
    if (!data || !['hrm', 'dept', 'branch', 'unit'].includes(cat)) return [];
    if (cat === 'branch') {
      return itemsOfCategory(data, 'branch').map((i) => ({ key: i.id, title: i.name }));
    }
    if (cat === 'unit') {
      const t = data.unitTree || [];
      if (allowedIds) return pruneUnitTree(t, new Set(allowedIds));
      return t;
    }
    return data.deptTree || [];
  }, [data, cat, allowedIds]);

  const filtered = useMemo(() => {
    // 人员由服务端返回当前页（rows），不再做客户端过滤/分页
    if (isHrm) return rows;
    let list = allItems;
    if (data && treeKey && ['dept', 'branch'].includes(cat)) {
      const deptIds = collectDeptIds(data.deptTree, treeKey);
      list = list.filter((i) => deptIds.has(i.id));
    }
    if (data && treeKey && cat === 'unit') {
      const unitIds = collectDeptIds(data.unitTree, treeKey);
      list = list.filter((i) => unitIds.has(i.id));
    }
    // 按密级过滤（仅 cat=unit 且已取到允许集合时生效）
    if (cat === 'unit' && allowedIds) {
      const set = new Set(allowedIds);
      list = list.filter((i) => set.has(i.id));
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
  }, [allItems, data, treeKey, keyword, cat, isHrm, rows, allowedIds]);

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
          // 人员候选来自服务端当前页（rows），其余类别来自全量内存（allItems）
          const hit = allItems.find((i) => i.id === id) || rows.find((i) => i.id === id);
          if (hit) next[id] = hit.name;
        }
      });
      return next;
    });
  };

  // 收发文单位（cat=unit）多选时：提供「公共组」快捷多选——点组即把成员单位并入已选
  const addGroup = (groupId: string) => {
    const g = (data?.groups || []).find((x: any) => String(x.id) === groupId);
    if (!g) return;
    const set = allowedIds ? new Set(allowedIds) : null;
    const memberIds: string[] = (g.unitIds || [])
      .map((x: any) => String(x))
      .filter((id: string) => !set || set.has(id));
    if (memberIds.length === 0) {
      if (isMobile) Toast.show({ content: '该公共组暂无成员单位' });
      else message.warning('该公共组暂无成员单位');
      return;
    }
    setSelected((prev) => Array.from(new Set([...prev, ...memberIds])));
    setNameMap((m) => {
      const next = { ...m };
      const units = data?.units || [];
      memberIds.forEach((id) => {
        if (!next[id]) {
          const hit = units.find((u: any) => String(u.id) === id);
          if (hit) next[id] = hit.name;
        }
      });
      return next;
    });
  };

  const renderGroupBar = () => {
    if (cat !== 'unit' || !isMultiple) return null;
    const groups = data?.groups || [];
    if (groups.length === 0) return null;
    return (
      <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#999' }}>公共组（点击带入成员）：</span>
        {groups.map((g: any) => (
          <Tag
            key={g.id}
            onClick={() => addGroup(g.id)}
            style={{ cursor: 'pointer', background: '#f6ffed', borderColor: '#b7eb8f', color: '#389e0d', marginInlineEnd: 0 }}
          >
            + {g.name}（{g.unitIds?.length || 0}）
          </Tag>
        ))}
      </div>
    );
  };

  const handleOk = () => {
    if (selected.length === 0) {
      // 两端提示组件不同：桌面用 antd message，手机用 antd-mobile Toast
      if (isMobile) Toast.show({ content: `请选择${label}` });
      else message.warning(`请选择${label}`);
      return;
    }
    onOk(selected, selectedItems);
  };

  // ─────────────────────────────────────────────────────────────
  // 手机端 UI（antd-mobile）：底部弹层，而非 780px 宽的居中 Modal
  //
  // 与桌面端的差异（选中逻辑完全一致，均来自上方同一份 state）：
  //   · Modal + 左右分栏      → Popup(position=bottom) + NavBar
  //   · 左侧 200px 部门树     → Selector 横向胶囊（一级部门 + 全部）；
  //                             手机上放不下 200px 侧栏，深层部门用顶部搜索定位
  //   · Table + 分页器        → CheckList + 「加载更多」；分页器在触屏上极难点中
  //   · 底部已选 Tag 列表     → 固定底部可逐项移除
  // ─────────────────────────────────────────────────────────────
  if (isMobile) {
    // 当前页可见条目：人员走服务端分页（filtered 即服务端当前页），
    // 其余类别客户端分页（切片口径与桌面端 Table 一致）
    const pagedRows = isHrm ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);
    const listTotal = isHrm ? total : filtered.length;
    const totalPages = Math.max(1, Math.ceil(listTotal / pageSize));
    const hasMore = page < totalPages;
    // 一级分类胶囊：全部 + 各根节点（替代桌面端左侧部门树）
    const rootOptions = treeData.length
      ? [
          { label: `全部${label}`, value: '' },
          ...treeData.map((n: any) => ({ label: String(n.title), value: String(n.key) })),
        ]
      : [];

    return (
      <Popup
        visible={open}
        position="bottom"
        closeOnMaskClick
        destroyOnClose
        onClose={onCancel}
        onMaskClick={onCancel}
        bodyStyle={{
          height: '82vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
        }}
      >
        <NavBar
          onBack={onCancel}
          right={
            <Button size="mini" color="primary" onClick={handleOk}>
              确定{selected.length ? `(${selected.length})` : ''}
            </Button>
          }
        >
          {title || `选择${label}${isMultiple ? '（可多选）' : '（单选）'}`}
        </NavBar>

        {/* 搜索 */}
        <div style={{ padding: '8px 12px 4px' }}>
          <SearchBar
            placeholder={`搜索${label}名称/编码`}
            value={keyword}
            onChange={setKeyword}
            clearable
            style={{ '--background': '#f5f5f5', '--border-radius': '6px' } as any}
          />
        </div>

        {/* 一级分类胶囊（替代左侧部门树） */}
        {rootOptions.length > 0 && (
          <div style={{ padding: '4px 12px 8px', overflowX: 'auto' }}>
            <Selector
              options={rootOptions.map((o) => ({ label: o.label, value: o.value }))}
              value={[treeKey || '']}
              onChange={([v]) => setTreeKey(v ? String(v) : undefined)}
              style={{ '--border-radius': '14px' } as any}
            />
          </div>
        )}

        {/* 公共组快捷条（收发文单位多选） */}
        <div style={{ padding: '0 12px' }}>{renderGroupBar()}</div>

        {/* 列表 */}
        <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <AdmEmpty description="加载中…" style={{ padding: 24 }} />
          ) : pagedRows.length === 0 ? (
            <AdmEmpty description="暂无数据" style={{ padding: 24 }} />
          ) : (
            <CheckList
              multiple={isMultiple}
              value={selected}
              onChange={(v) => toggleRows(v.map(String))}
            >
              {pagedRows.map((it) => (
                <CheckList.Item
                  key={it.id}
                  value={String(it.id)}
                  // extra 展示编码/描述：手机上不占主行宽度
                  extra={
                    it.code || it.desc ? (
                      <span style={{ fontSize: 12, color: '#999' }}>{it.code || it.desc}</span>
                    ) : undefined
                  }
                >
                  <span style={{ color: '#0072C6' }}>{it.name}</span>
                </CheckList.Item>
              ))}
            </CheckList>
          )}

          {/* 加载更多（替代桌面端分页器） */}
          {hasMore && !loading && (
            <div style={{ padding: 12, textAlign: 'center' }}>
              <Button size="small" fill="outline" onClick={() => setPage(page + 1)}>
                加载更多（{page}/{totalPages}）
              </Button>
            </div>
          )}
          {!hasMore && listTotal > pageSize && !loading && (
            <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: '#999' }}>
              共 {listTotal} 项，已全部加载
            </div>
          )}
        </div>

        {/* 底部已选区（可逐项移除） */}
        <div
          style={{
            borderTop: '1px solid #f0f0f0',
            padding: '8px 12px',
            maxHeight: 108,
            overflow: 'auto',
            background: '#fafafa',
          }}
        >
          <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>已选 {selected.length} 项：</div>
          {selectedItems.length === 0 ? (
            <div style={{ fontSize: 12, color: '#bfbfbf' }}>暂未选择</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selectedItems.map((it) => (
                <span
                  key={it.id}
                  onClick={() => setSelected((prev) => prev.filter((x) => x !== it.id))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: '#e6f4ff',
                    border: '1px solid #91caff',
                    color: '#0958d9',
                    fontSize: 13,
                  }}
                >
                  {it.name}
                  <span style={{ color: '#0958d9', fontWeight: 600 }}>×</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </Popup>
    );
  }

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
      {secretLevel && cat === 'unit' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
          message={`已按密级「${secretLevel}」仅展示允许收发的单位${
            allowedIds ? `（${allowedIds.length} 个）` : '（加载中或接口不可用，暂未过滤）'
          }`}
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
            {renderGroupBar()}
            <Table
              rowKey="id"
              size="small"
              dataSource={filtered}
              loading={loading}
              pagination={
                isHrm
                  ? {
                      // 人员：服务端分页（total 来自后端，pageSize 可选 10/20/50/100）
                      current: page,
                      pageSize,
                      total,
                      size: 'small',
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50', '100'],
                      onShowSizeChange: (_p, s) => {
                        setPageSize(s);
                        setPage(1);
                      },
                      onChange: (p) => setPage(p),
                      showTotal: (t) => `共 ${t} 人`,
                    }
                  : {
                      // 部门/角色/岗位：客户端分页（全量内存数据）
                      current: page,
                      pageSize,
                      total: filtered.length,
                      size: 'small',
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50', '100'],
                      onShowSizeChange: (_p, s) => {
                        setPageSize(s);
                        setPage(1);
                      },
                      onChange: (p) => setPage(p),
                      showTotal: (t) => `共 ${t} 项`,
                    }
              }
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

/**
 * 手机端「人员/组织」选择弹窗（antd-mobile）。
 *
 * <p>本质是 `PersonOrgPicker` 的 `variant='mobile'` 薄包装：状态逻辑、选中结果、
 * 名称反查全部复用同一套实现，只是把交互形态换成手机原生习惯的底部弹层。</p>
 *
 * <p>页面层**不需要**直接引用本组件 —— `PersonOrgField` 会按自己的 variant 自动分发；
 * 此处导出仅便于单独测试或嵌入其他手机端容器。</p>
 */
export const MobilePersonOrgPicker: React.FC<PersonOrgPickerProps> = (props) => (
  <PersonOrgPicker {...props} variant="mobile" />
);

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
  /**
   * 公文密级名（公开/秘密/机密/绝密）。传入后「收发文单位」候选按密级过滤（见 PersonOrgPicker）。
   * 若不传，内部会自动读取表单字段 `mj`（收发文密级约定字段名）的值。
   */
  secretLevel?: string;
  /**
   * 密级字段名（表单字段）。仅当 secretLevel 未显式传入、且 category=unit 时生效，
   * 用于从表单读取密级值。默认取 OdocPersonOrgConfig.secretLevelFieldName（'mj'）。
   */
  secretLevelFieldName?: string;
  /** 是否只展示（禁用交互）。命名规范：统一驼峰 `readOnly`，与 FieldControl / BrowserControl 一致 */
  readOnly?: boolean;
  /**
   * @deprecated 历史命名（小写 o），仅为兼容既有调用保留，新代码请用 `readOnly`。
   * 两者同时传入时以 `readOnly` 为准。
   */
  readonly?: boolean;
  /**
   * 外观变体：desktop=antd 桌面弹窗｜mobile=antd-mobile 底部弹层｜auto=按视口自动。
   * 默认 'desktop'（保持既有调用行为不变）；`FieldControl` 会按自己的 variant 透传，
   * 因此手机端表单里的人力资源/部门/分部字段会自动得到手机弹层。
   */
  variant?: FieldVariant;
}

export const PersonOrgField: React.FC<PersonOrgFieldProps> = (props) => {
  const { browserType, category, multiple, value, onChange, disabled, placeholder, variant = 'desktop' } = props;
  // 兼容历史小写 readonly，新代码统一用 readOnly
  const readOnly = props.readOnly ?? props.readonly;
  const isMobileViewport = useIsMobileViewport();
  const isMobile = resolveVariant(variant, isMobileViewport) === 'mobile';
  const meta = browserType != null ? BROWSER_TYPE_META[browserType] : undefined;
  const cat = category || meta?.category;
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const ids = splitIds(value);
  // 表单上下文（PersonOrgField 始终渲染在 Form 内）；用于按密级过滤单位时读取密级字段值
  const form = Form.useFormInstance();
  // 实际生效的密级（显式传入优先；否则单位类自动从表单 'mj' 字段读取）
  const [sl, setSl] = useState<string | undefined>(undefined);

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

  const disabledAll = disabled || readOnly;

  /** 打开选择器：单位类自动把表单密级字段(mj)的当前值作为 secretLevel 传入 */
  const openPicker = () => {
    if (disabledAll) return;
    resolveOdocPersonOrgConfig();
    const level =
      props.secretLevel ??
      (cat === 'unit'
        ? form?.getFieldValue(props.secretLevelFieldName || OdocPersonOrgConfig.secretLevelFieldName) ??
          undefined
        : undefined);
    setSl(level || undefined);
    setOpen(true);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        width: isMobile ? '100%' : undefined,
        maxWidth: '100%',
      }}
    >
      {/* 值显示区：field{id}span */}
      <div
        onClick={openPicker}
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 4,
          flex: isMobile ? '1 1 auto' : undefined,
          minWidth: isMobile ? 0 : 180,
          minHeight: isMobile ? 40 : 32,
          maxWidth: isMobile ? '100%' : 420,
          border: '1px solid #d9d9d9',
          borderRadius: isMobile ? 6 : '6px 0 0 6px',
          padding: isMobile ? '4px 10px' : '2px 8px',
          background: disabledAll ? '#f5f5f5' : '#fff',
          cursor: disabledAll ? 'not-allowed' : 'pointer',
          fontSize: isMobile ? 16 : 13,
        }}
      >
        {ids.length === 0 ? (
          <span style={{ color: '#bfbfbf', fontSize: isMobile ? 16 : 13 }}>
            {placeholder || `请选择${meta?.label || CATEGORY_LABEL[cat]}`}
          </span>
        ) : (
          ids.map((id) => (
            <Tag
              key={id}
              closable={!disabledAll}
              onClose={(e) => {
                e.preventDefault();
                onChange?.(joinIds(ids.filter((x) => x !== id)));
              }}
              style={{ margin: 0, fontSize: isMobile ? 13 : 12 }}
              color="blue"
            >
              {names[id] || id}
            </Tag>
          ))
        )}
      </div>
      {/* 浏览按钮：field{id}_browserbtn */}
      <span
        onClick={openPicker}
        title={`选择${meta?.label || CATEGORY_LABEL[cat]}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          flexShrink: 0,
          width: isMobile ? 56 : 32,
          height: isMobile ? 40 : 32,
          border: '1px solid #0072C6',
          borderRadius: isMobile ? 6 : '0 6px 6px 0',
          marginLeft: isMobile ? 8 : 0,
          background: disabledAll ? '#d9d9d9' : '#0072C6',
          color: '#fff',
          cursor: disabledAll ? 'not-allowed' : 'pointer',
          fontSize: isMobile ? 14 : 13,
        }}
      >
        {isMobile ? '选择' : <SearchOutlined style={{ fontSize: 14 }} />}
      </span>

      <PersonOrgPicker
        open={open}
        browserType={browserType}
        category={category}
        multiple={multiple}
        value={joinIds(ids)}
        secretLevel={sl}
        variant={variant}
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
