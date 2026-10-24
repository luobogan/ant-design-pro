import React, { useEffect, useRef } from 'react';
import FluentEditor from '@opentiny/fluent-editor';
import '@opentiny/fluent-editor/style.css';
import './font.css';
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
  [{ font: ['simsun', 'simhei', 'yahei', 'kaiti', 'fangsong', 'arial', 'times-new-roman', false] }], // 字体(含中文)
  [{ header: [1, 2, 3, 4, 5, 6, false] }],                     // 标题 H1-H6 / 正文
  [{ size: ['12px', '14px', '16px', '18px', '20px', '24px', false] }], // 字号
  ['bold', 'italic', 'underline', 'strike'],                   // 加粗/斜体/下划线/删除线
  [{ color: [] }, { background: [] }],                         // 文字色 / 背景色
  [{ script: 'sub' }, { script: 'super' }],                    // 下标 / 上标
  [{ list: 'ordered' }, { list: 'bullet' }],                   // 有序 / 无序列表
  [{ indent: '-1' }, { indent: '+1' }],                        // 减少 / 增加缩进
  [{ align: [] }],                                             // 对齐
  [{ 'line-height': ['1', '1.5', '1.75', '2', '2.5', '3', false] }], // 行高
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
              Authorization: 'Basic c2FiZXI6c2FiZXJfc2VjcmV0',
              'blade-auth': `bearer ${token}`,
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
            headers: {
              Authorization: 'Basic c2FiZXI6c2FiZXJfc2VjcmV0',
              'blade-auth': `bearer ${token}`,
              'Tenant-Id': tenantId,
            },
            body: fd,
          });
          const result = await res.json();
          if (result.success && result.data) {
            const fileName = result.data.fileName || f.name;
            const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
            const label = `📎 ${fileName}`;
            // 链接指向编辑器预览页（docId+fileId+mode=view），点击跳过去预览该附件
            const previewUrl = `/docengine/editor?docId=${docId ?? ''}&fileId=${result.data.fileId}&mode=view&editor=auto`;
            editor.insertText(range.index, label, 'link', previewUrl, 'user');
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

    // 插入链接：选中文字后点击，弹框输入 URL（替代默认 link tooltip，避免点了不弹输入框）
    const linkHandler = () => {
      const range = editor.getSelection(true);
      if (!range || range.length === 0) {
        message.warning('请先选中要添加链接的文字');
        return;
      }
      const url = window.prompt('请输入链接地址：', 'https://');
      if (url && url.trim()) {
        editor.formatText(range.index, range.length, 'link', url.trim(), 'user');
      }
    };

    // 插入指定行列的表格
    const insertTable = (cols: number, rows: number) => {
      let html = '<table style="border-collapse:collapse;width:100%"><tbody>';
      for (let r = 0; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
          html += '<td style="border:1px solid #ccc;padding:6px;min-width:48px;height:28px">&nbsp;</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table><p><br></p>';
      const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
      editor.clipboard.dangerouslyPasteHTML(range.index, html, 'user');
      editor.setSelection((range.index || 0) + 1, 0, 'user');
    };
    // 表格：弹出 8×8 网格，鼠标拖选行列后点击插入（不用手动填几×几）
    const tableHandler = () => {
      const MAX = 8;
      const box = document.createElement('div');
      box.style.cssText =
        'position:fixed;z-index:100000;background:#fff;border:1px solid #d9d9d9;box-shadow:0 4px 12px rgba(0,0,0,.15);padding:8px;border-radius:4px';
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(' + MAX + ',16px);gap:2px';
      const tip = document.createElement('div');
      tip.style.cssText = 'margin-top:6px;text-align:center;font-size:12px;color:#666';
      tip.textContent = '选择行列';
      const cells: HTMLElement[] = [];
      const close = () => {
        document.removeEventListener('mousedown', onOutside, true);
        box.remove();
      };
      const onOutside = (e: Event) => {
        if (!box.contains(e.target as Node)) close();
      };
      for (let r = 0; r < MAX; r++) {
        for (let c = 0; c < MAX; c++) {
          const cell = document.createElement('div');
          cell.style.cssText = 'width:16px;height:16px;border:1px solid #e5e5e5;cursor:pointer;background:#fff';
          const rr = r, cc = c;
          cell.addEventListener('mouseenter', () => {
            cells.forEach((el, i) => {
              const cr = Math.floor(i / MAX);
              const cic = i % MAX;
              el.style.background = cr <= rr && cic <= cc ? '#1677ff' : '#fff';
            });
            tip.textContent = cc + 1 + ' 列 × ' + (rr + 1) + ' 行';
          });
          cell.addEventListener('click', (e) => {
            e.stopPropagation();
            insertTable(cc + 1, rr + 1);
            close();
          });
          grid.appendChild(cell);
          cells.push(cell);
        }
      }
      box.appendChild(grid);
      box.appendChild(tip);
      document.body.appendChild(box);
      const btn = document.querySelector('.ql-table') as HTMLElement | null;
      const br = btn?.getBoundingClientRect();
      if (br) {
        box.style.left = br.left + 'px';
        box.style.top = br.bottom + 4 + 'px';
      } else {
        box.style.left = '50%';
        box.style.top = '50%';
      }
      document.addEventListener('mousedown', onOutside, true);
    };

    // emoji：弹出常用表情，点击插入
    const EMOJIS = ['😀','😁','😂','🤣','😊','😍','🥰','😘','😎','🤔','😅','😭','😡','🥳','😴','🤝','👍','👎','👏','🙏','💪','🎉','❤️','🔥','⭐','✅','❌','💡'];
    const emojiHandler = () => {
      const box = document.createElement('div');
      box.style.cssText =
        'position:fixed;z-index:100000;background:#fff;border:1px solid #d9d9d9;box-shadow:0 4px 12px rgba(0,0,0,.15);padding:8px;border-radius:4px;display:grid;grid-template-columns:repeat(7,auto);gap:2px;max-width:300px';
      const close = () => {
        document.removeEventListener('mousedown', onOutside, true);
        box.remove();
      };
      const onOutside = (e: Event) => {
        if (!box.contains(e.target as Node)) close();
      };
      EMOJIS.forEach((em) => {
        const b = document.createElement('span');
        b.textContent = em;
        b.style.cssText = 'font-size:20px;cursor:pointer;padding:4px;text-align:center;border-radius:3px';
        b.addEventListener('mouseenter', () => { b.style.background = '#f0f0f0'; });
        b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; });
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
          editor.insertText(range.index, em, 'user');
          editor.setSelection(range.index + em.length, 'user');
          close();
        });
        box.appendChild(b);
      });
      document.body.appendChild(box);
      const btn = document.querySelector('.ql-emoji') as HTMLElement | null;
      const br = btn?.getBoundingClientRect();
      if (br) {
        box.style.left = br.left + 'px';
        box.style.top = br.bottom + 4 + 'px';
      } else {
        box.style.left = '50%';
        box.style.top = '50%';
      }
      document.addEventListener('mousedown', onOutside, true);
    };

    // 公式：输入公式内容插入（blot 不支持时降级为文本）
    const formulaHandler = () => {
      const tex = window.prompt('请输入公式（如 E=mc^2）：', '');
      if (!tex || !tex.trim()) return;
      const value = tex.trim();
      const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
      try {
        editor.insertEmbed(range.index, 'formula', value, 'user');
        editor.setSelection(range.index + 1, 'user');
      } catch {
        editor.insertText(range.index, value, 'user');
      }
    };

    // @提醒：输入被提醒的人/内容插入（blot 不支持时降级为 @文本）
    const reminderHandler = () => {
      const name = window.prompt('请输入要提醒的人或内容：', '');
      if (!name || !name.trim()) return;
      const value = name.trim();
      const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
      try {
        editor.insertEmbed(range.index, 'reminder', { value }, 'user');
        editor.setSelection(range.index + 1, 'user');
      } catch {
        editor.insertText(range.index, '@' + value, 'user');
      }
    };

    const toolbar = compact ? COMPACT_TOOLBAR : FULL_TOOLBAR;

    // 注册行高(line-height)格式，供工具栏行高下拉使用（不支持时忽略，不影响其它功能）
    try {
      const ctor: any = FluentEditor as any;
      const Parchment = typeof ctor.import === 'function' ? ctor.import('parchment') : null;
      if (Parchment && typeof ctor.register === 'function') {
        const LineHeight = new Parchment.Attributor.Style('line-height', 'line-height', {
          scope: Parchment.Scope.BLOCK,
          whitelist: ['1', '1.5', '1.75', '2', '2.5', '3'],
        });
        ctor.register(LineHeight, true);
      }
    } catch {
      /* 不支持时忽略 */
    }

    editor = new FluentEditor(containerRef.current, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: {
          container: toolbar,
          handlers: { image: imageHandler, file: fileHandler, link: linkHandler, table: tableHandler, emoji: emojiHandler, formula: formulaHandler, reminder: reminderHandler },
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

    // 图片拖拽调整大小：点击图片显示 右/下/右下 三个手柄，分别 调宽 / 调高 / 等比缩放；
    // 写入 width/height 属性（Quill2 image blot 原生支持），模型记住 → 回显不丢（永久生效）
    let handles: HTMLElement[] = [];
    let currentImg: HTMLImageElement | null = null;
    let dragging = false;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const cancelHide = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    };
    const hideHandle = () => {
      handles.forEach((h) => {
        const pos = (h as any)._pos;
        if (pos) window.removeEventListener('scroll', pos, true);
        h.remove();
      });
      handles = [];
      currentImg = null;
    };
    const onHandleDown = (mode: string) => (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      const img = currentImg;
      if (!img) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = img.offsetWidth || 100;
      const startH = img.offsetHeight || 100;
      const ratio = startH / (startW || 1);
      const apply = (w: number, h: number) => {
        const W = Math.max(24, Math.round(w));
        const H = Math.max(24, Math.round(h));
        // 拖拽中只改 style，不碰 width/height 属性，避免触发 Quill 对 image blot 的重置
        img.style.width = W + 'px';
        img.style.height = H + 'px';
        handles.forEach((el) => (el as any)._pos?.());
      };
      // 松手把宽高写进 Quill 模型（blot.format）→ 永久生效，且后续重渲染不会按旧值重置
      const syncModel = () => {
        const W = Math.max(24, Math.round(parseFloat(img.style.width) || img.offsetWidth || 100));
        const H = Math.max(24, Math.round(parseFloat(img.style.height) || img.offsetHeight || 100));
        try {
          const ctor: any = (editor as any).constructor;
          const find = ctor && typeof ctor.find === 'function' ? ctor.find : (FluentEditor as any).find;
          const blot = typeof find === 'function' ? find(img) : null;
          if (blot && typeof blot.format === 'function') {
            blot.format('width', W);
            blot.format('height', H);
          }
        } catch {
          /* 忽略：不影响 DOM 显示 */
        }
        img.setAttribute('width', String(W));
        img.setAttribute('height', String(H));
      };
      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const d = Math.abs(dx) >= Math.abs(dy) ? dx : dy / (ratio || 1); // 等比主导位移
        switch (mode) {
          case 'e': apply(startW + dx, startH); break;             // 右：调宽
          case 'w': apply(startW - dx, startH); break;             // 左：调宽
          case 's': apply(startW, startH + dy); break;             // 下：调高
          case 'n': apply(startW, startH - dy); break;             // 上：调高
          case 'se': apply(startW + d, startH + d * ratio); break; // 右下：等比
          case 'nw': apply(startW - d, startH - d * ratio); break; // 左上：等比
          case 'ne': apply(startW + d, startH - d * ratio); break; // 右上：等比
          case 'sw': apply(startW - d, startH + d * ratio); break; // 左下：等比
          default: break;
        }
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        dragging = false;
        syncModel();
        lastValueRef.current = editor.root.innerHTML;
        if (typeof onChange === 'function') onChange(editor.root.innerHTML);
        hideHandle();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
    const HANDLE_POS: Record<string, { x: 'l' | 'c' | 'r'; y: 't' | 'c' | 'b'; cur: string }> = {
      nw: { x: 'l', y: 't', cur: 'nwse-resize' },
      n: { x: 'c', y: 't', cur: 'ns-resize' },
      ne: { x: 'r', y: 't', cur: 'nesw-resize' },
      w: { x: 'l', y: 'c', cur: 'ew-resize' },
      e: { x: 'r', y: 'c', cur: 'ew-resize' },
      sw: { x: 'l', y: 'b', cur: 'nesw-resize' },
      s: { x: 'c', y: 'b', cur: 'ns-resize' },
      se: { x: 'r', y: 'b', cur: 'nwse-resize' },
    };
    const makeHandle = (img: HTMLImageElement, kind: string) => {
      const cfg = HANDLE_POS[kind];
      if (!cfg) return;
      const h = document.createElement('div');
      h.style.cssText =
        'position:fixed;width:10px;height:10px;background:#1677ff;border:2px solid #fff;border-radius:2px;z-index:99999;box-shadow:0 0 4px rgba(0,0,0,.3);cursor:' + cfg.cur;
      document.body.appendChild(h);
      const pos = () => {
        const r = img.getBoundingClientRect();
        const px = cfg.x === 'l' ? r.left : cfg.x === 'r' ? r.right : r.left + r.width / 2;
        const py = cfg.y === 't' ? r.top : cfg.y === 'b' ? r.bottom : r.top + r.height / 2;
        h.style.left = px - 5 + 'px';
        h.style.top = py - 5 + 'px';
      };
      (h as any)._pos = pos;
      pos();
      window.addEventListener('scroll', pos, true);
      h.addEventListener('mousedown', onHandleDown(kind));
      handles.push(h);
    };
    const showHandle = (img: HTMLImageElement) => {
      hideHandle();
      currentImg = img;
      ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].forEach((k) => makeHandle(img, k));
    };
    // 悬停图片才显示缩放手柄，移开延迟隐藏（不常驻，避免图片外总套着框）
    const onImgOver = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement;
      if (t && t.tagName === 'IMG') {
        cancelHide();
        showHandle(t as HTMLImageElement);
      }
    };
    const onImgOut = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement;
      if (t && t.tagName === 'IMG') {
        cancelHide();
        hideTimer = setTimeout(() => {
          if (dragging) return;
          if (handles.some((h) => h.matches(':hover'))) return;
          hideHandle();
        }, 250);
      }
    };
    editor.root.addEventListener('mouseover', onImgOver);
    editor.root.addEventListener('mouseout', onImgOut);
    // contenteditable 里点 <a> 默认只定位光标、不跳转；这里手动打开（附件/插入的链接点击可跳预览）
    const onLinkClick = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement;
      const a = (t && t.closest ? t.closest('a') : null) as HTMLAnchorElement | null;
      const href = a && a.getAttribute('href');
      if (a && href) {
        ev.preventDefault();
        window.open(href, '_blank');
      }
    };
    editor.root.addEventListener('click', onLinkClick);

    // 表格列宽/行高：鼠标移到单元格右/下边界(4px)变 col-resize/row-resize 光标，按住拖动即调整
    let tResize: { kind: 'col' | 'row'; table: HTMLTableElement; idx: number; start: number; size: number } | null = null;
    const findTd = (t: HTMLElement | null): HTMLTableCellElement | null => {
      if (!t || !t.closest) return null;
      return (t.closest('td') || t.closest('th')) as HTMLTableCellElement | null;
    };
    const onTableMove = (e: MouseEvent) => {
      if (tResize) {
        const delta = tResize.kind === 'col' ? e.clientX - tResize.start : e.clientY - tResize.start;
        const newSize = Math.max(20, Math.round(tResize.size + delta));
        if (tResize.kind === 'col') {
          Array.from(tResize.table.rows).forEach((tr) => {
            const cell = tr.cells[tResize!.idx];
            if (cell) cell.style.width = newSize + 'px';
          });
        } else {
          const tr = tResize.table.rows[tResize.idx];
          if (tr) tr.style.height = newSize + 'px';
        }
        return;
      }
      const td = findTd(e.target as HTMLElement);
      if (!td) {
        editor.root.style.cursor = '';
        return;
      }
      const r = td.getBoundingClientRect();
      const nearCol = Math.abs(e.clientX - r.right) <= 4;
      const nearRow = Math.abs(e.clientY - r.bottom) <= 4;
      editor.root.style.cursor = nearCol ? 'col-resize' : nearRow ? 'row-resize' : '';
    };
    const onTableUp = () => {
      if (tResize) {
        tResize = null;
        lastValueRef.current = editor.root.innerHTML;
        if (typeof onChange === 'function') onChange(editor.root.innerHTML);
      }
      document.removeEventListener('mousemove', onTableMove);
      document.removeEventListener('mouseup', onTableUp);
    };
    const onTableDown = (e: MouseEvent) => {
      const td = findTd(e.target as HTMLElement);
      if (!td) return;
      const r = td.getBoundingClientRect();
      const nearCol = Math.abs(e.clientX - r.right) <= 4;
      const nearRow = Math.abs(e.clientY - r.bottom) <= 4;
      if (!nearCol && !nearRow) return;
      const table = td.closest('table') as HTMLTableElement | null;
      if (!table) return;
      e.preventDefault();
      e.stopPropagation();
      tResize = nearCol
        ? { kind: 'col', table, idx: td.cellIndex, start: e.clientX, size: r.width }
        : { kind: 'row', table, idx: (td.parentElement as HTMLTableRowElement).rowIndex, start: e.clientY, size: r.height };
      document.addEventListener('mousemove', onTableMove);
      document.addEventListener('mouseup', onTableUp);
    };
    editor.root.addEventListener('mousemove', onTableMove);
    editor.root.addEventListener('mousedown', onTableDown);

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
      editor.root.removeEventListener('mouseover', onImgOver);
      editor.root.removeEventListener('mouseout', onImgOut);
      editor.root.removeEventListener('click', onLinkClick);
      editor.root.removeEventListener('mousemove', onTableMove);
      editor.root.removeEventListener('mousedown', onTableDown);
      cancelHide();
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
