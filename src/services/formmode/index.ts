import { request } from '@umijs/max';
import type {
  FormDefinition,
  FormDefinitionFormData,
  FieldDefinition,
  FieldDefinitionFormData,
  FormDataRecord,
  FormDataFormData,
  ModuleDefinition,
  ModuleDefinitionFormData,
  PageParams,
  PageResponse,
  ApiResponse,
  FieldTypeInfo,
  BrowserTypeInfo,
  FieldHtmlType,
  FieldType,
  FieldDbType,
  FormStatus,
  FieldStatus,
  FieldOption,
} from './typings';

// 导出类型
export type {
  FormDefinition,
  FormDefinitionFormData,
  FieldDefinition,
  FieldDefinitionFormData,
  FormDataRecord,
  FormDataFormData,
  ModuleDefinition,
  ModuleDefinitionFormData,
  PageParams,
  PageResponse,
  ApiResponse,
  FieldTypeInfo,
  BrowserTypeInfo,
  FieldHtmlType,
  FieldType,
  FieldDbType,
  FormStatus,
  FieldStatus,
  FieldOption,
};

// API 基础路径（对应 blade-formmode 微服务）
const API_BASE_PATH = '/api/blade-formmode';
const FORM_DEFINITION_BASE_URL = `${API_BASE_PATH}/form-definition`;
const FIELD_DEFINITION_BASE_URL = `${API_BASE_PATH}/field-definition`;
const FORM_DATA_BASE_URL = `${API_BASE_PATH}/form-data`;
const MODULE_DEFINITION_BASE_URL = `${API_BASE_PATH}/module-definition`;

// SpringBlade 响应格式
interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
  success: boolean;
}

/**
 * 表单定义 API
 */
