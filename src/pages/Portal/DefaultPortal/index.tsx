import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Select,
  Space,
  Table,
  Tag,
  Tree,
  Typography,
  message,
} from 'antd';
import { DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import * as deptApi from '@/services/system/dept';
import { portalApi } from '@/services/portal';
import type { PortalOrgDefault } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';

const { Title, Text } = Typography;

/**
 * 机构默认首页（对标泛微 defaultportal §13.8）
 *
 * 按机构（部门）指定登录后默认门户：左侧部门树选机构 → 右侧为其指定默认门户页面。
 * 命中规则（后端）：取用户部门祖先链中「最具体」的默认页——配在父机构，其子孙机构同样生效。
 */
const DefaultPortal: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_page_default');

  const [deptTreeRaw, setDeptTreeRaw] = useState<any>([]);
  const [pageList, setPageList] = useState<any[]>([]);
  const [orgList, setOrgList] = useState<PortalOrgDefault[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDeptId, setSelectedDeptId] = useState<string | number | null>(null);
  const [formPageId, setFormPageId] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const normalizeDept = (raw: any): any[] =>
    Array.isArray(raw) ? raw : raw?.data || [];

  const deptTreeData = useMemo(() => {
    const toTree = (nodes: any[]): any[] =>
      (nodes || []).map((n) => ({
        title: n.deptName || n.fullName || n.name || n.title,
        key: n.id ?? n.key,
        value: n.id ?? n.key,
        children: toTree(n.children || []),
      }));
    return toTree(normalizeDept(deptTreeRaw));
  }, [deptTreeRaw]);

  const deptMap = useMemo(() => {
    const map: Record<string, string> = {};
    const walk = (nodes: any[]) => {
      (nodes || []).forEach((n) => {
        map[String(n.id ?? n.key)] = n.deptName || n.fullName || n.name || n.title;
        if (n.children) walk(n.children);
      });
    };
    walk(normalizeDept(deptTreeRaw));
    return map;
  }, [deptTreeRaw]);

  const pageMap = useMemo(() => {
    const map: Record<string, string> = {};
    (pageList || []).forEach((p: any) => {
      map[String(p.id)] = p.pageName;
    });
    return map;
  }, [pageList]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, pageRes, orgRes] = await Promise.all([
        deptApi.treeScope({}),
        portalApi.getPageList(),
        portalApi.getOrgDefaultList(),
      ]);
      setDeptTreeRaw(deptRes);
      setPageList(pageRes || []);
      setOrgList(orgRes || []);
    } catch (e) {
      console.error('[portal] 加载机构默认首页配置失败', e);
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelectDept = (keys: any[]) => {
    const did = keys && keys.length ? keys[0] : null;
    setSelectedDeptId(did);
    const found = orgList.find((o) => String(o.deptId) === String(did));
    setFormPageId(found ? found.pageId : undefined);
  };

  const handleSave = async () => {
    if (selectedDeptId == null || formPageId == null) {
      message.warning('请先选择机构和默认门户');
      return;
    }
    setSaving(true);
    try {
      const ok = await portalApi.setOrgDefault({
        deptId: Number(selectedDeptId),
        pageId: Number(formPageId),
      });
      if (ok) {
        message.success('已保存机构默认首页');
        await load();
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存机构默认首页失败', e);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (deptId?: number | string) => {
    const target = deptId != null ? deptId : selectedDeptId;
    if (target == null) return;
    try {
      const ok = await portalApi.removeOrgDefault(Number(target));
      if (ok) {
        message.success('已清除机构默认首页');
        if (deptId == null) setFormPageId(undefined);
        await load();
      } else {
        message.error('清除失败');
      }
    } catch (e) {
      console.error('[portal] 清除机构默认首页失败', e);
      message.error('清除失败');
    }
  };

  const columns = [
    {
      title: '机构/部门',
      dataIndex: 'deptId',
      render: (v: any) => deptMap[String(v)] || `(${v})`,
    },
    {
      title: '默认门户',
      dataIndex: 'pageId',
      render: (v: any) => pageMap[String(v)] || `(${v})`,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: PortalOrgDefault) =>
        canManage ? (
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleClear(record.deptId)}>
            清除
          </Button>
        ) : null,
    },
  ];

  return (
    <Card
      title="机构默认首页"
      extra={<Text type="secondary">按机构指定登录后默认门户（配在父机构，子孙机构同样生效）</Text>}
    >
      <Space style={{ display: 'flex' }} align="start" size="large">
        <Card size="small" title="组织机构" style={{ width: 320 }}>
          {deptTreeData.length ? (
            <Tree
              treeData={deptTreeData}
              onSelect={handleSelectDept}
              defaultExpandAll
              selectedKeys={selectedDeptId != null ? [selectedDeptId] : []}
            />
          ) : (
            <Empty description="暂无部门数据" />
          )}
        </Card>
        <Card size="small" title="为所选机构设置默认首页" style={{ width: 420 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              当前机构：
              <Text strong>
                {selectedDeptId != null ? deptMap[String(selectedDeptId)] || selectedDeptId : '未选择'}
              </Text>
            </div>
            <div>
              <Text type="secondary">默认门户：</Text>
              <Select
                style={{ width: 240 }}
                placeholder="请选择门户页面"
                value={formPageId}
                disabled={!canManage}
                onChange={(v) => setFormPageId(v)}
                options={(pageList || []).map((p: any) => ({ label: p.pageName, value: p.id }))}
              />
            </div>
            {canManage ? (
              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  disabled={selectedDeptId == null}
                  onClick={handleSave}
                >
                  保存
                </Button>
                <Button
                  danger
                  disabled={selectedDeptId == null || formPageId === undefined}
                  onClick={() => handleClear()}
                >
                  清除
                </Button>
              </Space>
            ) : (
              <Text type="secondary">无配置权限</Text>
            )}
          </Space>
        </Card>
      </Space>

      <Title level={5} style={{ marginTop: 24 }}>
        已配置的机构默认首页
      </Title>
      <Table
        rowKey={(r) => String(r.deptId)}
        loading={loading}
        dataSource={orgList}
        columns={columns}
        pagination={false}
        size="small"
      />
    </Card>
  );
};

export default DefaultPortal;
