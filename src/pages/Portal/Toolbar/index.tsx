/**
 * 门户「工具栏菜单」（对标泛微 ecology portalmenu toolbarmore）
 *
 * 菜单路由：/portal/toolbar → 组件 ./pages/Portal/Toolbar/index.tsx
 *（path 末段 toolbar 无复合词歧义，toPascalCase 直接得 Toolbar；
 *   刻意避开 toolbarmore —— more 不在 app.tsx 词典内，会推导出 Toolbarmore 而非 ToolbarMore）
 */
import MenuManage from '../MenuManage';

const Toolbar: React.FC = () => (
  <MenuManage
    fixedMenuType="toolbar"
    title="工具栏菜单"
    desc="门户工具栏「更多」下拉菜单（对标泛微 portalmenu toolbarmore），menu_type=toolbar"
  />
);

export default Toolbar;