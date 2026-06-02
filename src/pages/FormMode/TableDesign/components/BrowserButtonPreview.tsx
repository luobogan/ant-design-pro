import React, { useState, useCallback } from 'react';
import { Modal, Table, Button, Input, Tag, Space, message, Tooltip, Select } from 'antd';
import { SearchOutlined, CloseOutlined, CheckOutlined, TeamOutlined, ApartmentOutlined,
  UserSwitchOutlined, ShareAltOutlined, SafetyCertificateOutlined, LockOutlined } from '@ant-design/icons';

// ==================== 浏览器类型枚举定义（完整35+种）====================
interface BrowserTypeConfig {
  typeId: number;
  label: string;
  icon: React.ReactNode;
  description: string;
  singleSelect: boolean;
  category: string;        // 分类
  businessScenario?: string; // 业务场景描述
}

const BROWSER_TYPE_CONFIGS: Record<number, BrowserTypeConfig> = {
  // ========== 人员类别 ==========
  1:   { typeId: 1,   label: '人力资源',          icon: <UserSwitchOutlined />, description: '选择单个/多个人员',             singleSelect: false, category: 'hrm', businessScenario: '基础人员选择，适用于任务分配、审批指定等场景' },
  161: { typeId: 161, label: '多人力资源',         icon: <TeamOutlined />,       description: '支持批量选择大量人员',           singleSelect: false, category: 'hrm', businessScenario: '【多人员任务调度】支持动态分配与进度追踪，批量指派任务给多个人员' },
  162: { typeId: 162, label: '应聘人',             icon: <UserSwitchOutlined />, description: '招聘场景下的人员选择',         singleSelect: false, category: 'hrm', businessScenario: '招聘流程中候选人选择，支持面试评估与录用决策' },
  163: { typeId: 163, label: '多角色',             icon: <TeamOutlined />,       description: '同时选择多个角色关联人员',     singleSelect: false, category: 'hrm', businessScenario: '基于角色的批量人员选择，支持按角色筛选并分配' },
  165: { typeId: 165, label: '人力资源条件',       icon: <SearchOutlined />,     description: '按条件筛选人力资源',            singleSelect: false, category: 'hrm', businessScenario: '按部门/职级/状态等条件动态筛选人员池' },
  166: { typeId: 166, label: '角色人员',           icon: <ShareAltOutlined />,    description: '按角色筛选关联人员',            singleSelect: false, category: 'hrm', businessScenario: '先选角色再选人，确保所选人员具备相应权限' },
  167: { typeId: 167, label: '分权单人力资源',     icon: <SafetyCertificateOutlined />, description: '分权范围内的单人选择',         singleSelect: true,  category: 'hrm', businessScenario: '【数据隔离】当前用户只能看到自己权限范围内的人员' },
  168: { typeId: 168, label: '分权多人力资源',     icon: <SafetyCertificateOutlined />, description: '分权范围内多人选择',           singleSelect: false, category: 'hrm', businessScenario: '【数据隔离+多人】分权范围内批量选择人员' },

  // ========== 组织类别 ==========
  2:   { typeId: 2,   label: '部门',               icon: <ApartmentOutlined />,  description: '选择单个/多个部门',             singleSelect: false, category: 'org', businessScenario: '基础部门选择，用于审批流转、数据归属' },
  17:  { typeId: 17,  label: '多部门',             icon: <ApartmentOutlined />,  description: '支持批量选择大量部门',           singleSelect: false, category: 'org', businessScenario: '【跨部门资源分配】多部门协作场景，资源在部门间高效流转' },
  18:  { typeId: 18,  label: '分部',               icon: <ApartmentOutlined />,  description: '选择公司分支机构',              singleSelect: false, category: 'org', businessScenario: '集团化架构下的分支机构选择' },
  19:  { typeId: 19,  label: '分权单部门',         icon: <LockOutlined />,       description: '分权范围内的单个部门选择',       singleSelect: true,  category: 'org', businessScenario: '【数据隔离】仅显示有权限的部门' },
  20:  { typeId: 20,  label: '分权多部门',         icon: <LockOutlined />,       description: '分权范围内多部门选择',           singleSelect: false, category: 'org', businessScenario: '【数据隔离+多部门】分权范围内跨部门协作' },
  21:  { typeId: 21,  label: '分权单分部',         icon: <LockOutlined />,       description: '分权范围内的单个分部选择',       singleSelect: true,  category: 'org', businessScenario: '【数据隔离】仅显示有权限的分部' },
  22:  { typeId: 22,  label: '分权多分部',         icon: <LockOutlined />,       description: '分权范围内多分部选择',           singleSelect: false, category: 'org', businessScenario: '【数据隔离+多分部】分权范围内多分支协作' },
  23:  { typeId: 23,  label: '多分部',             icon: <ApartmentOutlined />,  description: '批量选择多个分部',               singleSelect: false, category: 'org', businessScenario: '集团多分支机构的批量操作' },
  25:  { typeId: 25,  label: '办公地点',           icon: <ApartmentOutlined />,  description: '选择办公地点/位置',              singleSelect: false, category: 'org', businessScenario: '考勤、会议室预订等场景的位置选择' },

  // ========== 流程类别 ==========
  30:  { typeId: 30,  label: '流程',               icon: null,                  description: '选择工作流流程',                 singleSelect: true,  category: 'workflow', businessScenario: '流程发起时的流程模板选择' },
  31:  { typeId: 31,  label: '多流程',             icon: null,                  description: '批量选择多个工作流流程',          singleSelect: false, category: 'workflow', businessScenario: '【协同审批流转】会签/或签逻辑：多个审批流并行或串行执行' },
  32:  { typeId: 32,  label: '归档流程',           icon: null,                  description: '选择已归档的流程实例',           singleSelect: false, category: 'workflow', businessScenario: '查看和引用历史归档的流程记录' },

  // ========== 文档类别 ==========
  24:  { typeId: 24,  label: '文档',               icon: null,                  description: '选择文档中心文档',                singleSelect: false, category: 'doc', businessScenario: '知识库文档引用与关联' },
  26:  { typeId: 26,  label: '多文档',             icon: null,                  description: '批量选择多个文档',                singleSelect: false, category: 'doc', businessScenario: '批量关联多个文档到表单中' },

  // ========== 系统类别 ==========
  98:  { typeId: 98,  label: '日期',               icon: null,                  description: '日期选择器',                      singleSelect: true,  category: 'system' },
  99:  { typeId: 99,  label: '时间',               icon: null,                  description: '时间选择器',                      singleSelect: true,  category: 'system' },
  100: { typeId: 100, label: '省份',               icon: null,                  description: '省份选择',                        singleSelect: false, category: 'system' },
  101: { typeId: 101, label: '币种',               icon: null,                  description: '货币币种选择',                    singleSelect: true,  category: 'system' },
  102: { typeId: 102, label: '城市',               icon: null,                  description: '城市选择',                        singleSelect: false, category: 'system' },
  103: { typeId: 103, label: '区县',               icon: null,                  description: '区县级选择',                      singleSelect: false, category: 'system' },
  104: { typeId: 104, label: '年份',               icon: null,                  description: '年份选择',                        singleSelect: true,  category: 'system' },
  105: { typeId: 105, label: '语言',               icon: null,                  description: '语言选择',                        singleSelect: true,  category: 'system' },

  // ========== 其他类别 ==========
  3:   { typeId: 3,   label: '角色',               icon: null,                  description: '选择系统角色',                    singleSelect: false, category: 'hrm' },
  4:   { typeId: 4,   label: '岗位',               icon: null,                  description: '选择岗位信息',                    singleSelect: false, category: 'hrm' },
  8:   { typeId: 8,   label: '项目',               icon: null,                  description: '选择项目管理项目',                singleSelect: true,  category: 'project' },
  16:  { typeId: 16,  label: '相关客户',           icon: null,                  description: '选择CRM客户',                     singleSelect: true,  category: 'customer' },
  57:  { typeId: 57,  label: '附件',               icon: null,                  description: '附件上传与选择',                  singleSelect: false, category: 'asset' },
  164: { typeId: 164, label: '自定义浏览按钮',     icon: null,                  description: '自定义数据源浏览框',              singleSelect: false, category: 'asset' },
  256: { typeId: 256, label: '自定义树形单选',     icon: null,                  description: '树形结构单选',                   singleSelect: true,  category: 'asset' },
  257: { typeId: 257, label: '自定义树形多选',     icon: null,                  description: '树形结构多选',                   singleSelect: false, category: 'asset' },
};

