import { history } from '@@/core/history';
import type { RequestConfig, RequestOptions } from '@@/plugin-request/request';
import { message, notification } from 'antd';
import hash from 'hash.js';
// @ts-expect-error
import qs from 'qs';
import { getBasicAuth } from '@/utils/auth';
import { getCaptchaKey, getToken, removeAll } from '@/utils/authority';
import Settings from '../config/defaultSettings';

// 后端状态码消息映射
const codeMessage: Record<number, string> = {
  200: '服务器成功返回请求的数据。',
  201: '新建或修改数据成功。',
  202: '一个请求已经进入后台排队（异步任务）。',
  204: '删除数据成功。',
  400: '发出的请求有错误，服务器没有进行新建或修改数据的操作。',
  401: '用户没有权限（令牌、用户名、密码错误）。',
  403: '用户得到授权，但是访问是被禁止的。',
  404: '发出的请求针对的是不存在的记录，服务器没有进行操作。',
  406: '请求的格式不可得。',
  410: '请求的资源被永久删除，且不会再得到的。',
  422: '当创建一个对象时，发生一个验证错误。',
  500: '服务器发生错误，请检查服务器。',
  502: '网关错误。',
  503: '服务不可用，服务器暂时过载或维护。',
  504: '网关超时。',
};

/**
 * 检查响应状态
 */
const checkStatus = (response: any) => {
  if (
    (response.status >= 200 && response.status < 300) ||
    // 针对于要显示后端返回自定义详细信息的status, 配置跳过
    response.status === 400 ||
    response.status === 500
  ) {
    return response;
  }
  const errortext = codeMessage[response.status] || response.statusText;
  notification.error({
    message: `请求错误 ${response.status}: ${response.url}`,
    description: errortext,
  });
  const error = new Error(errortext);
  error.name = response.status;
  (error as any).response = response;
  throw error;
};

/**
 * 检查服务器返回码
 */
const checkServerCode = (response: any) => {
  if (response.code >= 200 && response.code < 300) {
    return response;
  }
  if (response.code === 400) {
    notification.error({
      message: response.msg || codeMessage[response.code],
    });
  } else if (response.code === 401) {
    if (window.location.pathname === '/user/login') return false;
    notification.error({
      message: response.msg || codeMessage[response.code],
    });
    removeAll();
    history.push('/user/login');
  } else if (response.code === 404) {
    notification.error({
      message: response.msg || codeMessage[response.code],
    });
  } else if (response.code === 500) {
    notification.error({
      message: response.msg || codeMessage[response.code],
    });
  }
  return response;
};

/**
 * 缓存响应数据
 */
const cachedSave = (response: any, hashcode: string) => {
  /**
   * Clone a response data and store it in sessionStorage
   * Does not support data other than json, Cache only json
   */
  // 安全地获取 Content-Type，处理 headers 可能不是对象的情况
  let contentType = '';
  if (response.headers) {
    if (typeof response.headers.get === 'function') {
      // 标准的 Response 对象
      contentType = response.headers.get('Content-Type') || '';
    } else if (typeof response.headers === 'object') {
      // 普通对象类型的 headers
      contentType =
        response.headers['Content-Type'] ||
        response.headers['content-type'] ||
        '';
    }
  }

  if (contentType?.match(/application\/json/i)) {
    // 只有当 response.clone 方法存在时才执行
    if (typeof response.clone === 'function') {
      // All data is saved as text
      response
        .clone()
        .text()
        .then((content: string) => {
          sessionStorage.setItem(hashcode, content);
          sessionStorage.setItem(
            `${hashcode}:timestamp`,
            Date.now().toString(),
          );
        })
        .catch((error: any) => {
          console.warn('缓存响应数据失败:', error);
        });
    }
  }
  return response;
};

/**
 * @name 请求错误配置
 * 它基于 axios 和 ahooks 的 useRequest 提供了一套统一的网络请求和错误处理方案。
 * @doc https://umijs.org/docs/max/request#配置
 */
