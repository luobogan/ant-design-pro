import type { FieldDef, ModuleDef } from './types';

/** 通用选项：启用/停用 */
const STATUS_OPTIONS = [
  { label: '启用', value: '1' },
  { label: '停用', value: '0' },
];

const enabledText = (v: any) => (Number(v) === 1 ? '启用' : '停用');

/**
 * 门户工作台内容模块注册表。
 * key 与门户菜单 routeUrl 末段一致，保证「点菜单 -> 切内容」一一对应。
 * 与已授权给普通人员的 5 个终端门户菜单对齐：
 * 门户首页 / 公告详情 / 机构默认首页 / 协同区 / 特色门户。
 */
export const MODULES: ModuleDef[] = [
  {
    key: 'home',
    title: '门户概览',
    subtitle: '当前登录人所见门户的基础信息（只读）',
    matchPaths: ['/portal/home'],
    readOnly: true,
    fields: [
      { name: 'title', label: '门户名称', type: 'text' },
      { name: 'code', label: '门户编码', type: 'text' },
      { name: 'owner', label: '负责人', type: 'text' },
      { name: 'theme', label: '主题', type: 'tag' },
      { name: 'status', label: '状态', type: 'select', options: STATUS_OPTIONS, render: (v) => enabledText(v) },
      { name: 'updatedAt', label: '更新时间', type: 'date' },
      { name: 'remark', label: '说明', type: 'textarea', hideInTable: true },
    ],
    seed: [
      {
        title: '集团门户',
        code: 'default',
        owner: '门户管理员',
        theme: '蓝白',
        status: '1',
        updatedAt: '2026-10-17',
        remark: '普通人员登录后的默认落地门户。',
      },
    ],
  },
  {
    key: 'noticedetail',
    title: '公告管理',
    subtitle: '维护门户公告，支持新增、编辑、删除与关键字/类型查询',
    matchPaths: ['/portal/noticedetail'],
    fields: [
      { name: 'title', label: '公告标题', type: 'text', required: true, placeholder: '请输入公告标题' },
      {
        name: 'category',
        label: '公告类型',
        type: 'select',
        required: true,
        initialValue: '通知',
        options: [
          { label: '通知', value: '通知' },
          { label: '公告', value: '公告' },
          { label: '新闻', value: '新闻' },
        ],
      },
      { name: 'publisher', label: '发布人', type: 'text' },
      { name: 'publishDate', label: '发布日期', type: 'date' },
      { name: 'top', label: '是否置顶', type: 'switch', initialValue: 0 },
      {
        name: 'status',
        label: '状态',
        type: 'select',
        options: [
          { label: '草稿', value: '草稿' },
          { label: '已发布', value: '已发布' },
          { label: '已下线', value: '已下线' },
        ],
      },
      { name: 'content', label: '正文', type: 'textarea', hideInTable: true, placeholder: '请输入公告正文' },
    ],
    seed: [
      {
        title: '关于门户工作台上线的通知',
        category: '通知',
        publisher: '门户管理员',
        publishDate: '2026-10-16',
        top: 1,
        status: '已发布',
        content: '门户工作台已上线，支持左侧菜单切换与内联增删改查。',
      },
      {
        title: '2026 年第三季度制度更新',
        category: '公告',
        publisher: '综合管理部',
        publishDate: '2026-10-10',
        top: 0,
        status: '已发布',
        content: '请各部门查阅最新制度汇编。',
      },
      {
        title: '系统维护窗口说明',
        category: '新闻',
        publisher: '运维组',
        publishDate: '2026-10-08',
        top: 0,
        status: '草稿',
        content: '本周六 22:00-24:00 停机维护。',
      },
    ],
  },
  {
    key: 'defaultportal',
    title: '机构默认首页',
    subtitle: '按机构配置默认落地门户与布局',
    fields: [
      { name: 'orgName', label: '机构名称', type: 'text', required: true, placeholder: '请输入机构名称' },
      { name: 'orgCode', label: '机构编码', type: 'text' },
      { name: 'portalCode', label: '门户编码', type: 'text' },
      {
        name: 'layoutType',
        label: '布局方式',
        type: 'select',
        options: [
          { label: '单栏', value: '单栏' },
          { label: '左右分栏', value: '左右分栏' },
          { label: '三栏', value: '三栏' },
        ],
      },
      { name: 'sort', label: '排序', type: 'number' },
      { name: 'status', label: '状态', type: 'select', options: STATUS_OPTIONS, render: (v) => enabledText(v) },
      { name: 'remark', label: '备注', type: 'textarea', hideInTable: true },
    ],
    seed: [
      {
        orgName: '集团总部',
        orgCode: '1000000006',
        portalCode: 'default',
        layoutType: '左右分栏',
        sort: 1,
        status: '1',
        remark: '总部默认门户。',
      },
      {
        orgName: '华东分公司',
        orgCode: '1000000007',
        portalCode: 'default',
        layoutType: '单栏',
        sort: 2,
        status: '1',
        remark: '分公司门户。',
      },
    ],
  },
  {
    key: 'synergy',
    title: '协同区管理',
    subtitle: '维护门户协同面板绑定的流程/表单/节点',
    fields: [
      { name: 'title', label: '协同区标题', type: 'text', required: true, placeholder: '请输入协同区标题' },
      {
        name: 'areaType',
        label: '区域类型',
        type: 'select',
        required: true,
        options: [
          { label: '流程协同', value: '流程协同' },
          { label: '表单协同', value: '表单协同' },
          { label: '节点协同', value: '节点协同' },
        ],
      },
      { name: 'bindName', label: '绑定流程', type: 'text' },
      { name: 'sort', label: '排序', type: 'number' },
      { name: 'status', label: '状态', type: 'select', options: STATUS_OPTIONS, render: (v) => enabledText(v) },
      { name: 'remark', label: '说明', type: 'textarea', hideInTable: true },
    ],
    seed: [
      {
        title: '合同审批待办',
        areaType: '流程协同',
        bindName: '合同审批流程',
        sort: 1,
        status: '1',
        remark: '展示合同审批待办入口。',
      },
      {
        title: '请假表单协同',
        areaType: '表单协同',
        bindName: '请假申请流程',
        sort: 2,
        status: '1',
        remark: '展示请假表单关键字段。',
      },
    ],
  },
  {
    key: 'tsportal',
    title: '特色门户',
    subtitle: '按模板维护多个特色门户',
    fields: [
      { name: 'title', label: '门户名称', type: 'text', required: true, placeholder: '请输入门户名称' },
      { name: 'code', label: '门户编码', type: 'text' },
      {
        name: 'template',
        label: '模板',
        type: 'select',
        options: [
          { label: '标准模板', value: '标准模板' },
          { label: '三栏仪表盘', value: '三栏仪表盘' },
          { label: '简洁模板', value: '简洁模板' },
        ],
      },
      { name: 'sort', label: '排序', type: 'number' },
      { name: 'status', label: '状态', type: 'select', options: STATUS_OPTIONS, render: (v) => enabledText(v) },
      { name: 'remark', label: '描述', type: 'textarea', hideInTable: true },
    ],
    seed: [
      {
        title: '营销门户',
        code: 'tsportal_market',
        template: '三栏仪表盘',
        sort: 1,
        status: '1',
        remark: '面向营销团队的特色门户。',
      },
      {
        title: '提案门户',
        code: 'tsportal_proposal',
        template: '标准模板',
        sort: 2,
        status: '0',
        remark: '提案流程专用门户。',
      },
    ],
  },
];