export const formDefinitionApi = {
  /**
   * 获取表单列表
   */
  getList: async (params: PageParams & { formName?: string; status?: number }) => {
    const response = await request<BladeResponse<PageResponse<FormDefinition>>>(
      FORM_DEFINITION_BASE_URL,
      {
        method: 'GET',
        params,
      },
    );
    return response.data;
  },

  /**
   * 获取所有表单（不分页）
   */
  getAll: async () => {
    const response = await request<BladeResponse<FormDefinition[]>>(
      `${FORM_DEFINITION_BASE_URL}/all`,
      {
        method: 'GET',
      },
    );
    return response.data;
  },

  /**
   * 获取表单详情
   */
  getById: async (id: string) => {
    const response = await request<BladeResponse<FormDefinition>>(
      `${FORM_DEFINITION_BASE_URL}/${id}`,
      {
        method: 'GET',
      },
    );
    return response.data;
  },

  /**
   * 创建表单
   */
  create: async (data: FormDefinitionFormData) => {
    const response = await request<BladeResponse<FormDefinition>>(FORM_DEFINITION_BASE_URL, {
      method: 'POST',
      data,
    });
    return response.data;
  },

  /**
   * 更新表单
   */
  update: async (id: string, data: FormDefinitionFormData) => {
    const response = await request<BladeResponse<FormDefinition>>(
      `${FORM_DEFINITION_BASE_URL}/${id}`,
      {
        method: 'PUT',
        data,
      },
    );
    return response.data;
  },

  /**
   * 删除表单
   */
  delete: async (id: string) => {
    return request(`${FORM_DEFINITION_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * 批量删除表单
   */
  batchDelete: async (ids: string[]) => {
    return request(`${FORM_DEFINITION_BASE_URL}/batch-delete`, {
      method: 'POST',
      data: { ids },
    });
  },

  /**
   * 更新表单状态
   */
  updateStatus: async (id: string, status: number) => {
    const response = await request<BladeResponse<FormDefinition>>(
      `${FORM_DEFINITION_BASE_URL}/${id}/status`,
      {
        method: 'PUT',
        params: { status },
      },
    );
    return response.data;
  },

  /**
   * 检查表名是否存在
   */
  checkTableName: async (tableName: string, excludeId?: string) => {
    const response = await request<BladeResponse<boolean>>(
      `${FORM_DEFINITION_BASE_URL}/check-table-name`,
      {
        method: 'GET',
        params: { tableName, excludeId },
      },
    );
    return response.data;
  },
};

/**
 * 字段定义 API
 */
export const fieldDefinitionApi = {
  /**
   * 获取字段列表
   */
  getList: async (params: PageParams & { formId?: string; fieldLabel?: string; fieldHtmlType?: number }) => {
    const response = await request<BladeResponse<PageResponse<FieldDefinition>>>(
      FIELD_DEFINITION_BASE_URL,
      {
        method: 'GET',
        params,
      },
    );
    return response.data;
  },

  /**
   * 根据表单ID获取所有字段
   */
  getByFormId: async (formId: string) => {
    const response = await request<BladeResponse<FieldDefinition[]>>(
      `${FIELD_DEFINITION_BASE_URL}/by-form/${formId}`,
      {
        method: 'GET',
      },
    );
    return response.data;
  },

  /**
   * 获取字段详情
   */
  getById: async (id: string) => {
    const response = await request<BladeResponse<FieldDefinition>>(
      `${FIELD_DEFINITION_BASE_URL}/${id}`,
      {
        method: 'GET',
      },
    );
    return response.data;
  },

  /**
   * 创建字段
   */
  create: async (data: FieldDefinitionFormData) => {
    const response = await request<BladeResponse<FieldDefinition>>(FIELD_DEFINITION_BASE_URL, {
      method: 'POST',
      data,
    });
    return response.data;
  },

  /**
   * 更新字段
   */
  update: async (id: string, data: FieldDefinitionFormData) => {
    const response = await request<BladeResponse<FieldDefinition>>(
      `${FIELD_DEFINITION_BASE_URL}/${id}`,
      {
        method: 'PUT',
        data,
      },
    );
    return response.data;
  },

  /**
   * 删除字段
   */
  delete: async (id: string) => {
    return request(`${FIELD_DEFINITION_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * 批量删除字段
   */
  batchDelete: async (ids: string[]) => {
    return request(`${FIELD_DEFINITION_BASE_URL}/batch-delete`, {
      method: 'POST',
      data: { ids },
    });
  },

  /**
   * 更新字段排序
   */
  updateSort: async (id: string, sort: number) => {
    const response = await request<BladeResponse<FieldDefinition>>(
      `${FIELD_DEFINITION_BASE_URL}/${id}/sort`,
      {
        method: 'PUT',
        params: { sort },
      },
    );
    return response.data;
  },

  /**
   * 获取字段类型列表
   */
  getFieldTypes: async () => {
    const response = await request<BladeResponse<FieldTypeInfo[]>>(
      `${FIELD_DEFINITION_BASE_URL}/field-types`,
      {
        method: 'GET',
      },
    );
    return response.data;
  },

  /**
   * 获取浏览框类型列表
   */
  getBrowserTypes: async () => {
    const response = await request<BladeResponse<BrowserTypeInfo[]>>(
      `${FIELD_DEFINITION_BASE_URL}/browser-types`,
      {
        method: 'GET',
      },
    );
    return response.data;
  },
};

/**
 * 表单数据 API
 */
export const formDataApi = {
  /**
   * 获取表单数据列表
   */
  getList: async (formId: string, params: PageParams & Record<string, any>) => {
    const response = await request<BladeResponse<PageResponse<FormDataRecord>>>(
      `${FORM_DATA_BASE_URL}/${formId}`,
      {
        method: 'GET',
        params,
      },
    );
    return response.data;
  },

  /**
   * 获取表单数据详情
   */
  getById: async (formId: string, id: string) => {
    const response = await request<BladeResponse<FormDataRecord>>(
      `${FORM_DATA_BASE_URL}/${formId}/${id}`,
      {
        method: 'GET',
      },
    );
    return response.data;
  },

  /**
   * 创建表单数据
   */
  create: async (formId: string, data: FormDataFormData) => {
    const response = await request<BladeResponse<FormDataRecord>>(
      `${FORM_DATA_BASE_URL}/${formId}`,
      {
        method: 'POST',
        data,
      },
    );
    return response.data;
  },

  /**
   * 更新表单数据
   */
  update: async (formId: string, id: string, data: FormDataFormData) => {
    const response = await request<BladeResponse<FormDataRecord>>(
      `${FORM_DATA_BASE_URL}/${formId}/${id}`,
      {
        method: 'PUT',
        data,
      },
    );
    return response.data;
  },

  /**
   * 删除表单数据
   */
  delete: async (formId: string, id: string) => {
    return request(`${FORM_DATA_BASE_URL}/${formId}/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * 批量删除表单数据
   */
  batchDelete: async (formId: string, ids: string[]) => {
    return request(`${FORM_DATA_BASE_URL}/${formId}/batch-delete`, {
      method: 'POST',
      data: { ids },
    });
  },

  /**
   * 获取表单字段定义
   */
  getFieldDefinitions: async (formId: string) => {
    const response = await request<BladeResponse<FieldDefinition[]>>(
      `${FORM_DATA_BASE_URL}/${formId}/fields`,
      {
        method: 'GET',
      },
    );
    return response.data;
  },
};

/**
 * 模块定义 API
 */
export const moduleDefinitionApi = {
  /**
   * 获取模块列表
   */
  getList: async (params: PageParams & { moduleName?: string; status?: number }) => {
    const response = await request<BladeResponse<PageResponse<ModuleDefinition>>>(
      MODULE_DEFINITION_BASE_URL,
      {
        method: 'GET',
        params,
      },
    );
    return response.data;
  },

  /**
   * 获取模块树形结构
   */
  getTree: async () => {
    const response = await request<BladeResponse<ModuleDefinition[]>>(
      `${MODULE_DEFINITION_BASE_URL}/tree`,
      {
        method: 'GET',
      },
    );
    return response.data;
  },

  /**
   * 获取模块详情
   */
  getById: async (id: string) => {
    const response = await request<BladeResponse<ModuleDefinition>>(
      `${MODULE_DEFINITION_BASE_URL}/${id}`,
      {
        method: 'GET',
      },
    );
    return response.data;
  },

  /**
   * 创建模块
   */
  create: async (data: ModuleDefinitionFormData) => {
    const response = await request<BladeResponse<ModuleDefinition>>(MODULE_DEFINITION_BASE_URL, {
      method: 'POST',
      data,
    });
    return response.data;
  },

  /**
   * 更新模块
   */
  update: async (id: string, data: ModuleDefinitionFormData) => {
    const response = await request<BladeResponse<ModuleDefinition>>(
      `${MODULE_DEFINITION_BASE_URL}/${id}`,
      {
        method: 'PUT',
        data,
      },
    );
    return response.data;
  },

  /**
   * 删除模块
   */
  delete: async (id: string) => {
    return request(`${MODULE_DEFINITION_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * 批量删除模块
   */
  batchDelete: async (ids: string[]) => {
    return request(`${MODULE_DEFINITION_BASE_URL}/batch-delete`, {
      method: 'POST',
      data: { ids },
    });
  },
};

/**
 * 浏览框 API（通用数据选择）
 */
export const browserApi = {
  /**
   * 获取人力资源列表
   */
  getHrmList: async (params: PageParams & { name?: string }) => {
    const response = await request<BladeResponse<PageResponse<any>>>(
      `${API_BASE_PATH}/browser/hrm`,
      {
        method: 'GET',
        params,
      },
    );
    return response.data;
  },

  /**
   * 获取部门列表
   */
  getDeptList: async (params: PageParams & { name?: string }) => {
    const response = await request<BladeResponse<PageResponse<any>>>(
      `${API_BASE_PATH}/browser/dept`,
      {
        method: 'GET',
        params,
      },
    );
    return response.data;
  },

  /**
   * 获取角色列表
   */
  getRoleList: async (params: PageParams & { name?: string }) => {
    const response = await request<BladeResponse<PageResponse<any>>>(
      `${API_BASE_PATH}/browser/role`,
      {
        method: 'GET',
        params,
      },
    );
    return response.data;
  },

  /**
   * 获取资产列表
   */
  getAssetList: async (params: PageParams & { name?: string }) => {
    const response = await request<BladeResponse<PageResponse<any>>>(
      `${API_BASE_PATH}/browser/asset`,
      {
        method: 'GET',
        params,
      },
    );
    return response.data;
  },

  /**
   * 获取客户列表
   */
  getCustomerList: async (params: PageParams & { name?: string }) => {
    const response = await request<BladeResponse<PageResponse<any>>>(
      `${API_BASE_PATH}/browser/customer`,
      {
        method: 'GET',
        params,
      },
    );
    return response.data;
  },

  /**
   * 获取项目列表
   */
  getProjectList: async (params: PageParams & { name?: string }) => {
    const response = await request<BladeResponse<PageResponse<any>>>(
      `${API_BASE_PATH}/browser/project`,
      {
        method: 'GET',
        params,
      },
    );
    return response.data;
  },

  /**
   * 获取文档列表
   */
  getDocList: async (params: PageParams & { name?: string }) => {
    const response = await request<BladeResponse<PageResponse<any>>>(
      `${API_BASE_PATH}/browser/doc`,
      {
        method: 'GET',
        params,
      },
    );
    return response.data;
  },

  /**
   * 获取流程列表
   */
  getWorkflowList: async (params: PageParams & { name?: string }) => {
    const response = await request<BladeResponse<PageResponse<any>>>(
      `${API_BASE_PATH}/browser/workflow`,
      {
        method: 'GET',
        params,
      },
    );
    return response.data;
  },

  /**
   * 通用浏览框查询
   */
  getList: async (browserType: number, params: PageParams & { keyword?: string }) => {
    const response = await request<BladeResponse<PageResponse<any>>>(
      `${API_BASE_PATH}/browser/${browserType}`,
      {
        method: 'GET',
        params,
      },
    );
    return response.data;
  },
};

// 导出所有 API
export {
  formDefinitionApi as formApi,
  fieldDefinitionApi as fieldApi,
  formDataApi as dataApi,
  moduleDefinitionApi as moduleApi,
};