// ==================== 预览模拟数据（完整业务场景）====================
interface PreviewItem {
  id: string;
  name: string;
  code?: string;
  description?: string;
  status?: string;
}

const PREVIEW_DATA: Record<number, PreviewItem[]> = {
  // ========== 人员类别 ==========
  1: [
    { id: '1001', name: '张三', code: 'ZS001', description: '技术部-开发工程师', status: '在职' },
    { id: '1002', name: '李四', code: 'LS002', description: '市场部-市场专员', status: '在职' },
    { id: '1003', name: '王五', code: 'WW003', description: '财务部-财务主管', status: '在职' },
    { id: '1004', name: '赵六', code: 'ZL004', description: '人事部-HR经理', status: '在职' },
    { id: '1005', name: '孙七', code: 'SQ005', description: '行政部-行政专员', status: '离职' },
    { id: '1006', name: '周八', code: 'ZB006', description: '技术部-高级工程师', status: '在职' },
    { id: '1007', name: '吴九', code: 'WJ007', description: '产品部-产品经理', status: '在职' },
    { id: '1008', name: '郑十', code: 'ZS008', description: '运维部-运维工程师', status: '在职' },
  ],
  // 多人力资源 - 【多人员任务调度】动态分配与进度追踪
  161: [
    { id: '2001', name: '张三', code: 'ZS001', description: '技术部 | 任务：OA模块开发 | 进度：80%', status: '进行中' },
    { id: '2002', name: '李四', code: 'LS002', description: '市场部 | 任务：Q3推广方案 | 进度：45%', status: '进行中' },
    { id: '2003', name: '王五', code: 'WW003', description: '财务部 | 任务：月度预算审核 | 进度：100%', status: '已完成' },
    { id: '2004', name: '赵六', code: 'ZL004', description: '人事部 | 任务：招聘计划制定 | 进度：60%', status: '进行中' },
    { id: '2005', name: '周八', code: 'ZB006', description: '技术部 | 任务：性能优化 | 进度：30%', status: '进行中' },
    { id: '2006', name: '吴九', code: 'WJ007', description: '产品部 | 任务：需求评审 | 进度：90%', status: '待验收' },
    { id: '2007', name: '郑十', code: 'ZS008', description: '运维部 | 任务：服务器巡检 | 进度：100%', status: '已完成' },
    { id: '2008', name: '陈十一', code: 'SY011', description: '测试部 | 任务：回归测试 | 进度：70%', status: '进行中' },
  ],
  // 应聘人
  162: [
    { id: 'A001', name: '林小明', code: 'AP001', description: '前端工程师 | 面试轮次：3/3 | 评分：92', status: '待录用' },
    { id: 'A002', name: '陈小红', code: 'AP002', description: 'Java开发 | 面试轮次：2/3 | 评分：85', status: '面试中' },
    { id: 'A003', name: '王小刚', code: 'AP003', description: '产品经理 | 面试轮次：1/3 | 评分：-', status: '初筛通过' },
    { id: 'A004', name: '李小华', code: 'AP004', description: '测试工程师 | 面试轮次：3/3 | 评分：78', status: '已淘汰' },
  ],
  // 多角色
  163: [
    { id: 'MR001', name: '系统管理员角色', code: 'ROLE_ADMIN', description: '关联：张三、李四 | 权限：全系统', status: '3人' },
    { id: 'MR002', name: '部门经理角色', code: 'ROLE_MGR',   description: '关联：王五、赵六、周八 | 权限：本部门', status: '3人' },
    { id: 'MR003', name: '审批角色',     code: 'ROLE_APPROVE', description: '关联：吴九、郑十 | 权限：流程审批', status: '2人' },
  ],
  // 人力资源条件
  165: [
    { id: 'COND1', name: '技术部在职人员',      description: '部门=技术部 AND 状态=在职 | 匹配：6人' },
    { id: 'COND2', name: '高级及以上职级',       description: '职级>=P7 | 匹配：12人' },
    { id: 'COND3', name: '2024年新入职员工',    description: '入职时间>=2024-01-01 | 匹配：28人' },
  ],
  // 角色人员
  166: [
    { id: 'RP001', name: '张三(系统管理员)',  code: 'ZS001', description: '角色：管理员 | 技术部', status: '在线' },
    { id: 'RP002', name: '王五(部门经理)',    code: 'WW003', description: '角色：经理 | 财务部', status: '在线' },
    { id: 'RP003', name: '周八(审批人)',      code: 'ZB006', description: '角色：审批人 | 技术部', status: '忙碌' },
  ],

  // ========== 组织类别 ==========
  2: [
    { id: 'D001', name: '技术部', code: 'JS', description: '负责技术研发', status: '启用' },
    { id: 'D002', name: '市场部', code: 'SC', description: '负责市场营销', status: '启用' },
    { id: 'D003', name: '财务部', code: 'CW', description: '负责财务管理', status: '启用' },
    { id: 'D004', name: '人事部', code: 'RS', description: '负责人力资源管理', status: '启用' },
    { id: 'D005', name: '行政部', code: 'XZ', description: '负责行政管理', status: '启用' },
  ],
  // 多部门 - 【跨部门资源分配】资源高效流转
  17: [
    { id: 'MD001', name: '技术部', code: 'JS', description: '服务器池：5台(已分配3台) 利用率：60%', status: '可协作' },
    { id: 'MD002', name: '市场部', code: 'SC', description: '预算池：50万(已用32万) 剩余：18万', status: '可协作' },
    { id: 'MD003', name: '财务部', code: 'CW', description: '审批额度：100万(已批67万)', status: '需申请' },
    { id: 'MD004', name: '人事部', code: 'RS', description: '编制：20人(在岗17人) 空缺：3人', status: '可协作' },
    { id: 'MD005', name: '产品部', code: 'CP', description: '设计工时：800h(已用520h)', status: '可协作' },
  ],
  // 分部
  18: [
    { id: 'BR001', name: '北京分公司', code: 'BJ', description: '华北总部 | 320人', status: '运营中' },
    { id: 'BR002', name: '上海分公司', code: 'SH', description: '华东总部 | 280人', status: '运营中' },
    { id: 'BR003', name: '深圳分公司', code: 'SZ', description: '华南总部 | 150人', status: '运营中' },
  ],
  // 分权单部门 - 【数据隔离】
  19: [
    { id: 'DD001', name: '技术部', code: 'JS', description: '可见范围：当前用户 | 权限：完全访问', status: '有权限' },
    { id: 'DD002', name: '产品部', code: 'CP', description: '可见范围：当前用户 | 权限：只读访问', status: '有限权限' },
  ],
  // 分权多部门 - 【协同审批流转】会签/或签
  20: [
    { id: 'DDM01', name: '技术部', code: 'JS', description: '会签节点 | 审批进度：2/3通过', status: '审批中' },
    { id: 'DDM02', name: '产品部', code: 'CP', description: '或签节点 | 任一审批即可', status: '待处理' },
    { id: 'DDM03', name: '财务部', code: 'CW', description: '串行节点 | 等待上游完成', status: '等待中' },
  ],
  // 办公地点
  25: [
    { id: 'LOC001', name: '总部大厦-A座', code: 'HQ-A', description: '北京朝阳 | 1-15F | 工位500个' },
    { id: 'LOC002', name: '总部大厦-B座', code: 'HQ-B', description: '北京朝阳 | 16-25F | 工位300个' },
  ],

  // ========== 流程类别 ==========
  30: [
    { id: 'WF001', name: '请假审批流程', description: '员工请假审批', status: '启用' },
    { id: 'WF002', name: '费用报销流程', description: '费用报销审批', status: '启用' },
    { id: 'WF003', name: '采购审批流程', description: '采购申请审批', status: '启用' },
  ],
  // 多流程 - 会签/或签逻辑
  31: [
    { id: 'MW001', name: '采购主流程',     description: '串行 | 5节点 | 当前：财务审核', status: '运行中' },
    { id: 'MW002', name: '合同归档子流程',  description: '并行 | 3节点 | 法务+行政会签', status: '运行中' },
    { id: 'MW003', name: '付款执行子流程',  description: '条件分支 | >10万走特批', status: '待触发' },
  ],
  // 归档流程
  32: [
    { id: 'AW001', name: '2024-Q1请假记录', description: '归档：2024-04-02 | 156条', status: '已归档' },
    { id: 'AW002', name: '2024-Q1报销记录', description: '归档：2024-04-05 | 89条', status: '已归档' },
  ],

  // ========== 文档类别 ==========
  24: [
    { id: 'DOC001', name: '需求规格说明书', description: 'V2.1', status: '已审批' },
    { id: 'DOC002', name: '系统设计文档', description: 'V1.5', status: '草稿' },
    { id: 'DOC003', name: '测试用例文档', description: 'V3.0', status: '已审批' },
  ],
  // 多文档
  26: [
    { id: 'MD001', name: '需求文档合集.pdf',   description: '12份 | 24MB', status: '已关联' },
    { id: 'MD002', name: '设计稿合集.zip',     description: '35份 | 156MB', status: '已关联' },
  ],

  // ========== 其他原有类型 ==========
  3: [
    { id: 'R001', name: '系统管理员', description: '拥有系统最高权限' },
    { id: 'R002', name: '普通用户', description: '基础操作权限' },
    { id: 'R003', name: '审计角色', description: '审计监控权限' },
  ],
  4: [
    { id: 'P001', name: '开发工程师', description: '负责编码开发' },
    { id: 'P002', name: '测试工程师', description: '负责质量测试' },
    { id: 'P003', name: '产品经理', description: '负责产品规划' },
  ],
  8: [
    { id: 'PRJ001', name: 'OA办公系统', code: 'OA-2024', description: '内部OA系统升级' },
    { id: 'PRJ002', name: 'ERP管理系统', code: 'ERP-2024', description: '企业资源规划' },
  ],
  16: [
    { id: 'C001', name: '腾讯科技', code: 'TX', description: '互联网巨头' },
    { id: 'C002', name: '阿里巴巴', code: 'ALBB', description: '电商平台' },
  ],
  57: [
    { id: 'ATT001', name: '合同文件.pdf', description: '256KB', status: '已上传' },
    { id: 'ATT002', name: '项目报告.docx', description: '1.2MB', status: '已上传' },
  ],
  98: [
    { id: '2024-01-15', name: '2024-01-15', description: '星期一' },
    { id: '2024-06-15', name: '2024-06-15', description: '星期六' },
  ],
  99: [
    { id: '08:30', name: '08:30', description: '上午' },
    { id: '09:00', name: '09:00', description: '上午' },
    { id: '18:00', name: '18:00', description: '傍晚' },
  ],
  164: [
    { id: 'CB001', name: '自定义选项A', code: 'OPT_A', description: '自定义数据源A' },
    { id: 'CB002', name: '自定义选项B', code: 'OPT_B', description: '自定义数据源B' },
  ],
  256: [{ id: 'T001', name: '根节点', children: [{ id: 'T1-1', name: '子节点A' }] }],
  257: [{ id: 'M001', name: '分类一', children: [{ id: 'M1-1', name: '子项A1' }] }],
};

