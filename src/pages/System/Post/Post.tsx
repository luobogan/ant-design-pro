import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import {
  App,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
} from 'antd';
import React, { useMemo, useRef, useState } from 'react';
import { useIntl } from '@umijs/max';
import * as postApi from './service';
import { pickPayload } from '@/utils/utils';
import usePageButtons from '@/hooks/usePageButtons';
import useDictOptions from '@/hooks/useDictOptions';
import { hasButton } from '@/utils/authority';

/** 岗位列表字段（与后端 PostVO 保持一致，Long 主键后端已序列化为字符串） */
interface PostItem {
  id?: string;
  tenantId?: string;
  category?: number | string;
  categoryName?: string;
  postCode?: string;
  postName?: string;
  sort?: number;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

type ModalMode = 'add' | 'edit' | 'view';

const Post: React.FC = () => {
  const intl = useIntl();
  const t = (id: string, defaultMessage: string, values?: Record<string, any>) =>
    intl.formatMessage({ id, defaultMessage }, values);

  // 通过 App.useApp() 获取 message/modal，才能消费 ConfigProvider 的主题与配置
  const { message, modal } = App.useApp();
  const actionRef = useRef<any>(null);
  const [form] = Form.useForm();

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [currentRow, setCurrentRow] = useState<PostItem | undefined>(undefined);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // 按钮权限按当前路由末段（/system/post → post）取菜单 code
  const { buttons } = usePageButtons();

  // 岗位分类取自后端字典 post_category
  const { options: categoryOptions } = useDictOptions('post_category');
  const categoryEnum = useMemo(() => {
    const map: Record<string, { text: string }> = {};
    categoryOptions.forEach((item) => {
      map[String(item.value)] = { text: String(item.label) };
    });
    return map;
  }, [categoryOptions]);

  /** 打开新增弹窗 */
  const handleAdd = () => {
    setCurrentRow(undefined);
    setModalMode('add');
    form.resetFields();
    form.setFieldsValue({ sort: 1 });
    setModalOpen(true);
  };

  /** 打开编辑弹窗（走后端 detail 接口取最新数据） */
  const handleEdit = async (record: PostItem) => {
    setModalMode('edit');
    let detail: PostItem = record;
    try {
      const res = await postApi.detail({ id: record.id });
      detail = pickPayload<PostItem>(res, record) || record;
    } catch {
      // 详情接口异常时退回列表数据，不影响编辑
    }
    setCurrentRow(detail);
    form.setFieldsValue({
      postName: detail.postName,
      postCode: detail.postCode,
      category: detail.category === undefined ? undefined : Number(detail.category),
      sort: detail.sort,
      remark: detail.remark,
    });
    setModalOpen(true);
  };

  /** 打开查看弹窗 */
  const handleView = async (record: PostItem) => {
    setModalMode('view');
    let detail: PostItem = record;
    try {
      const res = await postApi.detail({ id: record.id });
      detail = pickPayload<PostItem>(res, record) || record;
    } catch {
      // 忽略，退回列表数据
    }
    setCurrentRow(detail);
    setModalOpen(true);
  };

  /** 删除（支持单条 / 批量） */
  const handleRemove = (ids: React.Key[], tips?: string) => {
    if (!ids || ids.length === 0) {
      message.warning(t('pages.system.post.message.selectFirst', '请先选择要删除的岗位'));
      return;
    }
    modal.confirm({
      title: t('pages.system.post.confirm.removeTitle', '删除确认'),
      content:
        tips || t('pages.system.post.confirm.removeContent', '删除后不可恢复，确认删除吗？'),
      okText: t('pages.system.common.confirm', '确认'),
      cancelText: t('pages.system.common.cancel', '取消'),
      okButtonProps: { danger: true },
      onOk: async () => {
        await postApi.remove({ ids });
        message.success(t('pages.system.post.message.removeSuccess', '删除成功'));
        setSelectedRowKeys([]);
        actionRef.current?.reload?.();
      },
    });
  };

  /** 新增 / 编辑提交 */
  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        postName: values.postName,
        postCode: values.postCode,
        category: values.category === undefined || values.category === null
          ? undefined
          : Number(values.category),
        sort: values.sort,
        remark: values.remark,
      };
      if (modalMode === 'edit' && currentRow?.id) {
        payload.id = currentRow.id;
      }
      await postApi.submit(payload);
      message.success(
        modalMode === 'edit'
          ? t('pages.system.post.message.editSuccess', '修改成功')
          : t('pages.system.post.message.addSuccess', '新增成功'),
      );
      setModalOpen(false);
      actionRef.current?.reload?.();
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ProColumns<PostItem>[] = [
    {
      title: t('pages.system.post.column.postName', '岗位名称'),
      dataIndex: 'postName',
      ellipsis: true,
      width: 160,
    },
    {
      title: t('pages.system.post.column.postCode', '岗位编号'),
      dataIndex: 'postCode',
      ellipsis: true,
      width: 140,
    },
    {
      title: t('pages.system.post.column.category', '岗位分类'),
      dataIndex: 'category',
      width: 120,
      valueType: 'select',
      valueEnum: categoryEnum,
      fieldProps: { options: categoryOptions },
      render: (_: any, record: PostItem) => record.categoryName || categoryEnum[String(record.category)]?.text || '-',
    },
    {
      title: t('pages.system.common.column.sort', '排序'),
      dataIndex: 'sort',
      width: 80,
      search: false,
      align: 'center',
    },
    {
      title: t('pages.system.post.column.description', '岗位描述'),
      dataIndex: 'remark',
      ellipsis: true,
      search: false,
    },
    {
      title: t('pages.system.post.column.createTime', '创建时间'),
      dataIndex: 'createTime',
      valueType: 'text',
      width: 180,
      search: false,
    },
    {
      title: t('pages.system.common.column.option', '操作'),
      valueType: 'option',
      key: 'option',
      width: 180,
      fixed: 'right',
      render: (_: any, record: PostItem) => [
        hasButton(buttons, 'post_view') && (
          <a key="view" onClick={() => handleView(record)}>
            <EyeOutlined /> {t('pages.system.common.view', '查看')}
          </a>
        ),
        hasButton(buttons, 'post_edit') && (
          <a key="edit" onClick={() => handleEdit(record)}>
            <EditOutlined /> {t('pages.system.common.edit', '编辑')}
          </a>
        ),
        hasButton(buttons, 'post_remove') && (
          <a
            key="remove"
            style={{ color: '#ff4d4f' }}
            onClick={() => handleRemove([record.id as React.Key])}
          >
            <DeleteOutlined /> {t('pages.system.common.remove', '删除')}
          </a>
        ),
      ].filter(Boolean),
    },
  ];

