/**
 * 门户「菜单样式库」（对标泛微 ecology portalmenu menustylelib）
 *
 * 菜单路由：/portal/menustylelib
 *   → toPascalCase('menustylelib') 推导出 MenustyleLib，故在 app.tsx PAGE_DIR_ALIAS
 *     显式登记 'portal/menustylelib' → 'MenuStyleLib'（Windows 大小写不敏感可裸跑，
 *     Linux 构建必须靠这条登记才能命中磁盘目录）。
 *
 * 与「门户样式库」(/portal/stylelib) 的关系：后者是菜单样式/元素样式/头条样式/元素模板四合一，
 * 本页只暴露「菜单样式」（menuh 横向 / menuv 纵向），便于与前端菜单、后端菜单并列成独立菜单项。
 */
import StyleLib from '../StyleLib';

const MenuStyleLib: React.FC = () => <StyleLib onlyTab="menu" title="菜单样式库" />;

export default MenuStyleLib;