// ==================== Weaver E9 样式常量 ====================
const E9_STYLES = {
  e8ShowNameClass: {
    display: 'inline-block',
    background: '#f0f0f0',
    borderRadius: 3,
    padding: '2px 6px',
    margin: '1px 2px',
    fontSize: 12,
    lineHeight: '20px',
    position: 'relative' as const,
    border: '1px solid #e8e8e8',
  } as React.CSSProperties,
  e8ShowNameClassHover: {
    background: '#e6f7ff',
    borderColor: '#91d5ff',
  } as React.CSSProperties,
  e8DelClass: {
    cursor: 'pointer',
    color: '#ff4d4f',
    fontWeight: 'bold',
    fontSize: 12,
    padding: '0 3px',
    marginLeft: 4,
  } as React.CSSProperties,
  browserBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    border: '1px solid #0072C6',
    borderRadius: 3,
    background: '#0072C6',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: '22px',
    textAlign: 'center' as const,
    outline: 'none',
    padding: 0,
    margin: 0,
  } as React.CSSProperties,
  browserBtnHover: {
    background: '#0058a0',
    borderColor: '#0058a0',
  } as React.CSSProperties,
  e8os: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  } as React.CSSProperties,
  fieldSpan: {
    display: 'inline-block',
    verticalAlign: 'middle',
    minWidth: 60,
    maxWidth: 300,
    minHeight: 22,
    border: '1px solid #d9d9d9',
    borderRadius: 3,
    padding: '1px 4px',
    background: '#fff',
    fontSize: 12,
    lineHeight: '20px',
  } as React.CSSProperties,
  previewContainer: {
    background: '#fafafa',
    border: '1px solid #e8e8e8',
    borderRadius: 4,
    padding: 24,
    marginBottom: 16,
  } as React.CSSProperties,
  fieldLabel: {
    display: 'block',
    marginBottom: 6,
    fontWeight: 500,
    fontSize: 13,
    color: '#333',
  } as React.CSSProperties,
};

