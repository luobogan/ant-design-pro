/**
 * 通用列表（ScopeGrid）配置预览页
 *
 * 界面路径：/authority/datascope/grid（静态声明，与 /authority/datascope/fields 同属
 * 数据权限模块的辅助页，无独立 blade_menu 行）。
 * 入口：数据权限配置弹窗「可见字段」区域的「列表预览」按钮，带 ?menuId= 自动带入菜单。
 *
 * 用途：把「可见字段勾选 → 前端动态列 → 字段级权限 → 按钮权限」整条链路可视化，
 * 用 mock 数据渲染，不依赖任何业务接口；管理员可把当前列配置保存为菜单级默认列。
 */
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import { App, Alert, Button, Card, Input, Select, Space, Switch, Tag } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import ScopeGrid from '@/components/ScopeGrid';
import { getFieldTypeLabel } from '@/components/FormMode/fieldTypes';
import {
  submitScopeFields,
  type ScopeFieldConfig,
} from '@/services/authority/dataPermission';
import * as menuApi from '@/services/system/menu';

interface MenuOption {
  value: string;
  label: string;
  code?: string;
}

interface MockRow {
  id: string;
  [key: string]: any;
}

/**
 * 各「组件字段类型」的 mock 示例值（键为 getFieldTypeLabel 的中文标签）。
 * 预览页据此让每列呈现对应组件的样子：人力资源/部门列显示人名、部门名，
 * 日期列显示日期，附件列显示文件名 —— 而不是一律「字段名 - 序号」。
 */
const COMP_MOCK_VALUES: Record<string, any[]> = {
  人力资源: ['张三', '李四', '王五'],
  多人力资源: ['张三、李四', '王五、赵六'],
  部门: ['技术部', '财务部', '市场部'],
  多部门: ['技术部、财务部', '市场部、运营部'],
  分部: ['华东分部', '华南分部'],
  角色: ['管理员', '普通角色'],
  岗位: ['部门经理', '业务专员'],
  日期: ['2026-11-14', '2026-12-01', '2027-01-08'],
  时间: ['2026-11-14 10:00:00', '2026-12-01 09:30:00'],
  下拉框: ['选项A', '选项B', '选项C'],
  单选框: ['选项A', '选项B'],
  复选框: ['是', '否'],
  附件上传: ['合同.pdf', '发票.jpg'],
  图片上传: ['照片.png', '现场.jpg'],
  整数: [1000, 2000, 3000],
  浮点数: [12.5, 23.75, 41.2],
  多行文本: ['多行内容 1', '多行内容 2'],
};

/** 无列配置时的回退列，保证预览页不白屏（与 ScopeGrid 的 fail-open 契约一致） */
const DEFAULT_COLUMNS: ProColumns<MockRow>[] = [
  { title: 'ID', dataIndex: 'id', width: 90, hideInSearch: true },
  { title: '名称', dataIndex: 'name', hideInSearch: true },
  { title: '编码', dataIndex: 'code', hideInSearch: true },
  { title: '状态', dataIndex: 'status', hideInSearch: true },
  { title: '创建时间', dataIndex: 'createTime', valueType: 'dateTime', hideInSearch: true },
];

