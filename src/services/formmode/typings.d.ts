/**
 * 表单建模模块类型定义
 * 基于泛微 e-cology 9 表单建模功能
 */

// ==================== 枚举定义 ====================

/** 字段HTML类型（fieldhtmltype）- 控制字段在前端如何渲染 */
export enum FieldHtmlType {
  /** 文本字段：单行文本、多行文本、保密字段 */
  TEXT = 1,
  /** 浏览按钮：人力资源、部门、角色、资产等 */
  BROWSER = 2,
  /** 选择框：单选、多选、下拉框 */
  SELECT = 3,
  /** 附件上传 */
  ATTACHMENT = 4,
  /** 特殊字段：日期、时间、说明等 */
  SPECIAL = 5,
  /** 复选框 */
  CHECKBOX = 6,
  /** 文件上传（老版本） */
  FILE = 7,
  /** 下拉选择框（新） */
  DROPDOWN = 8,
  /** 树形选择 */
  TREE = 9,
}

/** 字段详细类型（type）- 根据 fieldhtmltype 的组合确定具体类型 */
export enum FieldType {
  // fieldhtmltype = 1 (文本字段)
  /** 单行文本 */
  TEXT_SINGLE = 1,
  /** 多行文本 */
  TEXT_MULTI = 2,
  /** 保密字段 */
  TEXT_PASSWORD = 3,

  // fieldhtmltype = 2 (浏览按钮)
  /** 人力资源 */
  BROWSER_HRM = 1,
  /** 部门 */
  BROWSER_DEPT = 2,
  /** 角色 */
  BROWSER_ROLE = 3,
  /** 资产 */
  BROWSER_ASSET = 4,
  /** 客户 */
  BROWSER_CUSTOMER = 5,
  /** 项目 */
  BROWSER_PROJECT = 6,
  /** 文档 */
  BROWSER_DOC = 7,
  /** 流程 */
  BROWSER_WORKFLOW = 8,
  /** 自定义浏览框 */
  BROWSER_CUSTOM = 9,

  // fieldhtmltype = 3 (选择框)
  /** 单选框 */
  SELECT_RADIO = 1,
  /** 多选框 */
  SELECT_CHECKBOX = 2,
  /** 下拉框 */
  SELECT_DROPDOWN = 3,
  /** 单选下拉框 */
  SELECT_SINGLE = 4,
  /** 多选下拉框 */
  SELECT_MULTI = 5,

  // fieldhtmltype = 4 (附件上传)
  /** 附件上传 */
  ATTACHMENT_UPLOAD = 1,
  /** 图片上传 */
  ATTACHMENT_IMAGE = 2,

  // fieldhtmltype = 5 (特殊字段)
  /** 日期 */
  SPECIAL_DATE = 1,
  /** 时间 */
  SPECIAL_TIME = 2,
  /** 说明 */
  SPECIAL_DESC = 3,
  /** 分割线 */
  SPECIAL_DIVIDER = 4,
  /** 关联字段 */
  SPECIAL_RELATE = 5,

  // fieldhtmltype = 6 (复选框)
  /** 复选框 */
  CHECKBOX_SINGLE = 1,

  // fieldhtmltype = 8 (下拉选择框)
  /** 下拉选择框 */
  DROPDOWN_SELECT = 1,

  // fieldhtmltype = 9 (树形选择)
  /** 树形选择 */
  TREE_SELECT = 1,
}

/** 字段数据库类型（fielddbtype） */
export enum FieldDbType {
  /** 整数 */
  INT = 'int',
  /** 小数 */
  DECIMAL = 'decimal',
  /** 字符串 */
  VARCHAR = 'varchar',
  /** 长文本 */
  TEXT = 'text',
  /** 日期 */
  DATE = 'date',
  /** 时间 */
  DATETIME = 'datetime',
  /** 浮点数 */
  FLOAT = 'float',
  /** 双精度 */
  DOUBLE = 'double',
  /** 长整型 */
  BIGINT = 'bigint',
}

