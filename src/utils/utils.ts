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

// /**
//  * 格式化路由数据
//  * @param routes 路由数据
//  * @param iconType 图标类型
//  * @param parentPath 父路由路径（用于生成相对路径）
//  * @returns 格式化后的路由数据
//  */
// export function formatRoutes(routes: any, iconType = 'Outlined', parentPath = '') {
//   function format(arr: any[], parentPath = '') {
//     return arr.map(node => {
//       const item = { ...node }; // 创建副本避免直接修改原始数据

//       // 处理路径：如果是子路由且使用绝对路径，转换为相对路径
//       if (item.path && parentPath) {
//         // 如果子路由路径以父路由路径开头，提取相对部分
//         if (item.path.startsWith(parentPath + '/')) {
//           item.path = item.path.substring(parentPath.length);
//           // 移除开头的 /
//           if (item.path.startsWith('/')) {
//             item.path = item.path.substring(1);
//           }
//         }
//         // 如果路径以 / 开头（绝对路径但不是父路由的子路径），也转换为相对路径
//         else if (item.path.startsWith('/') && !item.path.startsWith(parentPath)) {
//           // 提取最后一个 / 后面的部分作为相对路径
//           const parts = item.path.split('/');
//           item.path = parts[parts.length - 1];
//         }
//       }

//       // 生成组件路径（只在有实际路径时）
//       if (item.path && item.path !== '/') {
//         const pathParts = item.path.split('/').filter(Boolean);

//         // 只为最底层的路由生成组件路径，菜单分组不生成
//         const hasChildren = item.children && item.children.length > 0;
//         const isLeafNode = !hasChildren;

//         if (isLeafNode && pathParts.length > 0) {
//           const systemPath = pathParts[0].toLowerCase();

//           console.log(`123  Processing path: ${item.path}`);
//           console.log(`1234 Processing path: ${item.path}, systemPath: ${systemPath}`);

//           if (systemPath === 'system') {
//             // 系统管理相关路径，使用System目录
//             if (pathParts.length === 2) {
//               // /system/user -> User.tsx
//               const moduleName = pathParts[1];
//               const capitalizedModuleName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
//               item.component = `./pages/System/${capitalizedModuleName}/${capitalizedModuleName}.tsx`;
//             } else if (pathParts.length >= 3) {
//               // /system/user/add -> User/UserAdd.tsx
//               const moduleName = pathParts[1];
//               const actionName = pathParts[2];
//               const capitalizedModuleName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
//               const capitalizedActionName = actionName.charAt(0).toUpperCase() + actionName.slice(1);
//               item.component = `./pages/System/${capitalizedModuleName}/${capitalizedModuleName}${capitalizedActionName}.tsx`;
//             }
//           } else if (systemPath === 'mall') {
//             // 商城管理相关路径，使用Mall目录
//             if (pathParts.length === 2) {
//               // /mall/dashboard -> Dashboard.tsx
//               const moduleName = pathParts[1];
//               const capitalizedModuleName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
//               item.component = `./pages/Mall/${capitalizedModuleName}/${capitalizedModuleName}.tsx`;
//             } else if (pathParts.length >= 3) {
//               // /mall/product/list -> Product/ProductList.tsx
//               const moduleName = pathParts[1];
//               const actionName = pathParts[2];
//               const capitalizedModuleName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
//               const capitalizedActionName = actionName.charAt(0).toUpperCase() + actionName.slice(1);
//               item.component = `./pages/Mall/${capitalizedModuleName}/${capitalizedModuleName}${capitalizedActionName}.tsx`;
//             }
//           } else {
//             // 其他路径，使用通用规则
//             const fileName = pathParts[pathParts.length - 1];
//             const dirPath = pathParts.slice(0, -1).join('/');
//             if (fileName) {
//               item.component = `./pages/${dirPath}/${fileName}.tsx`;
//             }
//           }
//         }
//       }

//       const currentPath = parentPath ? `${parentPath}/${item.path}` : item.path;

//       if (item.children && Array.isArray(item.children)) {
//         item.routes = format(item.children, currentPath);
//         delete item.children; // 删除 children，使用 routes
//       }

//       if (item.isOpen === 2) {
//         item.target = '_blank';
//       }

//       // 处理图标
//       if (item.source) {
//         const fixIconName = item.source.slice(0, 1).toLocaleUpperCase() + item.source.slice(1) + iconType;
//         item.icon = fixIconName;
//       }

//       // 删除不需要的字段
//       delete item.sort;
//       delete item.code;
//       delete item.source;

//       return item;
//     });
//   }
//   return format(routes);
// }

export function formatRoutes(routes: any, iconType = 'Outlined') {
  console.log(`formatRoutes  routes :${routes}`);
  function format(arr: any[]) {
    arr.forEach((node) => {
      const item = node;

      // 检查是否为外部URL
      const isExternalUrl =
        item.path &&
        (item.path.startsWith('http://') || item.path.startsWith('https://'));

      if (item.children && Array.isArray(item.children)) {
        item.routes = item.children;
        format(item.routes);
      }
      if (item.isOpen === 2) {
        item.target = '_blank';
      }
      // item.name = item.code;

      console.log(`item.parentId test   :${item.parentId}`);
      if (item.parentId !== 0 && !isExternalUrl) {
        item.component = `.${item.component}`;
        console.log(`item.component   :${item.component}`);
      }

      // item.layout='top';

      // item.menuRender=true;
      // let Component: React.ComponentType<any> | null = null;
      // const x = Func.formatRoutePath(item.path);
      // console.log("tempComponent  路径 "+x)
      //
      // console.log("tempComponent  路径详细 "+`@/pages${x}/index.tsx`)
      // // 防止配置了路由，但本地暂未添加对应的页面，产生的错误 /index.tsx
      // Component = React.lazy(() => new Promise((resolve, reject) => {
      //   import(`@/pages${x}/index.tsx`)
      //     .then(module => resolve(module))
      //     .catch((error) => resolve(import(`@/pages/404.tsx`)))
      // }))
      // item.element=createElement(Component);
      if (item.source) {
        const fixIconName =
          item.source.slice(0, 1).toLocaleUpperCase() +
          item.source.slice(1) +
          iconType;
        //console.log('fixIconName:'+fixIconName);

        // item.icon =fixIconName && <Icon component={icons[fixIconName]} />

        // eslint-disable-next-line no-param-reassign
        item.icon = fixIconName;
        // item.icon = React.createElement(allIcons[fixIconName] || allIcons[item.source])
        console.log(`item.icon:${item.icon}`);
      }
      // delete item.id;
      // delete item.parentId;
      delete item.sort;
      delete item.code;
      delete item.source;
      // delete item.children;
    });
    return arr;
  }

  return format(routes);
}
