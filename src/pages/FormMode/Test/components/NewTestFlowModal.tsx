import React, { useMemo, useState } from 'react';
import { Tree, List, Tag, Input, Empty, Modal } from 'antd';

/** 流程定义状态：0草稿 1已发布 2停用 */
const DEF_STATUS: Record<number, string> = { 0: '草稿', 1: '已发布', 2: '停用' };

interface Props {
  open: boolean;
  /** 流程分类字典：value=类型id，label=类型名称（对齐 wf_workflow_type） */
  wfTypes: any[];
  /** 仅含「激活版本」的流程定义 */
  activeDefs: any[];
  /** 点流程即创建测试：把选中的 defId 抛给父级 */
  onSelect: (defId: any) => void;
  onClose: () => void;
}

/**
 * 新建测试流程弹窗
 *
 * - 左：分类树（流程分类），节点带该分类下的流程数；
 * - 右：当前分类下的流程列表（只列激活版本），点任一行即选中并创建测试；
 * - 右侧支持按名称 / 版本搜索。
 */
const NewTestFlowModal: React.FC<Props> = ({ open, wfTypes, activeDefs, onSelect, onClose }) => {
  const [selectedKey, setSelectedKey] = useState<string>('all');
  const [keyword, setKeyword] = useState('');

  const typeNameMap = useMemo(() => {
    const m = new Map<string, string>();
    (wfTypes || []).forEach((t: any) => m.set(String(t.value), t.label));
    return m;
  }, [wfTypes]);

  const countByType = useMemo(() => {
    const m = new Map<string, number>();
    (activeDefs || []).forEach((d: any) => {
      const k = d.type == null || String(d.type) === '' ? '__none__' : String(d.type);
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }, [activeDefs]);

  const treeData = useMemo(() => {
    const nodes: any[] = [{ title: `全部流程（${activeDefs.length}）`, key: 'all' }];
    // 只显示「有流程」的分类（count>0）；空分类不展示
    (wfTypes || [])
      .filter((t: any) => (countByType.get(String(t.value)) || 0) > 0)
      .forEach((t: any) => {
        nodes.push({
          title: `${t.label}（${countByType.get(String(t.value))}）`,
          key: String(t.value),
        });
      });
    const none = countByType.get('__none__') || 0;
    if (none > 0) nodes.push({ title: `未分类（${none}）`, key: '__none__' });
    return nodes;
  }, [wfTypes, countByType, activeDefs.length]);

  const list = useMemo(() => {
    let arr = activeDefs || [];
    if (selectedKey !== 'all') {
      arr = arr.filter((d: any) =>
        selectedKey === '__none__'
          ? d.type == null || String(d.type) === ''
          : String(d.type) === selectedKey,
      );
    }
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      arr = arr.filter((d: any) =>
        (String(d.name || d.procKey) + ' v' + (d.version ?? '')).toLowerCase().includes(kw),
      );
    }
    return [...arr].sort((a: any, b: any) =>
      String(a.name || a.procKey).localeCompare(String(b.name || b.procKey)),
    );
  }, [activeDefs, selectedKey, keyword]);

  return (
    <Modal
      title="新建测试流程"
      open={open}
      onCancel={onClose}
      footer={null}
      width={840}
      destroyOnHidden
    >
      <div style={{ display: 'flex', gap: 12, minHeight: 440 }}>
        <div
          style={{
            width: 240,
            borderRight: '1px solid #f0f0f0',
            paddingRight: 12,
            overflow: 'auto',
          }}
        >
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>流程分类</div>
          <Tree
            treeData={treeData}
            defaultExpandAll
            blockNode
            selectedKeys={[selectedKey]}
            onSelect={(keys) => setSelectedKey((keys[0] as string) || 'all')}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Input.Search
            placeholder="搜索流程名称 / 版本"
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <div style={{ flex: 1, overflow: 'auto' }}>
            {list.length === 0 ? (
              <Empty description="该分类下暂无流程" />
            ) : (
              <List
                dataSource={list}
                renderItem={(d: any) => (
                  <List.Item
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelect(d.id)}
                    actions={[
                      <Tag color={d.status === 1 ? 'green' : 'default'} key="st">
                        {DEF_STATUS[d.status] ?? '-'}
                      </Tag>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <span>
                          {d.name || d.procKey}
                          <Tag color="blue" style={{ marginLeft: 6 }}>
                            v{d.version ?? '-'}
                          </Tag>
                          <Tag>{typeNameMap.get(String(d.type)) || '未分类'}</Tag>
                        </span>
                      }
                      description={`使用激活版本 v${d.version ?? '-'} · key：${d.procKey}`}
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default NewTestFlowModal;
