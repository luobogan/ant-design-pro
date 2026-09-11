import React from 'react';
import { Modal } from 'antd';
import WorkflowDefForm from './WorkflowDefForm';
import { WfProcessDefinition } from '@/services/workflow';

/**
 * 流程（路径）新增 / 编辑弹窗 —— 仅作为薄壳，表单逻辑下沉到 WorkflowDefForm。
 *
 * 设计页「基础设置」页签已内联复用同一份 WorkflowDefForm（贴近 E9 tab 内编辑体验），
 * 本弹窗保留给「流程列表」页的新增 / 编辑场景。
 */
export interface WorkflowDefFormModalProps {
  open: boolean;
  mode?: 'add' | 'edit';
  initialValues?: Partial<WfProcessDefinition>;
  /** 关闭弹窗 */
  onCancel: () => void;
  /** 保存成功（未进入详细设置） */
  onSaved?: (id?: string) => void;
  /** 「保存并进入详细设置」成功 */
  onEnterDesign?: (id?: string) => void;
  /** 「更多 -> 另存为新版本」 */
  onSaveAsNewVersion?: (id: string) => void;
}

const WorkflowDefFormModal: React.FC<WorkflowDefFormModalProps> = ({
  open,
  mode = 'add',
  initialValues,
  onCancel,
  onSaved,
  onEnterDesign,
  onSaveAsNewVersion,
}) => {
  return (
    <Modal
      title={mode === 'edit' ? '编辑路径' : '添加路径'}
      open={open}
      onCancel={onCancel}
      width={720}
      destroyOnClose
      maskClosable={false}
      footer={null}
    >
      {open && (
        <WorkflowDefForm
          mode={mode}
          initialValues={initialValues}
          onSaved={(id) => {
            onSaved?.(id);
            onCancel();
          }}
          onEnterDesign={onEnterDesign}
          onSaveAsNewVersion={onSaveAsNewVersion}
        />
      )}
    </Modal>
  );
};

export default WorkflowDefFormModal;