  const isView = modalMode === 'view';
  const batchRemoveTips = t(
    'pages.system.post.confirm.removeBatchContent',
    '确认删除选中的 {count} 个岗位吗？',
    { count: selectedRowKeys.length },
  );

  return (
    <PageContainer
      title={t('pages.system.post.title', '岗位管理')}
      subTitle={t('pages.system.post.subtitle', '维护岗位信息，可按名称/编号/分类查询')}
    >
      <ProTable<PostItem>
        rowKey="id"
        actionRef={actionRef}
        headerTitle={t('pages.system.post.listTitle', '岗位列表')}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        tableAlertRender={({ selectedRowKeys: keys, onCleanSelected }) =>
          keys.length > 0 ? (
            <Space size={16}>
              <span>
                {t('pages.system.common.selected', '已选')} {keys.length}{' '}
                {t('pages.system.common.items', '项')}
              </span>
              <a onClick={onCleanSelected}>
                {t('pages.system.common.clearSelected', '取消选择')}
              </a>
            </Space>
          ) : null
        }
        tableAlertOptionRender={() =>
          selectedRowKeys.length > 0 ? (
            <a
              style={{ color: '#ff4d4f' }}
              onClick={() => handleRemove(selectedRowKeys, batchRemoveTips)}
            >
              {t('pages.system.common.batchRemove', '批量删除')}
            </a>
          ) : null
        }
        toolBarRender={() => [
          hasButton(buttons, 'post_add') && (
            <Button key="add" type="primary" onClick={handleAdd}>
              <PlusOutlined /> {t('pages.system.post.action.add', '新增岗位')}
            </Button>
          ),
          selectedRowKeys.length > 0 && hasButton(buttons, 'post_remove') && (
            <Button
              key="batchRemove"
              danger
              onClick={() => handleRemove(selectedRowKeys, batchRemoveTips)}
            >
              <DeleteOutlined /> {t('pages.system.common.batchRemove', '批量删除')}
            </Button>
          ),
          <Button
            key="refresh"
            onClick={() => {
              setSelectedRowKeys([]);
              actionRef.current?.reload?.();
            }}
          >
            <ReloadOutlined /> {t('pages.system.common.refresh', '刷新')}
          </Button>,
        ].filter(Boolean)}
        search={{ labelWidth: 'auto' }}
        request={async (params) => {
          const { current, pageSize, ...rest } = params as Record<string, any>;
          // 后端 Query 分页参数为 current / size
          const res = await postApi.list({ current, size: pageSize, ...rest });
          const page = pickPayload<any>(res, {}) || {};
          const list: PostItem[] = Array.isArray(page)
            ? page
            : page.records || page.data || [];
          return {
            data: list,
            success: true,
            total: Array.isArray(page) ? list.length : Number(page.total ?? 0),
          };
        }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        dateFormatter="string"
      />

      <Modal
        title={
          modalMode === 'add'
            ? t('pages.system.post.modal.addTitle', '新增岗位')
            : modalMode === 'edit'
              ? t('pages.system.post.modal.editTitle', '编辑岗位')
              : t('pages.system.post.modal.viewTitle', '岗位详情')
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={isView ? () => setModalOpen(false) : handleSubmit}
        confirmLoading={submitting}
        okText={isView ? t('pages.system.common.close', '关闭') : t('pages.system.common.save', '保存')}
        cancelText={isView ? undefined : t('pages.system.common.cancel', '取消')}
        destroyOnHidden
        width={640}
      >
        {isView ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label={t('pages.system.post.column.postName', '岗位名称')}>
              {currentRow?.postName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.post.column.postCode', '岗位编号')}>
              {currentRow?.postCode || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.post.column.category', '岗位分类')}>
              {currentRow?.categoryName || categoryEnum[String(currentRow?.category)]?.text || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.common.column.sort', '排序')}>
              {currentRow?.sort ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item
              label={t('pages.system.post.column.description', '岗位描述')}
              span={2}
            >
              {currentRow?.remark || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.post.column.createTime', '创建时间')}>
              {currentRow?.createTime || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.post.column.updateTime', '更新时间')}>
              {currentRow?.updateTime || '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Form form={form} layout="vertical" preserve={false}>
            <Form.Item
              name="postName"
              label={t('pages.system.post.column.postName', '岗位名称')}
              rules={[
                {
                  required: true,
                  message: t('pages.system.post.form.postNameRequired', '请输入岗位名称'),
                },
              ]}
            >
              <Input allowClear />
            </Form.Item>
            <Form.Item
              name="postCode"
              label={t('pages.system.post.column.postCode', '岗位编号')}
              rules={[
                {
                  required: true,
                  message: t('pages.system.post.form.postCodeRequired', '请输入岗位编号'),
                },
              ]}
            >
              <Input allowClear />
            </Form.Item>
            <Form.Item
              name="category"
              label={t('pages.system.post.column.category', '岗位分类')}
            >
              <Select allowClear options={categoryOptions} />
            </Form.Item>
            <Form.Item
              name="sort"
              label={t('pages.system.common.column.sort', '排序')}
            >
              <InputNumber
                min={0}
                precision={0}
                style={{ width: '100%' }}
                placeholder={t('pages.system.common.form.sortPlaceholder', '数字越小越靠前')}
              />
            </Form.Item>
            <Form.Item
              name="remark"
              label={t('pages.system.post.column.description', '岗位描述')}
            >
              <Input.TextArea
                rows={3}
                placeholder={t('pages.system.post.form.remarkPlaceholder', '请输入岗位描述')}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </PageContainer>
  );
};

export default Post;
