import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Modal, Select, Space, Spin, Typography, message, App } from 'antd';
import { ArrowLeftOutlined, EyeOutlined, SaveOutlined } from '@ant-design/icons';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { history, useSearchParams } from '@umijs/max';
import { AppstoreAddOutlined, AppstoreOutlined } from '@ant-design/icons';
import { portalApi, ELEMENT_TYPE_META } from '@/services/portal';
import type { ElementType, PortalElement, PortalElementLib, PortalPage } from '@/services/portal';
import ElementPalette from './components/ElementPalette';
import { REGISTERED_ELEMENT_TYPES } from '../components/ElementRegistry';
import DesignCanvas from './components/DesignCanvas';
import PropertyDrawer from './components/PropertyDrawer';
import {
  buildDefaultConfig,
  defaultElementName,
  toSaveData,
  type DesignerElement,
} from './types';

const { Text } = Typography;

/**
 * 门户设计器（全屏独立页，is_open=2 → 顶层挂载不套 ProLayout）
 *
 * 文件路径：src/pages/Portal/Design/Design.tsx
 * 菜单路径：blade_menu code='portal_design' path='/portal/design'
 * 组件解析：app.tsx buildComponentLoaders(module=Portal, page=Design, rawPage=design)
 *          候选含 ./pages/Portal/Design/Design.tsx
 */
