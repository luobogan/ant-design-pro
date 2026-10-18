/**
 * 门户「前端菜单」（对标泛微 ecology portalmenu leftmenu）
 *
 * 菜单路由：/portal/frontmenu → 组件 ./pages/Portal/FrontMenu/index.tsx
 * （path 末段 frontmenu 经 app.tsx toPascalCase 还原为 FrontMenu：menu 在词典内）
 *
 * 复用 MenuManage 并锁定 menu_type=front，只维护门户左侧导航菜单。
 */
import MenuManage from '../MenuManage';

const FrontMenu: React.FC = () => (
  <MenuManage
    fixedMenuType="front"
    title="前端菜单"
    desc="门户左侧导航菜单（对标泛微 portalmenu leftmenu），menu_type=front"
  />
);

export default FrontMenu;