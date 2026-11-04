import { Alert, Button, InputNumber, Space, Typography } from 'antd';
import React, { useState } from 'react';
import type { WfProcessDefinition } from '@/services/workflow';

const { Text, Paragraph } = Typography;

export interface FreePoolSettingProps {
  def: WfProcessDefinition;
  /** 按新的节点数量重建默认画布（会重置画布上的手工编辑） */
  onRebuild: (size: number) => void;
}

/**
 * 自由流程「通用节点池」设置块。
 *
 * <p>节点是 BPMN 里真实存在的静态 UserTask，数量即单个实例可编排的步骤上限。
 * 调整数量后必须重建默认画布并点「发布」刷新 proc_def_id，否则运行期 loadNode
 * 读到的仍是上一次部署的模型（保存画布不等于生效）。</p>
 */
const FreePoolSetting: React.FC<FreePoolSettingProps> = ({ def, onRebuild }) => {
  const [size, setSize] = useState<number>(Number(def.freeNodePoolSize ?? 5));
  const dirty = size !== Number(def.freeNodePoolSize ?? 5);

  return (
    <div style={{ marginTop: 16, padding: 16, background: 'var(--th-bg-container, #F5F7FA)', borderRadius: 8 }}>
      <Text strong style={{ fontSize: 15 }}>自由流程 · 通用节点池</Text>
      <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 8, marginBottom: 12 }}>
        办理人可在「流转设定」中按本次单据编排步骤（名称、办理人、会签方式）。每个步骤绑定到下方预置的通用审批节点，
        因此数量即单实例可编排的最大步骤数。
      </Paragraph>
      <Space size="middle" wrap>
        <span>
          <Text type="secondary" style={{ marginRight: 8 }}>通用节点数量</Text>
          <InputNumber
            min={1}
            max={20}
            precision={0}
            value={size}
            onChange={(v) => setSize(Number(v ?? 5))}
            aria-label="通用节点数量"
          />
        </span>
        <Button
          type="primary"
          disabled={!dirty}
          onClick={() => onRebuild(size)}
        >
          按新数量重建默认画布
        </Button>
      </Space>
      <Alert
        style={{ marginTop: 12 }}
        type="warning"
        showIcon
        message="调整后必须发布才生效"
        description="重建画布会重置画布上的手工编辑；保存后请点「发布」刷新流程部署（proc_def_id），否则运行期仍读上一次部署的节点模型。若同时改了会签方式，还需执行「重新部署多实例」。"
      />
    </div>
  );
};

export default FreePoolSetting;
