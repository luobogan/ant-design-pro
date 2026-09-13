import React, { useMemo } from 'react';
import { Button, Card, Space, Tag } from 'antd';
import { WfProcessNode } from '@/services/workflow';
import { FormFieldBrief } from './LinkInfoPanel';
import NodeDetail from './NodeDetail';
import NodeInfoTable from './NodeInfoTable';
import { dictLabel, NODE_TYPES } from './wfDict';

export interface NodeInfoPanelProps {
  defId: any;
  nodes: WfProcessNode[];
  /** 当前选中节点（由画布选中驱动，点节点本体即同步进来） */
  selectedNodeKey?: string;
  /** 点列表行选中节点（与画布 / 出口信息联动） */
  onSelect?: (nodeKey: string) => void;
  formFields: FormFieldBrief[];
  /** 节点名称变更后回调（用于同步画布节点标签，沿用既有 renameEvt 通道） */
  onSaved?: (nodeKey: string, name: string) => void;
  /** 节点属性写库成功后通知父级，就地更新 nodes */
  onPatch?: (nodeKey: string, patch: Partial<WfProcessNode>) => void;
  /** 点「定位」→ 切到图形编辑页签并把画布居中高亮到该节点 */
  onLocate?: (nodeKey: string) => void;
  /** 当前流程绑定的表单ID（用于「生成表单布局」入口；未绑定则不显示按钮） */
  formId?: string;
  /** 表单名称（展示用） */
  formName?: string;
  /** 点击「生成表单布局」回调，传入当前节点 Key（弹窗由父级承载） */
  onGenerateLayout?: (nodeKey: string) => void;
  /** 拖拽排序节点：父级负责本地重排并持久化 sortOrder */
  onReorder?: (orderedNodeKeys: string[]) => void;
  /** 列表表尾草稿行保存：一次可在画布新建多个节点 */
  onCreateNodes?: (nodes: { nodeName: string; nodeType: number }[]) => void;
  /** 移除（删除）节点：调用方请求后端并刷新列表 */
  onDeleteNode?: (nodeKey: string) => void;
}

/**
 * 节点信息。
 *
 * 对齐 ecology「流转设置 → 节点信息」的字段集：节点名称 / 节点类型 / 操作者 /
 * 表单内容 / 操作菜单 / 节点前附加操作 / 节点后附加操作。
 * 主体是一张**可编辑列表**（一行一个节点，即改即存），选中行由画布选中驱动、点行也可回选；
 * 选中节点下方再挂 `NodeDetail`，承载字段权限 / 节点设置 / 表单布局等更细的配置。
 */
const NodeInfoPanel: React.FC<NodeInfoPanelProps> = ({
  defId,
  nodes,
  selectedNodeKey,
  onSelect,
  formFields,
  onSaved,
  onPatch,
  onLocate,
  formId,
  formName,
  onGenerateLayout,
  onCreateNodes,
  onDeleteNode,
  onReorder,
}) => {
  const current = useMemo(
    () => nodes.find((n) => n.nodeKey === selectedNodeKey),
    [nodes, selectedNodeKey],
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          gap: 8,
        }}
      >
        <Space size={8} wrap>
          {current ? (
            <>
              <span style={{ color: '#888' }}>当前节点：</span>
              <span style={{ fontWeight: 600 }}>{current.nodeName || current.nodeKey}</span>
              <Tag color="blue">{dictLabel(NODE_TYPES, current.nodeType, '未知')}</Tag>
            </>
          ) : (
            <span style={{ color: '#888' }}>节点列表：点行选中，各列可直接编辑</span>
          )}
        </Space>
        <Space size={8} wrap>
          {current && (
            <Button size="small" onClick={() => onLocate?.(current.nodeKey!)}>
              定位到画布
            </Button>
          )}
        </Space>
      </div>

      <NodeInfoTable
        defId={defId}
        nodes={nodes}
        selectedNodeKey={selectedNodeKey}
        onSelect={onSelect}
        onPatch={onPatch}
        onRename={onSaved}
        onLocate={onLocate}
        formId={formId}
        formFields={formFields}
        onEditLayout={onGenerateLayout}
        onCreateNodes={onCreateNodes}
        onDeleteNode={onDeleteNode}
        onReorder={onReorder}
      />

      {current && (
        <Card
          size="small"
          style={{ marginTop: 12 }}
          title={`节点详情：${current.nodeName || current.nodeKey}`}
        >
          <NodeDetail
            defId={defId}
            node={current}
            nodes={nodes}
            formFields={formFields}
            formId={formId}
            formName={formName}
            onSaved={onSaved}
            onPatch={onPatch}
            onOpenLayout={onGenerateLayout}
          />
        </Card>
      )}
    </div>
  );
};

export default NodeInfoPanel;