const GridPreview: React.FC = () => {
  const { message } = App.useApp();
  const location = useLocation();
  // Umi Max 的 useLocation() 不带 query 属性，必须自行解析 search，
  // 否则 ?menuId= 会被丢掉、列配置请求根本不会发出。
  const queryMenuId = useMemo(
    () => new URLSearchParams(location.search || '').get('menuId') || undefined,
    [location.search],
  );

  const [menus, setMenus] = useState<MenuOption[]>([]);
  const [menuId, setMenuId] = useState<string | undefined>(queryMenuId);
  const [pageCodeInput, setPageCodeInput] = useState<string>('');
  const [formId, setFormId] = useState<string>('');
  const [configs, setConfigs] = useState<ScopeFieldConfig[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  // 打开即处于编辑态（参考 antdprov5 EditableProTable 把 editableKeys 初始化为所有行）
  const [alwaysEdit, setAlwaysEdit] = useState(true);

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
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (queryMenuId) setMenuId(queryMenuId);
  }, [queryMenuId]);

  const menuCode = useMemo(
    () => menus.find((m) => m.value === menuId)?.code,
    [menus, menuId],
  );
  const effectivePageCode = pageCodeInput || menuCode || '';

  /** 按当前列配置补齐 mock 值，直观看到「勾选了哪些字段就显示哪些列」 */
  const baseRows = useMemo<MockRow[]>(() => {
    const visible = configs.filter((c) => c?.fieldName && c.isVisible !== 0);
    const names = visible.length
      ? visible.map((c) => c.fieldName)
      : ['id', 'name', 'code', 'status', 'createTime'];
    const cfgByName = new Map(configs.map((c) => [c.fieldName, c]));
    return Array.from({ length: 8 }, (_, i) => {
      const row: MockRow = { id: String(i + 1) };
      names.forEach((n) => {
        if (row[n] != null) return;
        const cfg = cfgByName.get(n);
        const html = String(cfg?.fieldHtmlType ?? '');
        const sub = String(cfg?.fieldType ?? '');
        // 组件字段类型（与列头标签、字段元数据表格同源）：人力资源 / 部门 / 日期 …
        const compLabel = html ? getFieldTypeLabel(html, sub) : '';
        const db = String(cfg?.fieldDbType || '').toLowerCase();
        if (COMP_MOCK_VALUES[compLabel]) {
          const pool = COMP_MOCK_VALUES[compLabel];
          row[n] = pool[i % pool.length];
        } else if (/datetime|timestamp/.test(db)) row[n] = '2026-11-14 10:00:00';
        else if (/^date$|^time$/.test(db)) row[n] = '2026-11-14';
        else if (/int|decimal|numeric|float|double|bigint/.test(db)) row[n] = (i + 1) * 1000;
        else if (/text|blob|json/.test(db)) row[n] = `${n} 多行内容 ${i + 1}`;
        else if (/time|date/i.test(n)) row[n] = '2026-11-14 10:00:00';
        else row[n] = `${n} - ${i + 1}`;
      });
      return row;
    });
  }, [configs]);

  // 预览页用本地 state 承接行内编辑结果（mock 环境，无业务写接口）
  const [dataSource, setDataSource] = useState<MockRow[]>([]);
  useEffect(() => {
    setDataSource(baseRows);
  }, [baseRows]);

  /** 操作栏演示：mock 数据下的新增 / 删除，不落库 */
  const addRow = () => {
    const names = configs.filter((c) => c?.fieldName && c.isVisible !== 0).map((c) => c.fieldName);
    const row: MockRow = { id: `new_${Date.now()}` };
    names.forEach((n) => { row[n] = `${n} - 新增`; });
    setDataSource((prev) => [...prev, row]);
    message.success('已新增一行（仅本地 mock）');
  };

  const removeRows = (ids: React.Key[]) => {
    if (!ids.length) return;
    const idSet = new Set(ids.map(String));
    setDataSource((prev) => prev.filter((r) => !idSet.has(String(r.id))));
    setSelectedKeys([]);
    message.success(`已删除 ${ids.length} 行（仅本地 mock）`);
  };

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
        description="从数据权限配置弹窗「可见字段」区域的「列表预览」进入，会自动带入当前菜单。勾选的可见字段决定本页列；字段级权限按当前用户叠加；工具栏与行内操作按钮由 /menu/buttons 按角色下发。本页用 mock 数据，不依赖业务接口。"
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
          <span>formId（字段权限）</span>
          <Input
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
            placeholder="可选，按当前用户叠加"
            allowClear
            style={{ width: 200 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => setRefreshToken((n) => n + 1)}
          >
            刷新配置
          </Button>
        </Space>
      </Card>

      <Card variant="outlined" size="small">
        <ScopeGrid<MockRow>
          menuId={menuId}
          scopeId={0}
          pageCode={effectivePageCode}
          formId={formId || undefined}
          rowKey="id"
          dataSource={dataSource}
          fallbackColumns={DEFAULT_COLUMNS}
          onConfigsChange={(list) => setConfigs(list as ScopeFieldConfig[])}
          onSaveColumns={handleSaveColumns}
          defaultEditable={alwaysEdit}
          showFieldType
          componentControl
          onCellSave={({ row, fieldName, value }) => {
            setDataSource((prev) =>
              prev.map((r) => (r.id === row.id ? { ...r, [fieldName]: value } : r)),
            );
            message.success(`已更新 ${fieldName}`);
          }}
          refreshToken={refreshToken}
          onSelectRow={(keys) => setSelectedKeys(keys)}
          rowActions={(record) => [
            <Button
              key="view"
              type="link"
              size="small"
              onClick={() => message.info(`查看行 ${record.id}`)}
            >
              查看
            </Button>,
            <Button
              key="edit"
              type="link"
              size="small"
              onClick={() => message.info(`编辑行 ${record.id}`)}
            >
              编辑
            </Button>,
            <Button
              key="remove"
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => removeRows([record.id])}
            >
              删除
            </Button>,
          ]}
          renderLeftButton={() => [
            <Button
              key="add"
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={addRow}
            >
              新增一行
            </Button>,
            <Button
              key="batch"
              size="small"
              danger
              disabled={!selectedKeys.length}
              onClick={() => removeRows(selectedKeys)}
            >
              {selectedKeys.length ? `批量删除 (${selectedKeys.length})` : '批量删除'}
            </Button>,
          ]}
          onButtonClick={({ btn }) =>
            message.info(`按钮 ${btn.name || btn.code} 由业务页处理（此处仅演示权限分派）`)
          }
          renderRightButton={() => (
            <Space size={8}>
              <Switch
                size="small"
                checked={alwaysEdit}
                onChange={setAlwaysEdit}
                data-testid="grid-preview-always-edit"
              />
              <span style={{ fontSize: 12 }}>默认编辑</span>
              <Tag color="blue">{configs.length} 个字段配置</Tag>
            </Space>
          )}
          tableProps={{
            search: false,
            options: false,
            toolBarRender: false,
            pagination: { pageSize: 5 },
          }}
        />
      </Card>
    </PageContainer>
  );
};

export default GridPreview;
