import React, { useEffect, useState } from 'react';
import { Modal, Typography } from 'antd';
import FieldControl from '@/components/FormMode/FieldControl';
import { getBrowserTypeLabel } from '@/components/FormMode/fieldTypes';

export interface BrowserTypePreviewProps {
  open: boolean;
  fieldLabel?: string;
  /** 浏览按钮类型（ecology 35+ 编号空间） */
  browserType?: number;
  onClose: () => void;
}

/**
 * 表单设计器「浏览按钮」类型预览弹窗（设计态）
 *
 * ★ 与数据页/预览页共用同一套控件（FieldControl → BrowserControl → PersonOrgField），
 *   不再有页面私有的 mock 版预览弹窗（BrowserButtonPreview 里的 PREVIEW_DATA 假数据）。
 *
 * 设计态语义（保持与旧版一致）：
 *   - 只为「展示这个类型的真实交互效果」，数据源真实（人员/部门/角色/岗位 走 personOrg 数据层）
 *   - **不落库**：所选值仅存在本组件内部 state，关闭即重置，绝不写回字段定义
 *   - 未接入数据的类型（资产/文档/流程等）由 FieldControl 自动降级为带类型提示的输入框
 */
const BrowserTypePreview: React.FC<BrowserTypePreviewProps> = ({
  open,
  fieldLabel,
  browserType = 1,
  onClose,
}) => {
  // 仅用于预览演示的临时值：不回写任何字段定义
  const [demoValue, setDemoValue] = useState('');
  const typeLabel = getBrowserTypeLabel(browserType) || '浏览按钮';

  // 每次打开重置，避免上一次的演示值残留
  useEffect(() => {
    if (open) setDemoValue('');
  }, [open, browserType]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnHidden
      title={`浏览按钮预览：${fieldLabel || typeLabel}（${typeLabel}）`}
    >
      <div style={{ padding: '8px 0' }}>
        <FieldControl
          controlType="browser"
          browserType={browserType}
          value={demoValue}
          onChange={(v) => setDemoValue(v)}
          placeholder={`请选择${typeLabel}`}
        />
      </div>
      <Typography.Paragraph
        type="secondary"
        style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}
      >
        说明：此处展示该类型的真实交互效果（与表单预览页共用同一组件与真实人员/组织数据）；
        预览为演示用途，关闭即重置，不会写入字段定义。
      </Typography.Paragraph>
    </Modal>
  );
};

export default BrowserTypePreview;
