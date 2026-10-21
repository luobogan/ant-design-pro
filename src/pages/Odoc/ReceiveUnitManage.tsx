import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  Tag,
  Tree,
  TreeSelect,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { odocReceiveUnitApi, type OdocReceiveUnit } from '@/services/workflow';

const COMPANY_TYPE: Record<number, string> = { 0: '内部', 1: '外部' };
const ORG_ALL = 'ALL';
const ORG_UNASSIGNED = 'UNASSIGNED';

/**
 * 收发文单位档案维护（归属机构 / 层级 / 内部外部）。
 * - 左侧「组织」树：来自 blade_system 机构树（分部/部门），点击筛选右侧单位。
 * - 右侧「层级」树：收文单位按 superiorId 聚合，挂在所选组织下，形成「组织 → 层级」两级结构。
 * 对应后端 WfOdocReceiveUnitController（/odoc/receive-unit/**）。
 */
const OdocReceiveUnitManage: React.FC = () => {
  const [unitList, setUnitList] = useState<OdocReceiveUnit[]>([]);
  const [orgList, setOrgList] = useState<any[]>([]);
  const [orgNameMap, setOrgNameMap] = useState<Record<string, string>>({});
  const [orgChildMap, setOrgChildMap] = useState<Record<string, string[]>>({});
  const [selectedOrg, setSelectedOrg] = useState<string>(ORG_ALL);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [current, setCurrent] = useState<OdocReceiveUnit | null>(null);
  const [form] = Form.useForm();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [unitRes, orgRes] = await Promise.all([
        odocReceiveUnitApi.list(),
        odocReceiveUnitApi.orgTree(),
      ]);
      const units = (unitRes?.data as OdocReceiveUnit[]) || [];
      const orgs = (orgRes?.data as any[]) || [];
      setUnitList(units);
      setOrgList(orgs);
      const nameMap: Record<string, string> = {};
      const childMap: Record<string, string[]> = {};
      flattenOrgs(orgs, nameMap, childMap);
      setOrgNameMap(nameMap);
      setOrgChildMap(childMap);
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // 左侧组织树（含「全部单位 / 未分配机构」虚拟节点）
  const leftTreeData = useMemo(() => {
    return [
      { key: ORG_ALL, value: ORG_ALL, title: '全部单位' },
      { key: ORG_UNASSIGNED, value: ORG_UNASSIGNED, title: '未分配机构' },
      ...buildOrgOptions(orgList),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgList]);

  // 归属机构选择器数据（Modal 用）
  const orgSelectData = useMemo(() => buildOrgOptions(orgList), [orgList]);

  // 上级单位选择器数据（排除自身子树，避免成环）
  const parentSelectData = useMemo(
    () => buildUnitOptions(unitList, current?.id),
    [unitList, current],
  );

  // 右侧单位层级树（按所选组织筛选）
  const rightTreeData = useMemo(() => {
    let units = unitList;
    if (selectedOrg === ORG_UNASSIGNED) {
      units = unitList.filter((u) => !u.subcompanyId);
    } else if (selectedOrg !== ORG_ALL) {
      const allowed = orgSubtreeIds(selectedOrg, orgChildMap);
      units = unitList.filter(
        (u) => u.subcompanyId != null && allowed.has(String(u.subcompanyId)),
      );
    }
    return buildUnitTreeData(units);
  }, [unitList, selectedOrg, orgChildMap]);

  const showOrg = selectedOrg === ORG_ALL;

  const titleRender = (node: any) => {
    const u = node.raw as OdocReceiveUnit;
    return (
      <span>
        <span style={{ marginRight: 8 }}>{u.unitName || String(u.id)}</span>
        <Tag color={u.companyType === 1 ? 'orange' : 'blue'}>
          {COMPANY_TYPE[u.companyType as number] ?? u.companyType}
        </Tag>
        {u.isMain === 1 && <Tag color="red">主送</Tag>}
        {showOrg && u.subcompanyId && (
          <span style={{ color: '#999', marginLeft: 6 }}>
            ({orgNameMap[String(u.subcompanyId)] || u.subcompanyId})
          </span>
        )}
        <span style={{ marginLeft: 12 }}>
          <Button
            type="link"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              openAddChild(u);
            }}
          >
            加下级
          </Button>
          <Button
            type="link"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(u);
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            onClick={(e) => {
              e.stopPropagation();
              handleRemove(u.id);
            }}
          >
            删除
          </Button>
        </span>
      </span>
    );
  };

  const openAdd = () => {
    setCurrent(null);
    form.resetFields();
    const defaults: any = {
      companyType: 0,
      isMain: false,
      canStartChildRequest: false,
      enabled: true,
      showOrder: 0,
    };
    // 选中具体机构时，新增单位默认归属该机构
    if (selectedOrg !== ORG_ALL && selectedOrg !== ORG_UNASSIGNED) {
      defaults.subcompanyId = selectedOrg;
    }
    form.setFieldsValue(defaults);
    setEditOpen(true);
  };
  const openAddChild = (parent: OdocReceiveUnit) => {
    setCurrent(null);
    form.resetFields();
    form.setFieldsValue({
      companyType: 0,
      isMain: false,
      canStartChildRequest: false,
      enabled: true,
      showOrder: 0,
      superiorId: String(parent.id),
      subcompanyId:
        parent.subcompanyId != null ? String(parent.subcompanyId) : undefined,
    });
    setEditOpen(true);
  };
  const openEdit = (r: OdocReceiveUnit) => {
    setCurrent(r);
    form.setFieldsValue({
      ...r,
      superiorId: r.superiorId != null ? String(r.superiorId) : undefined,
      subcompanyId: r.subcompanyId != null ? String(r.subcompanyId) : undefined,
      isMain: r.isMain === 1,
      canStartChildRequest: r.canStartChildRequest === 1,
      enabled: r.enabled !== 0,
    });
    setEditOpen(true);
  };
  const handleSubmit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await odocReceiveUnitApi.save({
        id: current?.id,
        unitName: v.unitName,
        unitCode: v.unitCode,
        superiorId: v.superiorId || undefined,
        subcompanyId: v.subcompanyId ? Number(v.subcompanyId) : undefined,
        companyType: v.companyType,
        isMain: v.isMain ? 1 : 0,
        canStartChildRequest: v.canStartChildRequest ? 1 : 0,
        receiverIds: v.receiverIds,
        showOrder: v.showOrder,
        enabled: v.enabled ? 1 : 0,
        extNote: v.extNote,
      });
      message.success('已保存');
      setEditOpen(false);
      reload();
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };
  const handleRemove = async (id: any) => {
    try {
      await odocReceiveUnitApi.remove(id);
      message.success('已删除');
      reload();
    } catch (e: any) {
      message.error(e?.msg || '删除失败');
    }
  };

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ width: 280, borderRight: '1px solid #f0f0f0', paddingRight: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>组织</div>
          <Tree
            treeData={leftTreeData}
            defaultExpandAll
            selectedKeys={[selectedOrg]}
            onSelect={(keys) => setSelectedOrg((keys[0] as string) || ORG_ALL)}
            style={{ maxHeight: 560, overflow: 'auto' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              新增单位
            </Button>
          </div>
          <Tree
            treeData={rightTreeData}
            titleRender={titleRender}
            defaultExpandAll
            loading={loading}
            style={{ maxHeight: 560, overflow: 'auto' }}
          />
        </div>
      </div>

      <Modal
        title={current ? '编辑单位' : '新增单位'}
        open={editOpen}
        onOk={handleSubmit}
        onCancel={() => setEditOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="unitName" label="单位名称" rules={[{ required: true, message: '请输入单位名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unitCode" label="单位代字/代码">
            <Input />
          </Form.Item>
          <Form.Item name="subcompanyId" label="归属机构">
            <TreeSelect
              treeData={orgSelectData}
              allowClear
              placeholder="留空=不归属具体机构"
              treeDefaultExpandAll
              treeNodeFilterProp="title"
            />
          </Form.Item>
          <Form.Item name="superiorId" label="上级单位">
            <TreeSelect
              treeData={parentSelectData}
              allowClear
              placeholder="留空=根级"
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item name="companyType" label="单位类型" rules={[{ required: true }]}>
            <Select>
              {[0, 1].map((v) => (
                <Select.Option key={v} value={v}>
                  {COMPANY_TYPE[v]}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="receiverIds" label="收文员ID（逗号分隔）">
            <Input />
          </Form.Item>
          <Form.Item name="showOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="extNote" label="备注">
            <Input />
          </Form.Item>
          <Form.Item name="isMain" label="主送单位" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="canStartChildRequest" label="可发起子收文" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

/** 扁平化嵌套机构树 → 名称映射 + 子节点映射 */
function flattenOrgs(
  nodes: any[],
  nameMap: Record<string, string>,
  childMap: Record<string, string[]>,
) {
  (nodes || []).forEach((n) => {
    if (n.id != null) {
      nameMap[String(n.id)] = n.deptName || String(n.id);
      childMap[String(n.id)] = (n.children || []).map((c: any) => String(c.id));
      flattenOrgs(n.children || [], nameMap, childMap);
    }
  });
}

/** 机构子树 ID 集合（含自身） */
function orgSubtreeIds(
  orgId: string,
  childMap: Record<string, string[]>,
): Set<string> {
  const set = new Set<string>([orgId]);
  const stack = [orgId];
  while (stack.length) {
    const cur = stack.pop() as string;
    (childMap[cur] || []).forEach((c) => {
      if (!set.has(c)) {
        set.add(c);
        stack.push(c);
      }
    });
  }
  return set;
}

/** 嵌套机构 → antd Tree/TreeSelect 数据（含 机构/部门 标记） */
function buildOrgOptions(nodes: any[]): any[] {
  return (nodes || [])
    .filter((n) => n.id != null)
    .map((n) => ({
      key: String(n.id),
      value: String(n.id),
      title: (
        <span>
          {n.deptName || String(n.id)}
          <Tag color={n.deptType === 1 ? 'purple' : 'default'} style={{ marginLeft: 6 }}>
            {n.deptType === 1 ? '机构' : '部门'}
          </Tag>
        </span>
      ),
      children: buildOrgOptions(n.children || []),
    }));
}

/** 单位 → 上级选择器数据（排除 excludeId 子树，避免成环） */
function buildUnitOptions(list: OdocReceiveUnit[], excludeId?: any): any[] {
  const nodes = new Map<string, any>();
  (list || []).forEach((u) => {
    if (u.id != null) {
      nodes.set(String(u.id), {
        value: String(u.id),
        title: u.unitName || String(u.id),
        children: [] as any[],
        raw: u,
      });
    }
  });
  const excluded = new Set<string>();
  if (excludeId != null) {
    const stack = [String(excludeId)];
    while (stack.length) {
      const cur = stack.pop() as string;
      if (excluded.has(cur)) continue;
      excluded.add(cur);
      nodes.get(cur)?.children.forEach((c: any) => stack.push(c.value));
    }
  }
  const roots: any[] = [];
  nodes.forEach((n) => {
    if (excluded.has(n.value)) return;
    const sup =
      n.raw?.superiorId != null && n.raw?.superiorId !== ''
        ? String(n.raw.superiorId)
        : '';
    if (sup && nodes.has(sup) && !excluded.has(sup)) nodes.get(sup)?.children.push(n);
    else roots.push(n);
  });
  const prune = (arr: any[]) =>
    arr.forEach((n) => {
      if (!n.children.length) delete n.children;
      else prune(n.children);
    });
  prune(roots);
  return roots;
}

/** 单位 → 右侧层级树（key/raw/children，title 由 titleRender 渲染） */
function buildUnitTreeData(list: OdocReceiveUnit[]): any[] {
  const nodes = new Map<string, any>();
  (list || []).forEach((u) => {
    if (u.id != null) nodes.set(String(u.id), { key: String(u.id), raw: u, children: [] as any[] });
  });
  const roots: any[] = [];
  nodes.forEach((n) => {
    const sup =
      n.raw?.superiorId != null && n.raw?.superiorId !== ''
        ? String(n.raw.superiorId)
        : '';
    if (sup && nodes.has(sup)) nodes.get(sup)?.children.push(n);
    else roots.push(n);
  });
  const prune = (arr: any[]) =>
    arr.forEach((n) => {
      if (!n.children.length) delete n.children;
      else prune(n.children);
    });
  prune(roots);
  return roots;
}

export default OdocReceiveUnitManage;
