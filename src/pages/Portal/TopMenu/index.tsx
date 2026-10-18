/**
 * 门户「后端菜单」（对标泛微 ecology portalmenu topmenu）
 *
 * 菜单路由：/portal/topmenu → 组件 ./pages/Portal/TopMenu/index.tsx
 * （path 末段 topmenu 经 app.tsx toPascalCase 还原为 TopMenu）
 */
import MenuManage from '../MenuManage';

const TopMenu: React.FC = () => (
  <MenuManage
    fixedMenuType="top"
    title="后端菜单"
    desc="门户顶部导航菜单（对标泛微 portalmenu topmenu），menu_type=top"
  />
);

export default TopMenu;