import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * 临时单元测试配置（仅 node 环境，跑纯逻辑单测）。
 * 项目默认 vitest.config.ts 依赖 @vitest/browser-playwright（浏览器模式，本机未安装），
 * 故纯逻辑单测用本配置跑；用完即删。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
