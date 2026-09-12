import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Descriptions, message, Modal, Space, Table, Tag, Tabs } from 'antd';
import {
  deployDefinition,
  getBpmn,
  listDefinitions,
  listLinks,
  listNodes,
  saveAsNewVersion,
  updateNode,
  configOperator,
  workflowBrowserApi,
  WfNodeLink,
  WfProcessDefinition,
  WfProcessNode,
  WfNodeOperator,
} from '@/services/workflow';
import { fieldDefinitionApi, workflowBillApi } from '@/services/formmode';
import { useLocation } from '@umijs/max';
import { usePageButtons } from '@/hooks/usePageButtons';
import WorkflowDefForm from '@/pages/System/Workflow/components/WorkflowDefForm';
import TableDesign from '@/pages/FormMode/TableDesign/TableDesign';
import NodeInfoPanel from './NodeInfoPanel';
import { configuredBadges } from './nodeSettings';
import LinkInfoPanel from './LinkInfoPanel';
// 「定位并高亮」指令类型：type-only import，运行时被擦除，不影响画布的懒加载
import type { FocusEvt } from './BpmnDesigner';
import './workflowDesign.css';
// Excel 设计器（Univer 较重）按需懒加载，避免拖累设计页首屏
const ExcelDesignLazy = React.lazy(() => import('@/pages/FormMode/ExcelDesign/ExcelDesign'));
import { pickPayload } from '@/utils/utils';