const PortalDesigner: React.FC = () => {
  const [pageId, setPageId] = useState<number | undefined>(undefined);
  const [searchParams] = useSearchParams();

  /** 元素面板类型：后端已注册 Provider ∩ 前端已注册渲染器（缺一不显示；后端异常回退前端集合） */
  const [paletteTypes, setPaletteTypes] = useState<ElementType[]>(
    () =>
      REGISTERED_ELEMENT_TYPES.filter((t) => ELEMENT_TYPE_META[t as ElementType]) as ElementType[],
  );
  useEffect(() => {
    portalApi
      .getElementTypes()
      .then((types) => {
        const backend = new Set((types || []).map((t) => String(t)));
        const inter = REGISTERED_ELEMENT_TYPES.filter(
          (t) => backend.has(t) && ELEMENT_TYPE_META[t as ElementType],
        ) as ElementType[];
        setPaletteTypes(inter.length ? inter : (REGISTERED_ELEMENT_TYPES as ElementType[]));
      })
      .catch(() => setPaletteTypes(REGISTERED_ELEMENT_TYPES as ElementType[]));
  }, []);

  /* 从元素库添加（§12.5 P3）：仅列正常态库元素 */
  const [libList, setLibList] = useState<PortalElementLib[]>([]);
  const [libOpen, setLibOpen] = useState(false);
  const [libAdding, setLibAdding] = useState(false);
  const [libSelId, setLibSelId] = useState<number | undefined>(undefined);
  useEffect(() => {
    portalApi
      .getElementLibList()
      .then((list) => setLibList((list || []).filter((l) => l.status === 1)))
      .catch(() => setLibList([]));
  }, []);

  const [elements, setElements] = useState<DesignerElement[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragType, setDragType] = useState<ElementType | null>(null);

  /* 另存为元素模板（对标泛微 elementtemplate §15.3 B2）：把选中元素的配置快照存为模板 */
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplSaving, setTplSaving] = useState(false);
  const selectedElement = useMemo(
    () => elements.find((e) => e.uid === selectedUid),
    [elements, selectedUid],
  );

  const handleSaveAsTemplate = async () => {
    if (!selectedElement) {
      message.warning('请先选中一个元素');
      return;
    }
    if (!tplName.trim()) {
      message.warning('请输入模板名称');
      return;
    }
    setTplSaving(true);
    try {
      const ok = await portalApi.submitElementTemplate({
        elementType: selectedElement.elementType,
        templateName: tplName.trim(),
        config: selectedElement.config || {},
      });
      if (ok) {
        message.success('已存为元素模板');
        setTplOpen(false);
        setTplName('');
      } else {
        message.error('保存失败（模板名不可重复）');
      }
    } catch (e) {
      console.error('[portal] 保存元素模板失败', e);
      message.error('保存失败');
    } finally {
      setTplSaving(false);
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  /* 页面列表（采用 useState + useEffect 直接 await，与 FormMode 页面一致的既有范式） */
  const [pages, setPages] = useState<PortalPage[]>([]);
  const [elementLoading, setElementLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    portalApi
      .getPageList()
      .then((list) => {
        if (!cancelled) setPages(list || []);
      })
      .catch((e) => {
        console.error('[portal] 加载门户页面列表失败', e);
        if (!cancelled) setPages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pageOptions = useMemo(
    () => pages.map((p) => ({ label: p.pageName, value: p.id as number })),
    [pages],
  );

  /* 选中页面的元素 */
  const reloadElements = useCallback(async () => {
    if (!pageId) {
      setElements([]);
      return;
    }
    setElementLoading(true);
    try {
      const list: PortalElement[] = (await portalApi.getElementList(pageId)) || [];
      setElements(
        list.map((el, index) => {
          // 兼容两种形态：后端 VO 的 config（对象）/ 老接口的 configJson（JSON 字符串）
          let config = el.config;
          if (!config && (el as any).configJson) {
            try {
              config = JSON.parse((el as any).configJson);
            } catch (e) {
              console.error('[portal] 解析元素配置失败', e);
              config = {};
            }
          }
          return {
            ...el,
            uid: el.id ? `e-${el.id}` : `new-${index}-${Date.now()}`,
            elementType: el.elementType as ElementType,
            rowNo: el.rowNo || 1,
            colSpan: el.colSpan || 12,
            sortOrder: el.sortOrder ?? index + 1,
            showTitle: el.showTitle ?? 1,
            config: config || {},
          };
        }),
      );
      setDirty(false);
      setSelectedUid(undefined);
    } catch (e) {
      console.error('[portal] 加载门户元素失败', e);
      setElements([]);
    } finally {
      setElementLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    reloadElements();
  }, [reloadElements]);

  /* 从元素库实例化一个元素到当前页（落库后重新拉取画布） */
  const handleAddFromLib = async () => {
    if (!pageId || !libSelId) return;
    setLibAdding(true);
    try {
      const id = await portalApi.instantiateElementLib({ libId: libSelId, pageId, rowNo: 1, colSpan: 12 });
      if (id != null) {
        message.success('已从元素库添加');
        setLibOpen(false);
        setLibSelId(undefined);
        reloadElements();
      } else {
        message.error('添加失败：库元素可能已封存');
      }
    } catch (e) {
      console.error('[portal] 从元素库添加失败', e);
      message.error('添加失败');
    } finally {
      setLibAdding(false);
    }
  };

  /* 选中页面：URL ?pageId 优先（页面管理"设计"按钮带参进入），其次默认页，再第一页 */
  const urlPageId = searchParams.get('pageId');
  useEffect(() => {
    if (pageId || !pages.length) return;
    const fromUrl = urlPageId ? pages.find((p) => String(p.id) === urlPageId) : undefined;
    const def = fromUrl || pages.find((p) => p.isDefault === 1) || pages[0];
    if (def?.id) setPageId(def.id);
  }, [pages, pageId, urlPageId]);

  const selected = elements.find((e) => e.uid === selectedUid);

  const handleDragStart = (event: DragStartEvent) => {
    const type = (event.active.data.current as any)?.type as ElementType | undefined;
    setDragType(type || null);
  };

  /** 新增一个元素（拖拽与点击添加共用） */
  const addElement = useCallback(
    (type: ElementType) => {
      if (!pageId) {
        message.warning('请先在顶部选择一个门户页面');
        return;
      }
      setElements((prev) => {
        const maxSort = prev.reduce((max, e) => Math.max(max, e.sortOrder), 0);
        const newEl: DesignerElement = {
          uid: `new-${Date.now()}`,
          pageId,
          elementType: type,
          elementName: defaultElementName(type),
          showTitle: 1,
          rowNo: 1,
          colSpan: 12,
          sortOrder: maxSort + 1,
          config: buildDefaultConfig(type),
        };
        setSelectedUid(newEl.uid);
        return [...prev, newEl];
      });
      setDirty(true);
      message.success(`已添加「${ELEMENT_TYPE_META[type]?.label}」元素`);
    },
    [pageId],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    setDragType(null);
    const { active, over } = event;
    if (!over) return;
    const from = (active.data.current as any)?.from;
    const to = (over.data.current as any)?.from;
    const type = (active.data.current as any)?.type as ElementType | undefined;

    // 从左侧面板拖入 → 新增元素
    if (from === 'palette') {
      if (!type) return;
      addElement(type);
      return;
    }

    // 画布内排序
    if (from === 'canvas' && to === 'canvas' && active.id !== over.id) {
      const oldIndex = elements.findIndex((e) => e.uid === active.id);
      const newIndex = elements.findIndex((e) => e.uid === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        setElements((prev) => arrayMove(prev, oldIndex, newIndex));
        setDirty(true);
      }
    }
  };

  const patchElement = useCallback((uid: string, patch: Partial<DesignerElement>) => {
    setElements((prev) => prev.map((e) => (e.uid === uid ? { ...e, ...patch } : e)));
    setDirty(true);
  }, []);

  const removeElement = useCallback((uid: string) => {
    setElements((prev) => prev.filter((e) => e.uid !== uid));
    setSelectedUid((cur) => (cur === uid ? undefined : cur));
    setDirty(true);
  }, []);

  const handleSave = async () => {
    if (!pageId) {
      message.warning('请先选择门户页面');
      return;
    }
    setSaving(true);
    try {
      const payload = elements.map((el, index) => ({
        ...toSaveData(el),
        sortOrder: el.sortOrder || index + 1,
      }));
      const ok = await portalApi.saveElementBatch(pageId, payload);
      if (ok) {
        message.success('门户布局已保存');
        setDirty(false);
        reloadElements();
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存门户元素失败', e);
      message.error('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <App>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F5F7FA' }}>
        {/* 顶栏 */}
        <div
          style={{
            height: 56,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            background: '#FFFFFF',
            borderBottom: '1px solid #E6EDF5',
          }}
        >
          <Space size={12}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => history.push('/portal/home')}>
              返回门户
            </Button>
            <Text strong style={{ fontSize: 15 }}>
              门户设计器
            </Text>
            <Select
              style={{ width: 220 }}
              placeholder="选择门户页面"
              value={pageId}
              options={pageOptions}
              onChange={(v) => setPageId(v)}
            />
            {dirty ? <Text type="warning">未保存</Text> : <Text type="secondary">已保存</Text>}
          </Space>
          <Space>
            <Button
              icon={<AppstoreAddOutlined />}
              disabled={!pageId}
              onClick={() => {
                setLibSelId(undefined);
                setLibOpen(true);
              }}
            >
              从元素库添加
            </Button>
            <Button
              disabled={!selectedElement}
              onClick={() => {
                setTplName(selectedElement?.elementName || '');
                setTplOpen(true);
              }}
            >
              存为模板
            </Button>
            <Button icon={<AppstoreOutlined />} onClick={() => history.push('/portal/pagemanage')}>
              页面管理
            </Button>
            <Button icon={<EyeOutlined />} onClick={() => history.push('/portal/home')}>
              预览
            </Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              保存布局
            </Button>
          </Space>
        </div>

        <Modal
          title="从元素库添加"
          open={libOpen}
          onOk={handleAddFromLib}
          confirmLoading={libAdding}
          onCancel={() => setLibOpen(false)}
          okText="添加"
          cancelText="取消"
          destroyOnHidden
        >
          <div style={{ marginTop: 12 }}>
            <Select
              style={{ width: '100%' }}
              placeholder="选择元素库中的元素"
              value={libSelId}
              onChange={setLibSelId}
              options={libList.map((l) => ({
                value: l.id as number,
                label: `${l.elementName}（${ELEMENT_TYPE_META[l.elementType as ElementType]?.label || l.elementType}）`,
              }))}
              notFoundContent="元素库暂无可用元素"
            />
          </div>
        </Modal>

        {/* 另存为元素模板（对标 elementtemplate §15.3 B2） */}
        <Modal
          title="存为元素模板"
          open={tplOpen}
          onOk={handleSaveAsTemplate}
          confirmLoading={tplSaving}
          onCancel={() => setTplOpen(false)}
          okText="保存"
          cancelText="取消"
          destroyOnHidden
        >
          <div style={{ marginTop: 12 }}>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={`元素类型：${selectedElement ? ELEMENT_TYPE_META[selectedElement.elementType]?.label || selectedElement.elementType : '-'}`}
              description="模板保存该元素当前的私有配置快照，之后可在「门户样式库 → 元素模板」查看与维护"
            />
            <Input
              placeholder="模板名称（租户内唯一）"
              value={tplName}
              maxLength={128}
              onChange={(e) => setTplName(e.target.value)}
            />
          </div>
        </Modal>

        {!pageId ? (
          <Alert
            type="info"
            showIcon
            message="请先在顶部选择一个门户页面，再拖入元素进行编排"
            style={{ margin: 16 }}
          />
        ) : null}

        {/* 主体：左面板 + 中画布 + 右抽屉 */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <ElementPalette types={paletteTypes} onAdd={addElement} />
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={elements.map((e) => e.uid)} strategy={rectSortingStrategy}>
              {elementLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spin tip="正在加载页面元素..." />
                </div>
              ) : (
                <DesignCanvas
                  elements={elements}
                  selectedUid={selectedUid}
                  onSelect={setSelectedUid}
                  onRemove={removeElement}
                />
              )}
            </SortableContext>
            <DragOverlay>
              {dragType ? (
                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: '#1677FF',
                    color: '#FFFFFF',
                    fontSize: 13,
                    boxShadow: '0 6px 16px rgba(22,119,255,.35)',
                  }}
                >
                  {ELEMENT_TYPE_META[dragType]?.icon} {ELEMENT_TYPE_META[dragType]?.label}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          <PropertyDrawer
            element={selected}
            open={!!selected}
            onClose={() => setSelectedUid(undefined)}
            onChange={patchElement}
            onRemove={removeElement}
          />
        </div>
      </div>
    </App>
  );
};

export default PortalDesigner; 
