import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history, useRequest } from '@umijs/max';
import { Button, message, Modal, Tag, Upload, Input, Space } from 'antd';
import React, { useMemo, useState, useRef } from 'react';
import * as workflowApi from '@/services/workflow';
import { workflowBrowserApi, FormFieldOption } from '@/services/workflow';
import { usePageButtons } from '@/hooks/usePageButtons';
import WorkflowDefFormModal from './components/WorkflowDefFormModal';

/**
 * 流程设计（流程定义）列表页。
 * 与 System 下其它模块（Dict/Menu）保持同一套写法：模块文件夹 + 同名组件 + PageContainer/ProTable。
 * 数据复用 @/services/workflow（blade-workflow 第 6 章：流程定义/节点/权限）。
 */
interface WorkflowDef {
  id?: number;
  procKey?: string;
  formId?: number | string;
  name?: string;
  version?: number;
  status?: number; // 0草稿 1已发布 3测试
  isFree?: number;
  type?: string;
  formType?: number;
  description?: string;
  sortOrder?: number;
  activeVersionId?: number | string;
}

const STATUS_TAG = (s?: number) => {
  switch (s) {
    case 1:
      return <Tag color="green">已发布</Tag>;
    case 3:
      return <Tag color="blue">测试</Tag>;
    default:
      return <Tag>草稿</Tag>;
  }
};

