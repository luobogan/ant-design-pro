import React, { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Col,
  message,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
} from 'antd';
import {
  deployDefinition,
  getBpmn,
  getFieldPerm,
  listDefinitions,
  listNodes,
  saveFieldPerm,
  WfProcessDefinition,
  WfProcessNode,
  FieldPermItem,
} from '@/services/workflow';
import { fieldDefinitionApi } from '@/services/formmode';
import { useLocation } from '@umijs/max';
import { usePageButtons } from '@/hooks/usePageButtons';
import WorkflowDefFormModal from '@/pages/System/Workflow/components/WorkflowDefFormModal';
import { pickPayload } from '@/utils/utils';

// bpmn-js 是较重的第三方库（带原生依赖），单独懒加载：
// 1) 加快设计页首屏；2) 即便画布模块加载失败，设计页（节点 / 字段权限）仍可正常打开，
//    不至于连带整个页面打不开（此前表现为点击进入后 404）。
const BpmnDesignerLazy = React.lazy(() => import('./BpmnDesigner'));

/**
 * 流程设计器（文档第 7 章 / §6.2）。
 *
 * 一期落地「定义管理 + 节点 + 节点字段权限矩阵」配置闭环，直接对接 blade-workflow 第 6 章接口。
 * 全链路：新建定义 → 录入节点 → 为每个节点配置字段权限矩阵（0隐藏/1只读/2可编辑/3必填）→ 部署。
 *
 * 说明：bpmn-js 画布（文档 §7 推荐的设计器画布）为独立演进项，需引入 bpmn-js + properties-panel
 * 并做后端 BPMN 转换层；本页已打通语义层配置与权限矩阵，画布接入时可复用下方节点/权限接口。
 */

const PERM_OPTIONS = [
  { value: 0, label: '隐藏' },
  { value: 1, label: '只读' },
  { value: 2, label: '可编辑' },
  { value: 3, label: '必填' },
];

const STATUS_TAG = (s?: number) => {
  switch (s) {
    case 0:
      return <Tag color="default">草稿</Tag>;
    case 1:
      return <Tag color="green">已发布</Tag>;
    case 2:
      return <Tag color="red">停用</Tag>;
    default:
      return <Tag>未知</Tag>;
  }
};

