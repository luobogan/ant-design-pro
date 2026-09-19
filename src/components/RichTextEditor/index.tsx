import React from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { getTenantId } from '@/utils/authority';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
  /** 紧凑模式：隐藏菜单栏、精简工具栏（审批意见 / 批注等小输入框用） */
  compact?: boolean;
}

/** 富文本是否为空：TinyMCE 的「空」是 `<p><br></p>` / `<p>&nbsp;</p>`，不能直接 trim 判断 */
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

/** 把焦点交给指定容器里的富文本编辑器（TinyMCE 渲染成 iframe，需定位到内部编辑区） */
export const focusRichText = (containerId: string) => {
  const iframe = document.querySelector<HTMLIFrameElement>(`#${containerId} iframe`);
  if (iframe?.contentWindow) {
    iframe.contentWindow.focus();
    return;
  }
  document.getElementById(containerId)?.scrollIntoView({ block: 'center' });
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder = '请输入内容...',
  height = 400,
  compact = false,
}) => {
  const handleImageUpload = (...args: any[]) => {
    const [blobInfo, success, failure] = args;
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', blobInfo.blob(), blobInfo.filename());

      const token = localStorage.getItem('sword-token') || '';
      const tenantId = getTenantId() || '000000';

      fetch('/api/blade-mall/admin/upload/image', {
        method: 'POST',
        headers: {
          'Blade-Auth': `bearer ${token}`,
          'Tenant-Id': tenantId,
        },
        body: formData,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('网络请求失败');
          }
          return response.json();
        })
        .then((result) => {
          if (result.success && result.data) {
            const fileUrl = result.data.trim().replace(/[`]/g, '');
            success(fileUrl);
            resolve(fileUrl);
          } else {
            const errorMessage = '上传失败: ' + (result.msg || '未知错误');
            if (typeof failure === 'function') {
              failure(errorMessage);
            } else {
              console.error(errorMessage);
            }
            reject(new Error(errorMessage));
          }
        })
        .catch((error) => {
          const errorMessage = '上传失败: ' + error.message;
          if (typeof failure === 'function') {
            failure(errorMessage);
          } else {
            console.error(errorMessage);
          }
          reject(error);
        });
    });
  };

  return (
    <div>
      <Editor
        apiKey="7u3oicom9m74gc15p90ipnp1ibke4a84yxigrsejqyxe052y"
        value={value}
        onEditorChange={(content) => onChange?.(content)}
        init={{
          height: height,
          // 界面中文化：TinyMCE 8 官方简体中文包，自托管在 public/tinymce/langs/zh_CN.js。
          // 注意代码必须是 'zh-CN'（连字符）：包里注册的就是 zh-CN，zh_CN 写法在 TinyMCE 8 已废弃。
          language: 'zh-CN',
          language_url: '/tinymce/langs/zh_CN.js',
          menubar: !compact,
          plugins: compact
            ? ['lists', 'link', 'charmap', 'wordcount']
            : [
                'advlist',
                'autolink',
                'lists',
                'link',
                'image',
                'charmap',
                'preview',
                'anchor',
                'searchreplace',
                'visualblocks',
                'code',
                'fullscreen',
                'insertdatetime',
                'media',
                'table',
                'help',
                'wordcount',
              ],
          toolbar: compact
            ? 'undo redo | bold italic underline forecolor | bullist numlist | removeformat'
            : 'undo redo | formatselect | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help',
          placeholder: placeholder,
          content_style: 'body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; }',
          images_upload_url: '/api/blade-mall/admin/upload/image',
          images_upload_handler: handleImageUpload,
          verify_html: false,
          extended_valid_elements: 'div[*],span[*],p[*],b[*],i[*],u[*],strong[*],em[*],a[*],ul[*],ol[*],li[*],table[*],tr[*],td[*],th[*],h1[*],h2[*],h3[*],h4[*],h5[*],h6[*]',
        }}
      />
    </div>
  );
};

export default RichTextEditor;
