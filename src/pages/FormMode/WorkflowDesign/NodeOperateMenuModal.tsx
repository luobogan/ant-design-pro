import React, { useEffect, useState } from 'react';
import { Button, Input, Modal, Radio, Space, Switch, Table, Tag, Tooltip, message } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, HolderOutlined } from '@ant-design/icons';
import { WfProcessNode } from '@/services/workflow';
import { DEFAULT_MENUS, MENUS_OPTIONS, REQUIRED_MENUS } from './wfDict';
import {
  buildExtJson,
  menusFromItems,
  nodeSettings,
  normalizeOperateMenu,
  OperateMenuItem,
} from './nodeSettings';
import { getActiveModeler } from './bpmnModelerHolder';
import { getWfNodeExt, setWfNodeExt } from './bpmnExtension';

export interface NodeOperateMenuModalProps {
  open: boolean;
  defId: any;
  /** 所属节点（草稿行由调用方组装成带 extJson 的伪节点） */
  node?: WfProcessNode;
  /** 草稿模式：不落库，仅通过 onSaved 回传新的 extJson */
  draftMode?: boolean;
  onSaved?: (nodeKey: string, extJson: string) => void;
  onClose: () => void;
}

const dictName = (key: string) =>
  MENUS_OPTIONS.find((o) => String(o.value) === key)?.label ?? key;

/**
 * 「操作菜单」设置弹窗（对齐 ecology E9 节点操作菜单）。
 *
 * E9 里该配置是独立弹窗：逐条列出可用操作，可改**显示名称**、**是否启用**、
 * **显示顺序**（上移/下移），并可指定一个**默认操作**；这里即为该形态。
 *
 * 存储：ext_json.settings.operateMenu = { items, default, menus }
 * menus 由 items 派生（启用项按显示顺序），保证既有读取逻辑（角标/引擎）不受影响。
 */