// bpmn-js 是较重的第三方库（带原生依赖），单独懒加载，避免拖累设计页首屏
const BpmnDesignerLazy = React.lazy(() => import('./BpmnDesigner'));

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
  const [links, setLinks] = useState<WfNodeLink[]>([]);
  const [bpmn, setBpmn] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('processCard');

  // 流转设置：图形编辑 / 节点信息 / 出口信息 三平级页签，共享选中节点联动
  const [flowSubTab, setFlowSubTab] = useState<string>('canvas');
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | undefined>();
  // 外部→画布同步信号
  const [renameEvt, setRenameEvt] = useState<{ seq: number; nodeKey: string; name: string } | undefined>();
  const [linkCmd, setLinkCmd] = useState<
    | { seq: number; type: 'add' | 'delete' | 'move'; from: string; to: string; oldTo?: string }
    | undefined
  >();
  // 画布上选中的那条出口（点连线同步进来），驱动「出口信息」的当前出口详情卡
  const [selectedLink, setSelectedLink] = useState<{ from: string; to: string } | undefined>();
  // 列表 → 画布：定位并高亮（seq 递增，保证对同一目标可重复触发）
  const [focusEvt, setFocusEvt] = useState<FocusEvt | undefined>();
  // 画布批量新增信号（seq 递增触发 BpmnDesigner 追加形状）
  const [createNodesEvt, setCreateNodesEvt] = useState<
    {
      seq: number;
      nodes: {
        nodeName: string;
        nodeType: number;
        operators?: WfNodeOperator[];
        extJson?: string;
      }[];
    } | undefined
  >();
  /**
   * 触发「画布批量新增节点」。list 已含草稿期间填好的 operators / extJson，
   * 画布建形状并 saveBpmn 后，由 onNodesCreated 把这些信息一并落库。
   * ⚠️ seq 必须用**自增计数器**而不是 Date.now()：BpmnDesigner 的 effect 依赖
   * `[createNodesEvt?.seq]`，同一毫秒内（或值未变时）seq 相同 → effect 不重跑 →
   * 表现为「点第二次没反应」。自增保证每次触发都是新值。
   */
  const createSeqRef = useRef(0);
  const fireCreateNodes = (
    list: {
      nodeName: string;
      nodeType: number;
      operators?: WfNodeOperator[];
      extJson?: string;
    }[],
  ) => {
    createSeqRef.current += 1;
    setCreateNodesEvt({ seq: createSeqRef.current, nodes: list });
  };

  // 流程卡片：解析路径类型(formmode 名)与表单名
  const [metaLabels, setMetaLabels] = useState<{ wftype?: string; formName?: string }>({});
  // 表单管理：当前表单的字段结构
  const [formFieldList, setFormFieldList] = useState<{ scope: string; fieldName: string; fieldLabel: string }[]>([]);
  const [formDesignOpen, setFormDesignOpen] = useState(false);
  const [formDesignId, setFormDesignId] = useState<string>('');
  const [formRefresh, setFormRefresh] = useState(0);

  // 生成表单布局：节点级 Excel 布局设计器弹窗（布局绑定 nodeKey）
  const [excelDesignOpen, setExcelDesignOpen] = useState(false);
  const [excelDesignNodeKey, setExcelDesignNodeKey] = useState<string | undefined>();

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
    setSelectedNodeKey(undefined);
    setBpmn('');
    setMetaLabels({});
    loadMeta(def);
    try {
      const [nodeRes, linkRes, bpmnRes] = await Promise.all([
        listNodes(def.id!),
        listLinks(def.id!),
        getBpmn(def.id!),
      ]);
      setNodes(pickPayload(nodeRes) || []);
      setLinks(pickPayload(linkRes) || []);
      setBpmn(pickPayload(bpmnRes) || '');
    } catch {
      message.error('加载流程定义失败');
    }
  };

  const refreshNodes = () => {
    if (current?.id == null) return;
    listNodes(current.id)
      .then((r: any) => setNodes(pickPayload(r) || []))
      .catch(() => {});
  };

  const refreshLinks = () => {
    if (current?.id == null) return;
    listLinks(current.id)
      .then((r: any) => setLinks(pickPayload(r) || []))
      .catch(() => {});
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

  // 打开节点信息页签（供节点列表行点击复用）
  const openNodePanel = (nodeKey?: string) => {
    setSelectedNodeKey(nodeKey);
    setActiveTab('flow');
    setFlowSubTab('node');
  };

  // 列表 → 画布：切到「图形编辑」并把画布居中、闪烁高亮到该节点 / 该连线
  const locateNode = (nodeKey: string) => {
    setActiveTab('flow');
    setFlowSubTab('canvas');
    setFocusEvt({ seq: Date.now(), nodeKey });
  };
  const locateLink = (from: string, to: string) => {
    setActiveTab('flow');
    setFlowSubTab('canvas');
    setFocusEvt({ seq: Date.now(), link: { from, to } });
  };

  // 画布批量新增完成：特殊类型(2/5/6)画布只产出 0/1/3，需回写真实 nodeType；
  // 草稿期间填好的操作者 / 设置项也在此一并落库，再刷新列表。
  const handleNodesCreated = (
    created: {
      nodeKey: string;
      nodeType: number;
      operators?: WfNodeOperator[];
      extJson?: string;
    }[],
  ) => {
    if (!current?.id) return;
    const tasks: Promise<any>[] = [];
    created.forEach((c) => {
      // 特殊类型（2/5/6）画布只产出 0/1/3，需回写真实 nodeType
      if (c.nodeType !== 0 && c.nodeType !== 1 && c.nodeType !== 3) {
        tasks.push(updateNode(current.id, c.nodeKey, { nodeType: c.nodeType }));
      }
      // 草稿期间填好的操作者
      if (c.operators && c.operators.length) {
        tasks.push(configOperator(current.id, c.nodeKey, c.operators));
      }
      // 草稿期间填好的设置项（操作菜单/表单内容/前后附加操作/7 个设置项等）
      if (c.extJson) {
        tasks.push(updateNode(current.id, c.nodeKey, { extJson: c.extJson }));
      }
    });
    Promise.all(tasks)
      .catch(() => {})
      .finally(() => {
        refreshNodes();
        refreshLinks();
      });
  };

  // 画布设置项角标：把每个节点「已配置的设置项」映射成短标签，交给画布在节点右上角标注
  // （useMemo：仅当节点数据变化时才产生新对象，避免父级每次渲染都触发画布叠加层重绘）
  const nodeBadges = useMemo(
    () =>
      nodes.reduce<Record<string, string[]>>((acc, n) => {
        const b = configuredBadges(n);
        if (b.length) acc[n.nodeKey] = b;
        return acc;
      }, {}),
    [nodes],
  );

  const renderCanvas = () => (
    <React.Suspense fallback={<div style={{ padding: 24 }}>画布加载中...</div>}>
      <BpmnDesignerLazy
        defId={current!.id}
        procKey={current!.procKey}
        name={current!.name}
        bpmnXml={bpmn}
        // 只同步选中项，**不切页签**（点节点只在画布上高亮，由用户自己点页签查看），
        // 否则编辑态下每选一次就被弹走，没法在画布上连续操作。
        onSelectNode={(k) => setSelectedNodeKey(k)}
        onSelectLink={(from, to) => setSelectedLink({ from, to })}
        renameNode={renameEvt}
        linkCommand={linkCmd}
        focusEvt={focusEvt}
        createNodesEvt={createNodesEvt}
        onNodesCreated={handleNodesCreated}
        nodeBadges={nodeBadges}
        onSaved={() => {
          refreshNodes();
          refreshLinks();
          // 保存后节点可能被删除，选中态可能指向已删 key → 顺手清空（文档 §6.5-7）
          setSelectedNodeKey(undefined);
        }}
        onDeployed={() => refresh()}
      />
    </React.Suspense>
  );

  // 流转设置：图形编辑 / 节点信息 / 出口信息 三个平级页签，选中节点三处联动。
  // · 画布页签「保持挂载」：rc-tabs 只在首次激活时挂载、之后切走不销毁（仅 display:none），
  //   所以来回切页签不会重建 modeler、不丢缩放/编辑态；默认停在画布页签，首帧即有真实尺寸，
  //   导入后的 fit-viewport 才准。
  // · 隐藏期间容器尺寸归零，切回时由 BpmnDesigner 内的 ResizeObserver 调 canvas.resized() 修正。
  // · 表单类页签限制最大宽度，避免在宽屏下单列表单被拉得过长。
  const PANEL_BOX = { maxWidth: 960, maxHeight: '72vh', overflow: 'auto' } as const;
  // 节点信息是可编辑宽表（13 列）：宽度撑满容器（不再写死上限），
  // 列宽由表格按内容给出 + scroll.x 横向滚动；高度由表格内部 scroll.y 自适应。
  const NODE_BOX = { width: '100%', maxHeight: '72vh', overflow: 'auto' } as const;
  const renderFlow = () => (
    <Tabs
      size="small"
      activeKey={flowSubTab}
      onChange={setFlowSubTab}
      items={[
        {
          key: 'canvas',
          label: '图形编辑',
          children: renderCanvas(),
        },
        {
          key: 'node',
          label: '节点信息',
          children: (
            <div style={NODE_BOX}>
              <NodeInfoPanel
                defId={current!.id}
                nodes={nodes}
                selectedNodeKey={selectedNodeKey}
                onSelect={(k) => setSelectedNodeKey(k)}
                formFields={formFieldList}
                formId={current?.formId ? String(current.formId) : undefined}
                formName={metaLabels.formName}
                onLocate={locateNode}
                onCreateNodes={(list) => fireCreateNodes(list)}
                // 写库成功后只就地更新该节点，不做整表 refresh → 不闪动、不丢滚动位置
                onPatch={(nodeKey, patch) =>
                  setNodes((prev) =>
                    prev.map((n) => (n.nodeKey === nodeKey ? { ...n, ...patch } : n)),
                  )
                }
                onGenerateLayout={(nk) => {
                  setExcelDesignNodeKey(nk);
                  setExcelDesignOpen(true);
                }}
                // 名称改动回写画布节点标签（沿用既有 renameEvt 通道）
                onSaved={(nodeKey, name) => setRenameEvt({ seq: Date.now(), nodeKey, name })}
              />
            </div>
          ),
        },
        {
          key: 'link',
          label: '出口信息',
          children: (
            <div style={PANEL_BOX}>
              <LinkInfoPanel
                defId={current!.id}
                nodes={nodes}
                links={links}
                selectedNodeKey={selectedNodeKey}
                selectedLink={selectedLink}
                onSelect={setSelectedNodeKey}
                formFields={formFieldList}
                onLocate={locateLink}
                onPatch={(linkId, patch) =>
                  setLinks((prev) =>
                    prev.map((l) => (l.id === linkId ? { ...l, ...patch } : l)),
                  )
                }
                onChanged={(change) => {
                  refreshLinks();
                  if (change) setLinkCmd({ seq: Date.now(), ...change });
                }}
              />
            </div>
          ),
        },
      ]}
    />
  );

  const renderAdvanced = () => (
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
      <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
        点击节点行可在「流转设置 → 节点信息」中编辑该节点；字段权限矩阵同样在节点信息页签维护。
      </div>
      <Table
        rowKey={(r) => String(r.id)}
        size="small"
        dataSource={nodes}
        pagination={false}
        onRow={(record) => ({
          onClick: () => openNodePanel(record.nodeKey),
          style: { cursor: 'pointer' },
        })}
        columns={[
          { title: '节点', dataIndex: 'nodeName' },
          { title: 'Key', dataIndex: 'nodeKey' },
          { title: '审批方式', dataIndex: 'signOrder', render: (v) => SIGN_ORDER[v ?? 0] },
          { title: '节点类型', dataIndex: 'nodeType', render: (v) => NODE_TYPE[v ?? 0] },
        ]}
      />
    </Card>
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

      {/* 生成表单布局：节点级 Excel 布局设计器（Modal 内嵌完整 Univer 设计器，布局按 nodeKey 隔离） */}
      <Modal
        title={`生成表单布局（节点：${excelDesignNodeKey ?? ''}）`}
        open={excelDesignOpen}
        onCancel={() => setExcelDesignOpen(false)}
        width="92vw"
        style={{ top: 24 }}
        styles={{ body: { height: '82vh', padding: 0 } }}
        footer={null}
        destroyOnClose
      >
        {excelDesignOpen && excelDesignNodeKey && current?.formId ? (
          <React.Suspense fallback={<div style={{ padding: 24 }}>设计器加载中...</div>}>
            <ExcelDesignLazy
              formId={current.formId ? String(current.formId) : undefined}
              formName={metaLabels.formName}
              nodeKey={excelDesignNodeKey}
              embedded
            />
          </React.Suspense>
        ) : null}
      </Modal>

    </PageContainer>
  );
};

export default WorkflowDesignPage;
