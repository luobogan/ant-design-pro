/**
 * 通用列表（ScopeGrid）配置预览页
 *
 * 界面路径：/authority/datascope/grid（静态声明，与 /authority/datascope/fields 同属
 * 数据权限模块的辅助页，无独立 blade_menu 行）。
 * 入口：数据权限配置弹窗「可见字段」区域的「列表预览」按钮，带 ?menuId= 自动带入菜单。
 *
 * 用途：把「可见字段勾选 → 前端动态列 → 字段级权限 → 按钮权限」整条链路可视化。
 *
 * ⚠️ 数据口径（与表单预览 ExcelPreviewPage 一致）：
 *   1. **真实数据**：走 `POST /api/blade-formmode/form-data/page-scope/{formId}`，
 *      由后端按 `blade_scope_data` 的行级规则（scope_column / scope_type / scope_value）
 *      过滤、并按 scope_field 裁列 —— 即「当前数据权限配置下的真实数据」，**不使用任何 mock**。
 *   2. **值形态**：浏览按钮类字段返回原始值（id 逗号串），显示名称由前端按需反查
 *      （与 FieldControl / personOrg 同一套解析，见 ScopeGrid 内置的名称解析）。
 *   3. **组件统一**：列表容器只用 ScopeGrid（通用列表）组件，不引入其它表格组件。
 */
import { ReloadOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer } from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Card,
  Input,
  Segmented,
  Select,
  Space,
  Tag,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import ScopeGrid from '@/components/ScopeGrid';
import {
  createScopeRow,
  deleteScopeRows,
  fetchScopeFormData,
  type ScopeFieldConfig,
  submitScopeFields,
  updateScopeCell,
} from '@/services/authority/dataPermission';
import * as menuApi from '@/services/system/menu';

interface MenuOption {
  value: string;
  label: string;
  code?: string;
}

/** 真实业务行：列由 blade_scope_field 决定，字段名动态 */
type RealRow = Record<string, any> & { id?: any };

/** 无列配置时的回退列（fail-open，与 ScopeGrid 契约一致，保证不白屏） */
const DEFAULT_COLUMNS: ProColumns<RealRow>[] = [
  { title: 'ID', dataIndex: 'id', width: 90, hideInSearch: true },
  { title: '创建时间', dataIndex: 'modedatacreatedate', hideInSearch: true },
];

/**
 * 「可见字段」配置里记住的业务表单（与 VisibleFieldSelector 同一份 localStorage 记忆）。
 * blade_menu / blade_scope_data 都没有 formId 绑定列，业务表单由用户手选并按 menuId 记忆，
 * 故预览页按同一份记忆取 formId —— 与字段配置同源，不会张冠李戴。
 */
const formMemoryKey = (menuId?: string) =>
  `datascope:visibleField:form:${menuId || 'default'}`;

