import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Tabs, Space, Tooltip, Empty, Spin } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { browserApi } from '@/services/formmode';

// ==================== 类型定义 ====================
interface BrowserTypeItem {
  typeId: number;
  label: string;
  description?: string;
  singleSelect?: boolean;
  group?: string;       // 所属分组（如"hrm"、"org"等）
  subCategory?: string; // 子分类（如"人事"、"公文"等）
}

interface BrowserCategory {
  categoryId: string;
  categoryName: string;
  types: Array<{ typeId: number; label: string; categoryId: string }>;
}

// ==================== 后端API返回的分类数据 ====================

/** 子分类标签（仅人员tab使用）*/
const SUB_CATEGORIES = ['人事', '公文', '会议', '集成', '其他'];

/** categoryId 到 group key 的映射 */
const CATEGORY_TO_GROUP_MAP: Record<string, string> = {
  personnel: 'hrm',
  organization: 'org',
  workflow: 'workflow',
  document: 'doc',
  system: 'system',
  customer: 'customer',
  project: 'project',
  asset: 'asset',
  custom: 'custom',
};

/** group key 到中文名称的映射 */
const GROUP_LABEL_MAP: Record<string, string> = {
  hrm: '人员',
  org: '组织',
  workflow: '流程',
  doc: '文档',
  system: '系统',
  customer: '客户',
  project: '项目',
  asset: '资产',
  custom: '自定义',
};

/** 类型详细描述配置（补充后端未返回的 description 等信息） */
const TYPE_DETAIL_MAP: Record<number, { description?: string; singleSelect?: boolean; subCategory?: string }> = {
  1:   { description: '选择单个/多个人员',           subCategory: '人事' },
  161: { description: '支持批量选择大量人员',        subCategory: '人事' },
  162: { description: '招聘场景下的人员选择',         subCategory: '人事' },
  163: { description: '同时选择多个角色关联人员',     subCategory: '人事' },
  165: { description: '按条件筛选人力资源',            subCategory: '人事' },
  166: { description: '按角色筛选关联人员',            subCategory: '人事' },
  167: { description: '分权范围内的单人选择',         subCategory: '人事' },
  168: { description: '分权范围内多人选择',           subCategory: '人事' },
  2:   { description: '选择单个/多个部门',           subCategory: '' },
  17:  { description: '支持批量选择大量部门',         subCategory: '' },
  18:  { description: '选择公司分支机构',              subCategory: '' },
  19:  { description: '分权范围内的单个部门选择',     subCategory: '' },
  20:  { description: '分权范围内多部门选择',         subCategory: '' },
  21:  { description: '分权范围内的单个分部选择',     subCategory: '' },
  22:  { description: '分权范围内多分部选择',         subCategory: '' },
  23:  { description: '批量选择多个分部',             subCategory: '' },
  25:  { description: '选择办公地点/位置',            subCategory: '' },
  30:  { description: '选择工作流流程',               subCategory: '' },
  31:  { description: '批量选择多个工作流流程',        subCategory: '' },
  32:  { description: '选择已归档的流程实例',         subCategory: '' },
  24:  { description: '选择文档中心文档',              subCategory: '' },
  26:  { description: '批量选择多个文档',             subCategory: '' },
  98:  { description: '日期选择器',                   subCategory: '', singleSelect: true },
  99:  { description: '时间选择器',                   subCategory: '', singleSelect: true },
  100: { description: '省份选择',                     subCategory: '' },
  101: { description: '货币币种选择',                 subCategory: '' },
  102: { description: '城市选择',                     subCategory: '' },
  103: { description: '区县级选择',                   subCategory: '' },
  104: { description: '年份选择',                     subCategory: '' },
  105: { description: '语言选择',                     subCategory: '' },
  16:  { description: '选择CRM客户',                  subCategory: '', singleSelect: true },
  8:   { description: '选择项目管理项目',              subCategory: '', singleSelect: true },
  57:  { description: '附件上传与选择',                subCategory: '' },
  164: { description: '自定义数据源浏览框',           subCategory: '' },
  256: { description: '树形结构单选',                 subCategory: '', singleSelect: true },
  257: { description: '树形结构多选',                 subCategory: '' },
  3:   { description: '选择系统角色',                  subCategory: '人事' },
  4:   { description: '选择岗位信息',                  subCategory: '人事' },
};

