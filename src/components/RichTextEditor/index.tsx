import React from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { getTenantId } from '@/utils/authority';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder = '请输入内容...',
  height = 400,
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
          menubar: true,
          plugins: [
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
          toolbar:
            'undo redo | formatselect | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help',
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