/** 表单状态 */
export enum FormStatus {
  /** 禁用 */
  DISABLED = 0,
  /** 启用 */
  ENABLED = 1,
}

/** 字段状态 */
export enum FieldStatus {
  /** 禁用 */
  DISABLED = 0,
  /** 启用 */
  ENABLED = 1,
}

// ==================== 表单管理 ====================

/** 表单定义 */
export interface FormDefinition {
  /** 表单ID */
  id: string;
  /** 表单名称 */
  formName: string;
  /** 数据库表名 */
  tableName: string;
  /** 表单描述 */
  description?: string;
  /** 状态：0-禁用，1-启用 */
  status: FormStatus;
  /** 模块ID */
  moduleId?: string;
  /** 模块名称 */
  moduleName?: string;
  /** 创建时间 */
  createTime: string;
  /** 更新时间 */
  updateTime?: string;
  /** 创建人 */
  createUser?: string;
  /** 更新人 */
  updateUser?: string;
}

/** 表单表单数据（新增/编辑） */
export interface FormDefinitionFormData {
  /** 表单ID（编辑时必填） */
  id?: string;
  /** 表单名称 */
  formName: string;
  /** 数据库表名 */
  tableName: string;
  /** 表单描述 */
  description?: string;
  /** 状态：0-禁用，1-启用 */
  status?: FormStatus;
  /** 模块ID */
  moduleId?: string;
}

// ==================== 字段管理 ====================

/** 字段定义 */
export interface FieldDefinition {
  /** 字段ID */
  id: string;
  /** 表单ID */
  formId: string;
  /** 字段名称（数据库字段名） */
  fieldName: string;
  /** 字段标签（显示名称） */
  fieldLabel: string;
  /** 字段HTML类型（fieldhtmltype） */
  fieldHtmlType: FieldHtmlType;
  /** 字段详细类型（type） */
  fieldType: FieldType;
  /** 字段数据库类型（fielddbtype） */
  fieldDbType: string;
  /** 字段长度 */
  fieldLength?: number;
  /** 小数位数 */
  fieldDecimals?: number;
  /** 是否必填：0-否，1-是 */
  isRequired: number;
  /** 是否只读：0-否，1-是 */
  isReadOnly: number;
  /** 是否禁用：0-否，1-是 */
  isDisabled?: number;
  /** 默认值 */
  defaultValue?: string;
  /** 排序 */
  sort: number;
  /** 校验规则（JSON字符串） */
  validateRule?: string;
  /** 字段描述 */
  description?: string;
  /** 状态：0-禁用，1-启用 */
  status?: FieldStatus;
  /** 创建时间 */
  createTime: string;
  /** 更新时间 */
  updateTime?: string;
  /** 选项列表（用于选择框、单选、多选等） */
  options?: FieldOption[];
}

/** 字段选项（用于选择框、单选、多选等） */
export interface FieldOption {
  /** 选项ID */
  id?: string;
  /** 字段ID */
  fieldId?: string;
  /** 选项值 */
  value: string;
  /** 选项标签 */
  label: string;
  /** 排序 */
  sort: number;
  /** 是否默认选中：0-否，1-是 */
  isDefault?: number;
}