const NodeOperateMenuModal: React.FC<NodeOperateMenuModalProps> = ({
  open,
  defId,
  node,
  draftMode,
  onSaved,
  onClose,
}) => {
  const [items, setItems] = useState<OperateMenuItem[]>([]);
  const [defaultKey, setDefaultKey] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  /** 路线 B：extJson 优先读 BPMN `wf:node` 扩展；画布未就绪时回退父级传入的 node.extJson */
  const extJsonOfNode = (): string | undefined => {
    const modeler = getActiveModeler();
    const element = node?.nodeKey ? modeler?.get('elementRegistry')?.get(node.nodeKey) : undefined;
    return element ? getWfNodeExt(element)?.extJson : node?.extJson;
  };

  useEffect(() => {
    if (!open || !node) return;
    const extJson = extJsonOfNode();
    const om = nodeSettings(extJson != null ? { ...node, extJson } : node).operateMenu || {};
    setItems(normalizeOperateMenu(om));
    setDefaultKey(typeof om.default === 'string' ? om.default : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, node?.nodeKey, node?.extJson]);

  const patch = (key: string, next: Partial<OperateMenuItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...next } : i)));

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [cur] = next.splice(index, 1);
      next.splice(target, 0, cur);
      return next;
    });
  };

  /** 置顶：把某项移到最前（菜单「置顶」语义，对齐 ecology 操作菜单排序） */
  const pinToTop = (index: number) => {
    if (index <= 0) return;
    setItems((prev) => {
      const next = [...prev];
      const [cur] = next.splice(index, 1);
      next.unshift(cur);
      return next;
    });
  };

  /** 鼠标拖拽排序：正在拖动的项 key / 当前悬停落点项 key */
  const [dragKey, setDragKey] = useState<string | undefined>();
  const [dragOverKey, setDragOverKey] = useState<string | undefined>();

  /** 把 fromKey 拖到 toKey 的位置（插入其后之前，即占用 toKey 原下标） */
  const moveTo = (fromKey: string, toKey: string) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.key === fromKey);
      const to = prev.findIndex((i) => i.key === toKey);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [cur] = next.splice(from, 1);
      next.splice(to, 0, cur);
      return next;
    });
  };

  /**
   * 全选 / 清空 / 恢复默认（默认 = DEFAULT_MENUS：提交 + 保存 + 退回 + 转发，名称还原字典名）。
   *
   * <p>「清空」也不会动 {@link REQUIRED_MENUS}（提交/保存）：这两项是节点能工作的最低动作集，
   * 取消掉会让节点没有提交按钮、流程无法推进，属必填项、不可取消。</p>
   */
  const setAll = (enabled: boolean) =>
    setItems((prev) =>
      prev.map((i) => (REQUIRED_MENUS.includes(i.key) ? { ...i, enabled: true } : { ...i, enabled })),
    );
  const resetDefault = () => {
    setItems((prev) => {
      // 默认项按 DEFAULT_MENUS 的顺序排前，其余按字典顺序跟后，全部恢复字典名
      const picked = DEFAULT_MENUS.map((k) => prev.find((i) => i.key === k)).filter(Boolean) as OperateMenuItem[];
      const rest = prev.filter((i) => !DEFAULT_MENUS.includes(i.key));
      return [...picked, ...rest].map((i) => ({
        ...i,
        name: dictName(i.key),
        enabled: DEFAULT_MENUS.includes(i.key),
      }));
    });
    setDefaultKey('submit');
  };

  const handleOk = async () => {
    if (!node?.nodeKey) return;
    const bad = items.find((i) => i.enabled && !(i.name || '').trim());
    if (bad) {
      message.warning('已启用的操作必须填写显示名称');
      return;
    }
    // 落库前强制补回必填项（提交/保存）：即便本地 items 因旧数据/异常状态没勾上，
    // 保存到定义里也一定是启用的，杜绝「节点没有提交按钮」的配置流入线上。
    const cleaned: OperateMenuItem[] = items.map((i) => ({
      key: i.key,
      name: (i.name || '').trim() || dictName(i.key),
      enabled: REQUIRED_MENUS.includes(i.key) ? true : !!i.enabled,
    }));
    // 默认操作必须处于启用状态
    const dk =
      defaultKey && cleaned.some((c) => c.key === defaultKey && c.enabled) ? defaultKey : undefined;
    // 路线 B：以 BPMN 扩展里的 extJson 为基准重建，避免覆盖掉画布上已有的其它设置项
    const extJson = buildExtJson({ ...node, extJson: extJsonOfNode() }, (s) => {
      s.operateMenu = {
        items: cleaned,
        default: dk,
        menus: menusFromItems(cleaned),
      };
    });

    setSaving(true);
    try {
      if (draftMode) {
        onSaved?.(node.nodeKey, extJson);
        onClose();
        return;
      }
      const modeler = getActiveModeler();
      const element = modeler?.get('elementRegistry')?.get(node.nodeKey);
      if (!element) {
        message.error('画布未就绪，无法保存');
        return;
      }
      const ext = getWfNodeExt(element) || {};
      setWfNodeExt(modeler, element, { ...ext, extJson });
      onSaved?.(node.nodeKey, extJson);
      message.success('操作菜单已保存（已写入 BPMN 扩展）');
      onClose();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '排序',
      width: 124,
      render: (_: any, r: OperateMenuItem, index: number) => (
        <Space size={0}>
          <span
            draggable
            title="按住拖动调整顺序"
            style={{
              cursor: 'grab',
              color: '#8c8c8c',
              marginRight: 2,
              display: 'inline-flex',
              alignItems: 'center',
            }}
            onDragStart={(e) => {
              setDragKey(r.key);
              e.dataTransfer.effectAllowed = 'move';
              // Firefox 需 setData 才会真正启动拖拽
              e.dataTransfer.setData('text/plain', String(r.key));
            }}
            onDragEnd={() => {
              setDragKey(undefined);
              setDragOverKey(undefined);
            }}
          >
            <HolderOutlined />
          </span>
          <Button
            type="text"
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={index === 0}
            onClick={() => move(index, -1)}
          />
          <Button
            type="text"
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={index === items.length - 1}
            onClick={() => move(index, 1)}
          />
          <Button
            type="text"
            size="small"
            title="置顶"
            disabled={index === 0}
            onClick={() => pinToTop(index)}
          >
            置顶
          </Button>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'key',
      width: 110,
      render: (key: string) => <Tag color="blue">{dictName(key)}</Tag>,
    },
    {
      title: '显示名称',
      dataIndex: 'name',
      render: (name: string, r: OperateMenuItem) => (
        <Input
          size="small"
          style={{ width: 160 }}
          value={name}
          placeholder={dictName(r.key)}
          onChange={(e) => patch(r.key, { name: e.target.value })}
        />
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 110,
      render: (enabled: boolean, r: OperateMenuItem) => {
        // 必填项（提交/保存）：强制启用且不可取消 —— 缺了它们节点无法提交/保存，流程走不通
        const required = REQUIRED_MENUS.includes(r.key);
        return (
          <Space size={4}>
            <Switch
              size="small"
              checked={required || enabled}
              disabled={required}
              onChange={(v) => {
                patch(r.key, { enabled: v });
                // 停用项若为默认操作，则清掉默认，避免出现"默认了一个不显示的操作"
                if (!v && defaultKey === r.key) setDefaultKey(undefined);
              }}
            />
            {required && (
              <Tooltip title="必填：节点能工作的最低动作集，不可取消">
                <Tag color="red" style={{ marginInlineEnd: 0 }}>
                  必填
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: '默认',
      dataIndex: 'key',
      width: 60,
      render: (key: string, r: OperateMenuItem) => (
        <Radio
          disabled={!r.enabled}
          checked={defaultKey === key}
          onChange={() => setDefaultKey(key)}
        />
      ),
    },
  ];

  return (
    <Modal
      title={node ? `操作菜单（${node.nodeName || node.nodeKey}）` : '操作菜单'}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={saving}
      destroyOnClose
      width={720}
      okText="保存"
      cancelText="取消"
    >
      <Space style={{ marginBottom: 8 }}>
        <Button size="small" onClick={() => setAll(true)}>
          全选
        </Button>
        <Button size="small" onClick={() => setAll(false)}>
          清空
        </Button>
        <Button size="small" onClick={resetDefault}>
          恢复默认
        </Button>
      </Space>
      <Table
        size="small"
        rowKey="key"
        pagination={false}
        dataSource={items}
        columns={columns as any}
        scroll={{ y: 360 }}
        // 鼠标拖拽排序：拖到目标行即插入该位置（保留上移/下移按钮作兜底）
        rowClassName={(r: OperateMenuItem) =>
          dragKey && dragOverKey && r.key === dragOverKey && r.key !== dragKey ? 'wf-row-dragover' : ''
        }
        onRow={(r: OperateMenuItem) => ({
          onDragOver: (e: React.DragEvent) => {
            if (!dragKey || r.key === dragKey) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dragOverKey !== r.key) setDragOverKey(r.key);
          },
          onDrop: (e: React.DragEvent) => {
            if (!dragKey || r.key === dragKey) return;
            e.preventDefault();
            moveTo(dragKey, r.key);
            setDragKey(undefined);
            setDragOverKey(undefined);
          },
        })}
      />
      <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
        可改显示名称、启停与顺序（按住左侧拖柄可鼠标拖动排序，也可用上移/下移按钮）；
        「默认」指定打开表单时默认选中的操作（需先启用）。
      </div>
    </Modal>
  );
};

export default NodeOperateMenuModal;