export const errorConfig: RequestConfig = {
  // 错误处理配置
  requestInterceptors: [
    (config: RequestOptions) => {
      // 确保有 headers 对象
      if (!config.headers) {
        config.headers = {};
      }

      // 验证码接口不需要认证
      const isCaptchaApi = config.url?.includes('/captcha');

      // 添加 Basic Auth 头（排除验证码接口）
      if (!isCaptchaApi) {
        config.headers.Authorization = getBasicAuth();
      }

      // 日志：记录所有请求的认证信息
      console.log('=== 请求认证信息 ===');
      console.log('请求 URL:', config.url);
      console.log('是否有 Token:', !!getToken());
      console.log('Basic Auth:', getBasicAuth());
      console.log('Blade-Auth Token:', getToken());

      // Token 鉴权 - 优先使用 getToken() 获取的 token
      // 登录后存储的 token 会被用于后续请求
      const token = getToken();
      console.log('请求拦截器 - 当前token:', token);
      console.log('请求拦截器 - localStorage中的所有token相关数据:', {
        'sword-token': localStorage.getItem('sword-token'),
        'sword-access-token': localStorage.getItem('sword-access-token'),
      });

      // 添加 Blade-Auth Token 头
      // 后端要求使用 bearer token 格式，格式为: "bearer <token>" (小写)
      if (token) {
        // 检查是否已经包含 bearer 或 crypto 前缀（不区分大小写）
        const lowerToken = token.toLowerCase();
        if (
          !lowerToken.startsWith('bearer ') &&
          !lowerToken.startsWith('crypto ')
        ) {
          config.headers['Blade-Auth'] = `bearer ${token}`; // 使用小写 'bearer '
        } else {
          config.headers['Blade-Auth'] = token;
        }
        console.log(
          '已添加 Blade-Auth Token:',
          `${config.headers['Blade-Auth'].substring(0, 30)}...`,
        );
      } else {
        console.warn('未找到 Token，请求可能无法通过认证');
      }

      // 处理请求体
      if (
        config.method === 'POST' ||
        config.method === 'PUT' ||
        config.method === 'DELETE'
      ) {
        if (
          config.body &&
          typeof config.body === 'object' &&
          !(config.body instanceof FormData)
        ) {
          // 如果是 application/x-www-form-urlencoded 格式,将对象转换为 URL 编码字符串
          if (
            config.headers['Content-Type'] ===
            'application/x-www-form-urlencoded'
          ) {
            const encodedData = qs.stringify(config.body);
            console.log('URL编码前的body:', config.body);
            console.log('URL编码后的data:', encodedData);
            config.data = encodedData;
            delete config.body;
          } else {
            // 默认使用 JSON 格式
            config.headers = {
              Accept: 'application/json',
              'Content-Type': 'application/json;charset=utf-8',
              ...config.headers,
            };
            // 确保 body 被正确设置为 data
            if (!config.data) {
              config.data = config.body;
              delete config.body;
            }
          }
        }
      }

      // 添加验证码相关的 headers（如果存在）
      if (config.url?.includes('/blade-auth/token') && Settings.captchaMode) {
        const captchaKey = getCaptchaKey();
        console.log('验证码Key:', captchaKey);
        if (captchaKey) {
          config.headers['Captcha-Key'] = captchaKey;
        }
      }

      console.log('最终请求配置:', {
        url: config.url,
        method: config.method,
        headers: config.headers,
        data: config.data,
      });

      return config;
    },
  ],

  // 响应拦截器
  responseInterceptors: [
    (response: any) => {
      console.log('响应拦截器 - 原始响应:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        url: response.config?.url,
      });

      // 检查HTTP状态码
      checkStatus(response);

      // 缓存响应数据
      if (response.config?.expirys !== false) {
        const fingerprint =
          response.config.url +
          (response.config.data ? JSON.stringify(response.config.data) : '');
        const hashcode = hash.sha256().update(fingerprint).digest('hex');
        cachedSave(response, hashcode);
      }

      // 拦截响应数据，进行个性化处理
      const data = response.data;

      console.log('响应拦截器 - 解析后的数据:', data);

      // 处理后端业务状态码
      if (data?.code !== undefined) {
        // 特殊处理401错误，清除认证信息并跳转到登录页
        if (data.code === 401) {
          console.error('认证失败:', data.msg);
          // 清除所有登录信息
          removeAll();
          // 跳转到登录页
          if (window.location.pathname !== '/user/login') {
            history.push('/user/login');
          }
        } else {
          checkServerCode(data);
        }
      }

      // 处理 success 字段（兼容 Pro 默认格式）
      if (data?.success === false) {
        message.error(data.errorMessage || '请求失败！');
      }

      // 直接返回 response
      // Umi request 库会根据泛型类型 <{code, data, msg}> 自动提取 response.data
      return response;
    },
  ],
};
