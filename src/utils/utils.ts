/**
 * 获取URL参数
 * @param name 参数名
 * @returns 参数值
 */
export const getQueryString = (name: string): string => {
  const reg = new RegExp(`(^|&)${name}=([^&]*)(&|$)`);
  const r = window.location.search.substr(1).match(reg);
  if (r != null) return unescape(r[2]);
  return '';
};

/**
 * 获取顶级URL
 * @returns 顶级URL
 */
export const getTopUrl = (): string => {
  if (window.top === window.self) {
    return window.location.href;
  }
  try {
    return window.top.location.href;
  } catch (_e) {
    return window.location.href;
  }
};

/**
 * 验证是否为null或undefined
 * @param val 要验证的值
 * @returns 是否为null或undefined
 */
export const validateNull = (val: any): boolean => {
  if (val === null || val === undefined || val === '') {
    return true;
  }
  if (typeof val === 'string' && val.trim() === '') {
    return true;
  }
  if (Array.isArray(val) && val.length === 0) {
    return true;
  }
  if (typeof val === 'object' && Object.keys(val).length === 0) {
    return true;
  }
  return false;
};

/**
 * 格式化时间
 * @param date 日期对象或时间戳
 * @param format 格式字符串
 * @returns 格式化后的时间字符串
 */
export const formatDate = (
  date: Date | number,
  format: string = 'YYYY-MM-DD HH:mm:ss',
): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

/**
 * 深拷贝对象
 * @param obj 要拷贝的对象
 * @returns 拷贝后的对象
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
};

/**
 * 生成随机字符串
 * @param length 字符串长度
 * @returns 随机字符串
 */
export const generateRandomString = (length: number = 8): string => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