/** 字段表单数据（新增/编辑） */
export interface FieldDefinitionFormData {
  /** 字段ID（编辑时必填） */
  id?: string;
  /** 表单ID */
  formId: string;
  /** 字段名称（数据库字段名） */
  fieldName: string;
  /** 字段标签（显示名称） */
  fieldLabel: string;
  /** 字段HTML类型（fieldhtmltype） */
  fieldHtmlType: FieldHtmlType;
  /** 字段详细类型（type） */
  fieldType: FieldType;
  /** 字段数据库类型（fielddbtype） */
  fieldDbType: string;
  /** 字段长度 */
  fieldLength?: number;
  /** 小数位数 */
  fieldDecimals?: number;
  /** 是否必填：0-否，1-是 */
  isRequired?: number;
  /** 是否只读：0-否，1-是 */
  isReadOnly?: number;
  /** 是否禁用：0-否，1-是 */
  isDisabled?: number;
  /** 默认值 */
  defaultValue?: string;
  /** 排序 */
  sort?: number;
  /** 校验规则（JSON字符串） */
  validateRule?: string;
  /** 字段描述 */
  description?: string;
  /** 状态：0-禁用，1-启用 */
  status?: FieldStatus;
  /** 是否系统字段：0-否，1-是（系统字段不可删除，大部分属性只读） */
  isSystemField?: number;
  /** 列表显示：0-否，1-是（是否在列表中显示该字段） */
  listDisplay?: number;
  /** 选项列表 */
  options?: FieldOption[];
}

// ==================== 表单数据 ====================

/** 表单数据 */
export interface FormDataRecord {
  /** 数据ID */
  id: string;
  /** 表单ID */
  formId: string;
  /** 创建时间 */
  createTime: string;
  /** 更新时间 */
  updateTime?: string;
  /** 创建人 */
  createUser?: string;
  /** 更新人 */
  updateUser?: string;
  /** 动态字段（根据字段定义） */
  [key: string]: any;
}

/** 表单数据表单数据（新增/编辑） */
export interface FormDataFormData {
  /** 数据ID（编辑时必填） */
  id?: string;
  /** 表单ID */
  formId: string;
  /** 动态字段（根据字段定义） */
  [key: string]: any;
}

// ==================== 模块管理 ====================

/** 模块定义（对应泛微的模块/应用） */
export interface ModuleDefinition {
  /** 模块ID */
  id: string;
  /** 模块名称 */
  moduleName: string;
  /** 模块描述 */
  description?: string;
  /** 父模块ID */
  parentId?: string;
  /** 模块图标 */
  icon?: string;
  /** 排序 */
  sort: number;
  /** 状态：0-禁用，1-启用 */
  status: FormStatus;
  /** 创建时间 */
  createTime: string;
  /** 更新时间 */
  updateTime?: string;
  /** 子模块 */
  children?: ModuleDefinition[];
}

/** 模块表单数据（新增/编辑） */
export interface ModuleDefinitionFormData {
  /** 模块ID（编辑时必填） */
  id?: string;
  /** 模块名称 */
  moduleName: string;
  /** 模块描述 */
  description?: string;
  /** 父模块ID */
  parentId?: string;
  /** 模块图标 */
  icon?: string;
  /** 排序 */
  sort?: number;
  /** 状态：0-禁用，1-启用 */
  status?: FormStatus;
}

// ==================== 通用类型 ====================

/** 分页参数 */
export interface PageParams {
  /** 当前页 */
  current: number;
  /** 每页条数 */
  pageSize: number;
}

/** 分页响应 */
export interface PageResponse<T> {
  /** 数据列表 */
  list: T[];
  /** 总条数 */
  total: number;
  /** 当前页 */
  current: number;
  /** 每页条数 */
  pageSize: number;
}

/** 通用响应 */
export interface ApiResponse<T = any> {
  /** 状态码 */
  code: number;
  /** 消息 */
  message: string;
  /** 数据 */
  data: T;
  /** 是否成功 */
  success: boolean;
}

/** 字段类型信息（用于字段类型选择） */
export interface FieldTypeInfo {
  /** HTML类型 */
  htmlType: FieldHtmlType;
  /** 详细类型 */
  type: FieldType;
  /** 类型名称 */
  name: string;
  /** 数据库类型 */
  dbType: string;
  /** 类型描述 */
  description?: string;
}

/** 浏览框类型信息（用于浏览框选择） */
export interface BrowserTypeInfo {
  /** 浏览框类型 */
  type: number;
  /** 类型名称 */
  name: string;
  /** 浏览框URL */
  url?: string;
  /** 类型描述 */
  description?: string;
}
