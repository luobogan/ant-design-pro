import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import StandardTable from '@/components/StandardTable';
import type { ProColumns } from '@ant-design/pro-components';
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Tag,
  Tree,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useMemo, useState } from 'react';
import { useIntl, useRequest } from '@umijs/max';
import * as dictApi from './service';
import { pickPayload } from '@/utils/utils';
import usePageButtons from '@/hooks/usePageButtons';
import { hasButton } from '@/utils/authority';

/** 字典项（与后端 DictVO 一致，Long 主键已序列化为字符串） */
interface DictItem {
  id?: string;
  parentId?: string;
  code?: string;
  dictKey?: number;
  dictValue?: string;
  sort?: number;
  remark?: string;
  parentName?: string;
  children?: DictItem[];
}

type ModalMode = 'addType' | 'addData' | 'edit' | 'view';

const TOP_PARENT_ID = '0';

/** DictVO 树 → antd Tree 数据 */
const toTreeData = (list: DictItem[] = []): DataNode[] =>
  list.map((item) => ({
    key: String(item.id),
    title: `${item.dictValue ?? ''}${item.code ? `（${item.code}）` : ''}`,
    children: item.children?.length ? toTreeData(item.children) : undefined,
  }));

/** 在树中按 id 查找节点 */
const findNode = (list: DictItem[] = [], id?: string): DictItem | undefined => {
  if (!id) return undefined;
  for (const item of list) {
    if (String(item.id) === String(id)) return item;
    if (item.children?.length) {
      const found = findNode(item.children, id);
      if (found) return found;
    }
  }
  return undefined;
};

