/**
 * 系统常量配置
 */

// 应用名称前缀
export const APPLICATION_NAME_PREFIX = 'blade-';

// 系统应用名称
export const APPLICATION_SYSTEM_NAME = APPLICATION_NAME_PREFIX + 'system';

// 商城应用名称
export const APPLICATION_MALL_NAME = APPLICATION_NAME_PREFIX + 'mall';
// API 基础路径
export const API_BASE_PATH = '/api';

// 商城API基础路径
export const API_MALL_BASE_PATH = `${API_BASE_PATH}/${APPLICATION_MALL_NAME}`;

// 其他常用常量
export const TOKEN_KEY = 'sword-token';
export const ACCESS_TOKEN_KEY = 'sword-access-token';
