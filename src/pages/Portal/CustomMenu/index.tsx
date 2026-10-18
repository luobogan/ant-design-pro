/**
 * 门户「自定义菜单」（对标泛微 ecology portalmenu custommenu）
 *
 * 菜单路由：/portal/custommenu → 组件 ./pages/Portal/CustomMenu/index.tsx
 * （path 末段 custommenu 经 app.tsx toPascalCase 还原为 CustomMenu）
 *
 * 与前端/后端菜单的区别：自定义菜单不锁定类型，可跨 front/top/toolbar/quick/report
 * 查看全部自建门户菜单（后端 /menu/list 不传 menuType 即返回全类型）。
 */
import MenuManage from '../MenuManage';

const CustomMenu: React.FC = () => (
  <MenuManage
    fixedMenuType="all"
    title="自定义菜单"
    desc="用户/管理员自建的门户菜单，可跨类型查看（对标泛微 portalmenu custommenu）"
  />
);

export default CustomMenu;