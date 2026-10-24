import React, { useEffect, useRef } from 'react';
import FluentEditor from '@opentiny/fluent-editor';
import '@opentiny/fluent-editor/style.css';
import { message } from 'antd';
import { getTenantId, getToken } from '@/utils/authority';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
  /** 紧凑模式：精简工具栏（审批意见 / 批注等小输入框用） */
  compact?: boolean;
  /** 文档ID：富文本内上传文件时关联为文档附件（走 /doc/attach/upload） */
  docId?: number | string;
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

// 完整工具栏（对齐 FluentEditor 官方能力）：撤销/清除、字体、标题、字号、BISU、
// 颜色、上下标、列表、缩进、对齐、引用代码块、链接图片、表格、公式、emoji、@提醒、全屏
const FULL_TOOLBAR: any[] = [
  ['undo', 'redo', 'clean'],
  [{ font: [] }],                                              // 字体
  [{ header: [1, 2, 3, 4, 5, 6, false] }],                     // 标题 H1-H6 / 正文
  [{ size: ['12px', '14px', '16px', '18px', '20px', '24px', false] }], // 字号
  ['bold', 'italic', 'underline', 'strike'],                   // 加粗/斜体/下划线/删除线
  [{ color: [] }, { background: [] }],                         // 文字色 / 背景色
  [{ script: 'sub' }, { script: 'super' }],                    // 下标 / 上标
  [{ list: 'ordered' }, { list: 'bullet' }],                   // 有序 / 无序列表
  [{ indent: '-1' }, { indent: '+1' }],                        // 减少 / 增加缩进
  [{ align: [] }],                                             // 对齐
  ['blockquote', 'code-block'],                                // 引用 / 代码块
  ['link', 'image', 'file'],                                   // 链接 / 图片 / 上传文件
  ['table'],                                                   // 表格
  ['formula'],                                                 // 公式
  ['emoji'],                                                   // emoji
  ['reminder'],                                                // @提醒
  ['fullscreen'],                                              // 全屏
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
  docId,
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
        const token = getToken() || '';
        const tenantId = getTenantId() || '000000';
        try {
          const res = await fetch(`/api/blade-doc/doc/attach/upload?docId=${docId ?? ''}&docFileType=3`, {
            method: 'POST',
            headers: {
              'Blade-Auth': `bearer ${token}`,
              'Tenant-Id': tenantId,
            },
            body: formData,
          });
          const result = await res.json();
          if (result.success && result.data) {
            // 统一附件上传：图片作为文档附件(imagefile)，下载走 /api/blade-doc/file/download/{fileId}
            const fileUrl = result.data.ossFileUrl || `/api/blade-doc/file/download/${result.data.fileId}`;
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

    // 文件上传：走 blade-doc 附件上传(/doc/attach/upload)，作为文档附件统一存储，插入文件块
    const fileHandler = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async () => {
        const f = input.files?.[0];
        if (!f) return;
        const fd = new FormData();
        fd.append('file', f);
        const token = getToken() || '';
        const tenantId = getTenantId() || '000000';
        try {
          const res = await fetch(`/api/blade-doc/doc/attach/upload?docId=${docId ?? ''}&docFileType=1`, {
            method: 'POST',
            headers: { 'Blade-Auth': `bearer ${token}`, 'Tenant-Id': tenantId },
            body: fd,
          });
          const result = await res.json();
          if (result.success && result.data) {
            const fileUrl = result.data.ossFileUrl || `/api/blade-doc/file/download/${result.data.fileId}`;
            const fileName = result.data.fileName || f.name;
            const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
            const label = `📎 ${fileName}`;
            editor.insertText(range.index, label, 'link', fileUrl, 'user');
            editor.setSelection(range.index + label.length, 'user');
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
          handlers: { image: imageHandler, file: fileHandler },
        },
      },
    });
    editorRef.current = editor;

    // 工具栏按钮中文悬停提示（按 ql-* class 加 title）
    const TOOLBAR_TIPS: Record<string, string> = {
      'ql-undo': '撤销', 'ql-redo': '重做', 'ql-clean': '清除格式',
      'ql-bold': '加粗', 'ql-italic': '斜体', 'ql-underline': '下划线', 'ql-strike': '删除线',
      'ql-blockquote': '引用', 'ql-code-block': '代码块',
      'ql-header': '标题', 'ql-font': '字体', 'ql-size': '字号',
      'ql-color': '文字颜色', 'ql-background': '背景色',
      'ql-script': '上标/下标', 'ql-list': '列表', 'ql-indent': '缩进', 'ql-align': '对齐',
      'ql-link': '插入链接', 'ql-image': '插入图片', 'ql-file': '上传文件',
      'ql-table': '插入表格', 'ql-formula': '插入公式', 'ql-emoji': '插入表情',
      'ql-reminder': '@提醒', 'ql-fullscreen': '全屏', 'ql-direction': '文字方向',
    };
    const applyToolbarTips = () => {
      const tb = (editor.getModule('toolbar') as any)?.container as HTMLElement | undefined;
      if (!tb) return;
      tb.querySelectorAll<HTMLElement>('button, select, .ql-picker, .ql-picker-label, [class*="ql-"]').forEach((el) => {
        for (const c of Array.from(el.classList)) {
          if (TOOLBAR_TIPS[c]) {
            el.setAttribute('title', TOOLBAR_TIPS[c]);
            break;
          }
        }
      });
    };
    applyToolbarTips();

    // 图片拖拽调整大小（FluentEditor/Quill2 未内置 resize）：点击图片显示右下角手柄，拖拽改宽度
    let resizeHandle: HTMLElement | null = null;
    let currentImg: HTMLImageElement | null = null;
    const hideHandle = () => {
      if (resizeHandle) {
        const pos = (resizeHandle as any)._pos;
        if (pos) window.removeEventListener('scroll', pos, true);
        resizeHandle.remove();
        resizeHandle = null;
        currentImg = null;
      }
    };
    const onHandleDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const img = currentImg;
      if (!img) return;
      const startX = e.clientX;
      const startW = img.offsetWidth;
      const onMove = (ev: MouseEvent) => {
        const w = Math.max(40, Math.min(startW + (ev.clientX - startX), 2000));
        img.style.width = w + 'px';
        (resizeHandle as any)._pos?.();
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        lastValueRef.current = editor.root.innerHTML;
        if (typeof onChange === 'function') onChange(editor.root.innerHTML);
        hideHandle();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
    const showHandle = (img: HTMLImageElement) => {
      hideHandle();
      currentImg = img;
      const h = document.createElement('div');
      h.style.cssText =
        'position:fixed;width:12px;height:12px;background:#1677ff;border:2px solid #fff;border-radius:2px;cursor:nwse-resize;z-index:99999;box-shadow:0 0 4px rgba(0,0,0,.3)';
      document.body.appendChild(h);
      resizeHandle = h;
      const pos = () => {
        const r = img.getBoundingClientRect();
        h.style.left = (r.right - 6) + 'px';
        h.style.top = (r.bottom - 6) + 'px';
      };
      (h as any)._pos = pos;
      pos();
      window.addEventListener('scroll', pos, true);
      h.addEventListener('mousedown', onHandleDown);
    };
    const onImgClick = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement;
      if (t && t.tagName === 'IMG') {
        ev.preventDefault();
        showHandle(t as HTMLImageElement);
      } else {
        hideHandle();
      }
    };
    editor.root.addEventListener('click', onImgClick);

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
      editor.root.removeEventListener('click', onImgClick);
      hideHandle();
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
