/**
 * 工具函数类
 */
export default class Func {
  /**
   * 格式化路由路径
   * @param path 原始路径
   * @returns 格式化后的路径
   */
  // static formatRoutePath(path: string): string {
  //   if (!path) return '';
  //   // 确保路径以 / 开头
  //   let formattedPath = path.startsWith('/') ? path : `/${path}`;
  //   // 移除路径末尾的 /
  //   formattedPath = formattedPath.endsWith('/') ? formattedPath.slice(0, -1) : formattedPath;
  //   return formattedPath;
  // }
static formatRoutePath(path: string) {
  const words = path.replace(/^\//, '').split(/(?<=\w+)\//);
  console.log('words:'+words)
  // 提取路径单词
  return `/${words
    .map((word: string) =>
      word.toLowerCase().replace(word[0], word[0].toUpperCase()),
    )
    .join('/')}`;
}

  /**
   * 将对象转换为 FormData
   * @param data 对象数据
   * @returns FormData
   */
  static toFormData(data: any): FormData {
    const formData = new FormData();
    if (data) {
      Object.keys(data).forEach(key => {
        const value = data[key];
        if (Array.isArray(value)) {
          value.forEach((item: any, index: number) => {
            formData.append(`${key}[${index}]`, item);
          });
        } else if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });
    }
    return formData;
  }

  /**
   * 检查值是否为空
   * @param value 要检查的值
   * @returns 是否为空
   */
  static isEmpty(value: any): boolean {
    if (value === null || value === undefined || value === '') {
      return true;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return true;
    }
    if (Array.isArray(value) && value.length === 0) {
      return true;
    }
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      return true;
    }
    return false;
  }
}
