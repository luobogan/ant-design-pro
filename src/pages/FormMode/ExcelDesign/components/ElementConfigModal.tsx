import React from 'react';
import { Modal, Input, InputNumber, Select, Switch, Upload, Button, Space, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { type ElementFieldDef } from '../elementSchema';
import { uploadFile } from '@/services/file';

interface ElementConfigModalProps {
  open: boolean;
  title: string;
  fields: ElementFieldDef[];
  values: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  onOk: () => void;
  onCancel: () => void;
  okText?: string;
  width?: number;
  /** 顶部说明区（如代码块的使用帮助），可选 */
  helpNode?: React.ReactNode;
}

/**
 * 元素属性配置弹窗（插入 / 双击编辑共用）。
 * 受控：values 由父组件持有，onChange 回写；onOk 由父组件决定写入单元格还是回写配置。
 */
const ElementConfigModal: React.FC<ElementConfigModalProps> = ({
  open,
  title,
  fields,
  values,
  onChange,
  onOk,
  onCancel,
  okText = '确定',
  width = 520,
  helpNode,
}) => {
  const set = (name: string, v: any) => onChange({ ...values, [name]: v });
  return (
    <Modal
      open={open}
      title={title}
      okText={okText}
      cancelText="取消"
      onOk={onOk}
      onCancel={onCancel}
      width={width}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        {helpNode}
        {(fields || []).map((f) => {
          if (f.showIf && !f.showIf(values)) return null;
          return (
            <div key={f.name}>
              <div style={{ marginBottom: 4, fontSize: 13 }}>{f.label}</div>
              {f.type === 'text' && (
                <Input
                  value={values[f.name] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
              {f.type === 'textarea' && (
                <Input.TextArea
                  rows={f.rows ?? 4}
                  value={values[f.name] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
              {f.type === 'number' && (
                <InputNumber
                  style={{ width: '100%' }}
                  value={values[f.name]}
                  onChange={(v) => set(f.name, v)}
                />
              )}
              {f.type === 'select' && (
                <Select
                  style={{ width: '100%' }}
                  value={values[f.name]}
                  options={f.options}
                  onChange={(v) => set(f.name, v)}
                />
              )}
              {f.type === 'upload' && (
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <Input
                    value={values[f.name] ?? ''}
                    placeholder={f.placeholder || '上传后自动填充；也可直接粘贴 URL（文件服务未启动时可用）'}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                  <Upload
                    beforeUpload={(file) => {
                      const hide = message.loading('上传中…', 0);
                      uploadFile(file)
                        .then((r) => {
                          if (r?.url) set(f.name, r.url);
                          else message.error('上传失败：未返回地址');
                        })
                        .catch((e) => message.error('上传失败：' + (e?.message || e)))
                        .finally(() => hide());
                      return false; // 阻断默认上传，改由 uploadFile 走统一文件服务（双通道：URL 兜底）
                    }}
                    showUploadList={false}
                    accept="image/*"
                  >
                    <Button icon={<UploadOutlined />}>上传图片（双通道）</Button>
                  </Upload>
                </Space>
              )}
              {f.type === 'multiselect' && (
                <Select
                  style={{ width: '100%' }}
                  mode={f.options && f.options.length ? 'multiple' : 'tags'}
                  value={values[f.name] || []}
                  options={f.options}
                  placeholder={f.placeholder}
                  onChange={(v) => set(f.name, v)}
                />
              )}
              {f.type === 'switch' && (
                <Switch checked={!!values[f.name]} onChange={(v) => set(f.name, v)} />
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export default ElementConfigModal;
