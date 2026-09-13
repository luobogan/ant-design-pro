import React, { useEffect, useState } from 'react';
import { Button, Input, Modal, Radio, Space, Switch, Table, Tag, message } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, HolderOutlined } from '@ant-design/icons';
import { updateNode, WfProcessNode } from '@/services/workflow';
import { MENUS_OPTIONS } from './wfDict';
import {
  buildExtJson,
  menusFromItems,
  nodeSettings,
  normalizeOperateMenu,
  OperateMenuItem,
} from './nodeSettings';

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

  useEffect(() => {
    if (!open || !node) return;
    const om = nodeSettings(node).operateMenu || {};
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

  /** 全选 / 清空 / 恢复默认（默认 = 提交 + 退回，名称还原字典名） */
  const setAll = (enabled: boolean) => setItems((prev) => prev.map((i) => ({ ...i, enabled })));
  const resetDefault = () => {
    setItems((prev) => prev.map((i) => ({ ...i, name: dictName(i.key), enabled: i.key === 'submit' || i.key === 'reject' })));
    setDefaultKey('submit');
  };

  const handleOk = async () => {
    if (!node?.nodeKey) return;
    const bad = items.find((i) => i.enabled && !(i.name || '').trim());
    if (bad) {
      message.warning('已启用的操作必须填写显示名称');
      return;
    }
    const cleaned: OperateMenuItem[] = items.map((i) => ({
      key: i.key,
      name: (i.name || '').trim() || dictName(i.key),
      enabled: !!i.enabled,
    }));
    // 默认操作必须处于启用状态
    const dk =
      defaultKey && cleaned.some((c) => c.key === defaultKey && c.enabled) ? defaultKey : undefined;
    const extJson = buildExtJson(node, (s) => {
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
      const r: any = await updateNode(defId, node.nodeKey, { extJson });
      if (r?.success === false) {
        message.error('保存失败');
        return;
      }
      onSaved?.(node.nodeKey, extJson);
      message.success('操作菜单已保存');
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
      width: 70,
      render: (enabled: boolean, r: OperateMenuItem) => (
        <Switch
          size="small"
          checked={enabled}
          onChange={(v) => {
            patch(r.key, { enabled: v });
            // 停用项若为默认操作，则清掉默认，避免出现"默认了一个不显示的操作"
            if (!v && defaultKey === r.key) setDefaultKey(undefined);
          }}
        />
      ),
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
