import { PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history, useRequest } from '@umijs/max';
import { Button, message, Modal, Tag } from 'antd';
import React, { useMemo, useState } from 'react';
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
  status?: number; // 0草稿 1已发布 2停用
  isFree?: number;
  type?: string;
  formType?: number;
  description?: string;
  sortOrder?: number;
}

const STATUS_TAG = (s?: number) => {
  switch (s) {
    case 1:
      return <Tag color="green">已发布</Tag>;
    case 2:
      return <Tag color="red">停用</Tag>;
    default:
      return <Tag>草稿</Tag>;
  }
};

const Workflow: React.FC = () => {
  const [addVisible, setAddVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [viewVisible, setViewVisible] = useState(false);
  const [current, setCurrent] = useState<WorkflowDef | null>(null);

  // 列表：全局拦截器返回 ApiResponse 包装体，用 data?.data 取数组（兼容后端直接返回数组的情况）
  const { data, loading, refresh } = useRequest(() => workflowApi.listDefinitions());
  const defs: WorkflowDef[] = Array.isArray(data) ? data : (data?.data || []);
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
            <Button type="link" onClick={() => handleDeploy(record)}>
              部署
            </Button>
          )}
          {hasPerm('workflow_enable') &&
            (record.status === 1 ? (
              <Button type="link" danger onClick={() => handleDisable(record)}>
                停用
              </Button>
            ) : (
              <Button type="link" onClick={() => handleEnable(record)}>
                启用
              </Button>
            ))}
          {hasPerm('workflow_design') && (
            <Button type="link" onClick={() => history.push(`/formmode/workflowdesign?defId=${record.id}`)}>
              进入设计
            </Button>
          )}
        </>
      ),
    },
  ];

  const handleDeploy = (r: WorkflowDef) => {
    Modal.confirm({
      title: '确认部署',
      content: `确定要部署流程「${r.name}」吗？`,
      onOk: async () => {
        try {
          await workflowApi.deployDefinition(r.id!);
          message.success('部署成功');
          refresh();
        } catch {
          message.error('部署失败');
        }
      },
    });
  };

  const handleEnable = (r: WorkflowDef) => {
    Modal.confirm({
      title: '确认启用',
      content: `确定要启用流程「${r.name}」吗？`,
      onOk: async () => {
        try {
          await workflowApi.enableDefinition(r.id!);
          message.success('启用成功');
          refresh();
        } catch {
          message.error('启用失败');
        }
      },
    });
  };

  const handleDisable = (r: WorkflowDef) => {
    Modal.confirm({
      title: '确认停用',
      content: `确定要停用流程「${r.name}」吗？`,
      onOk: async () => {
        try {
          await workflowApi.disableDefinition(r.id!);
          message.success('停用成功');
          refresh();
        } catch {
          message.error('停用失败');
        }
      },
    });
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
    </PageContainer>
  );
};

export default Workflow;