const WorkflowDesignPage: React.FC = () => {
  const [defs, setDefs] = useState<WfProcessDefinition[]>([]);
  const [current, setCurrent] = useState<WfProcessDefinition | null>(null);
  const [nodes, setNodes] = useState<WfProcessNode[]>([]);
  const [bpmn, setBpmn] = useState<string>('');
  const [activeNode, setActiveNode] = useState<WfProcessNode | null>(null);
  const [fields, setFields] = useState<{ scope: string; fieldName: string; fieldLabel: string }[]>([]);
  const [permMap, setPermMap] = useState<Record<string, number>>({});
  const [permLoading, setPermLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('config');

  // 按钮 code 门禁：设计页按钮挂在 blade_menu 的 workflow_design 菜单下，由角色授权（blade_role_menu）
  const { buttons: designButtons } = usePageButtons('workflow_design');
  const hasPerm = (code: string) => designButtons.some((b: any) => b.code === code);

  // 支持从「流程设计列表」页创建后跳转进来：/formmode/workflowdesign?defId=xxx
  const location = useLocation();
  const defIdParam = new URLSearchParams(location.search).get('defId');

  const refresh = () => {
    listDefinitions()
      .then((r: any) => setDefs(pickPayload(r) || []))
      .catch(() => message.error('加载流程定义失败'));
  };

  useEffect(() => {
    refresh();
  }, []);

  // 跳转带 defId 时，自动选中该定义并默认打开「流程画布」Tab
  useEffect(() => {
    if (!defIdParam || defs.length === 0) return;
    const target = defs.find((d) => String(d.id) === String(defIdParam));
    if (target) {
      selectDef(target);
      setActiveTab('canvas');
    }
  }, [defs, defIdParam]);

  const selectDef = async (def: WfProcessDefinition) => {
    setCurrent(def);
    setActiveNode(null);
    setBpmn('');
    try {
      const [nodeRes, bpmnRes] = await Promise.all([
        listNodes(def.id!),
        getBpmn(def.id!),
      ]);
      setNodes(pickPayload(nodeRes) || []);
      setBpmn(pickPayload(bpmnRes) || '');
    } catch {
      message.error('加载流程定义失败');
    }
  };

  const openNodePerm = async (node: WfProcessNode) => {
    setActiveNode(node);
    setPermLoading(true);
    try {
      const formId = current?.formId;
      const fieldRes: any = formId ? await fieldDefinitionApi.getByFormId(String(formId)) : { data: [] };
      const fieldList = (fieldRes?.data || []).map((f: any) => {
        // 所属明细表索引（0/null=主表）；B5：scope = main | dt{idx}
        const dt = Number(f.detailTable ?? f.detailtable ?? 0);
        const scope = dt > 0 ? `dt${dt}` : 'main';
        return {
          scope,
          fieldName: f.fieldName || f.fieldDbName,
          fieldLabel: f.fieldLabel || f.fieldName || f.fieldDbName,
        };
      });
      setFields(fieldList);

      const permRes: any = await getFieldPerm(current!.id!, node.nodeKey!);
      const map: Record<string, number> = {};
      (pickPayload(permRes) || []).forEach((p: FieldPermItem) => {
        map[`${p.scope || 'main'}|${p.fieldName}`] = p.perm;
      });
      // 缺省为「可编辑(2)」便于配置
      fieldList.forEach((f) => {
        const k = `${f.scope}|${f.fieldName}`;
        if (map[k] == null) map[k] = 2;
      });
      setPermMap(map);
    } finally {
      setPermLoading(false);
    }
  };

  const savePerm = () => {
    if (!current || !activeNode) return;
    const perms: FieldPermItem[] = fields.map((f) => ({
      scope: f.scope,
      fieldName: f.fieldName,
      perm: (permMap[`${f.scope}|${f.fieldName}`] ?? 2) as 0 | 1 | 2 | 3,
    }));
    saveFieldPerm(current.id!, activeNode.nodeKey!, perms)
      .then((r: any) => {
        if (r?.success) message.success('节点字段权限已保存');
        else message.error('保存失败');
      })
      .catch(() => message.error('保存失败'));
  };

  const handleDeploy = (id?: number) => {
    if (!id) return;
    deployDefinition(id)
      .then((r: any) => (r?.success ? message.success('部署成功') : message.error('部署失败')))
      .catch(() => message.error('部署失败'));
  };

  const permColumns = useMemo(
    () => [
      {
        title: '作用域',
        dataIndex: 'scope',
        key: 'scope',
        width: 100,
        render: (s: string) => (s === 'main' ? '主表' : `明细表${String(s).replace('dt', '')}`),
      },
      { title: '字段名', dataIndex: 'fieldName', key: 'fieldName' },
      { title: '字段标签', dataIndex: 'fieldLabel', key: 'fieldLabel' },
      {
        title: '权限',
        key: 'perm',
        render: (_: any, record: { scope: string; fieldName: string }) => (
          <Select
            size="small"
            style={{ width: 120 }}
            value={permMap[`${record.scope}|${record.fieldName}`] ?? 2}
            options={PERM_OPTIONS}
            onChange={(v) => setPermMap((m) => ({ ...m, [`${record.scope}|${record.fieldName}`]: v }))}
          />
        ),
      },
    ],
    [permMap],
  );

  return (
    <PageContainer
      header={{ title: '流程设计器', subTitle: '定义 / 节点 / 节点字段权限矩阵（对接 blade-workflow）' }}
    >
      <Row gutter={16}>
        <Col span={8}>
          <Card
            title="流程定义"
            extra={
              hasPerm('workflow_design_create') ? (
                <Button type="primary" size="small" onClick={() => setCreateOpen(true)}>
                  新建
                </Button>
              ) : null
            }
          >
            <Table
              rowKey={(r) => String(r.id)}
              size="small"
              dataSource={defs}
              pagination={false}
              onRow={(record) => ({
                onClick: () => selectDef(record),
                style: { cursor: 'pointer', background: current?.id === record.id ? '#e6f7ff' : undefined },
              })}
              columns={[
                { title: '名称', dataIndex: 'name' },
                { title: '版本', dataIndex: 'version', width: 60 },
                { title: '状态', dataIndex: 'status', width: 80, render: (s) => STATUS_TAG(s) },
                {
                  title: '操作',
                  width: 80,
                  render: (_, r) =>
                    hasPerm('workflow_design_deploy') ? (
                      <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); handleDeploy(r.id); }}>
                        部署
                      </Button>
                    ) : null,
                },
              ]}
            />
          </Card>
        </Col>

        <Col span={16}>
          {!current && <Card>请选择左侧流程定义</Card>}
          {current && (
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'config',
                  label: '节点权限配置',
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      <Card title={`节点列表（${current.name}）`}>
                        <Table
                          rowKey={(r) => String(r.id)}
                          size="small"
                          dataSource={nodes}
                          pagination={false}
                          onRow={(record) => ({
                            onClick: () => openNodePerm(record),
                            style: {
                              cursor: 'pointer',
                              background: activeNode?.id === record.id ? '#e6f7ff' : undefined,
                            },
                          })}
                          columns={[
                            { title: '节点', dataIndex: 'nodeName' },
                            { title: 'Key', dataIndex: 'nodeKey' },
                            {
                              title: '审批方式',
                              dataIndex: 'signOrder',
                              render: (v) => ['或签', '会签', '依次', '抄送不需提交', '抄送需提交'][v ?? 0],
                            },
                            {
                              title: '节点类型',
                              dataIndex: 'nodeType',
                              render: (v) => ['创建', '审批', '提交', '归档', '等待', '自动'][v ?? 0],
                            },
                          ]}
                        />
                      </Card>

                      {activeNode && (
                        <Card
                          title={`字段权限矩阵（${activeNode.nodeName}）`}
                          extra={
                            hasPerm('workflow_design_save_perm') ? (
                              <Button type="primary" size="small" loading={permLoading} onClick={savePerm}>
                                保存权限
                              </Button>
                            ) : null
                          }
                        >
                          <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                            主表与各明细表分开展示；明细表按整表（dt 级）授权，动态新增行继承明细表级权限。
                          </div>
                          <Table
                            rowKey={(r: any) => `${r.scope}|${r.fieldName}`}
                            size="small"
                            loading={permLoading}
                            dataSource={fields}
                            pagination={false}
                            columns={permColumns}
                          />
                        </Card>
                      )}
                    </Space>
                  ),
                },
                {
                  key: 'canvas',
                  label: '流程画布',
                  children: (
                    <React.Suspense fallback={<div style={{ padding: 24 }}>画布加载中...</div>}>
                      <BpmnDesignerLazy
                        defId={current.id}
                        procKey={current.procKey}
                        name={current.name}
                        bpmnXml={bpmn}
                        onSaved={() => {
                          if (current?.id != null) {
                            listNodes(current.id)
                              .then((r: any) => setNodes(r?.data || []))
                              .catch(() => {});
                          }
                        }}
                        onDeployed={() => refresh()}
                      />
                    </React.Suspense>
                  ),
                },
              ]}
            />
          )}
        </Col>
      </Row>

      {/* 新增路径（对齐 ecology「添加路径」） */}
      <WorkflowDefFormModal
        open={createOpen}
        mode="add"
        onCancel={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false);
          refresh();
        }}
      />
    </PageContainer>
  );
};

export default WorkflowDesignPage;