const Dict: React.FC = () => {
  const intl = useIntl();
  const t = (id: string, defaultMessage: string, values?: Record<string, any>) =>
    intl.formatMessage({ id, defaultMessage }, values);

  // 通过 App.useApp() 获取 message/modal，才能消费 ConfigProvider 的主题与配置
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();

  const [searchKey, setSearchKey] = useState<string>('');
  const [queryKey, setQueryKey] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<ModalMode>('addType');
  const [currentRow, setCurrentRow] = useState<DictItem | undefined>(undefined);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { buttons } = usePageButtons('dict');

  /**
   * 后端 /dict/list 返回的是「已合并成树」的字典列表，不支持分页；
   * 这里用 dictValue 作为模糊查询条件交给后端过滤，分页在前端完成。
   */
  const {
    data: tree,
    loading,
    refresh,
  } = useRequest(() => {
    const params: Record<string, any> = {};
    if (queryKey) {
      params.dictValue = queryKey;
    }
    // 注意：@umijs/max 的 useRequest 在默认配置下会把回调返回值当作响应体再取一次 .data，
    // 因此这里直接返回原始响应（ApiResponse），由下面的 treeData 兼容两种形态取值。
    return dictApi.list(params);
  }, { refreshDeps: [queryKey] });

  // useRequest 默认会取响应体的 .data；这里兼容「直接是数组 / 包了一层 ApiResponse」两种形态
  const treeData = useMemo<DictItem[]>(() => {
    const arr = Array.isArray(tree) ? tree : tree?.data;
    return Array.isArray(arr) ? arr : [];
  }, [tree]);
  const treeNodes = useMemo(() => toTreeData(treeData), [treeData]);
  const selectedNode = useMemo(() => findNode(treeData, selectedId), [treeData, selectedId]);

  /** 表格数据：未选中时展示字典类型（顶级），选中后展示该类型的字典数据（子级） */
  const rows = useMemo<DictItem[]>(() => {
    if (!treeData.length) return [];
    const top = treeData.filter((item) => String(item.parentId ?? TOP_PARENT_ID) === TOP_PARENT_ID);
    const source = selectedNode ? selectedNode.children ?? [] : top;
    return [...source].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  }, [treeData, selectedNode]);

  /** 打开新增弹窗：type=字典类型（顶级），data=字典数据（挂在选中类型下） */
  const handleAdd = (type: 'type' | 'data') => {
    form.resetFields();
    setCurrentRow(undefined);
    if (type === 'data') {
      if (!selectedNode) {
        message.warning(t('pages.system.dict.message.selectTypeFirst', '请先在左侧选择一个字典类型'));
        return;
      }
      setModalMode('addData');
      form.setFieldsValue({ code: selectedNode.code, parentName: selectedNode.dictValue, sort: 1 });
    } else {
      setModalMode('addType');
      form.setFieldsValue({ sort: 1 });
    }
    setModalOpen(true);
  };

  /** 打开编辑弹窗（走后端 detail 接口） */
  const handleEdit = async (record: DictItem) => {
    let detail: DictItem = record;
    try {
      const res = await dictApi.detail({ id: record.id });
      detail = pickPayload<DictItem>(res, record) || record;
    } catch {
      // 详情失败时退回行数据
    }
    setCurrentRow(detail);
    setModalMode('edit');
    form.setFieldsValue({
      id: detail.id,
      parentId: detail.parentId,
      code: detail.code,
      dictKey: detail.dictKey,
      dictValue: detail.dictValue,
      sort: detail.sort,
      remark: detail.remark,
    });
    setModalOpen(true);
  };

  /** 打开查看弹窗 */
  const handleView = async (record: DictItem) => {
    let detail: DictItem = record;
    try {
      const res = await dictApi.detail({ id: record.id });
      detail = pickPayload<DictItem>(res, record) || record;
    } catch {
      // 忽略
    }
    setCurrentRow(detail);
    setModalMode('view');
    setModalOpen(true);
  };

  /** 删除（支持单条 / 批量） */
  const handleRemove = (ids: React.Key[]) => {
    if (!ids || ids.length === 0) {
      message.warning(t('pages.system.dict.message.selectFirst', '请先选择要删除的字典'));
      return;
    }
    modal.confirm({
      title: t('pages.system.dict.confirm.removeTitle', '删除确认'),
      content: t(
        'pages.system.dict.confirm.removeContent',
        '确认删除选中的 {count} 项字典吗？该字典下的子字典不会被级联删除。',
        { count: ids.length },
      ),
      okText: t('pages.system.common.confirm', '确认'),
      cancelText: t('pages.system.common.cancel', '取消'),
      okButtonProps: { danger: true },
      onOk: async () => {
        await dictApi.remove({ ids });
        message.success(t('pages.system.dict.message.removeSuccess', '删除成功'));
        setSelectedRowKeys([]);
        refresh();
      },
    });
  };

  /** 新增 / 编辑提交 */
  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        code: values.code,
        dictKey: values.dictKey === undefined || values.dictKey === null
          ? undefined
          : Number(values.dictKey),
        dictValue: values.dictValue,
        sort: values.sort,
        remark: values.remark,
      };
      if (modalMode === 'edit') {
        payload.id = currentRow?.id;
        payload.parentId = currentRow?.parentId ?? TOP_PARENT_ID;
      } else if (modalMode === 'addData') {
        // 子项必须继承父级的字典编号，否则后端 (code, dictKey) 唯一性校验会失效
        payload.parentId = selectedNode?.id ?? TOP_PARENT_ID;
        payload.code = selectedNode?.code ?? values.code;
      } else {
        payload.parentId = TOP_PARENT_ID;
      }
      await dictApi.submit(payload);
      message.success(
        modalMode === 'edit'
          ? t('pages.system.dict.message.editSuccess', '修改成功')
          : t('pages.system.dict.message.addSuccess', '新增成功'),
      );
      setModalOpen(false);
      refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const isAddData = modalMode === 'addData';
  const isTypeEdit =
    modalMode === 'addType' ||
    (modalMode === 'edit' && String(currentRow?.parentId ?? TOP_PARENT_ID) === TOP_PARENT_ID);
  const isView = modalMode === 'view';

  const columns: ProColumns<DictItem>[] = [
    {
      title: t('pages.system.dict.column.code', '字典编号'),
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      hideInTable: !!selectedNode,
      render: (_: any, record: DictItem) => record.code || '-',
    },
    {
      title: t('pages.system.dict.column.dictValue', '字典名称'),
      dataIndex: 'dictValue',
      ellipsis: true,
      width: 180,
    },
    {
      title: t('pages.system.dict.column.dictKey', '字典值'),
      dataIndex: 'dictKey',
      width: 120,
      hideInTable: !selectedNode,
      align: 'center',
      render: (_: any, record: DictItem) =>
        record.dictKey === undefined || record.dictKey === null ? '-' : (
          <Tag color="blue">{record.dictKey}</Tag>
        ),
    },
    {
      title: t('pages.system.common.column.sort', '排序'),
      dataIndex: 'sort',
      width: 80,
      align: 'center',
      search: false,
    },
    {
      title: t('pages.system.common.column.remark', '备注'),
      dataIndex: 'remark',
      ellipsis: true,
      search: false,
    },
    {
      title: t('pages.system.common.column.option', '操作'),
      valueType: 'option',
      key: 'option',
      width: 180,
      fixed: 'right',
      render: (_: any, record: DictItem) => [
        hasButton(buttons, 'dict_view') && (
          <a key="view" onClick={() => handleView(record)}>
            <EyeOutlined /> {t('pages.system.common.view', '查看')}
          </a>
        ),
        hasButton(buttons, 'dict_edit') && (
          <a key="edit" onClick={() => handleEdit(record)}>
            <EditOutlined /> {t('pages.system.common.edit', '编辑')}
          </a>
        ),
        hasButton(buttons, 'dict_remove') && (
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

  return (
    <PageContainer
      title={t('pages.system.dict.title', '字典管理')}
      subTitle={t('pages.system.dict.subtitle', '左侧为字典类型，右侧为该类型下的字典数据')}
    >
      <Row gutter={16}>
        <Col span={6}>
          <Card
            title={t('pages.system.dict.typeTitle', '字典类型')}
            size="small"
            extra={
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => {
                  refresh();
                }}
              >
                {t('pages.system.common.refresh', '刷新')}
              </Button>
            }
            styles={{ body: { padding: 12 } }}
          >
            <Input.Search
              placeholder={t('pages.system.dict.search.placeholder', '按字典名称查询')}
              allowClear
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              onSearch={(value) => setQueryKey(value?.trim() || '')}
              style={{ marginBottom: 12 }}
            />
            {treeNodes.length === 0 && !loading ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('pages.system.dict.empty', '暂无字典数据')}
              />
            ) : (
              <Tree
                treeData={treeNodes}
                blockNode
                selectedKeys={selectedId ? [selectedId] : []}
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys)}
                onSelect={(keys) => {
                  setSelectedRowKeys([]);
                  setSelectedId(keys.length ? String(keys[0]) : undefined);
                }}
              />
            )}
          </Card>
        </Col>

        <Col span={18}>
          <StandardTable<DictItem>
            rowKey="id"
            headerTitle={
              selectedNode
                ? t('pages.system.dict.dataTitle', '字典数据 · {name}', {
                    name: selectedNode.dictValue ?? '',
                  })
                : t('pages.system.dict.typeTitle', '字典类型')
            }
            search={false}
            options={false}
            dataSource={rows}
            loading={loading}
            columns={columns}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            pagination={{ defaultPageSize: 10,
              showSizeChanger: true,
              showTotal: (total) =>
                t('pages.system.common.total', '共 {total} 条', { total }),
            }}
            toolBarRender={() => [
              hasButton(buttons, 'dict_add') && (
                <Button key="addType" type="primary" onClick={() => handleAdd('type')}>
                  <PlusOutlined /> {t('pages.system.dict.action.addType', '新增字典类型')}
                </Button>
              ),
              hasButton(buttons, 'dict_add') && (
                <Button key="addData" onClick={() => handleAdd('data')}>
                  <PlusOutlined /> {t('pages.system.dict.action.addData', '新增字典数据')}
                </Button>
              ),
              selectedRowKeys.length > 0 && hasButton(buttons, 'dict_remove') && (
                <Button key="batchRemove" danger onClick={() => handleRemove(selectedRowKeys)}>
                  <DeleteOutlined /> {t('pages.system.common.batchRemove', '批量删除')}
                </Button>
              ),
              selectedNode && (
                <Button
                  key="clear"
                  onClick={() => {
                    setSelectedId(undefined);
                    setSelectedRowKeys([]);
                  }}
                >
                  {t('pages.system.dict.action.backToType', '返回字典类型')}
                </Button>
              ),
            ].filter(Boolean)}
          />
        </Col>
      </Row>

      <Modal
        title={
          modalMode === 'addType'
            ? t('pages.system.dict.modal.addTypeTitle', '新增字典类型')
            : modalMode === 'addData'
              ? t('pages.system.dict.modal.addDataTitle', '新增字典数据')
              : modalMode === 'edit'
                ? t('pages.system.dict.modal.editTitle', '编辑字典')
                : t('pages.system.dict.modal.viewTitle', '字典详情')
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
            <Descriptions.Item label={t('pages.system.dict.column.code', '字典编号')}>
              {currentRow?.code || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dict.detail.parentName', '上级字典')}>
              {currentRow?.parentName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dict.column.dictValue', '字典名称')}>
              {currentRow?.dictValue || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dict.column.dictKey', '字典值')}>
              {currentRow?.dictKey === undefined || currentRow?.dictKey === null
                ? '-'
                : currentRow?.dictKey}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.common.column.sort', '排序')}>
              {currentRow?.sort ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.common.column.remark', '备注')}>
              {currentRow?.remark || '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Form form={form} layout="vertical" preserve={false}>
            <Form.Item name="id" hidden>
              <Input />
            </Form.Item>
            {!isAddData ? (
              <Form.Item
                name="code"
                label={t('pages.system.dict.column.code', '字典编号')}
                rules={[
                  {
                    required: true,
                    message: t('pages.system.dict.form.codeRequired', '请输入字典编号'),
                  },
                ]}
              >
                <Input
                  placeholder={t('pages.system.dict.form.codePlaceholder', '如 post_category')}
                  allowClear
                  disabled={modalMode === 'edit'}
                />
              </Form.Item>
            ) : (
              <Form.Item label={t('pages.system.dict.form.parentType', '所属字典类型')}>
                <Input value={selectedNode?.dictValue ?? ''} readOnly />
              </Form.Item>
            )}
            <Form.Item
              name="dictValue"
              label={t('pages.system.dict.column.dictValue', '字典名称')}
              rules={[
                {
                  required: true,
                  message: t('pages.system.dict.form.dictValueRequired', '请输入字典名称'),
                },
              ]}
            >
              <Input allowClear />
            </Form.Item>
            {!isTypeEdit && (
              <Form.Item
                name="dictKey"
                label={t('pages.system.dict.column.dictKey', '字典值')}
                rules={[
                  {
                    required: true,
                    message: t('pages.system.dict.form.dictKeyRequired', '请输入字典值（整数）'),
                  },
                ]}
              >
                <InputNumber
                  precision={0}
                  style={{ width: '100%' }}
                  placeholder={t('pages.system.dict.form.dictKeyPlaceholder', '请输入整数')}
                />
              </Form.Item>
            )}
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
              label={t('pages.system.common.column.remark', '备注')}
            >
              <Input.TextArea
                rows={3}
                placeholder={t('pages.system.common.form.remarkPlaceholder', '请输入备注')}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </PageContainer>
  );
};

export default Dict;