// ==================== Props 接口 ====================
interface BrowserButtonPreviewProps {
  visible: boolean;
  fieldLabel: string;
  browserType: number;
  onClose: () => void;
}

// ==================== 组件主体 ====================
const BrowserButtonPreview: React.FC<BrowserButtonPreviewProps> = ({
  visible,
  fieldLabel,
  browserType,
  onClose,
}) => {
  const config = BROWSER_TYPE_CONFIGS[browserType] || BROWSER_TYPE_CONFIGS[1];
  const [selectedItems, setSelectedItems] = useState<PreviewItem[]>([]);
  const [selectDialogVisible, setSelectDialogVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [deleteHoverIndex, setDeleteHoverIndex] = useState<number | null>(null);
  const [browserBtnHover, setBrowserBtnHover] = useState(false);
  const [tagHover, setTagHover] = useState(false);

  // 重置状态
  const resetState = useCallback(() => {
    setSelectedItems([]);
    setSelectDialogVisible(false);
    setSearchText('');
    setSelectedKeys([]);
    setDeleteHoverIndex(null);
    setBrowserBtnHover(false);
    setTagHover(false);
  }, []);

  // 获取预览数据
  const data = PREVIEW_DATA[browserType] || PREVIEW_DATA[1];

  // 搜索过滤
  const filteredData = data.filter(item =>
    item.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (item.code && item.code.toLowerCase().includes(searchText.toLowerCase()))
  );

  // 表格列定义 - 根据类型动态调整
  const getStatusColor = (val: string) => {
    if (!val) return 'default';
    if (['在职', '启用', '运营中', '已归档', '已关联', '有权限', '可协作', '在线', '已完成', '待验收'].includes(val)) return 'green';
    if (['离职', '需申请', '紧张', '有限权限', '离线', '已淘汰', '等待中', '忙碌'].includes(val)) return 'orange';
    if (['进行中', '面试中', '审批中', '运行中', '初筛通过', '待处理', '待录用', '待触发', '部分关联'].includes(val)) return 'blue';
    if (['已上传', '草稿', '已发布', '已审批'].includes(val)) return 'cyan';
    return 'default';
  };

  const hasStatusColumn = [1, 2, 161, 162, 163, 166, 167, 168, 17, 18, 19, 20, 25, 30, 31, 32, 24, 26, 57].includes(browserType);

  const selectColumns = [
    ...(browserType === 165 ? [{
      title: '条件名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    }] : [
      {
        title: browserType === 161 || browserType === 162 || browserType === 17 || browserType === 31 ? '人员/部门' :
              browserType === 163 || browserType === 166 ? '角色' :
              browserType === 18 ? '分部' : '名称',
        dataIndex: 'name',
        key: 'name',
        width: browserType === 161 || browserType === 17 ? 140 : 160,
      },
    ]),
    {
      title: browserType === 161 ? '任务与进度' :
            browserType === 162 ? '面试信息' :
            browserType === 163 ? '关联人员' :
            browserType === 165 ? '筛选条件' :
            browserType === 166 ? '角色与部门' :
            browserType === 17 ? '资源池状态' :
            browserType === 18 ? '区域信息' :
            browserType === 19 || browserType === 20 ? '权限/协同状态' :
            browserType === 31 ? '流程配置' :
            browserType === 32 ? '归档信息' :
            browserType === 26 ? '文档集合' : '描述',
      dataIndex: 'description',
      key: 'description',
    },
    ...(hasStatusColumn ? [{
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (val: string) => val ? <Tag color={getStatusColor(val)}>{val}</Tag> : '-',
    }] : []),
  ];

  // 打开选择对话框
  const handleOpenSelectDialog = () => {
    setSelectedKeys(selectedItems.map(item => item.id));
    setSearchText('');
    setSelectDialogVisible(true);
  };

  // 确认选择
  const handleSelectConfirm = () => {
    const newSelected = data.filter(item => selectedKeys.includes(item.id));
    setSelectedItems(newSelected);
    setSelectDialogVisible(false);
    message.success(`已选择 ${newSelected.length} 项`);
  };

  // 删除选中项
  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(prev => prev.filter(item => item.id !== itemId));
  };

  // 渲染选中值的标签
  const renderSelectedTags = () => {
    if (selectedItems.length === 0) {
      return <span style={{ color: '#bfbfbf', fontSize: 12 }}>请点击浏览按钮选择{config.label}</span>;
    }
    return selectedItems.map((item, index) => (
      <span
        key={item.id}
        className="e8_showNameClass"
        style={{
          ...E9_STYLES.e8_showNameClass,
          ...(deleteHoverIndex === index ? E9_STYLES.e8_showNameClassHover : {}),
        }}
        onMouseEnter={() => setDeleteHoverIndex(index)}
        onMouseLeave={() => setDeleteHoverIndex(null)}
      >
        <a
          href="javascript:return false;"
          onClick={(e) => e.preventDefault()}
          style={{
            color: '#0072C6',
            textDecoration: 'none',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {item.name}
        </a>
        <span
          className="e8_delClass"
          style={{
            ...E9_STYLES.e8DelClass,
            opacity: deleteHoverIndex === index ? 1 : 0,
            visibility: deleteHoverIndex === index ? 'visible' : 'hidden',
            transition: 'opacity 0.2s, visibility 0.2s',
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveItem(item.id);
          }}
        >
          x
        </span>
      </span>
    ));
  };

  return (
    <>
      {/* 主预览弹窗 */}
      <Modal
        title={
          <Space direction="vertical" size={2}>
            <Space>
              <span>浏览按钮预览</span>
              <Tag color="blue">{config.label}</Tag>
              {config.icon && <span style={{ fontSize: 14 }}>{config.icon}</span>}
              {config.category === 'hrm' && <Tag color="purple">人员类</Tag>}
              {config.category === 'org' && <Tag color="orange">组织类</Tag>}
            </Space>
            {config.businessScenario && (
              <div style={{ fontSize: 12, color: '#1890ff', fontWeight: 'normal' }}>
                {config.businessScenario}
              </div>
            )}
          </Space>
        }
        open={visible}
        onCancel={() => { resetState(); onClose(); }}
        footer={[
          <Button key="close" onClick={() => { resetState(); onClose(); }}>
            关闭预览
          </Button>,
        ]}
        width={620}
        destroyOnClose
      >
        {/* 预览说明 */}
        <div style={{ marginBottom: 12, fontSize: 12, color: '#666' }}>
          以下展示 "{config.label}" 浏览按钮在工作表单中的实际交互效果。点击浏览按钮（蓝色图标）体验选择操作。
          {config.businessScenario && (
            <div style={{ marginTop: 4, color: '#1890ff' }}>
              业务场景：{config.businessScenario}
            </div>
          )}
        </div>

        {/* 模拟表单字段 */}
        <div style={E9_STYLES.previewContainer}>
          {/* 字段标签 */}
          <label style={E9_STYLES.fieldLabel}>
            {fieldLabel || config.label}
            <span style={{ color: '#ff4d4f', marginLeft: 2 }}>*</span>
          </label>

          {/* 浏览按钮主体：参照 Weaver E9 AddFormModeIframe.jsp DOM结构 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
            {/* 隐藏ID输入框 */}
            <input
              id="field_preview"
              type="hidden"
              value={selectedItems.map(item => item.id).join(',')}
              readOnly
            />

            {/* 值显示区域：field{id}span */}
            <div
              id="field_previewspan"
              style={{
                ...E9_STYLES.fieldSpan,
                ...(tagHover ? { borderColor: '#0072C6' } : {}),
              }}
              onMouseEnter={() => setTagHover(true)}
              onMouseLeave={() => setTagHover(false)}
            >
              {renderSelectedTags()}
            </div>

            {/* 浏览按钮触发元素：field{id}_browserbtn / e8_os 包裹 */}
            <span
              className="e8_os"
              style={E9_STYLES.e8os}
            >
              <span
                id="field_preview_browserbtn"
                className="Browser"
                style={{
                  ...E9_STYLES.browserBtn,
                  ...(browserBtnHover ? E9_STYLES.browserBtnHover : {}),
                }}
                onMouseEnter={() => setBrowserBtnHover(true)}
                onMouseLeave={() => setBrowserBtnHover(false)}
                onClick={handleOpenSelectDialog}
                title={`选择${config.label}`}
              >
                <SearchOutlined style={{ fontSize: 12 }} />
              </span>
            </span>

            {/* wrapspan 包裹浏览按钮和显示区域 */}
            <span id="field_previewwrapspan" style={{ display: 'none' }} />
          </div>

          {/* 交互提示 */}
          <div style={{ marginTop: 8, fontSize: 11, color: '#999' }}>
            {selectedItems.length > 0
              ? `已选择 ${selectedItems.length} 个${config.label}，鼠标悬停在标签上可显示删除按钮`
              : '点击蓝色搜索图标打开选择对话框'}
          </div>
        </div>

        {/* 交互说明 */}
        <div
          style={{
            background: '#f6f8fa',
            border: '1px solid #e8e8e8',
            borderRadius: 4,
            padding: '12px 16px',
            fontSize: 12,
            color: '#666',
            lineHeight: 1.8,
          }}
        >
          <div style={{ fontWeight: 600, color: '#333', marginBottom: 4 }}>交互说明</div>
          <div>1. 单击 <span style={{ color: '#0072C6' }}>蓝色搜索图标</span> 打开 "{config.label}" 选择对话框</div>
          <div>2. 在选择对话框中勾选需要的项目（{config.singleSelect ? '单选' : '可多选'}）</div>
          <div>3. 确认后，选中项会以 <span style={{ color: '#0072C6' }}>蓝色链接标签</span> 显示在上方区域</div>
          <div>4. 鼠标悬停到标签上可看到 <span style={{ color: '#ff4d4f' }}>删除按钮(x)</span>，点击可移除</div>
          <div>5. 此预览仅展示交互效果，不保存实际数据</div>
        </div>
      </Modal>

      {/* 模拟选择对话框 */}
      <Modal
        title={
          <Space>
            <span>选择{config.label}</span>
            <Tag style={{ marginLeft: 8 }}>
              共 {data.length} 项
            </Tag>
          </Space>
        }
        open={selectDialogVisible}
        onCancel={() => setSelectDialogVisible(false)}
        onOk={handleSelectConfirm}
        okText="确认选择"
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        {/* 搜索框 */}
        {browserType !== 98 && browserType !== 99 && (
          <Input
            prefix={<SearchOutlined />}
            placeholder={`搜索${config.label}...`}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ marginBottom: 12 }}
            allowClear
          />
        )}

        {/* 数据表格 */}
        <Table
          dataSource={filteredData}
          columns={selectColumns}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ y: 280 }}
          rowSelection={{
            type: config.singleSelect ? 'radio' : 'checkbox',
            selectedRowKeys: selectedKeys,
            onChange: (keys) => {
              if (config.singleSelect) {
                setSelectedKeys(keys as string[]);
              } else {
                setSelectedKeys(keys as string[]);
              }
            },
          }}
          locale={{ emptyText: '暂无匹配数据' }}
        />
      </Modal>
    </>
  );
};

export default BrowserButtonPreview;