const GridPreview: React.FC = () => {
  const { message } = App.useApp();
  const location = useLocation();
  // Umi Max 的 useLocation() 不带 query 属性，必须自行解析 search，
  // 否则 ?menuId= 会被丢掉、列配置请求根本不会发出。
  const searchParams = useMemo(
    () => new URLSearchParams(location.search || ''),
    [location.search],
  );
  const queryMenuId = searchParams.get('menuId') || undefined;
  const queryFormId = searchParams.get('formId') || undefined;

  const [menus, setMenus] = useState<MenuOption[]>([]);
  const [menuId, setMenuId] = useState<string | undefined>(queryMenuId);
  const [pageCodeInput, setPageCodeInput] = useState<string>('');
  const [formIdInput, setFormIdInput] = useState<string>('');
  const [configs, setConfigs] = useState<ScopeFieldConfig[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  /**
   * 编辑形态：
   * - `row`（**默认**）：列表打开是只读展示，操作列点「编辑」进入该行编辑态，行尾「保存 / 取消」。
   * - `cell`：可编辑列**常驻**输入控件，失焦即存（改动一格立刻落库）。
   *
   * <p>默认行编辑而非常驻编辑：字段配置里勾「可编辑」的往往有几十列，
   * 若常驻输入会让一打开就是上百个输入框（数据看不清、易误改）。
   * 要常驻编辑可随时用工具栏切到「单元格编辑」。</p>
   *
   * <p>两种都只提交**实际改动**的字段，不会覆盖未渲染列（业务数据表渲染列常少于物理列）。</p>
   */
  const [editMode, setEditMode] = useState<'cell' | 'row'>('row');

  useEffect(() => {
    let alive = true;
    menuApi
      .list({ tenantId: '000000' })
      .then((res: any) => {
        if (!alive) return;
        const records: any[] = Array.isArray(res)
          ? res
          : res?.records || res?.data?.records || res?.data || [];
        setMenus(
          records
            .map((m) => ({
              value: String(m?.id ?? m?.menuId ?? ''),
              label: String(m?.name || m?.menuName || m?.title || m?.id || ''),
              code: m?.code || m?.menuCode,
            }))
            .filter((o) => !!o.value),
        );
      })
      .catch(() => {
        // 菜单加载失败不阻塞预览，可直接手填 menuId
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (queryMenuId) setMenuId(queryMenuId);
  }, [queryMenuId]);

  const menuCode = useMemo(
    () => menus.find((m) => m.value === menuId)?.code,
    [menus, menuId],
  );
  const effectivePageCode = pageCodeInput || menuCode || '';

  /** 业务表单 ID：URL > 手填 > 本地记忆（与「可见字段」配置同一份） */
  const formId = useMemo(() => {
    if (queryFormId) return queryFormId;
    const manual = formIdInput.trim();
    if (manual) return manual;
    try {
      return localStorage.getItem(formMemoryKey(menuId)) || '';
    } catch (_e) {
      return '';
    }
  }, [queryFormId, formIdInput, menuId]);

  /**
   * 资源编号：用于定位数据权限行级规则（blade_scope_data.resource_code = 菜单 code）。
   * 优先取可见字段配置里保存的 resourceCode（保存时写入），回退到菜单 code。
   */
  const resourceCode = useMemo(
    () => configs.find((c) => c?.resourceCode)?.resourceCode || menuCode || '',
    [configs, menuCode],
  );

  /** 真实数据请求（无业务表单时不请求，交由页面提示） */
  const request = useMemo(() => {
    if (!formId) return undefined;
    return async (params: any) => {
      const page = await fetchScopeFormData({
        formId,
        resourceCode,
        current: params?.current || 1,
        size: params?.pageSize || 10,
      });
      return { data: page.records, total: page.total, success: true };
    };
  }, [formId, resourceCode]);

  /**
   * 行内编辑保存：只更新**这一格**（其余字段保留库中原值）。
   *
   * <p>后端 `PUT /api/blade-formmode/form-data/{formId}/{dataId}/cell`，
   * 值按目标列类型转换（int / decimal / varchar … 都能直接提交字符串）。</p>
   *
   * <p>`silent=true` 时不弹提示、不刷新 —— 行编辑「保存」会逐格提交，
   * 由行保存统一提示与刷新，避免一改多格就弹 N 次提示、刷 N 次表。</p>
   */
  const handleCellSave = async (payload: {
    row: RealRow;
    fieldName: string;
    value: string;
    refresh: () => void;
    silent?: boolean;
  }) => {
    if (!formId) {
      if (!payload.silent) message.warning('未确定业务表单，无法保存');
      return;
    }
    const dataId = payload.row?.id;
    if (dataId == null) {
      if (!payload.silent) message.error('缺少数据主键，无法保存');
      return;
    }
    try {
      const ok = await updateScopeCell({
        formId,
        dataId,
        fieldName: payload.fieldName,
        value: payload.value,
      });
      if (ok) {
        if (!payload.silent) {
          message.success('已保存');
          payload.refresh();
        }
      } else if (!payload.silent) {
        message.error('保存失败（未更新到数据）');
      }
    } catch (_e) {
      if (!payload.silent) message.error('保存失败');
    }
  };

  /**
   * 新增行：先落一条空行拿到主键，再插到列表顶部；后续字段在行编辑里逐格填写。
   *
   * <p>主表除 `id` 外均为可空列，故空行可直接插入。</p>
   */
  const handleRowAdd = async () => {
    if (!formId) {
      message.warning('未确定业务表单，无法新增行');
      return;
    }
    try {
      const id = await createScopeRow({ formId });
      if (id == null) {
        message.error('新增行失败（未返回数据主键）');
        return;
      }
      message.success('已新增一行，可点行内「编辑」填写内容');
      return { id } as RealRow;
    } catch (_e) {
      message.error('新增行失败');
      return undefined;
    }
  };

  /** 删除行：落库删除后由 ScopeGrid 移除本地行 */
  const handleRowDelete = async (row: RealRow) => {
    if (!formId) {
      message.warning('未确定业务表单，无法删除');
      return;
    }
    const id = row?.id;
    if (id == null) {
      message.error('缺少数据主键，无法删除');
      return;
    }
    try {
      await deleteScopeRows({ formId, dataIds: [id] });
      message.success('已删除');
    } catch (_e) {
      message.error('删除失败');
    }
  };

  /** 管理员「保存为菜单级默认列」（写库，仍由页面负责，组件不直接写） */
  const handleSaveColumns = async (list: ScopeFieldConfig[]) => {
    if (!menuId) {
      message.warning('请先选择关联菜单');
      return;
    }
    if (!list.length) {
      message.warning('当前菜单尚无可见字段配置');
      return;
    }
    try {
      await submitScopeFields({
        scopeId: 0,
        menuId,
        resourceCode,
        fields: list.map((f, idx) => ({ ...f, sort: f.sort ?? idx })),
      });
      message.success('已保存为菜单级默认列');
      setRefreshToken((n) => n + 1);
    } catch (_e) {
      message.error('保存失败（写接口需要管理员权限）');
    }
  };

  return (
    <PageContainer
      title="通用列表 · 列配置预览"
      subTitle="ScopeGrid：可见字段 + 字段级权限 + 操作按钮权限"
      extra={[
        <Button key="back" onClick={() => history.push('/authority/datascope')}>
          返回数据权限
        </Button>,
      ]}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="界面路径：/authority/datascope/grid"
        description="从数据权限配置弹窗「可见字段」区域的「列表预览」进入，会自动带入当前菜单。数据为**真实业务数据**：由后端按当前数据权限规则（scope_column / scope_type / scope_value）过滤并按可见字段裁列；浏览按钮类字段显示名称由前端按需反查（与表单预览同一套解析）。本页只用 ScopeGrid 组件实现。"
      />

      <Card variant="outlined" size="small" style={{ marginBottom: 16 }}>
        <Space size={12} wrap>
          <span>关联菜单</span>
          <Select
            value={menuId}
            onChange={(v) => setMenuId(v)}
            options={menus}
            showSearch
            optionFilterProp="label"
            placeholder="选择菜单（决定列配置）"
            allowClear
            style={{ width: 260 }}
            data-testid="grid-preview-menu"
          />
          <span>pageCode（按钮权限）</span>
          <Input
            value={pageCodeInput}
            onChange={(e) => setPageCodeInput(e.target.value)}
            placeholder="留空则用菜单 code"
            allowClear
            style={{ width: 200 }}
          />
          <span>formId（业务表单）</span>
          <Input
            value={formIdInput}
            onChange={(e) => setFormIdInput(e.target.value)}
            placeholder="留空则用「可见字段」记住的表单"
            allowClear
            style={{ width: 240 }}
            data-testid="grid-preview-formid"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => setRefreshToken((n) => n + 1)}
          >
            刷新配置
          </Button>
        </Space>
      </Card>

      {!formId && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="未确定业务表单，无法加载真实数据"
          description="请先在「数据权限配置 → 可见字段」里为该菜单选择业务表单（表单选择会被按菜单记住），或在上方直接填写 formId。"
        />
      )}

      <Card variant="outlined" size="small">
        <ScopeGrid<RealRow>
          menuId={menuId}
          scopeId={0}
          pageCode={effectivePageCode}
          formId={formId || undefined}
          rowKey="id"
          request={request}
          fallbackColumns={DEFAULT_COLUMNS}
          onConfigsChange={(list) => setConfigs(list as ScopeFieldConfig[])}
          onSaveColumns={handleSaveColumns}
          onCellSave={handleCellSave}
          componentControl
          browserEditable
          /**
           * 编辑形态：`cell` = 可编辑列常驻输入控件（失焦即存）；`row` = 操作列点「编辑」
           * 进入行编辑态，行尾「保存 / 取消」，只提交该行实际改动的格子。
           *
           * <p>「哪些列可编辑」由字段配置的 `is_editable=1` 决定（唯一配置源）；
           * 形态只决定**可编辑列的呈现与提交粒度**。</p>
           */
          editMode={editMode}
          defaultEditable={editMode === 'cell'}
          onRowAdd={handleRowAdd}
          onRowDelete={handleRowDelete}
          refreshToken={refreshToken}
          renderRightButton={() => (
            <Space size={8}>
              <Segmented
                size="small"
                value={editMode}
                onChange={(v) => setEditMode(v as 'cell' | 'row')}
                options={[
                  { label: '单元格编辑', value: 'cell' },
                  { label: '行编辑', value: 'row' },
                ]}
              />
              <Tag color="blue">{configs.length} 个字段配置</Tag>
            </Space>
          )}
          tableProps={{
            search: false,
            options: false,
            toolBarRender: false,
          }}
        />
      </Card>
    </PageContainer>
  );
};

export default GridPreview;
