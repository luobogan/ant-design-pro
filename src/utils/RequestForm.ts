/**
 * RequestForm 表单数据处理工具
 * 支持构建表单数据、处理文件上传等功能
 */

export default class RequestForm {
  /**
   * 构建表单数据
   * @param data 表单数据对象
   * @returns URLSearchParams 对象
   */
  static buildFormData(data: any): URLSearchParams {
    const formData = new URLSearchParams();

    if (data && typeof data === 'object') {
      Object.keys(data).forEach((key) => {
        const value = data[key];
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });
    }

    return formData;
  }

  /**
   * 构建包含文件的表单数据
   * @param data 表单数据对象
   * @returns FormData 对象
   */
  static buildMultipartFormData(data: any): FormData {
    const formData = new FormData();

    if (data && typeof data === 'object') {
      Object.keys(data).forEach((key) => {
        const value = data[key];
        if (value !== undefined && value !== null) {
          formData.append(key, value);
        }
      });
    }

    return formData;
  }

  /**
   * 构建URL查询字符串
   * @param params 查询参数对象
   * @returns URL查询字符串
   */
  static buildQueryString(params: any): string {
    const formData = RequestForm.buildFormData(params);
    return formData.toString();
  }

  /**
   * 解析URL查询字符串为对象
   * @param queryString URL查询字符串
   * @returns 查询参数对象
   */
  static parseQueryString(queryString: string): any {
    const result: any = {};
    const params = new URLSearchParams(queryString);

    params.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }

  /**
   * 构建认证请求的表单数据
   * @param username 用户名
   * @param password 密码
   * @param grantType 授权类型
   * @param tenantId 租户ID
   * @param code 验证码
   * @param key 验证码key
   * @returns URLSearchParams 对象
   */
  static buildAuthFormData(
    username: string,
    password: string,
    grantType: string = 'password',
    tenantId: string = '000000',
    code?: string,
    key?: string,
  ): URLSearchParams {
    const formData = new URLSearchParams();
    formData.append('grant_type', grantType);
    formData.append('tenant_id', tenantId);
    formData.append('account', username);
    formData.append('password', password);

    if (code && key) {
      formData.append('code', code);
      formData.append('key', key);
    }

    return formData;
  }

  /**
   * 构建刷新token的表单数据
   * @param refreshToken 刷新token
   * @param grantType 授权类型
   * @returns URLSearchParams 对象
   */
  static buildRefreshTokenFormData(
    refreshToken: string,
    grantType: string = 'refresh_token',
  ): URLSearchParams {
    const formData = new URLSearchParams();
    formData.append('grant_type', grantType);
    formData.append('refresh_token', refreshToken);

    return formData;
  }
}
