import { request } from '@umijs/max';
import { getBasicAuth, getToken } from './authority';

/**
 * 测试认证配置
 */
export const testAuthConfig = () => {
  console.log('=== 认证配置测试 ===');

  // 检查 localStorage 中的 token
  const token = getToken();
  console.log('localStorage 中的 token:', token);
  console.log('是否有 token:', !!token);

  // 检查 Basic Auth
  const basicAuth = getBasicAuth();
  console.log('Basic Auth:', basicAuth);

  // 测试一个需要认证的 API
  console.log('=== 测试 API 调用 ===');

  // 测试系统菜单 API
  request('/api/blade-system/menu/list', {
    method: 'GET',
  })
    .then((response) => {
      console.log('API 调用成功:', response);
    })
    .catch((error) => {
      console.error('API 调用失败:', error);
    });
};

export default testAuthConfig;
