import React, { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
  App,
  Button,
  Card,
  Tabs,
  Spin,
} from 'antd';
import {
  SaveOutlined,
  EyeOutlined,
  DownloadOutlined,
  UploadOutlined,
  UndoOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from '@umijs/max';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import FieldPalette from './components/FieldPalette';
import UniverExcelGrid from './components/UniverExcelGrid';
import PropertyPanel from './components/PropertyPanel';
import { saveFormLayout, getFormLayout } from '@/services/formmode/formLayoutApi';

/**
 * Excel设计器主页面
 * 集成Univer表格、字段面板、属性配置面板
 * 参照 SpreadJS迁移到Univer方案.md 实现字段元数据完整集成
 */
const ExcelDesignContent: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const formId = searchParams.get('formId');
  const { message } = App.useApp();

  const [activeTab, setActiveTab] = useState<string>('Sheet1');
  const [selectedField, setSelectedField] = useState<any>(null);
  const [layoutData, setLayoutData] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [pendingField, setPendingField] = useState<any>(null);

  // ──────────────────────────────────────────────
  // 加载表单布局数据
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (formId) {
      loadFormLayout();
    }
  }, [formId]);

  const loadFormLayout = async () => {
    if (!formId) return;
    setLoading(true);
    try {
      const result = await getFormLayout(parseInt(formId));
      if (result && result.data) {
        const parsed = result.data.layoutJson || {};
        setLayoutData(parsed);
        message.success('布局数据加载成功');
      }
    } catch (error) {
      console.error('加载布局数据失败:', error);
      message.error('加载布局数据失败');
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────
  // 保存表单布局 - 从 UniverExcelGrid 获取数据
  // ──────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!formId) {
      message.warning('请先选择表单');
      return;
    }

    const univerGrid = (window as any).univerExcelGrid;
    if (!univerGrid) {
      message.error('Excel组件未初始化');
      return;
    }

    const sheetLayoutData = univerGrid.saveLayoutData();
    if (!sheetLayoutData) {
      message.error('获取布局数据失败');
      return;
    }

    setSaving(true);
    try {
      const formData = {
        formId: parseInt(formId),
        layoutName: `表单${formId}的布局`,
        layoutJson: sheetLayoutData,
        status: 1,
      };
      await saveFormLayout(formData);
      message.success('保存成功');
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  }, [formId]);

  // ──────────────────────────────────────────────
  // 字段选择 → 准备放置到 Excel 单元格
  // 参照迁移文档 §5.3 字段绑定
  // ──────────────────────────────────────────────
  const handleFieldSelect = useCallback((field: any) => {
    console.log('[handleFieldSelect] 收到字段:', field);
    
    // 判断字段来源：来自后端表单字段 vs 静态字段类型
    // FieldDefinition 特征：有 id、fieldName 和 fieldLabel 属性（后端字段）
    // 静态字段特征：有 label 和 type 属性
    const isFormField = !!(field.id && (field.fieldName || field.fieldLabel));

    console.log('[handleFieldSelect] 字段类型判断:', {
      isFormField,
      hasId: !!field.id,
      hasFieldName: !!field.fieldName,
      hasFieldLabel: !!field.fieldLabel,
      fieldLabel: field.fieldLabel,
      label: field.label,
    });

    // 构造完整的 pendingField 对象
    const pending = {
      ...field,
      // 字段ID：后端字段用 id，静态类型用 type 或生成的 ID
      id: field.id || field.fieldId || `static_${field.type}_${Date.now()}`,
      // 字段名称（数据库字段名）
      fieldName: field.fieldName || field.name || field.type || 'unknown',
      // 字段标签（显示名称）- 添加默认值防止 undefined
      fieldLabel: field.fieldLabel || field.label || field.fieldName || field.type || '未命名字段',
      // 字段类型：后端字段用 fieldHtmlType/fieldType，静态类型用 type
      fieldHtmlType: field.fieldHtmlType || 1,
      fieldType: field.fieldType || 1,
      // 兼容旧代码
      type: isFormField ? 'formField' : (field.type || 'unknown'),
      label: field.fieldLabel || field.label || field.fieldName || '未命名字段',
      // 其他属性
      required: false,
      readonly: false,
      defaultValue: '',
      placeholder: '',
      tooltip: '',
      options: [],
    };

    console.log('[handleFieldSelect] 构造后的 pending:', {
      id: pending.id,
      fieldName: pending.fieldName,
      fieldLabel: pending.fieldLabel,
      type: pending.type,
    });

    setPendingField(pending);
    setSelectedField(pending);

    // 挂载到 window 供 UniverExcelGrid 内部通过事件访问
    (window as any).__pendingField = pending;

    message.info(`已选中字段 "${pending.fieldLabel}"，请拖拽到 Excel 单元格`);
  }, []);

  // ──────────────────────────────────────────────
  // 取消待放置字段（Escape 键或手动清理）
  // ──────────────────────────────────────────────
  const clearPendingField = useCallback(() => {
    setPendingField(null);
    (window as any).__pendingField = null;
    message.info('已取消字段放置');
  }, []);

  // 监听 Escape 键取消待放置状态
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pendingField) {
        clearPendingField();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingField, clearPendingField]);

  // ──────────────────────────────────────────────
  // 布局变更回调
  // ──────────────────────────────────────────────
  const handleLayoutChange = useCallback((data: any) => {
    setLayoutData((prev: any) => ({ ...prev, ...data }));
  }, []);

  // ──────────────────────────────────────────────
  // 重做/撤销（占位）
  // ──────────────────────────────────────────────
  const handleUndo = () => message.info('撤销功能开发中');
  const handleRedo = () => message.info('重做功能开发中');

  // ──────────────────────────────────────────────
  // 导出布局为 JSON（参照迁移文档 JSON 格式）
  // ──────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const univerGrid = (window as any).univerExcelGrid;
    if (!univerGrid) {
      message.warning('Excel组件未初始化');
      return;
    }
    const data = univerGrid.saveLayoutData();
    if (!data) return;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout-${formId || 'unknown'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('布局导出成功');
  }, [formId]);

  // ──────────────────────────────────────────────
  // 导入布局 JSON
  // ──────────────────────────────────────────────
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        setLayoutData(parsed);
        message.success('布局导入成功，请切换工作表刷新');
      } catch {
        message.error('无效的 JSON 文件');
      }
    };
    input.click();
  }, []);

  // ──────────────────────────────────────────────
  // 页面按钮配置
  // ──────────────────────────────────────────────
  const pageExtra = [
    ...(pendingField
      ? [
          <Button
            key="clear-pending"
            danger
            icon={<UndoOutlined />}
            onClick={clearPendingField}
          >
            取消放置: {pendingField.fieldLabel}
          </Button>,
        ]
      : []),
    <Button key="save" type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
      保存
    </Button>,
    <Button key="preview" icon={<EyeOutlined />}>
      预览
    </Button>,
    <Button key="import" icon={<UploadOutlined />} onClick={handleImport}>
      导入
    </Button>,
    <Button key="export" icon={<DownloadOutlined />} onClick={handleExport}>
      导出
    </Button>,
    <Button key="undo" icon={<UndoOutlined />} onClick={handleUndo}>
      撤销
    </Button>,
    <Button key="redo" icon={<RedoOutlined />} onClick={handleRedo}>
      重做
    </Button>,
  ];

  // ──────────────────────────────────────────────
  // Tabs 配置 - 每个工作表对应一个 UniverExcelGrid
  // 传递 pendingField 以实现选中字段后点击放置
  // ──────────────────────────────────────────────
  const tabItems = ['Sheet1', 'Sheet2'].map((name) => ({
    key: name,
    label: name,
    children: (
      <UniverExcelGrid
        sheetName={name}
        layoutData={layoutData}
        onLayoutChange={handleLayoutChange}
        formId={formId || undefined}
        pendingField={selectedField || (window as any).__pendingField}
      />
    ),
  }));

  return (
    <DndProvider backend={HTML5Backend}>
      <PageContainer title="Excel 设计器" extra={pageExtra}>
        <Spin spinning={loading}>
          <div style={{ display: 'flex', height: 'calc(100vh - 200px)' }}>
            {/* 左侧字段面板 */}
            <div style={{ width: 250, borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
              <FieldPalette onFieldSelect={handleFieldSelect} formId={formId || undefined} />
            </div>

            {/* 中间 Univer Excel 区域 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
              <Card>
                <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
              </Card>
            </div>

            {/* 右侧属性配置面板 */}
            <div style={{ width: 300, borderLeft: '1px solid #f0f0f0', overflow: 'auto' }}>
              <PropertyPanel selectedField={selectedField} />
            </div>
          </div>
        </Spin>
      </PageContainer>
    </DndProvider>
  );
};

const ExcelDesign: React.FC = () => (
  <App>
    <ExcelDesignContent />
  </App>
);

export default ExcelDesign;