const Workflow: React.FC = () => {
  const [addVisible, setAddVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [viewVisible, setViewVisible] = useState(false);
  const [current, setCurrent] = useState<WorkflowDef | null>(null);

  // 导入 BPMN（调用后端 /definition/import，新建草稿定义并自动配置节点/操作者/权限）
  const [importOpen, setImportOpen] = useState(false);
  const [importName, setImportName] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  // 表格实例引用：导入成功后重置搜索条件（避免客户端 search 过滤把新行挡掉）
  const actionRef = useRef<any>(null);

  // 列表：全局拦截器返回 ApiResponse 包装体，用 data?.data 取数组（兼容后端直接返回数组的情况）
  const { data, loading, refresh } = useRequest(() => workflowApi.listDefinitions());
  const allDefs: WorkflowDef[] = Array.isArray(data) ? data : (data?.data || []);
  // 每个流程（同 procKey 版本组）仅展示「当前激活版本」那一行：
  // 锚点 = activeVersionId 非空且非 -1 则取其值，否则为自身 id；仅保留 id 与锚点相等的记录。
  // ⚠️ 不要对 activeVersionId 做 Number() 转换：19 位雪花 ID 经 JSON 可能为字符串，
  //    Number() 会丢失精度导致锚点与原 id 比对不相等，把已激活的发布/测试行整行丢弃。
  // ⚠️ activeVersionId 可能为 -1：导入草稿时 Java 侧 setActiveVersionId(null)，但 MyBatis-Plus 插入策略
  //    跳过 null 字段，落到库默认值 -1；此时 -1 并非有效锚点，应视为「单版本流程、锚点=自身」，
  //    否则导入的草稿会被这条过滤规则整行丢弃，列表看不到（见 /definition/import 导入链路）。
  const defs = useMemo<WorkflowDef[]>(() => {
    const map = new Map<string, WorkflowDef>();
    for (const d of allDefs) {
      const av = d.activeVersionId;
      const isSelfAnchor = av == null || av === -1 || av === '-1';
      const anchor = isSelfAnchor ? d.id : av;
      if (String(anchor) === String(d.id)) {
        map.set(String(anchor), d);
      }
    }
    return Array.from(map.values());
  }, [allDefs]);
  const { buttons: pageButtons } = usePageButtons();
  // 按钮 code 门禁：与后端 workflow 角色门禁口径一致（菜单/按钮由 blade_role_menu 按角色授权）
  const hasPerm = (code: string) => pageButtons.some((b: any) => b.code === code);

  // 路径类型（wftype）反查：一次拉全量后建 id->名称 映射，避免 N+1
  const { data: typeData } = useRequest(() => workflowBrowserApi.list('wftype'));
  const typeOptions: FormFieldOption[] = Array.isArray(typeData)
    ? typeData
    : (typeData?.data || []);
  const typeMap = useMemo(() => {
    const m: Record<string, string> = {};
    typeOptions.forEach((o) => {
      m[String(o.value)] = (o.label as string) || '';
    });
    return m;
  }, [typeOptions]);

  const columns: ProColumns<WorkflowDef>[] = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '流程名称', dataIndex: 'name', key: 'name', search: true, width: 160 },
    { title: '流程Key', dataIndex: 'procKey', key: 'procKey', search: true, width: 160 },
    {
      title: '路径类型',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (_, r) => (r.type ? (typeMap[r.type] || r.type) : '-'),
    },
    { title: '关联表单ID', dataIndex: 'formId', key: 'formId', width: 120 },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (_, r) => STATUS_TAG(r.status),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: WorkflowDef) => (
        <>
          {hasPerm('workflow_view') && (
            <Button
              type="link"
              onClick={() => {
                setCurrent(record);
                setViewVisible(true);
              }}
            >
              查看
            </Button>
          )}
          {hasPerm('workflow_edit') && (
            <Button
              type="link"
              onClick={() => {
                setCurrent(record);
                setEditVisible(true);
              }}
            >
              编辑
            </Button>
          )}
          {hasPerm('workflow_deploy') && (
            <Button type="link" onClick={() => handlePublish(record)}>
              发布
            </Button>
          )}
          {hasPerm('workflow_deploy') && (
            <Button type="link" onClick={() => handleTest(record)}>
              测试
            </Button>
          )}
          {hasPerm('workflow_enable') && (record.status === 1 || record.status === 3) && (
            <Button type="link" danger onClick={() => handleWithdraw(record)}>
              撤回
            </Button>
          )}
          {hasPerm('workflow_design') && (
            <Button type="link" onClick={() => history.push(`/formmode/workflowdesign?defId=${record.id}`)}>
              进入设计
            </Button>
          )}
          {hasPerm('workflow_delete') && (
            <Button type="link" danger onClick={() => handleRemove(record)}>
              删除
            </Button>
          )}
        </>
      ),
    },
  ];

  const handlePublish = (r: WorkflowDef) => {
    Modal.confirm({
      title: '确认发布',
      content: `确定要发布流程「${r.name}」吗？（将部署到引擎并置为已发布）`,
      onOk: async () => {
        try {
          await workflowApi.deployDefinition(r.id!);
          message.success('发布成功');
          refresh();
        } catch {
          message.error('发布失败');
        }
      },
    });
  };

  const handleTest = (r: WorkflowDef) => {
    Modal.confirm({
      title: '确认测试发布',
      content: `确定将流程「${r.name}」部署到测试引擎并置为测试态吗？`,
      onOk: async () => {
        try {
          await workflowApi.testDefinition(r.id!);
          message.success('已设为测试态');
          refresh();
        } catch {
          message.error('操作失败');
        }
      },
    });
  };

  const handleWithdraw = (r: WorkflowDef) => {
    Modal.confirm({
      title: '确认撤回',
      content: `确定将流程「${r.name}」撤回为草稿并下线引擎部署吗？`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await workflowApi.withdrawDefinition(r.id!);
          message.success('已撤回为草稿');
          refresh();
        } catch {
          message.error('操作失败');
        }
      },
    });
  };

  const handleRemove = (r: WorkflowDef) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除流程「${r.name}」（版本 v${r.version}）吗？将级联清理节点、出口、操作者、权限与布局。`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await workflowApi.removeDefinition(r.id!);
          message.success('删除成功');
          refresh();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  // 选择本地 BPMN 文件：读文本存起来（阻止自动上传，由「导入」按钮统一提交）
  const handleImportFile = (file: any) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result));
      setImportFileName(file.name);
    };
    reader.readAsText(file);
    return false;
  };

  const handleImportOk = async () => {
    if (!importText) {
      message.warning('请先选择 BPMN 文件');
      return;
    }
    setImporting(true);
    try {
      const res = await workflowApi.importDefinition({ name: importName, bpmnXml: importText });
      if (res?.success) {
        message.success('导入成功' + (res.data ? `（defId=${res.data}）` : ''));
        setImportOpen(false);
        setImportName('');
        setImportText('');
        setImportFileName('');
        refresh();
        // 重置表格搜索条件，避免"流程名称/流程Key"关键字过滤把新导入的行挡在客户端之外
        setTimeout(() => actionRef.current?.reset?.(), 0);
      } else {
        message.error('导入失败：' + (res?.msg || '未知错误'));
      }
    } catch {
      message.error('导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleSaveAsNewVersion = async (id: number) => {
    try {
      await workflowApi.saveAsNewVersion(id);
      message.success('已生成新版本');
      setEditVisible(false);
      refresh();
    } catch {
      message.error('另存失败');
    }
  };

  return (
    <PageContainer
      title="流程设计"
      subTitle="流程定义管理（对接 blade-workflow：新建 / 部署 / 启用 / 停用 / 字段权限）"
    >
      <ProTable
        actionRef={actionRef}
        columns={columns}
        dataSource={defs}
        loading={loading}
        rowKey={(r) => String(r.id)}
        pagination={{ pageSize: 10 }}
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          ...(hasPerm('workflow_add')
            ? [
                <Button
                  key="add"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setAddVisible(true)}
                >
                  新增
                </Button>,
              ]
            : []),
          <Button
            key="import"
            icon={<UploadOutlined />}
            onClick={() => setImportOpen(true)}
          >
            导入
          </Button>,
          <Button key="refresh" onClick={refresh}>
            刷新
          </Button>,
        ]}
      />

      {/* 新增 / 编辑路径（对齐 ecology「添加路径」） */}
      <WorkflowDefFormModal
        open={addVisible}
        mode="add"
        onCancel={() => setAddVisible(false)}
        onSaved={() => {
          setAddVisible(false);
          refresh();
        }}
        onEnterDesign={(id) => {
          setAddVisible(false);
          refresh();
          if (id != null) history.push(`/formmode/workflowdesign?defId=${id}`);
        }}
      />
      <WorkflowDefFormModal
        open={editVisible}
        mode="edit"
        initialValues={current || {}}
        onCancel={() => setEditVisible(false)}
        onSaved={() => {
          setEditVisible(false);
          refresh();
        }}
        onSaveAsNewVersion={handleSaveAsNewVersion}
      />

      {/* 查看流程定义 */}
      <Modal
        title="查看流程定义"
        open={viewVisible}
        onCancel={() => setViewVisible(false)}
        footer={[
          <Button key="ok" onClick={() => setViewVisible(false)}>
            确定
          </Button>,
        ]}
        width={600}
      >
        <div style={{ padding: 24 }}>
          {current && (
            <div>
              <p>
                <strong>流程名称：</strong>
                {current.name}
              </p>
              <p>
                <strong>流程Key：</strong>
                {current.procKey}
              </p>
              <p>
                <strong>路径类型：</strong>
                {current.type ? (typeMap[current.type] || current.type) : '-'}
              </p>
              <p>
                <strong>关联表单ID：</strong>
                {current.formId}
              </p>
              <p>
                <strong>版本：</strong>
                {current.version}
              </p>
              <p>
                <strong>状态：</strong>
                {STATUS_TAG(current.status)}
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* 导入 BPMN：选择本地 .bpmn/.xml 文件 → 调后端 /definition/import 新建草稿定义并自动配置 */}
      <Modal
        title="导入流程 (BPMN)"
        open={importOpen}
        onOk={handleImportOk}
        onCancel={() => setImportOpen(false)}
        confirmLoading={importing}
        okText="导入"
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input
            placeholder="流程名称（可空，缺省取 BPMN 的 process id）"
            value={importName}
            onChange={(e) => setImportName(e.target.value)}
            allowClear
          />
          <Upload
            accept=".xml,.bpmn,.bpmn20.xml"
            maxCount={1}
            beforeUpload={handleImportFile}
            fileList={importFileName ? [{ uid: '-1', name: importFileName, status: 'done' }] : []}
            onRemove={() => {
              setImportText('');
              setImportFileName('');
            }}
          >
            <Button icon={<UploadOutlined />}>选择 BPMN 文件</Button>
          </Upload>
          <div style={{ color: '#999', fontSize: 12 }}>
            导入将新建一个版本=1 的草稿流程，并自动解析 wf: 扩展配置节点操作者 / 操作菜单 / 字段权限。
          </div>
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default Workflow;
