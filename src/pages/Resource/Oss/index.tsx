/**
 * 对象存储配置页（对标 BladeX「对象存储」管理页）
 *
 * 路由：/resource/oss（blade_menu 驱动 → ./pages/Resource/Oss/index.tsx）
 * 功能：OSS 配置 CRUD + 启用切换（同一租户仅一条生效）
 *
 * 默认存储行为（重要）
 *   该路径默认指向「本地存储」（category = 'local'）：未显式启用任何第三方 OSS 配置时，
 *   此路径下的上传与文件读写一律走本地存储（本地目录由 imageDir / fileDir 等字段指定）。
 *   仅当在本页明确「启用」（status = 1）了一条第三方 OSS 配置（如七牛云 category='qiniu'）时，
 *   才切换为该配置所对应的第三方 OSS 存储；同一租户仅一条配置生效，
 *   停用或删除该第三方配置后，自动回退为默认的本地存储。
 */
import React, { useRef, useState } from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  Button,
  Modal,
  Popconfirm,
  Tag,
  Tooltip,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ProFormInstance } from '@ant-design/pro-form';
import {
  ModalForm,
  ProFormDependency,
  ProFormDigit,
  ProFormRadio,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  OSS_CATEGORIES,
  activeOssConfig,
  maskAccessKey,
  pageOssConfig,
  removeOssConfig,
  submitOssConfig,
  type OssConfigItem,
} from '@/services/oss';

type ModalMode = 'add' | 'edit' | 'view';

/** 内置保护配置的资源编号：该条配置不可删除，仅允许修改 */
const PROTECTED_OSS_CODE = '00000';

/** 是否为内置保护配置（不可删除，仅可修改） */
const isProtected = (record?: OssConfigItem) => record?.ossCode === PROTECTED_OSS_CODE;

const categoryLabel = (v?: string) =>
  OSS_CATEGORIES.find((c) => c.value === v)?.label ?? v ?? '-';

const OssPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [current, setCurrent] = useState<OssConfigItem | null>(null);
  const [selectedRows, setSelectedRows] = useState<OssConfigItem[]>([]);
  // 可删除行：排除内置保护配置（00000）
  const deletableRows = selectedRows.filter((r) => !isProtected(r));

  const openModal = (mode: ModalMode, record?: OssConfigItem) => {
    setModalMode(mode);
    setCurrent(record ?? null);
    setModalOpen(true);
    setTimeout(() => {
      formRef.current?.setFieldsValue(record ?? { accessPolicy: 1, category: 'qiniu' });
    });
  };

  const handleSubmit = async (values: OssConfigItem) => {
    const payload: Record<string, any> = { ...current, ...values };
    // 按分类裁剪：本地存储只保留本地字段，云存储只保留云字段，避免互相污染
    if (values.category === 'local') {
      delete payload.endpoint;
      delete payload.domain;
      delete payload.bucketName;
      delete payload.accessPolicy;
      delete payload.accessKey;
      delete payload.secretKey;
      delete payload.region;
      payload.compressEnable = values.compressEnable ? 1 : 0;
      payload.encryptEnable = values.encryptEnable ? 1 : 0;
    } else {
      delete payload.imageDir;
      delete payload.fileDir;
      delete payload.backupDir;
      delete payload.backupCycle;
      delete payload.compressEnable;
      delete payload.encryptEnable;
    }
    const res = await submitOssConfig(payload);
    if (res?.success) {
      message.success(current?.id ? '修改成功' : '新增成功');
      setModalOpen(false);
      actionRef.current?.reload();
      return true;
    }
    message.error(res?.msg || '保存失败');
    return false;
  };

  const handleActive = async (record: OssConfigItem) => {
    const res = await activeOssConfig(record.id as string);
    if (res?.success) {
      message.success(`已启用「${record.ossCode}」，该配置将作为当前生效的存储配置`);
      actionRef.current?.reload();
    } else {
      message.error(res?.msg || '启用失败');
    }
  };

  const handleRemove = async (ids: string) => {
    const res = await removeOssConfig(ids);
    if (res?.success) {
      message.success('删除成功');
      actionRef.current?.reload();
    } else {
      message.error(res?.msg || '删除失败');
    }
  };

  const columns: ProColumns<OssConfigItem>[] = [
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      valueType: 'select',
      fieldProps: { options: OSS_CATEGORIES.map((c) => ({ label: c.label, value: c.value })) },
      render: (_, record) => <Tag color="blue">{categoryLabel(record.category)}</Tag>,
    },
    { title: '资源编号', dataIndex: 'ossCode', ellipsis: true },
    { title: '资源地址', dataIndex: 'endpoint', ellipsis: true, hideInSearch: true },
    { title: '外网地址', dataIndex: 'domain', ellipsis: true, hideInSearch: true },
    { title: '空间名', dataIndex: 'bucketName', ellipsis: true, hideInSearch: true },
    {
      title: '访问策略',
      dataIndex: 'accessPolicy',
      width: 90,
      hideInSearch: true,
      render: (_, record) =>
        record.accessPolicy === 2 ? <Tag>私有</Tag> : <Tag color="green">公共读</Tag>,
    },
    {
      title: 'accessKey',
      dataIndex: 'accessKey',
      ellipsis: true,
      render: (_, record) => maskAccessKey(record.accessKey),
    },
    {
      title: '是否启用',
      dataIndex: 'status',
      width: 100,
      hideInSearch: true,
      render: (_, record) =>
        record.status === 1 ? (
          <Tag color="green">启用中</Tag>
        ) : (
          <Popconfirm
            title={`启用「${record.ossCode}」？`}
            description="同一时间仅一条配置生效，原启用配置将被停用。"
            onConfirm={() => handleActive(record)}
          >
            <a>启用</a>
          </Popconfirm>
        ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => [
        <a key="view" onClick={() => openModal('view', record)}>
          查看
        </a>,
        <a key="edit" onClick={() => openModal('edit', record)}>
          编辑
        </a>,
        isProtected(record) ? (
          <Tooltip key="del" title={`内置配置（资源编号 ${PROTECTED_OSS_CODE}）不可删除，仅可修改`}>
            <a style={{ color: 'rgba(0,0,0,0.25)', cursor: 'not-allowed' }} onClick={(e) => e.preventDefault()}>
              删除
            </a>
          </Tooltip>
        ) : (
          <Popconfirm key="del" title="确认删除该配置？" onConfirm={() => handleRemove(record.id as string)}>
            <a>删除</a>
          </Popconfirm>
        ),
      ],
    },
  ];

  const readonly = modalMode === 'view';

  return (
    <PageContainer header={{ title: '对象存储', subTitle: '统一管理 OSS 配置：七牛云 / 阿里云 / MinIO 等，启用其中一条作为当前生效配置' }}>
      <ProTable<OssConfigItem>
        headerTitle="对象存储配置"
        actionRef={actionRef}
        rowKey="id"
        scroll={{ x: 1200 }}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        request={async (params) => {
          const { current, pageSize, ...rest } = params;
          const res = await pageOssConfig({ current, size: pageSize, ...rest });
          return {
            data: res?.data?.records ?? [],
            total: res?.data?.total ?? 0,
            success: !!res?.success,
          };
        }}
        columns={columns}
        rowSelection={{
          // 内置保护配置（00000）禁止勾选，避免被批量删除
          getCheckboxProps: (record: OssConfigItem) => ({ disabled: isProtected(record) }),
        }}
        onRowSelectionChange={setSelectedRows}
        pagination={{ defaultPageSize: 10 }}
        toolBarRender={() => [
          <Button
            key="batch-del"
            danger
            disabled={deletableRows.length === 0}
            onClick={() =>
              Modal.confirm({
                title: '批量删除',
                content: `确认删除选中的 ${deletableRows.length} 条配置？`,
                onOk: () => handleRemove(deletableRows.map((r) => r.id as string).join(',')),
              })
            }
          >
            批量删除
          </Button>,
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal('add')}>
            新增
          </Button>,
        ]}
      />

      <ModalForm<OssConfigItem>
        title={modalMode === 'add' ? '新增' : modalMode === 'edit' ? '编辑' : '查看'}
        width={720}
        open={modalOpen}
        onOpenChange={setModalOpen}
        formRef={formRef}
        onFinish={handleSubmit}
        submitter={readonly ? false : undefined}
        modalProps={{ destroyOnHidden: true, maskClosable: false }}
        disabled={readonly}
      >
        <ProFormRadio.Group
          name="category"
          label="分类"
          tooltip="不同云厂商对应的对象存储类型"
          options={OSS_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))}
          radioType="button"
          rules={[{ required: true, message: '请选择分类' }]}
        />
        <ProFormText
          name="ossCode"
          label="资源编号"
          placeholder="请输入 资源编号"
          rules={[{ required: true, message: '请输入资源编号' }]}
        />
        <ProFormDependency name={['category']}>
          {({ category }) => {
            if (category === 'local') {
              return (
                <>
                  <ProFormText
                    name="imageDir"
                    label="图片存放目录"
                    tooltip="本地存储生效，Linux 绝对路径，正斜杠、区分大小写"
                    placeholder="如 /data/blade/oss/images"
                    rules={[{ required: true, message: '请输入图片存放目录' }]}
                  />
                  <ProFormText
                    name="fileDir"
                    label="文件存放目录"
                    placeholder="如 /data/blade/oss/files"
                    rules={[{ required: true, message: '请输入文件存放目录' }]}
                  />
                  <ProFormText
                    name="backupDir"
                    label="文件备份目录"
                    tooltip="应与主目录分离，避免备份覆盖原数据"
                    placeholder="如 /data/blade/oss/backup"
                  />
                  <ProFormDigit
                    name="backupCycle"
                    label="文件备份周期(分钟)"
                    tooltip="定时备份触发周期，默认 1440 分钟 = 24 小时"
                    initialValue={1440}
                    min={1}
                    fieldProps={{ precision: 0 }}
                  />
                  <ProFormSwitch name="compressEnable" label="压缩存储开关" />
                  <ProFormSwitch name="encryptEnable" label="加密存储开关" />
                </>
              );
            }
            return (
              <>
                <ProFormText
                  name="endpoint"
                  label="资源地址"
                  placeholder="请输入 资源地址（如 http://127.0.0.1:9000）"
                  rules={[{ required: true, message: '请输入资源地址' }]}
                />
                <ProFormText name="domain" label="外网地址" placeholder="请输入 外网地址" />
                <ProFormText
                  name="bucketName"
                  label="空间名"
                  placeholder="请输入 空间名"
                  rules={[{ required: true, message: '请输入空间名' }]}
                />
                <ProFormRadio.Group
                  name="accessPolicy"
                  label="访问策略"
                  options={[
                    { label: '公共读', value: 1 },
                    { label: '私有', value: 2 },
                  ]}
                  initialValue={1}
                />
                <ProFormText
                  name="accessKey"
                  label="accessKey"
                  placeholder="请输入 accessKey"
                  rules={[{ required: true, message: '请输入 accessKey' }]}
                />
                <ProFormText.Password
                  name="secretKey"
                  label="secretKey"
                  placeholder="请输入 secretKey"
                  rules={[{ required: !readonly, message: '请输入 secretKey' }]}
                />
                <ProFormText name="region" label="region" placeholder="请输入 region" />
              </>
            );
          }}
        </ProFormDependency>
        <ProFormTextArea name="remark" label="备注" placeholder="请输入 备注" />
        <ProFormDigit name="id" hidden />
      </ModalForm>
    </PageContainer>
  );
};

export default OssPage;
