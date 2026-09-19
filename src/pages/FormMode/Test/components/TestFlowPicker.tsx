import React, { useMemo, useState } from 'react';
import { Card, Empty, Input, Modal, Tabs, Tag } from 'antd';
import { PlusCircleFilled, UserOutlined } from '@ant-design/icons';
import { PersonOrgPicker } from '@/components/FormMode/PersonOrgPicker';

/** 流程定义状态：0草稿 1已发布 2停用 */
const DEF_STATUS: Record<number, string> = { 0: '草稿', 1: '已发布', 2: '停用' };

export interface TestFlowPickerProps {
  /** panel：作为进入页的内嵌面板（未选流程时的入口）；modal：测试页内「更换流程」弹窗 */
  mode?: 'panel' | 'modal';
  /** modal 模式下的显隐 */
  open?: boolean;
  /** 流程分类字典：value=类型id，label=类型名称（对齐 wf_workflow_type） */
  wfTypes: any[];
  /** 仅含「激活版本」的流程定义 */
  activeDefs: any[];
  /** 当前已选流程（高亮） */
  selectedDefId?: any;
  /**
   * 选中流程并确认测试发起人后回调：
   * 父级据此携带「流程 + 发起人」进入测试界面（不创建任何测试实例）。
   */
  onConfirm: (defId: any, testUserId: string) => void;
  onCancel?: () => void;
}

/**
 * 测试流程选择器（新建测试流程）
 *
 * - 顶部分类 Tabs（带数量）+ 名称搜索；
 * - 流程卡片列表：只列「激活版本」；
 * - 点流程卡片 → 弹出「选择测试发起人」→ 确定后回调父级进入测试界面。
 */
const TestFlowPicker: React.FC<TestFlowPickerProps> = ({
  mode = 'panel',
  open,
  wfTypes,
  activeDefs,
  selectedDefId,
  onConfirm,
  onCancel,
}) => {
  const [tabKey, setTabKey] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  /** 已点选、等待确认测试发起人的流程 */
  const [pendingDef, setPendingDef] = useState<any>(null);

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

  const tabItems = useMemo(() => {
    const items: any[] = [{ key: 'all', label: `全部流程（${activeDefs.length}）` }];
    // 只显示「有流程」的分类（count>0）；空分类不展示
    (wfTypes || [])
      .filter((t: any) => (countByType.get(String(t.value)) || 0) > 0)
      .forEach((t: any) => {
        items.push({
          key: String(t.value),
          label: `${t.label}（${countByType.get(String(t.value))}）`,
        });
      });
    const none = countByType.get('__none__') || 0;
    if (none > 0) items.push({ key: '__none__', label: `未分类（${none}）` });
    return items;
  }, [wfTypes, countByType, activeDefs.length]);

  const list = useMemo(() => {
    let arr = activeDefs || [];
    if (tabKey !== 'all') {
      arr = arr.filter((d: any) =>
        tabKey === '__none__'
          ? d.type == null || String(d.type) === ''
          : String(d.type) === tabKey,
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
  }, [activeDefs, tabKey, keyword]);

  const body = (
    <>
      <Tabs items={tabItems} activeKey={tabKey} onChange={setTabKey} />
      <Input.Search
        placeholder="搜索流程名称 / 版本"
        allowClear
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ marginBottom: 12, maxWidth: 320 }}
      />
      <div style={{ maxHeight: mode === 'modal' ? 420 : undefined, overflow: 'auto' }}>
        {list.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该分类下暂无流程" />
        ) : (
          list.map((d: any) => {
            const active = String(d.id) === String(selectedDefId);
            return (
              <div
                key={d.id}
                onClick={() => setPendingDef(d)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  marginBottom: 8,
                  borderRadius: 8,
                  border: `1px solid ${active ? '#91caff' : '#f0f0f0'}`,
                  background: active ? '#e6f4ff' : '#fafafa',
                  cursor: 'pointer',
                  transition: 'all .2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e6f4ff';
                  e.currentTarget.style.borderColor = '#91caff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = active ? '#e6f4ff' : '#fafafa';
                  e.currentTarget.style.borderColor = active ? '#91caff' : '#f0f0f0';
                }}
              >
                <UserOutlined style={{ fontSize: 20, color: '#69b1ff' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: '#333' }}>{d.name || d.procKey}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#999',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {typeNameMap.get(String(d.type)) || '未分类'} · 使用激活版本 v{d.version ?? '-'}
                    · key：{d.procKey}
                  </div>
                </div>
                <Tag color={d.status === 1 ? 'green' : 'default'} style={{ marginRight: 0 }}>
                  {DEF_STATUS[d.status] ?? '-'}
                </Tag>
              </div>
            );
          })
        )}
      </div>

      {/* 点流程后先弹「选择测试发起人」：确认后才进入测试界面 */}
      <PersonOrgPicker
        open={!!pendingDef}
        browserType={1}
        multiple={false}
        onOk={(ids) => {
          if (pendingDef && ids.length) {
            onConfirm(pendingDef.id, ids[0]);
            setPendingDef(null);
          }
        }}
        onCancel={() => setPendingDef(null)}
      />
    </>
  );

  if (mode === 'modal') {
    return (
      <Modal
        title="新建测试流程"
        open={!!open}
        onCancel={onCancel}
        footer={null}
        width={840}
        destroyOnHidden
      >
        {body}
      </Modal>
    );
  }

  return (
    <Card
      size="small"
      title={
        <span>
          <PlusCircleFilled style={{ color: '#1677ff', marginRight: 6 }} />
          新建测试流程
        </span>
      }
      extra={
        <span style={{ fontSize: 12, color: '#999' }}>
          点流程 → 选择测试发起人 → 进入测试界面
        </span>
      }
      style={{ marginBottom: 12 }}
    >
      {body}
    </Card>
  );
};

export default TestFlowPicker;
