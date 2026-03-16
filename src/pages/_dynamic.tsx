import { PageContainer } from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import { Button, Result, Spin } from 'antd';
import React, { Suspense } from 'react';

/**
 * 动态页面组件
 * 用于处理动态路由的页面渲染
 * 根据路径动态加载对应的页面组件
 */
const DynamicPage: React.FC = () => {
  const location = useLocation();

  // 路径到组件的映射
  const componentMap: Record<string, React.LazyExoticComponent<any>> = {
    // 系统管理
    '/system/user': React.lazy(() => import('./System/User/User')),
    '/system/user/add': React.lazy(() => import('./System/User/UserAdd')),
    '/system/user/edit': React.lazy(() => import('./System/User/UserEdit')),
    '/system/user/view': React.lazy(() => import('./System/User/UserView')),
    '/system/dept': React.lazy(() => import('./System/Dept/Dept')),
    '/system/dict': React.lazy(() => import('./System/Dict/Dict')),
    '/system/menu': React.lazy(() => import('./System/Menu/Menu')),
    '/system/position': React.lazy(() => import('./System/Position/Position')),
    '/system/config': React.lazy(() => import('./System/Config/Config')),
    '/system/tenant': React.lazy(() => import('./System/Tenant/Tenant')),
    '/system/client': React.lazy(() => import('./System/Client/Client')),
    // 权限管理
    '/authority/role': React.lazy(() => import('./Authority/Role/Role')),
    '/authority/datascope': React.lazy(
      () => import('./Authority/DataPermission/DataPermission'),
    ),
    // 监控管理
    '/monitor/log': React.lazy(() => import('./Monitor/Log/Log')),
    // 工具管理
    '/tool/codegen': React.lazy(() => import('./Tool/Codegen/Codegen')),
    '/tool/datasource': React.lazy(
      () => import('./Tool/Datasource/Datasource'),
    ),
    // 低代码
    '/lowcode/desform': React.lazy(() => import('./Lowcode/Desform/Desform')),
    '/lowcode/desform/design': React.lazy(
      () => import('./Lowcode/Desform/DesformDesign'),
    ),
    '/lowcode/tabledesign': React.lazy(
      () => import('./Lowcode/TableDesign/index'),
    ),
    // 仪表板
    '/dashboard/workplace': React.lazy(() => import('./Dashboard/Workplace')),
    '/dashboard/analysis': React.lazy(() => import('./Dashboard/Analysis')),
    '/dashboard/monitor': React.lazy(() => import('./Dashboard/Monitor')),
    // 账户
    '/account/center': React.lazy(() => import('./Account/Center/Center')),
    '/account/settings': React.lazy(() => import('./Account/Settings/Info')),
  };

  // 查找匹配的组件
  const findComponent = (
    path: string,
  ): React.LazyExoticComponent<any> | null => {
    // 精确匹配
    if (componentMap[path]) {
      return componentMap[path];
    }

    // 前缀匹配（处理带参数的路由，如 /system/user/edit/:id）
    for (const [routePath, component] of Object.entries(componentMap)) {
      if (path.startsWith(routePath)) {
        return component;
      }
    }

    return null;
  };

  const Component = findComponent(location.pathname);

  // 尝试从路径推断页面标题
  const getPageTitle = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    if (paths.length > 0) {
      const lastPath = paths[paths.length - 1];
      return lastPath.charAt(0).toUpperCase() + lastPath.slice(1);
    }
    return '页面';
  };

  if (Component) {
    return (
      <Suspense
        fallback={
          <Spin
            size="large"
            style={{ display: 'block', margin: '100px auto' }}
          />
        }
      >
        <Component />
      </Suspense>
    );
  }

  return (
    <PageContainer
      title={getPageTitle()}
      content={
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Result
            status="404"
            title="页面未找到"
            subTitle={`未找到路径 "${location.pathname}" 对应的页面组件`}
            extra={[
              <Button
                type="primary"
                key="back"
                onClick={() => history.goBack()}
              >
                返回
              </Button>,
            ]}
          />
        </div>
      }
    />
  );
};

export default DynamicPage;
