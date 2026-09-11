import React, { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Descriptions,
  message,
  Modal,
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
  saveAsNewVersion,
  workflowBrowserApi,
  WfProcessDefinition,
  WfProcessNode,
  FieldPermItem,
} from '@/services/workflow';
import { fieldDefinitionApi, workflowBillApi } from '@/services/formmode';
import { useLocation } from '@umijs/max';
import { usePageButtons } from '@/hooks/usePageButtons';
import WorkflowDefForm from '@/pages/System/Workflow/components/WorkflowDefForm';
import TableDesign from '@/pages/FormMode/TableDesign/TableDesign';
import { pickPayload } from '@/utils/utils';

// bpmn-js 是较重的第三方库（带原生依赖），单独懒加载，避免拖累设计页首屏
const BpmnDesignerLazy = React.lazy(() => import('./BpmnDesigner'));

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

const SIGN_ORDER = ['或签', '会签', '依次', '抄送不需提交', '抄送需提交'];
const NODE_TYPE = ['创建', '审批', '提交', '归档', '等待', '自动'];

const WorkflowDesignPage: React.FC = () => {
  const [defs, setDefs] = useState<WfProcessDefinition[]>([]);
  const [current, setCurrent] = useState<WfProcessDefinition | null>(null);
  const [nodes, setNodes] = useState<WfProcessNode[]>([]);
  const [bpmn, setBpmn] = useState<string>('');
  const [activeNode, setActiveNode] = useState<WfProcessNode | null>(null);
  const [fields, setFields] = useState<{ scope: string; fieldName: string; fieldLabel: string }[]>([]);
  const [permMap, setPermMap] = useState<Record<string, number>>({});
  const [permLoading, setPermLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('processCard');

  // 流程卡片：解析路径类型(formmode 名)与表单名
  const [metaLabels, setMetaLabels] = useState<{ wftype?: string; formName?: string }>({});
  // 表单管理：当前表单的字段结构
  const [formFieldList, setFormFieldList] = useState<{ scope: string; fieldName: string; fieldLabel: string }[]>([]);
  const [formDesignOpen, setFormDesignOpen] = useState(false);
  const [formDesignId, setFormDesignId] = useState<string>('');
  const [formRefresh, setFormRefresh] = useState(0);

  const { buttons: designButtons } = usePageButtons('workflow_design');
  const hasPerm = (code: string) => designButtons.some((b: any) => b.code === code);

  const location = useLocation();
  const defIdParam = new URLSearchParams(location.search).get('defId');

  const refresh = () => {
    listDefinitions()
      .then((r: any) => setDefs(pickPayload(r) || []))
      .catch(() => message.error('加载流程定义失败'));
  };

  const reloadCurrent = () => {
    if (!current?.id) return;
    listDefinitions()
      .then((r: any) => {
        const list = pickPayload(r) || [];
        setDefs(list);
        const next = list.find((d: any) => String(d.id) === String(current.id));
        if (next) {
          setCurrent(next);
          loadMeta(next);
        }
      })
      .catch(() => {});
  };

  // 解析路径类型名 / 表单名用于卡片展示
  const loadMeta = async (def: WfProcessDefinition) => {
    try {
      const [wtRes, billRes]: any = await Promise.all([
        workflowBrowserApi.list('wftype'),
        def.formId != null ? workflowBillApi.getById(String(def.formId)) : Promise.resolve(null),
      ]);
      const wtList = pickPayload(wtRes) || [];
      const wtLabel = wtList.find((w: any) => String(w.value) === String(def.type))?.label;
      const bill = billRes?.data ?? billRes;
      const formName = bill ? bill.formName || bill.tableName || bill.name : undefined;
      setMetaLabels({ wftype: wtLabel, formName });
    } catch {
      /* 标签解析失败不影响主流程 */
    }
  };

  const selectDef = async (def: WfProcessDefinition) => {
    setCurrent(def);
    setActiveNode(null);
    setBpmn('');
    setMetaLabels({});
    loadMeta(def);
    try {
      const [nodeRes, bpmnRes] = await Promise.all([listNodes(def.id!), getBpmn(def.id!)]);
      setNodes(pickPayload(nodeRes) || []);
      setBpmn(pickPayload(bpmnRes) || '');
    } catch {
      message.error('加载流程定义失败');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  // 跳转带 defId 时，自动选中该定义并默认打开「流转设置」Tab（进入设计）
  useEffect(() => {
    if (!defIdParam || defs.length === 0) return;
    const target = defs.find((d) => String(d.id) === String(defIdParam));
    if (target) {
      selectDef(target);
      setActiveTab('flow');
    }
  }, [defs, defIdParam]);

  // 选中定义变化时，加载表单字段结构（表单管理页签用）
  useEffect(() => {
    if (!current?.formId) {
      setFormFieldList([]);
      return;
    }
    fieldDefinitionApi
      .getByFormId(String(current.formId))
      .then((r: any) => {
        const list = (r?.data || []).map((f: any) => {
          const dt = Number(f.detailTable ?? f.detailtable ?? 0);
          const scope = dt > 0 ? `dt${dt}` : 'main';
          return {
            scope,
            fieldName: f.fieldName || f.fieldDbName,
            fieldLabel: f.fieldLabel || f.fieldName || f.fieldDbName,
          };
        });
        setFormFieldList(list);
      })
      .catch(() => setFormFieldList([]));
  }, [current?.id, current?.formId]);

  const openNodePerm = async (node: WfProcessNode) => {
    setActiveNode(node);
    setPermLoading(true);
    try {
      const formId = current?.formId;
      const fieldRes: any = formId ? await fieldDefinitionApi.getByFormId(String(formId)) : { data: [] };
      const fieldList = (fieldRes?.data || []).map((f: any) => {
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

  const handleDeploy = (id?: string | number) => {
    if (!id) return;
    deployDefinition(id as any)
      .then((r: any) => (r?.success ? message.success('部署成功') : message.error('部署失败')))
      .catch(() => message.error('部署失败'));
  };

  const handleSaveAsNewVersion = (id: string | number) => {
    saveAsNewVersion(id as any)
      .then((r: any) => {
        if (r?.success) {
          message.success('已生成新版本');
          refresh();
        } else message.error('另存为新版本失败');
      })
      .catch(() => message.error('另存为新版本失败'));
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

  const renderProcessCard = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Card title="流程卡片">
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="流程名称">{current?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">{STATUS_TAG(current?.status)}</Descriptions.Item>
          <Descriptions.Item label="版本">v{current?.version ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="流程标识(procKey)">{current?.procKey || '-'}</Descriptions.Item>
          <Descriptions.Item label="路径类型">{metaLabels.wftype || current?.type || '-'}</Descriptions.Item>
          <Descriptions.Item label="对应表单">{metaLabels.formName || current?.formId || '未绑定'}</Descriptions.Item>
          <Descriptions.Item label="节点数">{nodes.length}</Descriptions.Item>
          <Descriptions.Item label="排序">{current?.sortOrder ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {current?.description || '暂无描述'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Space>
        <Button type="primary" onClick={() => setActiveTab('basic')}>
          编辑基础设置
        </Button>
        <Button onClick={() => setActiveTab('flow')}>打开流程画布</Button>
        {hasPerm('workflow_design_deploy') && (
          <Button onClick={() => handleDeploy(current?.id)}>部署</Button>
        )}
      </Space>
    </Space>
  );

  const renderBasic = () => (
    <Card title="基础设置">
      {current && (
        <WorkflowDefForm
          key={`${current.id}-${formRefresh}`}
          mode="edit"
          initialValues={current}
          onSaved={() => {
            setFormRefresh((f) => f + 1);
            reloadCurrent();
          }}
          onSaveAsNewVersion={(id) => handleSaveAsNewVersion(id)}
        />
      )}
    </Card>
  );

  const renderFormManage = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Card
        title="表单管理"
        extra={
          current?.formId ? (
            <Space>
              <Button
                onClick={() => {
                  setFormDesignId(String(current.formId));
                  setFormDesignOpen(true);
                }}
              >
                配置字段
              </Button>
              <Button type="link" onClick={() => setActiveTab('basic')}>
                更换表单 »
              </Button>
            </Space>
          ) : (
            <Button type="link" onClick={() => setActiveTab('basic')}>
              去基础设置选择表单 »
            </Button>
          )
        }
      >
        {!current?.formId ? (
          <div style={{ color: '#999' }}>当前流程尚未绑定表单，请到「基础设置」选择对应表单。</div>
        ) : (
          <Table
            rowKey={(r: any) => `${r.scope}|${r.fieldName}`}
            size="small"
            dataSource={formFieldList}
            pagination={false}
            columns={[
              {
                title: '作用域',
                dataIndex: 'scope',
                width: 120,
                render: (s: string) => (s === 'main' ? '主表' : `明细表${String(s).replace('dt', '')}`),
              },
              { title: '字段名', dataIndex: 'fieldName' },
              { title: '字段标签', dataIndex: 'fieldLabel' },
            ]}
          />
        )}
      </Card>
    </Space>
  );

  const renderFlow = () => (
    <React.Suspense fallback={<div style={{ padding: 24 }}>画布加载中...</div>}>
      <BpmnDesignerLazy
        defId={current!.id}
        procKey={current!.procKey}
        name={current!.name}
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
  );

  const renderAdvanced = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Card
        title={`节点列表（${current?.name}）`}
        extra={
          hasPerm('workflow_design_deploy') ? (
            <Button type="primary" size="small" onClick={() => handleDeploy(current?.id)}>
              部署
            </Button>
          ) : null
        }
      >
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
            { title: '审批方式', dataIndex: 'signOrder', render: (v) => SIGN_ORDER[v ?? 0] },
            { title: '节点类型', dataIndex: 'nodeType', render: (v) => NODE_TYPE[v ?? 0] },
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
  );

  return (
    <PageContainer
      header={{ title: '流程设计器', subTitle: '定义 / 节点 / 字段权限 / 表单（对接 blade-workflow）' }}
    >
      {current ? (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'processCard', label: '流程卡片', children: renderProcessCard() },
            { key: 'basic', label: '基础设置', children: renderBasic() },
            { key: 'formManage', label: '表单管理', children: renderFormManage() },
            { key: 'flow', label: '流转设置', children: renderFlow() },
            { key: 'advanced', label: '高级设置', children: renderAdvanced() },
          ]}
        />
      ) : (
        <Card>请先从流程列表点击一条流程进入设计</Card>
      )}

      {/* 表单管理：配置字段（内嵌表设计器，不打开新页签） */}
      <Modal
        title="配置字段"
        open={formDesignOpen}
        onCancel={() => setFormDesignOpen(false)}
        width="90vw"
        style={{ top: 24 }}
        styles={{ body: { height: '78vh', padding: 0 } }}
        footer={null}
        destroyOnClose
      >
        {formDesignOpen && formDesignId ? (
          <TableDesign
            formId={formDesignId}
            embedded
            onClose={() => setFormDesignOpen(false)}
            onSaved={() => {
              setFormDesignOpen(false);
              // 表单结构变化，刷新表单管理页签的字段列表
              if (current?.formId) {
                fieldDefinitionApi.getByFormId(String(current.formId)).then((r: any) => {
                  setFormFieldList(
                    (r?.data || []).map((f: any) => {
                      const dt = Number(f.detailTable ?? f.detailtable ?? 0);
                      return {
                        scope: dt > 0 ? `dt${dt}` : 'main',
                        fieldName: f.fieldName || f.fieldDbName,
                        fieldLabel: f.fieldLabel || f.fieldName || f.fieldDbName,
                      };
                    }),
                  );
                });
              }
            }}
          />
        ) : null}
      </Modal>
    </PageContainer>
  );
};

export default WorkflowDesignPage;
