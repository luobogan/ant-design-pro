/**
 * 请求配置扩展类型
 */

declare module '@umijs/max' {
  interface RequestConfig {
    /**
     * 是否加密传输 Token（使用 AES 加密）
     */
    cryptoToken?: boolean;
  }
}
