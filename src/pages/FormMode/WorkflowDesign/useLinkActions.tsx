import { useMemo, useState } from 'react';
import { Modal, message } from 'antd';
import { deleteLink, updateLink, WfNodeLink, WfProcessNode } from '@/services/workflow';
import ConditionBuilder, {
  buildCondExpr,
  CondField,
  CondRow,
  parseCondExpr,
} from './ConditionBuilder';
import { FormFieldBrief, LinkChange } from './LinkInfoPanel';
import { scopeLabel } from './wfDict';

export interface LinkActionsOpts {
  onPatch?: (linkId: number, patch: Partial<WfNodeLink>) => void;
  onChanged?: (change?: LinkChange) => void;
  /** 出口信息锁定（所有节点测试通过前禁止编辑条件） */
  locked?: boolean;
}

/**
 * 出口的「流转条件编辑弹窗」与「删除确认」逻辑，被「出口信息」页签表格的行内操作
 * 与「图形编辑」页签右侧栏（LinkDetail）共用，避免重复实现。
 */
export function useLinkActions(
  defId: any,
  nodes: WfProcessNode[],
  formFields: FormFieldBrief[],
  opts: LinkActionsOpts,
) {
  const { onPatch, onChanged, locked } = opts;
  const [condLink, setCondLink] = useState<WfNodeLink | undefined>();
  const [condRows, setCondRows] = useState<CondRow[]>([]);
  const [savingCond, setSavingCond] = useState(false);

  const nodeName = (key?: string) =>
    nodes.find((n) => n.nodeKey === key)?.nodeName || key || '-';
  const linkName = (l: WfNodeLink) =>
    l.toNodeKey ? `${nodeName(l.fromNodeKey)} 至 ${nodeName(l.toNodeKey)}` : '待选择目标节点';

  const condFields: CondField[] = useMemo(
    () =>
      formFields.map((f) => ({
        key: f.scope === 'main' ? f.fieldName : `${f.scope}.${f.fieldName}`,
        label: f.scope === 'main' ? f.fieldLabel : `${f.fieldLabel}（${scopeLabel(f.scope)}）`,
      })),
    [formFields],
  );
  const condPreview = buildCondExpr(condRows);

  const openCond = (link: WfNodeLink) => {
    setCondLink(link);
    setCondRows(parseCondExpr(link.conditionExpr));
  };

  const submitCond = async () => {
    if (!condLink || locked) return;
    setSavingCond(true);
    try {
      const { expr, cn } = buildCondExpr(condRows);
      const patch = { conditionExpr: expr || undefined, conditionCn: cn || undefined };
      const r: any = await updateLink(defId, condLink.id!, patch);
      if (r?.success === false) {
        message.error('保存失败');
        return;
      }
      onPatch?.(condLink.id!, patch);
      message.success('流转条件已保存');
      setCondLink(undefined);
    } catch {
      message.error('保存失败');
    } finally {
      setSavingCond(false);
    }
  };

  const confirmDelete = (link: WfNodeLink) => {
    Modal.confirm({
      title: '删除出口',
      content: `确定删除「${linkName(link)}」吗？画布上的对应连线也会同步删除。`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteLink(defId, link.id!);
          message.success('出口已删除');
          onChanged?.({
            type: 'delete',
            from: String(link.fromNodeKey),
            to: String(link.toNodeKey),
          });
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const modal = (
    <Modal
      title={condLink ? `流转条件（${linkName(condLink)}）` : '流转条件'}
      open={!!condLink}
      onOk={submitCond}
      confirmLoading={savingCond}
      onCancel={() => setCondLink(undefined)}
      width={720}
      destroyOnClose
    >
      <ConditionBuilder rows={condRows} onChange={setCondRows} fields={condFields} />
      <div style={{ marginTop: 12, color: condPreview.expr ? '#1677ff' : '#999', fontSize: 12 }}>
        条件预览：{condPreview.cn || '未设置条件'}
        {condPreview.expr ? <div style={{ color: '#888' }}>{condPreview.expr}</div> : null}
      </div>
    </Modal>
  );

  return { openCond, confirmDelete, modal };
}
