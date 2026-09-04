import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
  App,
  Button,
  Card,
  Tabs,
  Spin,
  Divider,
  Tooltip,
} from 'antd';
import {
  SaveOutlined,
  EyeOutlined,
  DownloadOutlined,
  UploadOutlined,
  UndoOutlined,
  RedoOutlined,
  CheckCircleOutlined,
  EditOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from '@umijs/max';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import FieldPalette from './components/FieldPalette';
import UniverExcelGrid from './components/UniverExcelGrid';
import PropertyPanel from './components/PropertyPanel';
import ExcelPreview from './components/ExcelPreview';
import { EXCEL_PREVIEW_DATA_KEY } from './ExcelPreviewPage';
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
  // 镜像 ref：在异步回调里读取最新的 layoutData，避免闭包捕获到初始空对象
  const layoutDataRef = useRef(layoutData);
  layoutDataRef.current = layoutData;
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [pendingField, setPendingField] = useState<any>(null);
  const [hoveredField, setHoveredField] = useState<any>(null);

  // 预览弹窗状态
  const [previewVisible, setPreviewVisible] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<any>(null);

  // 字段属性状态
  const [fieldAttr, setFieldAttr] = useState<'readonly' | 'editable' | 'required' | null>(null);
  // 属性按钮是否禁用：选中无字段元数据的单元格时禁用（参照 ecology controlOperLimits）
  const [fieldAttrDisabled, setFieldAttrDisabled] = useState(false);

  // ──────────────────────────────────────────────
  // 字段属性操作（参照 ecology excel 设计器）- 供工具栏按钮使用
  // ──────────────────────────────────────────────
  const handleFieldAttrChange = useCallback((attr: 'readonly' | 'editable' | 'required') => {
    const univerGrid = (window as any).univerExcelGrid;
    if (!univerGrid) {
      return;
    }

    const selection = univerGrid.getSelection?.() || univerGrid.getContextCell?.();
    if (!selection) {
      return;
    }

    const attrValue = attr === 'readonly' ? 1 : attr === 'editable' ? 2 : 3;
    univerGrid.setFieldAttr?.(selection.row, selection.col, attrValue);
    setFieldAttr(attr);
  }, []);

  // ──────────────────────────────────────────────
  // 加载表单布局数据
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (formId) {
      loadFormLayout();
    }
  }, [formId]);

  // ──────────────────────────────────────────────
  // 监听 Univer 右键菜单事件
  // ──────────────────────────────────────────────
  useEffect(() => {
    // 打开字段属性面板
    const handleFieldPropertyOpen = () => {
      const univerGrid = (window as any).univerExcelGrid;
      if (!univerGrid) return;
      try {
        const selection = univerGrid.getSelection?.();
        if (selection) {
          const fieldMeta = univerGrid.getCellFieldMeta?.(selection.row, selection.col);
          if (fieldMeta) {
            setSelectedField(fieldMeta);
          }
        }
      } catch (e) {
        console.warn('[FieldPropertyEvent] 打开字段属性失败:', e);
      }
    };
    window.addEventListener('univer-field-property-open', handleFieldPropertyOpen);
    return () => {
      window.removeEventListener('univer-field-property-open', handleFieldPropertyOpen);
    };
  }, []);

  // ──────────────────────────────────────────────
  // 同步右键菜单设置的字段属性到工具栏高亮（只读/可编辑/必填）
  // ──────────────────────────────────────────────
  useEffect(() => {
    const handleAttrApplied = (e: Event) => {
      const attr = (e as CustomEvent).detail?.attr;
      setFieldAttr(attr === 1 ? 'readonly' : attr === 2 ? 'editable' : attr === 3 ? 'required' : null);
    };
    window.addEventListener('univer-field-attr-applied', handleAttrApplied as EventListener);
    return () => {
      window.removeEventListener('univer-field-attr-applied', handleAttrApplied as EventListener);
    };
  }, []);

  // 监听单元格选中状态 → 无字段元数据时禁用属性按钮（参照 ecology controlOperLimits 的禁用行为，不弹提示）
  useEffect(() => {
    const handleCellSelected = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setFieldAttrDisabled(detail?.hasField === false);
    };
    window.addEventListener('univer-cell-selected', handleCellSelected as EventListener);
    return () => {
      window.removeEventListener('univer-cell-selected', handleCellSelected as EventListener);
    };
  }, []);

  const loadFormLayout = async (force = false) => {
    if (!formId) return;
    setLoading(true);
    try {
      // 使用 String(formId) 避免 JavaScript 大整数精度丢失
      const result = await getFormLayout(String(formId));
      if (result && result.data) {
        // layoutJson 是字符串，需要解析为对象
        let layoutJson = result.data.layoutJson;
        if (typeof layoutJson === 'string') {
          try {
            layoutJson = JSON.parse(layoutJson);
          } catch (e) {
            console.warn('解析 layoutJson 失败:', e);
            layoutJson = {};
          }
        }

        // 竞态防护：初始异步加载若晚于用户拖入字段才返回，会覆盖掉已带字段元数据的布局，
        // 进而触发 loadLayoutData 清空内存 Map → 随后的显式保存读到空 Map → 字段元数据丢失（无法持久化）。
        // 非强制加载（挂载/初次）时，若当前已有布局内容，则跳过，保留用户编辑结果。
        if (!force && layoutDataRef.current && Object.keys(layoutDataRef.current).length > 0) {
          console.log('[LoadFormLayout] 跳过覆盖：当前已有布局数据（避免异步加载覆盖用户编辑）', {
            currentKeys: Object.keys(layoutDataRef.current),
          });
          return;
        }

        setLayoutData(layoutJson || {});
        console.log('[LoadFormLayout] 已加载布局数据', { hasFieldMeta: JSON.stringify(layoutJson).includes('fieldMeta') });
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
  // 预览：取当前布局数据，在**新标签页**打开独立预览页。
  // 对齐 ecology excelPreView 的行为（预览是独立页面而非设计器内弹窗）。
  // 数据通过 localStorage 跨标签页传递（sessionStorage 按标签页隔离，新标签页读不到）。
  const handlePreview = useCallback(() => {
    const univerGrid = (window as any).univerExcelGrid;
    if (!univerGrid) {
      message.error('Excel组件未初始化');
      return;
    }

    const data = univerGrid.saveLayoutData();
    if (!data) {
      message.warning('暂无可预览的布局数据，请先拖入字段');
      return;
    }

    // 先缓存数据，再开窗，保证新标签页一定能读到
    try {
      localStorage.setItem(EXCEL_PREVIEW_DATA_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[预览] 布局数据写入本地存储失败，回退为弹窗预览:', e);
    }

    const url = `/formmode/exceldesign/ExcelPreviewPage?t=${Date.now()}`;
    const win = window.open(url, '_blank');

    // 新标签页被浏览器拦截时，回退为弹窗预览，保证功能不失效
    if (!win) {
      message.info('新标签页被浏览器拦截，已改用弹窗预览');
      setPreviewData(data);
      setPreviewVisible(true);
    }
  }, [message]);

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
        formId: String(formId),  // 保持字符串格式，避免 JavaScript 大整数精度丢失
        layoutName: `表单${formId}的布局`,
        layoutJson: JSON.stringify(sheetLayoutData),  // 转换为 JSON 字符串
        status: 1,
      };
      await saveFormLayout(formData);
      message.success('保存成功');

      // 保存成功后重新加载布局数据，确保页面显示最新数据（强制刷新，覆盖用户编辑）
      await loadFormLayout(true);
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  }, [formId, loadFormLayout]);

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
  // 字段悬停 → 高亮对应单元格
  // ──────────────────────────────────────────────
  const handleFieldHover = useCallback((field: any | null) => {
    setHoveredField(field);
  }, []);

  // ──────────────────────────────────────────────
  // 布局变更回调
  // ──────────────────────────────────────────────
  const handleLayoutChange = useCallback((data: any) => {
    // 直接替换，不要与 prev 合并。
    // saveLayoutData 会先用 parentData（顶层 cellData）回调一次，再以 result（sheets）回调一次；
    // 若合并就会残留上一次的 sheets（过期数据），而 UniverExcelGrid 解析布局时优先取 sheets，
    // 于是会把过期布局重新灌回表格（如"清空单元格后又自动恢复"、字段元数据回滚）。
    setLayoutData(data);
  }, []);

  // ──────────────────────────────────────────────
  // 已拖入表格的字段集合（供字段面板置灰，避免重复拖入）
  // key 格式：`${fieldId}_${cellType}`，标签与字段占位符各自独立计数
  // ──────────────────────────────────────────────
  const usedFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    const collectFromCellData = (cellData: any) => {
      Object.values(cellData || {}).forEach((rowData: any) => {
        Object.values(rowData || {}).forEach((cell: any) => {
          const meta = cell?.fieldMeta;
          if (meta && meta.fieldId !== undefined && meta.fieldId !== null && meta.fieldId !== '') {
            keys.add(`${String(meta.fieldId)}_${meta.cellType}`);
          }
        });
      });
    };

    try {
      const sheets = layoutData?.sheets;
      if (sheets) {
        Object.values(sheets).forEach((sheet: any) => collectFromCellData(sheet?.cellData));
      } else {
        collectFromCellData(layoutData?.cellData);
      }
    } catch (e) {
      console.warn('[ExcelDesign] 解析已放置字段失败:', e);
    }
    return keys;
  }, [layoutData]);

  // ══════════════════════════════════════════════
  // Univer Event.Drop 原生拖拽放置事件处理
  // 功能：从左侧 FieldPalette 拖拽字段到 Univer canvas 单元格时，
  //       自动将字段数据填入目标单元格，提供完整的视觉反馈和异常处理
  // ══════════════════════════════════════════════

  /** 拖拽放置成功后的临时高亮状态（用于视觉反馈） */
  const [dropFlash, setDropFlash] = useState<{ row: number; col: number; label: string } | null>(null);
  const dropFlashTimerRef = useRef<any>(null);
  const dropDisposeRef = useRef<(() => void) | null>(null);

  /**
   * 订阅 Univer Event.Drop 事件的核心逻辑
   * 在 FUniver API 就绪后，注册拖拽放置回调
   * 每次拖拽放置会：
   *   1. 从 dataTransfer 解析字段数据（支持 application/json + text/plain 两种格式）
   *   2. 验证字段数据完整性
   *   3. 检查目标单元格是否已被占用
   *   4. 调用 UniverExcelGrid.handleFieldDrop 执行放置
   *   5. 清理 pendingField 状态
   *   6. 触发临时视觉高亮反馈
   */
  // ⚠️ 临时禁用 Event.Drop 订阅，避免与 useDrop 冲突
  // 只使用 React DnD 的 useDrop 处理拖放
  /*
  useEffect(() => {
    // 只针对该组件内的全局状态标记，防止重复订阅
    let retryTimer: any = null;
    let isSubscribed = false;

    console.log('[Event.Drop][Lifecycle] useEffect 初始化，开始准备订阅');

    const doSubscribe = () => {
      console.log('[Event.Drop][Subscribe] doSubscribe 开始执行');

      // 1. 获取 FUniver Facade API 实例
      const fAPI = (window as any).__univerFAPI;
      console.log('[Event.Drop][Dependency] 检查 window.__univerFAPI:', {
        exists: !!fAPI,
        hasEvent: !!(fAPI && fAPI.Event),
        hasAddEvent: !!(fAPI && typeof fAPI.addEvent === 'function'),
      });
      if (!fAPI || !fAPI.Event || !fAPI.addEvent) {
        console.warn('[Event.Drop][Dependency] FUniver API 未就绪, 返回 false 等待重试');
        return false;
      }

      // 2. 获取 UniverExcelGrid 组件引用（必须有 handleFieldDrop）
      const univerGrid = (window as any).univerExcelGrid;
      const hasHandleFieldDrop = !!(univerGrid && typeof univerGrid.handleFieldDrop === 'function');
      console.log('[Event.Drop][Dependency] 检查 window.univerExcelGrid:', {
        exists: !!univerGrid,
        hasHandleFieldDrop,
        exposedMethods: univerGrid ? Object.keys(univerGrid) : [],
      });
      if (!univerGrid || !hasHandleFieldDrop) {
        console.warn('[Event.Drop][Dependency] UniverExcelGrid 未就绪, 返回 false 等待重试');
        return false;
      }

      console.log('[Event.Drop][Subscribe] FUniver API + UniverExcelGrid 已就绪，开始订阅...');

      try {
        // 3. 订阅 Event.Drop
        const eventName = fAPI.Event.Drop;
        console.log('[Event.Drop][Subscribe] 调用 fAPI.addEvent, 事件名称:', {
          eventName,
          eventType: typeof eventName,
          availableEvents: Object.keys(fAPI.Event || {}),
        });

        const disposable = fAPI.addEvent(eventName, (params: any) => {
          // ── 回调入口日志 ──
          console.log('[Event.Drop][Callback] ====== 收到拖拽放置事件 ======');
          console.log('[Event.Drop][Callback] 回调已触发！', {
            timestamp: Date.now(),
            paramsType: typeof params,
            paramsKeys: params ? Object.keys(params) : []
          });
          console.log('[Event.Drop][Callback] params 原始值:', {
            type: typeof params,
            isNull: params === null,
            isUndefined: params === undefined,
            keys: params ? Object.keys(params) : [],
          });
          console.log('[Event.Drop][Callback] params 完整内容:', params);

          const { row, column, dataTransfer } = params || {};

          // ── 坐标解析日志 ──
          const colLetter = column !== undefined && column !== null ? String.fromCharCode(65 + Number(column)) : '?';
          const rowNum = row !== undefined && row !== null ? Number(row) + 1 : '?';
          console.log('[Event.Drop][Position] 目标单元格坐标:', {
            rawRow: row,
            rawColumn: column,
            rowType: typeof row,
            columnType: typeof column,
            displayRef: `(${rowNum}, ${colLetter})`,
            isValid: row !== undefined && row !== null && column !== undefined && column !== null,
          });

          // ── 3a. 验证 dataTransfer ──
          console.log('[Event.Drop][DataTransfer] dataTransfer 检查:', {
            exists: !!dataTransfer,
            type: typeof dataTransfer,
            types: dataTransfer ? Array.from(dataTransfer.types || []) : [],
            filesCount: dataTransfer?.files?.length ?? 0,
            effectAllowed: dataTransfer?.effectAllowed ?? 'N/A',
            dropEffect: dataTransfer?.dropEffect ?? 'N/A',
          });
          if (!dataTransfer) {
            console.warn('[Event.Drop][DataTransfer] dataTransfer 为空，忽略此次放置');
            console.log('[Event.Drop][Callback] ====== 结束（dataTransfer 为空）======');
            return;
          }

          // ── 3b. 从 dataTransfer 解析字段数据 ──
          // 优先使用 handleFieldSelect 后设置的 __pendingField（包含完整后端字段属性）
          // 然后尝试从 dataTransfer 的 application/json 解析
          // 最后 fallback 到 text/plain
          let fieldData: any = null;
          const pendingField = (window as any).__pendingField;
          console.log('[Event.Drop][FieldData] ====== 开始字段数据解析 ======');
          console.log('[Event.Drop][FieldData] Step 1 - 检查 window.__pendingField:', {
            exists: !!pendingField,
            fieldLabel: pendingField?.fieldLabel,
            fieldName: pendingField?.fieldName,
            fieldId: pendingField?.id || pendingField?.fieldId,
            pendingKeys: pendingField ? Object.keys(pendingField) : [],
          });

          if (pendingField) {
            fieldData = pendingField;
            console.log('[Event.Drop][FieldData] ✅ Step 1 命中: 使用 __pendingField');
          }

          if (!fieldData) {
            console.log('[Event.Drop][FieldData] Step 2 - 尝试从 dataTransfer.application/json 解析');
            const jsonData = dataTransfer.getData('application/json');
            console.log('[Event.Drop][FieldData] dataTransfer.getData("application/json") 结果:', {
              rawLength: jsonData?.length ?? 0,
              preview: jsonData ? jsonData.substring(0, 200) : '(empty)',
            });
            if (jsonData) {
              try {
                fieldData = JSON.parse(jsonData);
                console.log('[Event.Drop][FieldData] ✅ Step 2 命中: 从 application/json 解析成功:', {
                  fieldLabel: fieldData?.fieldLabel,
                  fieldName: fieldData?.fieldName,
                  fieldId: fieldData?.id || fieldData?.fieldId,
                  fieldType: fieldData?.fieldHtmlType || fieldData?.fieldType,
                  parsedKeys: Object.keys(fieldData),
                });
              } catch (e) {
                console.error('[Event.Drop][FieldData] ❌ Step 2 解析 application/json 异常:', {
                  error: (e as Error).message,
                  stack: (e as Error).stack?.substring(0, 200),
                  rawPreview: jsonData.substring(0, 300),
                });
              }
            } else {
              console.log('[Event.Drop][FieldData] Step 2 跳过: dataTransfer 中无 application/json 数据');
            }
          }

          if (!fieldData) {
            console.log('[Event.Drop][FieldData] Step 3 - 尝试从 dataTransfer.text/plain 解析');
            const textData = dataTransfer.getData('text/plain');
            console.log('[Event.Drop][FieldData] dataTransfer.getData("text/plain") 结果:', {
              textData,
              length: textData?.length ?? 0,
            });
            if (textData) {
              console.log('[Event.Drop][FieldData] Step 3a - 检查 __pendingField 是否匹配 text/plain:', {
                textData,
                pendingFieldLabel: pendingField?.fieldLabel,
                pendingFieldName: pendingField?.fieldName,
                labelMatch: pendingField?.fieldLabel === textData,
                nameMatch: pendingField?.fieldName === textData,
              });
              const p = (window as any).__pendingField;
              if (p && (p.fieldLabel === textData || p.fieldName === textData)) {
                fieldData = p;
                console.log('[Event.Drop][FieldData] ✅ Step 3 命中: 通过 text/plain 匹配到 __pendingField');
              } else {
                console.log('[Event.Drop][FieldData] Step 3 无法匹配: text/plain 数据无法关联到已选字段');
              }
            } else {
              console.log('[Event.Drop][FieldData] Step 3 跳过: dataTransfer 中无 text/plain 数据');
            }
          }

          // ── 3c. 验证字段数据是否有效 ──
          console.log('[Event.Drop][FieldData] ====== 字段数据验证 ======');
          const finalFieldData = fieldData;
          console.log('[Event.Drop][FieldData] 最终字段数据概览:', {
            exists: !!finalFieldData,
            hasId: !!(finalFieldData?.id || finalFieldData?.fieldId),
            hasFieldName: !!finalFieldData?.fieldName,
            hasFieldLabel: !!finalFieldData?.fieldLabel,
            fieldLabel: finalFieldData?.fieldLabel || '(empty)',
            fieldName: finalFieldData?.fieldName || '(empty)',
            fieldId: finalFieldData?.id || finalFieldData?.fieldId || '(empty)',
            fieldHtmlType: finalFieldData?.fieldHtmlType || '(empty)',
            fieldType: finalFieldData?.fieldType || '(empty)',
            fullPayload: finalFieldData ? JSON.stringify(finalFieldData).substring(0, 500) : '(null)',
          });

          if (!finalFieldData || (!finalFieldData.id && !finalFieldData.fieldName && !finalFieldData.fieldLabel)) {
            console.warn('[Event.Drop][FieldData] ❌ 字段数据验证失败:', {
              reason: !finalFieldData ? 'fieldData 为空' : '缺少 id/fieldName/fieldLabel',
              fieldData: finalFieldData,
            });
            message.warning({
              content: '请先点击左侧字段面板选中字段，再拖拽到 Excel 单元格',
              key: 'drop-field-warning',
              duration: 3,
            });
            console.log('[Event.Drop][Callback] ====== 结束（字段数据无效）======');
            return;
          }
          console.log('[Event.Drop][FieldData] ✅ 字段数据验证通过');

          // ── 3d. 检查目标单元格是否已被占用 ──
          console.log('[Event.Drop][CellCheck] ====== 目标单元格占用检查 ======');
          console.log('[Event.Drop][CellCheck] 目标:', {
            row,
            column,
            cellRef: `(${rowNum}, ${colLetter})`,
            hasGetCellFieldMeta: typeof univerGrid.getCellFieldMeta === 'function',
          });
          if (typeof univerGrid.getCellFieldMeta === 'function') {
            const existingMeta = univerGrid.getCellFieldMeta(row, column);
            console.log('[Event.Drop][CellCheck] getCellFieldMeta 查询结果:', {
              hasMeta: !!existingMeta,
              fieldId: existingMeta?.fieldId || '(none)',
              fieldLabel: existingMeta?.fieldLabel || '(none)',
              fieldName: existingMeta?.fieldName || '(none)',
              fullMeta: existingMeta ? JSON.stringify(existingMeta) : '(null)',
            });
            if (existingMeta && existingMeta.fieldId) {
              console.warn('[Event.Drop][CellCheck] ❌ 目标单元格已被占用，阻止放置:', {
                row,
                column,
                cellRef: `(${rowNum}, ${colLetter})`,
                existingField: existingMeta.fieldLabel,
                newField: finalFieldData.fieldLabel || finalFieldData.fieldName,
              });
              message.warning({
                content: `单元格 (${rowNum}, ${colLetter}) 已被字段"${existingMeta.fieldLabel}"占用`,
                key: 'cell-occupied',
                duration: 3,
              });
              console.log('[Event.Drop][Callback] ====== 结束（单元格被占用）======');
              return;
            }
            console.log('[Event.Drop][CellCheck] ✅ 目标单元格空闲，可以放置');
          } else {
            console.log('[Event.Drop][CellCheck] ⚠️ getCellFieldMeta 不可用，跳过占用检查');
          }

          // ── 3e. 执行字段放置 ──
          console.log('[Event.Drop][Execute] ====== 开始执行字段放置 ======');
          console.log('[Event.Drop][Execute] 调用参数:', {
            field: {
              id: finalFieldData.id || finalFieldData.fieldId,
              fieldName: finalFieldData.fieldName,
              fieldLabel: finalFieldData.fieldLabel,
              fieldHtmlType: finalFieldData.fieldHtmlType,
            },
            row,
            column,
            cellRef: `(${rowNum}, ${colLetter})`,
          });
          console.log('[Event.Drop][Execute] 调用 univerGrid.handleFieldDrop...');
          try {
            const startTime = Date.now();
            univerGrid.handleFieldDrop(finalFieldData, row, column);
            const elapsed = Date.now() - startTime;
            console.log('[Event.Drop][Execute] ✅ handleFieldDrop 调用成功:', {
              elapsed: `${elapsed}ms`,
              field: finalFieldData.fieldLabel || finalFieldData.fieldName,
              target: `(${rowNum}, ${colLetter})`,
            });

            // 成功提示（使用固定 key 避免重复弹出）
            const successMsg = `字段"${finalFieldData.fieldLabel || finalFieldData.fieldName}" 已放置到单元格 (${rowNum}, ${colLetter})`;
            console.log('[Event.Drop][Feedback] 发送 success 提示:', successMsg);
            message.success({
              content: successMsg,
              key: 'drop-success',
              duration: 2,
            });

            // 视觉反馈：临时高亮状态（2 秒后自动消失）
            console.log('[Event.Drop][Feedback] 触发 visual flash 高亮:', {
              row,
              col: column,
              label: finalFieldData.fieldLabel || finalFieldData.fieldName || '',
            });
            setDropFlash({
              row,
              col: column,
              label: finalFieldData.fieldLabel || finalFieldData.fieldName || '',
            });
            if (dropFlashTimerRef.current) {
              console.log('[Event.Drop][Feedback] 清除上一次的 flash 定时器');
              clearTimeout(dropFlashTimerRef.current);
            }
            dropFlashTimerRef.current = setTimeout(() => {
              console.log('[Event.Drop][Feedback] flash 高亮定时器到期，清除高亮');
              setDropFlash(null);
              dropFlashTimerRef.current = null;
            }, 2000);

            // 清理待放置状态
            console.log('[Event.Drop][Cleanup] 清理 pendingField 状态');
            setPendingField(null);
            (window as any).__pendingField = null;
            console.log('[Event.Drop][Cleanup] ✅ pendingField 已清理');

            console.log('[Event.Drop][Callback] ====== 结束（放置成功 ✅）======');
          } catch (e) {
            const error = e as Error;
            console.error('[Event.Drop][Execute] ❌ handleFieldDrop 抛出异常:', {
              name: error.name,
              message: error.message,
              stack: error.stack?.substring(0, 500),
              field: finalFieldData?.fieldLabel || finalFieldData?.fieldName || '(unknown)',
              target: `(${rowNum}, ${colLetter})`,
            });
            message.error({
              content: `字段放置失败：${error.message || '未知错误'}`,
              key: 'drop-error',
              duration: 3,
            });
            console.log('[Event.Drop][Callback] ====== 结束（执行异常 ❌）======');
          }
        });

        // 保存清理函数
        console.log('[Event.Drop][Dispose] 保存 disposable 清理函数');
        dropDisposeRef.current = () => {
          console.log('[Event.Drop][Dispose] 执行 disposable.dispose() 清理事件订阅');
          try {
            disposable.dispose();
            console.log('[Event.Drop][Dispose] ✅ disposable.dispose() 执行成功');
          } catch (e) {
            console.warn('[Event.Drop][Dispose] disposable.dispose() 执行忽略:', e);
          }
        };

        isSubscribed = true;
        console.log('[Event.Drop][Subscribe] ✅✅✅ Event.Drop 订阅成功 ✅✅✅');
        return true;
      } catch (e) {
        const error = e as Error;
        console.error('[Event.Drop][Subscribe] ❌ 订阅 Event.Drop 抛出异常:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 500),
        });
        return false;
      }
    };

    // 延迟 1.5 秒等待 Univer 初始化完成
    console.log('[Event.Drop][Retry] 设置 1.5s 延迟后首次尝试订阅');
    const initialTimer = setTimeout(() => {
      console.log('[Event.Drop][Retry] 1.5s 延迟到期，首次尝试 doSubscribe');
      if (!doSubscribe()) {
        // 首次订阅失败，每 500ms 轮询重试，最多 30 次（15 秒）
        console.log('[Event.Drop][Retry] 首次订阅失败，启动轮询重试（每 500ms，最多 30 次）');
        let retryCount = 0;
        retryTimer = setInterval(() => {
          retryCount++;
          console.log(`[Event.Drop][Retry] 第 ${retryCount}/30 次重试...`);
          if (retryCount > 30) {
            clearInterval(retryTimer);
            console.error('[Event.Drop][Retry] ❌ 重试 30 次后仍未就绪，放弃订阅');
            console.log('[Event.Drop][Retry] 最终诊断信息:', {
              hasFAPI: !!(window as any).__univerFAPI,
              hasUniverGrid: !!(window as any).univerExcelGrid,
              fAPIDetail: (window as any).__univerFAPI ? {
                hasEvent: !!((window as any).__univerFAPI.Event),
                hasAddEvent: typeof (window as any).__univerFAPI.addEvent === 'function',
              } : 'N/A',
              univerGridDetail: (window as any).univerExcelGrid ? {
                methods: Object.keys((window as any).univerExcelGrid),
              } : 'N/A',
            });
            return;
          }
          if (doSubscribe()) {
            console.log(`[Event.Drop][Retry] ✅ 第 ${retryCount} 次重试订阅成功`);
            clearInterval(retryTimer);
          } else {
            console.log(`[Event.Drop][Retry] 第 ${retryCount} 次重试仍未成功`);
          }
        }, 500);
      }
    }, 1500);

    // 清理
    return () => {
      console.log('[Event.Drop][Lifecycle] useEffect 清理函数执行');
      console.log('[Event.Drop][Lifecycle] 清理 initialTimer');
      clearTimeout(initialTimer);
      if (retryTimer) {
        console.log('[Event.Drop][Lifecycle] 清理 retryTimer');
        clearInterval(retryTimer);
      }
      if (dropDisposeRef.current) {
        console.log('[Event.Drop][Lifecycle] 执行事件订阅清理');
        dropDisposeRef.current();
        dropDisposeRef.current = null;
      }
      if (dropFlashTimerRef.current) {
        console.log('[Event.Drop][Lifecycle] 清理 dropFlash 定时器');
        clearTimeout(dropFlashTimerRef.current);
        dropFlashTimerRef.current = null;
      }
      console.log('[Event.Drop][Lifecycle] useEffect 清理完成');
    };
  }, [message]); // message 来自 antd App.useApp()，引用稳定
  */

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
    <Button key="preview" icon={<EyeOutlined />} onClick={handlePreview}>
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
    // 字段属性按钮（参照 ecology excel 设计器）
    <Divider key="field-attr-divider" type="vertical" style={{ height: 24, margin: '0 8px' }} />,
    <Tooltip key="readonly-tooltip" title="设置字段为只读">
      <Button
        key="readonly"
        icon={<LockOutlined />}
        type={fieldAttr === 'readonly' ? 'primary' : 'default'}
        disabled={fieldAttrDisabled}
        onClick={() => handleFieldAttrChange('readonly')}
      >
        只读
      </Button>
    </Tooltip>,
    <Tooltip key="editable-tooltip" title="设置字段为可编辑">
      <Button
        key="editable"
        icon={<EditOutlined />}
        type={fieldAttr === 'editable' ? 'primary' : 'default'}
        disabled={fieldAttrDisabled}
        onClick={() => handleFieldAttrChange('editable')}
      >
        编辑
      </Button>
    </Tooltip>,
    <Tooltip key="required-tooltip" title="设置字段为必填">
      <Button
        key="required"
        icon={<CheckCircleOutlined />}
        type={fieldAttr === 'required' ? 'primary' : 'default'}
        disabled={fieldAttrDisabled}
        onClick={() => handleFieldAttrChange('required')}
      >
        必填
      </Button>
    </Tooltip>,
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
        hoveredField={hoveredField}
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
              <FieldPalette
                onFieldSelect={handleFieldSelect}
                onFieldHover={handleFieldHover}
                formId={formId || undefined}
                usedFieldKeys={usedFieldKeys}
              />
            </div>

            {/* 中间 Univer Excel 区域 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
              <Card>
                <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

                {/* 拖拽放置成功后的临时高亮反馈 */}
                {dropFlash && (
                  <div
                    style={{
                      position: 'fixed',
                      bottom: 24,
                      right: 24,
                      zIndex: 1050,
                      padding: '10px 20px',
                      borderRadius: 6,
                      background: '#f6ffed',
                      border: '1px solid #b7eb8f',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                      fontSize: 14,
                      color: '#389e0d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      animation: 'fadeIn 0.3s ease',
                    }}
                  >
                    <CheckCircleOutlined style={{ fontSize: 18 }} />
                    <span>
                      字段 <strong>{dropFlash.label}</strong> 已放置到
                      单元格 <strong>({dropFlash.row + 1}, {String.fromCharCode(65 + dropFlash.col)})</strong>
                    </span>
                  </div>
                )}
              </Card>
            </div>

            {/* 右侧属性配置面板 */}
            <div style={{ width: 300, borderLeft: '1px solid #f0f0f0', overflow: 'auto' }}>
              <PropertyPanel selectedField={selectedField} />
            </div>
          </div>
        </Spin>
      </PageContainer>

      {/* 表单预览弹窗 */}
      <ExcelPreview
        layoutData={previewData}
        open={previewVisible}
        onClose={() => setPreviewVisible(false)}
        title="表单预览"
      />
    </DndProvider>
  );
};

const ExcelDesign: React.FC = () => (
  <App>
    <ExcelDesignContent />
  </App>
);

export default ExcelDesign;
