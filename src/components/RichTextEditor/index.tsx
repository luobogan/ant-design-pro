import React, { useEffect, useRef } from 'react';
import FluentEditor from '@opentiny/fluent-editor';
import '@opentiny/fluent-editor/style.css';
import { message } from 'antd';
import { getTenantId } from '@/utils/authority';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
  /** 紧凑模式：精简工具栏（审批意见 / 批注等小输入框用） */
  compact?: boolean;
}

/** 富文本是否为空：Quill 的「空」是 `<p><br></p>`，不能直接 trim 判断 */
export const isRichTextEmpty = (html?: string): boolean => {
  if (!html) return true;
  return (
    html
      .replace(/<br\s*\/?>/gi, '')
      .replace(/&nbsp;/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim().length === 0
  );
};

/** 富文本只读展示（审批意见 / 批注回显）：纯 HTML 内容，空值显示占位横线 */
export const RichTextView: React.FC<{ html?: string; style?: React.CSSProperties }> = ({
  html,
  style,
}) => {
  if (isRichTextEmpty(html)) {
    return <span style={{ color: '#bbb' }}>—</span>;
  }
  return <div style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />;
};

/** 把焦点交给指定容器里的富文本编辑器（Quill/FluentEditor 渲染 .ql-editor 为 contenteditable 区域） */
export const focusRichText = (containerId: string) => {
  const container = document.getElementById(containerId);
  const editable = container?.querySelector<HTMLElement>(
    '.ql-editor[contenteditable="true"], .w-e-text-container [contenteditable="true"]',
  );
  if (editable) {
    editable.focus();
    return;
  }
  container?.scrollIntoView({ block: 'center' });
};

// 完整（snow 默认）工具栏
const FULL_TOOLBAR: string[] = [
  'bold',
  'italic',
  'underline',
  'strike',
  'blockquote',
  'code-block',
  'link',
  'image',
  'clean',
];

// 紧凑工具栏（审批意见等小输入框）
const COMPACT_TOOLBAR: string[] = [
  'undo',
  'redo',
  'bold',
  'italic',
  'underline',
  'color',
  'list',
  'bullet',
  'image',
  'clean',
];

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder = '请输入内容...',
  height = 400,
  compact = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<FluentEditor | null>(null);
  const lastValueRef = useRef<string>(value || '');
  // 程序化 setHTML 时置位，避免触发多余 onChange（防止受控回环）
  const syncingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let editor: FluentEditor;

    // 图片上传：复用现有 /api/blade-mall/admin/upload/image + 鉴权头
    const imageHandler = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        const token = localStorage.getItem('sword-token') || '';
        const tenantId = getTenantId() || '000000';
        try {
          const res = await fetch('/api/blade-mall/admin/upload/image', {
            method: 'POST',
            headers: {
              'Blade-Auth': `bearer ${token}`,
              'Tenant-Id': tenantId,
            },
            body: formData,
          });
          const result = await res.json();
          if (result.success && result.data) {
            const fileUrl = result.data.trim().replace(/[`]/g, '');
            const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
            editor.insertEmbed(range.index, 'image', fileUrl, 'user');
            editor.setSelection(range.index + 1, 'user');
          } else {
            message.error(result.msg || '上传失败');
          }
        } catch {
          message.error('上传失败');
        }
      };
      input.click();
    };

    const toolbar = compact ? COMPACT_TOOLBAR : FULL_TOOLBAR;

    editor = new FluentEditor(containerRef.current, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: {
          container: toolbar,
          handlers: { image: imageHandler },
        },
      },
    });
    editorRef.current = editor;

    // 初始内容（仅挂载时写入一次）
    syncingRef.current = true;
    if (value) {
      editor.clipboard.dangerouslyPasteHTML(value);
    }
    syncingRef.current = false;
    lastValueRef.current = value || '';

    editor.on('text-change', () => {
      if (syncingRef.current) return;
      const next = editor.root.innerHTML;
      lastValueRef.current = next;
      onChange?.(next);
    });

    return () => {
      editor.off('text-change');
      // React 18/19 StrictMode 会双调用 effect（创建→清理→再创建），
      // 必须还原 Quill 注入的 DOM，否则同一容器二次 new FluentEditor 会抛「已初始化」
      const el = containerRef.current;
      if (el) {
        const toolbar = el.previousElementSibling;
        if (toolbar && (toolbar as HTMLElement).classList?.contains('ql-toolbar')) {
          toolbar.remove();
        }
        el.classList.remove('ql-container');
        el.innerHTML = '';
        delete (el as unknown as Record<string, unknown>).__quill;
      }
      editorRef.current = null;
    };
    // 仅在挂载时创建一次编辑器；后续内容同步由下方受控 effect 负责
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部受控：value 变化时同步进编辑器（父组件重置意见 / 切换节点）
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && value !== lastValueRef.current) {
      syncingRef.current = true;
      editor.clipboard.dangerouslyPasteHTML(value || '');
      lastValueRef.current = value || '';
      syncingRef.current = false;
    }
  }, [value]);

  return <div ref={containerRef} style={{ height }} />;
};

export default RichTextEditor;