// ==================== Props ====================
interface BrowserTypePickerProps {
  visible: boolean;
  currentTypeId?: number;   // 当前已选的类型ID
  onConfirm: (typeId: number, typeLabel: string) => void;
  onCancel: () => void;
}

// ==================== 组件主体 ====================
const BrowserTypePicker: React.FC<BrowserTypePickerProps> = ({
  visible,
  currentTypeId,
  onConfirm,
  onCancel,
}) => {
  const [activeMainTab, setActiveMainTab] = useState<string>('all');
  const [activeSubTab, setActiveSubTab] = useState<string>('人事');

  // API 数据状态
  const [loading, setLoading] = useState<boolean>(false);
  const [categories, setCategories] = useState<BrowserCategory[]>([]);
  const [allTypes, setAllTypes] = useState<BrowserTypeItem[]>([]);

  // 从后端 API 获取浏览按钮类型分类数据
  useEffect(() => {
    if (!visible) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await browserApi.getBrowserTypes();
        if (data && Array.isArray(data)) {
          // 设置分类数据
          setCategories(data as unknown as BrowserCategory[]);

          // 将分类数据转换为 ALL_BROWSER_TYPES 格式
          const types: BrowserTypeItem[] = [];
          (data as unknown as BrowserCategory[]).forEach((cat) => {
            const groupKey = CATEGORY_TO_GROUP_MAP[cat.categoryId] || cat.categoryId;
            if (cat.types && Array.isArray(cat.types)) {
              cat.types.forEach((t) => {
                const detail = TYPE_DETAIL_MAP[t.typeId] || {};
                types.push({
                  typeId: t.typeId,
                  label: t.label,
                  description: detail.description,
                  singleSelect: detail.singleSelect,
                  group: groupKey,
                  subCategory: detail.subCategory || '',
                });
              });
            }
          });
          setAllTypes(types);
        }
      } catch (err) {
        console.error('获取浏览按钮类型失败:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [visible]);

  // 动态生成主分类 Tabs
  const mainCategories = useMemo(() => {
    const tabs = [{ key: 'all', label: '全部类型' }];
    categories.forEach((cat) => {
      const groupKey = CATEGORY_TO_GROUP_MAP[cat.categoryId] || cat.categoryId;
      const label = GROUP_LABEL_MAP[groupKey] || cat.categoryName;
      // 去重
      if (!tabs.find(t => t.key === groupKey)) {
        tabs.push({ key: groupKey, label });
      }
    });
    return tabs;
  }, [categories]);

  // 按主分类过滤
  const filteredByMainTab = useMemo(() => {
    if (activeMainTab === 'all') return allTypes;
    return allTypes.filter(t => t.group === activeMainTab);
  }, [activeMainTab, allTypes]);

  // 按子分类进一步过滤
  const displayTypes = useMemo(() => {
    if (activeMainTab !== 'hrm') return filteredByMainTab;
    // 人员tab需要子分类过滤
    return filteredByMainTab.filter(t =>
      !t.subCategory || t.subCategory === activeSubTab
    );
  }, [filteredByMainTab, activeMainTab, activeSubTab]);

  // 将显示的类型按分组聚合
  const groupedTypes = useMemo(() => {
    const groups: Record<string, BrowserTypeItem[]> = {};
    displayTypes.forEach(type => {
      const groupName = type.group || '其他';
      const label = GROUP_LABEL_MAP[groupName] || groupName;
      if (!groups[label]) groups[label] = [];
      groups[label].push(type);
    });
    return groups;
  }, [displayTypes]);

  // 切换主Tab时重置子Tab
  const handleMainTabChange = (key: string) => {
    setActiveMainTab(key);
    if (key !== 'all') {
      setActiveSubTab('人事');
    }
  };

  // 渲染类型链接列表
  const renderTypeLinks = (types: BrowserTypeItem[]) => {
    if (types.length === 0) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无该分类下的类型" />;
    }

    return types.map((type, idx) => (
      <React.Fragment key={type.typeId}>
        <a
          onClick={() => onConfirm(type.typeId, type.label)}
          style={{
            color: currentTypeId === type.typeId ? '#0072C6' : '#333',
            fontWeight: currentTypeId === type.typeId ? 600 : 400,
            cursor: 'pointer',
            textDecoration: 'none',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (currentTypeId !== type.typeId) {
              e.currentTarget.style.color = '#0072C6';
            }
          }}
          onMouseLeave={(e) => {
            if (currentTypeId !== type.typeId) {
              e.currentTarget.style.color = '#333';
            }
          }}
        >
          {type.label}
        </a>
        {idx < types.length - 1 && (
          <span style={{ margin: '0 6px', color: '#ccc' }}>|</span>
        )}
      </React.Fragment>
    ));
  };

  // 主Tab内容渲染
  const renderMainTabContent = () => {
    if (loading) {
      return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin size="large" /></div>;
    }
    if (Object.keys(groupedTypes).length === 0) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
    }

    return Object.entries(groupedTypes).map(([groupName, types]) => (
      <div key={groupName} style={{ marginBottom: 14 }}>
        {/* 分组标签 */}
        <span
          style={{
            display: 'inline-block',
            width: 56,
            fontSize: 13,
            color: '#999',
            verticalAlign: 'top',
            flexShrink: 0,
            paddingTop: 2,
          }}
        >
          {groupName}
        </span>
        {/* 类型链接 */}
        <span
          style={{
            display: 'inline-block',
            maxWidth: 420,
            fontSize: 13,
            lineHeight: '26px',
            wordBreak: 'break-all',
          }}
        >
          {renderTypeLinks(types)}
        </span>
      </div>
    ));
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>浏览按钮类型选择</span>
          <Tooltip title="高级设置">
            <SettingOutlined
              style={{ cursor: 'pointer', color: '#999', fontSize: 15 }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          </Tooltip>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={560}
      destroyOnClose
      bodyStyle={{ paddingTop: 0, minHeight: 320 }}
    >
      {/* 主分类Tabs */}
      <Tabs
        activeKey={activeMainTab}
        onChange={handleMainTabChange}
        size="small"
        items={mainCategories.map(cat => ({
          key: cat.key,
          label: cat.label,
        }))}
        style={{ marginBottom: 8 }}
      />

      {/* 人员类别的子分类 */}
      {activeMainTab === 'hrm' && (
        <div style={{ marginBottom: 12 }}>
          <Space size={16}>
            {SUB_CATEGORIES.map(sub => (
              <a
                key={sub}
                onClick={() => setActiveSubTab(sub)}
                style={{
                  fontSize: 13,
                  color: activeSubTab === sub ? '#0072C6' : '#666',
                  fontWeight: activeSubTab === sub ? 600 : 400,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  borderBottom: activeSubTab === sub ? '2px solid #0072C6' : '2px solid transparent',
                  paddingBottom: 2,
                }}
              >
                {sub}
              </a>
            ))}
          </Space>
        </div>
      )}

      {/* 类型列表区域 */}
      <div style={{ padding: '4px 0' }}>
        {renderMainTabContent()}
      </div>

      {/* 底部提示 */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0', fontSize: 11, color: '#bbb' }}>
        点击上方类型名称可切换浏览按钮类型并预览效果
      </div>
    </Modal>
  );
};

export default BrowserTypePicker;

/** 导出类型详情配置供外部使用 */
export { TYPE_DETAIL_MAP };
export type { BrowserTypeItem, BrowserCategory };
