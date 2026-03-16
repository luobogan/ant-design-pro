import { request } from '@umijs/max';

// 页面生成参数接口
export interface PageGeneratorParams {
  formId: number;
  pageName: string;
  pagePath: string;
  templateType: string;
  generateType: string; // 'preview' | 'publish'
}

// 页面生成响应接口
export interface PageGeneratorResult {
  success: boolean;
  msg: string;
  data: {
    pageUrl?: string;
    pageId?: number;
  };
}

/**
 * 生成页面预览
 * @param params 生成参数
 * @returns 生成结果
 */
export async function generatePagePreview(params: PageGeneratorParams): Promise<PageGeneratorResult> {
  return request('/api/blade-system/lowcode/page/generate/preview', {
    method: 'POST',
    data: {
      ...params,
      generateType: 'preview',
    },
  });
}

/**
 * 发布生成页面
 * @param params 生成参数
 * @returns 生成结果
 */
export async function publishGeneratedPage(params: PageGeneratorParams): Promise<PageGeneratorResult> {
  return request('/api/blade-system/lowcode/page/generate/publish', {
    method: 'POST',
    data: {
      ...params,
      generateType: 'publish',
    },
  });
}

/**
 * 获取页面模板列表
 * @returns 模板列表
 */
export async function getPageTemplates() {
  return request('/api/blade-system/lowcode/page/template/list', {
    method: 'GET',
  });
}

/**
 * 获取已生成页面列表
 * @param params 查询参数
 * @returns 页面列表
 */
export async function getGeneratedPages(params: {
  pageNo?: number;
  pageSize?: number;
  formId?: number;
}) {
  return request('/api/blade-system/lowcode/page/list', {
    method: 'GET',
    params,
  });
}

/**
 * 删除生成的页面
 * @param id 页面ID
 * @returns 删除结果
 */
export async function deleteGeneratedPage(id: number) {
  return request(`/api/blade-system/lowcode/page/remove/${id}`, {
    method: 'POST',
  });
}