/** key -> 模块定义 */
export const MODULE_MAP: Record<string, ModuleDef> = MODULES.reduce(
  (acc, m) => {
    acc[m.key] = m;
    return acc;
  },
  {} as Record<string, ModuleDef>,
);

/** 菜单 routeUrl -> 模块 key（末段优先，再回退到 matchPaths 精确匹配） */
export function resolveModuleKey(routeUrl?: string): string | undefined {
  if (!routeUrl) return undefined;
  const normalized = routeUrl.split('?')[0].replace(/\/+$/, '');
  const seg = normalized.slice(normalized.lastIndexOf('/') + 1).toLowerCase();
  if (MODULE_MAP[seg]) return seg;
  return MODULES.find((m) => (m.matchPaths || []).some((p) => p.toLowerCase() === normalized.toLowerCase()))?.key;
}

/** 取模块定义 */
export function getModule(key?: string): ModuleDef | undefined {
  return key ? MODULE_MAP[key] : undefined;
}

/** 查询区 / 表单区可见字段 */
export function visibleFields(module: ModuleDef, area: 'query' | 'form'): FieldDef[] {
  return module.fields.filter((f) => (area === 'query' ? !f.hideInQuery : !f.hideInForm));
}

/** 表格可见字段 */
export function tableFields(module: ModuleDef): FieldDef[] {
  return module.fields.filter((f) => !f.hideInTable);
}