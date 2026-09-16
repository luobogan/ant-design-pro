import React, { useMemo } from 'react';
import { Button, Card, Descriptions, Space, Tag } from 'antd';
import { WfNodeLink, WfProcessNode } from '@/services/workflow';
import { FormFieldBrief, LinkChange } from './LinkInfoPanel';
import { useLinkActions } from './useLinkActions';

export interface LinkDetailProps {
  defId: any;
  nodes: WfProcessNode[];
  links: WfNodeLink[];
  /** 画布上选中的那条出口（点连线同步进来） */
  selectedLink?: { from: string; to: string };
  formFields: FormFieldBrief[];
  /** 出口属性写库成功后通知父级，就地更新 links */
  onPatch?: (linkId: number, patch: Partial<WfNodeLink>) => void;
  /** 出口变更后回调（用于刷新 links 并同步画布连线） */
  onChanged?: (change?: LinkChange) => void;
  /** 点「定位」→ 把画布居中高亮到该连线 */
  onLocate?: (from: string, to: string) => void;
}

/**
 * 画布右侧「出口信息」详情卡（对齐 ecology 点连线后的出口属性面板）。
 *
 * 与 `LinkInfoPanel` 的「当前出口」卡片同源：只渲染单条出口的详情 + 流转条件编辑，
 * 供「图形编辑」页签右侧栏在选中连线时即改即存，无需切换到「出口信息」页签。
 * 「流转条件弹窗 / 删除确认」复用 `useLinkActions`，与出口信息表格行内操作同一份实现。
 */
const LinkDetail: React.FC<LinkDetailProps> = ({
  defId,
  nodes,
  links,
  selectedLink,
  formFields,
  onPatch,
  onChanged,
  onLocate,
}) => {
  // 与 LinkInfoPanel 一致：所有节点测试通过后才允许编辑出口属性
  const allTested = nodes.length > 0 && nodes.every((n) => n.testStatus === 1);
  const locked = !allTested;

  const { openCond, confirmDelete, modal } = useLinkActions(defId, nodes, formFields, {
    onPatch,
    onChanged,
    locked,
  });

  const nodeName = (key?: string) =>
    nodes.find((n) => n.nodeKey === key)?.nodeName || key || '-';

  const linkName = (l: WfNodeLink) =>
    l.toNodeKey ? `${nodeName(l.fromNodeKey)} 至 ${nodeName(l.toNodeKey)}` : '待选择目标节点';

  /** 画布上当前选中的那条出口 */
  const currentLink = useMemo(
    () =>
      selectedLink
        ? links.find(
            (l) =>
              String(l.fromNodeKey) === selectedLink.from && String(l.toNodeKey) === selectedLink.to,
          )
        : undefined,
    [links, selectedLink],
  );

  if (!currentLink) return null;

  return (
    <>
      <Card
        size="small"
        style={{ borderColor: '#91caff', background: '#f0f7ff' }}
        title={<span>当前出口：{linkName(currentLink)}</span>}
        extra={
          <Space size={4}>
            <Button size="small" disabled={locked} onClick={() => openCond(currentLink)}>
              设置条件
            </Button>
            <Button
              size="small"
              onClick={() => onLocate?.(String(currentLink.fromNodeKey), String(currentLink.toNodeKey))}
            >
              定位
            </Button>
            <Button size="small" danger onClick={() => confirmDelete(currentLink)}>
              删除
            </Button>
          </Space>
        }
      >
        <Descriptions size="small" column={2} colon={false}>
          <Descriptions.Item label="源节点">{nodeName(currentLink.fromNodeKey)}</Descriptions.Item>
          <Descriptions.Item label="目标节点">{nodeName(currentLink.toNodeKey)}</Descriptions.Item>
          <Descriptions.Item label="是否退回">
            {currentLink.isReject === 1 ? <Tag color="red">退回</Tag> : '否'}
          </Descriptions.Item>
          <Descriptions.Item label="必经分支">
            {currentLink.isMustPass === 1 ? <Tag color="blue">必经</Tag> : '否'}
          </Descriptions.Item>
          <Descriptions.Item label="排序">{currentLink.sortOrder ?? 0}</Descriptions.Item>
          <Descriptions.Item label="流转条件">
            {currentLink.conditionCn || currentLink.conditionExpr || (
              <span style={{ color: '#bbb' }}>未设置</span>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {modal}
    </>
  );
};

export default LinkDetail;
