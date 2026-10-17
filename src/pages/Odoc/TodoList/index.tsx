// 路由入口：菜单 path=/odoc/todo-list → 本文件（app.tsx 约定③ ./pages/Odoc/TodoList/index.tsx）。
// 实现见同级扁平文件 ../TodoList.tsx（无相对导入，均为 @/ 别名，故可安全 re-export）。
export { default } from '../TodoList';
