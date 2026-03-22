/**
 * @name 代理的配置
 * @see 在生产环境 代理是无法生效的，所以这里没有生产环境的配置
 * -------------------------------
 * The agent cannot take effect in the production environment
 * so there is no configuration of the production environment
 * For details, please see
 * https://pro.ant.design/docs/deploy
 *
 * @doc https://umijs.org/docs/guides/proxy
 */
export default {
  // 如果需要自定义本地开发服务器  请取消注释按需调整
  dev: {
    // localhost:8002/api/** -> http://127.0.0.1:8085/**
    '/api/': {
      // 要代理的地址
      target: 'http://127.0.0.1:8085/',
      // 配置了这个可以从 http 代理到 https
      // 依赖 origin 的功能可能需要这个，比如 cookie
      changeOrigin: true,
      // 重写路径，移除 /api 前缀
      pathRewrite: { '^/api': '' },
      // 配置代理选项
      onProxyReq: (proxyReq, req, res) => {
        // 确保请求头中的 Content-Type 包含 UTF-8 编码
        if (proxyReq.getHeader('content-type')?.includes('application/json')) {
          proxyReq.setHeader('content-type', 'application/json;charset=utf-8');
        }
        
        // 调试：记录请求体
        console.log('=== 代理请求调试 ===');
        console.log('请求 URL:', req.url);
        console.log('请求方法:', req.method);
        console.log('请求头:', JSON.stringify(proxyReq.getHeaders(), null, 2));
        
        // 捕获请求体
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          if (body) {
            console.log('请求体 (前500字符):', body.substring(0, 500));
            // 检查请求体是否包含无效字符
            for (let i = 0; i < body.length; i++) {
              const charCode = body.charCodeAt(i);
              if (charCode > 0x10FFFF || (charCode >= 0xD800 && charCode <= 0xDFFF)) {
                console.error(`代理请求中发现无效字符在位置 ${i}: 字符码 ${charCode}`);
              }
            }
          }
        });
      },
    },
    // 代理上传的静态资源
    '/uploads/': {
      target: 'http://127.0.0.1:8085/',
      changeOrigin: true,
    },
  },
  /**
   * @name 详细的代理配置
   * @doc https://github.com/chimurai/http-proxy-middleware
   */
  test: {
    // localhost:8000/api/** -> https://preview.pro.ant.design/api/**
    '/api/': {
      target: 'https://proapi.azurewebsites.net',
      changeOrigin: true,
      pathRewrite: { '^': '' },
    },
  },
  pre: {
    '/api/': {
      target: 'your pre url',
      changeOrigin: true,
      pathRewrite: { '^': '' },
    },
  },
};
