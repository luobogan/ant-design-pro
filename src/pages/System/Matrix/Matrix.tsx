import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { names as userNames } from '@/services/system/user';
import * as deptApi from '@/services/system/dept';
import { PersonOrgField } from '@/components/FormMode/PersonOrgPicker';
import { pickPayload } from '@/utils/utils';
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Descriptions,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useMemo, useState } from 'react';
import { useIntl, useRequest, useAccess } from '@umijs/max';
import * as matrixApi from './service';
import type {
  WfMatrix,
  WfMatrixData,
  WfMatrixField,
  MatrixMatchVO,
} from './service';

const BROWSER_TYPE_OPTIONS = [
  { value: 1, label: '人力资源(1)' },
  { value: 17, label: '多人力资源(17)' },
  { value: 4, label: '部门(4)' },
  { value: 57, label: '部门(57)' },
  { value: 164, label: '分部(164)' },
  { value: 194, label: '分部(194)' },
];

const fieldTypeText = (t?: number) => (t === 1 ? '结果维度' : '条件维度');
const fieldTypeColor = (t?: number) => (t === 1 ? 'blue' : 'gold');

/**
 * 矩阵字段「浏览类型」→ 人员/组织选择器类别。
 * ⚠️ 矩阵用的是 E9 MatrixFieldInfo 编号（1人力资源/17多人力资源/4、57部门/164、194分部），
 * 与 PersonOrgPicker 的 BrowserBean 编号不同，故不能透传 browserType，按类别映射以错开冲突。
 */
const fieldCategory = (bt?: number): 'hrm' | 'dept' | 'branch' | null => {
  if (bt === 1 || bt === 17) return 'hrm';
  if (bt === 4 || bt === 57) return 'dept';
  if (bt === 164 || bt === 194) return 'branch';
  return null;
};

const Matrix: React.FC = () => {
  const intl = useIntl();
  const t = (id: string, defaultMessage: string, values?: Record<string, any>) =>
    intl.formatMessage({ id, defaultMessage }, values);
  const { message, modal } = App.useApp();
  const { hasButton } = useAccess();

  const [selectedId, setSelectedId] = useState<string | number | undefined>(undefined);
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [matrixModalOpen, setMatrixModalOpen] = useState(false);

  // ───────── 矩阵列表 ─────────
  const {
    data: matrixRes,
    loading: matrixLoading,
    refresh: refreshMatrix,
  } = useRequest(() => matrixApi.list(), {});

  const matrices = useMemo<WfMatrix[]>(() => {
    const arr = Array.isArray(matrixRes) ? matrixRes : matrixRes?.data;
    return Array.isArray(arr) ? arr : [];
  }, [matrixRes]);

  const selectedMatrix = useMemo(
    () => matrices.find((m) => String(m.id) === String(selectedId)),
    [matrices, selectedId],
  );

  // ───────── 字段定义 ─────────
  const {
    data: fieldsRes,
    loading: fieldsLoading,
    refresh: refreshFields,
  } = useRequest(() => (selectedId ? matrixApi.fields(selectedId) : Promise.resolve(null)), {
    refreshDeps: [selectedId],
  });
  const fields = useMemo<WfMatrixField[]>(() => {
    const arr = Array.isArray(fieldsRes) ? fieldsRes : fieldsRes?.data;
    return Array.isArray(arr) ? arr : [];
  }, [fieldsRes]);

  const conditionFields = useMemo(() => fields.filter((f) => f.fieldType === 0), [fields]);
  const resultFields = useMemo(() => fields.filter((f) => f.fieldType === 1), [fields]);

  // ───────── 数据行 ─────────
  const {
    data: dataRes,
    loading: dataLoading,
    refresh: refreshData,
  } = useRequest(() => (selectedId ? matrixApi.dataList(selectedId) : Promise.resolve(null)), {
    refreshDeps: [selectedId],
  });
  const dataRows = useMemo<WfMatrixData[]>(() => {
    const arr = Array.isArray(dataRes) ? dataRes : dataRes?.data;
    return Array.isArray(arr) ? arr : [];
  }, [dataRes]);

  // ───────── 数据行 ID → 名称反查（人员/部门/分部） ─────────
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  const [deptNameMap, setDeptNameMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const needUser = new Set<string>();
    const needDept = new Set<string>();
    const collect = (isUser: boolean, val: any) => {
      if (val === undefined || val === null || val === '') return;
      String(val)
        .split(',')
        .forEach((s) => {
          const x = s.trim();
          if (x) (isUser ? needUser : needDept).add(x);
        });
    };
    fields.forEach((f) => {
      const isUser = f.browserType === 1 || f.browserType === 17;
      const isDept = f.browserType === 4 || f.browserType === 57 || f.browserType === 164 || f.browserType === 194;
      if (!isUser && !isDept) return;
      dataRows.forEach((r) => collect(isUser, r.dataJson?.[f.fieldKey!]));
    });
    let cancel = false;
    (async () => {
      if (needUser.size) {
        try {
          const nr = await userNames({ ids: Array.from(needUser).join(',') }, { skipErrorHandler: true });
          const arr = Array.isArray(nr) ? nr : nr?.data;
          const m: Record<string, string> = {};
          (arr || []).forEach((u: any) => {
            m[String(u.id ?? u.userId)] = u.name ?? u.realName ?? String(u.id ?? u.userId);
          });
          if (!cancel) setUserNameMap(m);
        } catch {
          /* 反查失败则保留原值 */
        }
      }
      if (needDept.size) {
        try {
          const dr = await deptApi.tree();
          const arr = Array.isArray(dr) ? dr : dr?.data;
          const m: Record<string, string> = {};
          const walk = (nodes: any[]) =>
            (nodes || []).forEach((n: any) => {
              m[String(n.id)] = n.deptName || n.name || String(n.id);
              if (n.children) walk(n.children);
            });
          walk(arr);
          if (!cancel) setDeptNameMap(m);
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [dataRows, fields]);

  const renderFieldValue = (field: WfMatrixField, raw: any): string => {
    if (raw === undefined || raw === null || raw === '') return '-';
    const isUser = field.browserType === 1 || field.browserType === 17;
    const isDept = field.browserType === 4 || field.browserType === 57 || field.browserType === 164 || field.browserType === 194;
    if (!isUser && !isDept) return String(raw);
    const map = isUser ? userNameMap : deptNameMap;
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => map[s] || s)
      .join('、');
  };

  // ───────── 新建矩阵 ─────────
  const [matrixForm] = Form.useForm();
  const handleCreateMatrix = async () => {
    const values = await matrixForm.validateFields();
    await matrixApi.create(values.matrixName, values.matrixDesc);
    message.success(t('pages.system.matrix.message.addSuccess', '创建成功'));
    setMatrixModalOpen(false);
    matrixForm.resetFields();
    refreshMatrix();
  };

  const handleRemoveMatrix = (id: any) => {
    modal.confirm({
      title: t('pages.system.matrix.confirm.removeTitle', '删除矩阵'),
      content: t(
        'pages.system.matrix.confirm.removeContent',
        '确认删除该矩阵吗？其字段与数据行将级联删除，且被流程引用时会拒绝删除。',
      ),
      okText: t('pages.system.common.confirm', '确认'),
      cancelText: t('pages.system.common.cancel', '取消'),
      okButtonProps: { danger: true },
      onOk: async () => {
        await matrixApi.removeMatrix(id);
        message.success(t('pages.system.matrix.message.removeSuccess', '删除成功'));
        if (String(selectedId) === String(id)) setSelectedId(undefined);
        refreshMatrix();
      },
    });
  };

  // ───────── 字段定义编辑 ─────────
  const [fieldForm] = Form.useForm();
  const [fieldRows, setFieldRows] = useState<WfMatrixField[]>([]);
  const openFieldModal = () => {
    setFieldRows(fields.map((f) => ({ ...f })));
    setFieldModalOpen(true);
  };
  const addFieldRow = () =>
    setFieldRows((rows) => [
      ...rows,
      { fieldKey: '', displayName: '', browserType: 1, fieldType: 0, fieldOrder: rows.length + 1 },
    ]);
  const updateFieldRow = (idx: number, patch: Partial<WfMatrixField>) =>
    setFieldRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeFieldRow = (idx: number) =>
    setFieldRows((rows) => rows.filter((_, i) => i !== idx));
  const handleSaveFields = async () => {
    if (!selectedId) return;
    const keys = fieldRows.map((r) => (r.fieldKey || '').trim());
    if (fieldRows.some((r) => !r.fieldKey || !r.displayName)) {
      message.warning(t('pages.system.matrix.field.keyRequired', '字段键值与显示名均必填'));
      return;
    }
    if (new Set(keys).size !== keys.length) {
      message.warning(t('pages.system.matrix.field.keyDup', '字段键值重复'));
      return;
    }
    if (!fieldRows.some((r) => r.fieldType === 0)) {
      message.warning(t('pages.system.matrix.field.needCond', '至少保留一个条件维度'));
      return;
    }
    if (!fieldRows.some((r) => r.fieldType === 1)) {
      message.warning(t('pages.system.matrix.field.needResult', '至少保留一个结果维度'));
      return;
    }
    await matrixApi.saveFields(selectedId, fieldRows);
    message.success(t('pages.system.matrix.message.saveSuccess', '保存成功'));
    setFieldModalOpen(false);
    refreshFields();
  };

  const fieldColumns: ColumnsType<WfMatrixField> = [
    { title: t('pages.system.matrix.field.key', '字段键值'), dataIndex: 'fieldKey', width: 160 },
    { title: t('pages.system.matrix.field.name', '显示名'), dataIndex: 'displayName', width: 160 },
    {
      title: t('pages.system.matrix.field.type', '维度'),
      dataIndex: 'fieldType',
      width: 100,
      render: (v: number) => <Tag color={fieldTypeColor(v)}>{fieldTypeText(v)}</Tag>,
    },
    {
      title: t('pages.system.matrix.field.browser', '浏览类型'),
      dataIndex: 'browserType',
      width: 130,
      render: (v: number) => BROWSER_TYPE_OPTIONS.find((o) => o.value === v)?.label || v,
    },
    {
      title: t('pages.system.common.column.option', '操作'),
      key: 'option',
      width: 80,
      render: (_: any, _r: WfMatrixField, idx: number) =>
        hasButton('matrix', 'matrix_edit') && (
          <a style={{ color: '#ff4d4f' }} onClick={() => removeFieldRow(idx)}>
            <DeleteOutlined /> {t('pages.system.common.remove', '删除')}
          </a>
        ),
    },
  ];

  // ───────── 数据行编辑 ─────────
  const [dataDraft, setDataDraft] = useState<{ dataOrder: number; values: Record<string, string> }>({
    dataOrder: 1,
    values: {},
  });
  const setDraftValue = (key: string, v: string) =>
    setDataDraft((d) => ({ ...d, values: { ...d.values, [key]: v } }));
  const handleOpenDataModal = () => {
    if (!fields.length) {
      message.warning(t('pages.system.matrix.data.needField', '请先配置字段定义'));
      return;
    }
    setDataDraft({ dataOrder: dataRows.length + 1, values: {} });
    setDataModalOpen(true);
  };
  /** 数据行取值控件：人员/部门/分部用选择器，其它退回文本输入 */
  const renderDraftField = (f: WfMatrixField) => {
    const cat = fieldCategory(f.browserType);
    const val = dataDraft.values[f.fieldKey!] ?? '';
    if (cat) {
      return (
        <PersonOrgField
          category={cat}
          multiple={f.browserType !== 1}
          value={val}
          onChange={(v) => setDraftValue(f.fieldKey!, v || '')}
          placeholder={cat === 'hrm' ? '选择人员' : cat === 'branch' ? '选择分部' : '选择部门'}
        />
      );
    }
    return (
      <Input
        value={val}
        onChange={(e) => setDraftValue(f.fieldKey!, e.target.value)}
        allowClear
        placeholder="输入值"
      />
    );
  };
  const handleSaveData = async () => {
    if (!selectedId) return;
    if (!dataDraft.dataOrder) {
      message.warning(t('pages.system.matrix.form.orderRequired', '请输入行序'));
      return;
    }
    const payload: Record<string, any> = {};
    fields.forEach((f) => {
      const v = dataDraft.values[f.fieldKey!];
      if (v !== undefined && v !== null && v !== '') payload[f.fieldKey!] = v;
    });
    await matrixApi.saveData(selectedId, dataDraft.dataOrder, payload);
    message.success(t('pages.system.matrix.message.saveSuccess', '保存成功'));
    setDataModalOpen(false);
    refreshData();
  };
  const handleRemoveData = (dataId: any) => {
    modal.confirm({
      title: t('pages.system.matrix.confirm.removeDataTitle', '删除数据行'),
      content: t('pages.system.matrix.confirm.removeDataContent', '确认删除该数据行吗？'),
      okText: t('pages.system.common.confirm', '确认'),
      cancelText: t('pages.system.common.cancel', '取消'),
      okButtonProps: { danger: true },
      onOk: async () => {
        await matrixApi.removeData(dataId);
        message.success(t('pages.system.matrix.message.removeSuccess', '删除成功'));
        refreshData();
      },
    });
  };

  const dataColumns: ColumnsType<WfMatrixData> = [
    {
      title: t('pages.system.matrix.data.order', '行序'),
      dataIndex: 'dataOrder',
      width: 70,
      render: (v: any) => v,
    },
    ...fields.map((f) => ({
      title: `${f.displayName}${f.fieldType === 1 ? '(结果)' : ''}`,
      dataIndex: ['dataJson', f.fieldKey!],
      width: 160,
      ellipsis: true,
      render: (v: any) => renderFieldValue(f, v),
    })),
    {
      title: t('pages.system.common.column.option', '操作'),
      key: 'option',
      width: 80,
      fixed: 'right' as const,
      render: (_: any, record: WfMatrixData) =>
        hasButton('matrix', 'matrix_delete') && (
          <a style={{ color: '#ff4d4f' }} onClick={() => handleRemoveData(record.id)}>
            <DeleteOutlined /> {t('pages.system.common.remove', '删除')}
          </a>
        ),
    },
  ];

  // ───────── 匹配测试 ─────────
  const [matchForm] = Form.useForm();
  const [matchResult, setMatchResult] = useState<MatrixMatchVO | null>(null);
  const [matchNames, setMatchNames] = useState<Record<string, string>>({});
  const handleMatch = async () => {
    if (!selectedId) return;
    const values = matchForm.getFieldsValue();
    const valueField = values.valueField;
    if (!valueField) {
      message.warning(t('pages.system.matrix.match.needResult', '请选择结果维度'));
      return;
    }
    const conditions: Record<string, string> = {};
    conditionFields.forEach((f) => {
      const v = values[`cond_${f.fieldKey}`];
      if (v !== undefined && v !== null && v !== '') conditions[f.fieldKey!] = String(v);
    });
    try {
      const res = await matrixApi.match(selectedId, valueField, conditions);
      const vo: MatrixMatchVO = pickPayload(res, {}) as MatrixMatchVO;
      setMatchResult(vo);
      // 反查人员姓名（非关键请求，失败不影响结果展示）
      const ids = (vo.userIds || []).map((id) => String(id));
      if (ids.length) {
        try {
          const nr = await userNames({ ids: ids.join(',') }, { skipErrorHandler: true });
          const listAny: any[] = Array.isArray(nr) ? nr : nr?.data;
          const map: Record<string, string> = {};
          (listAny || []).forEach((u: any) => {
            map[String(u.id ?? u.userId)] = u.name ?? u.realName ?? String(u.id ?? u.userId);
          });
          setMatchNames(map);
        } catch {
          setMatchNames({});
        }
      } else {
        setMatchNames({});
      }
    } catch (e: any) {
      message.error(e?.msg || e?.data?.msg || t('pages.system.matrix.match.fail', '匹配失败'));
    }
  };

  const matrixColumns: ColumnsType<WfMatrix> = [
    {
      title: t('pages.system.matrix.column.name', '矩阵名称'),
      dataIndex: 'matrixName',
    },
    {
      title: t('pages.system.matrix.column.desc', '描述'),
      dataIndex: 'matrixDesc',
      ellipsis: true,
    },
    {
      title: t('pages.system.matrix.column.status', '状态'),
      dataIndex: 'status',
      width: 90,
      render: (v: number) =>
        v === 1 ? (
          <Tag color="green">{t('pages.system.common.enabled', '启用')}</Tag>
        ) : (
          <Tag color="default">{t('pages.system.common.disabled', '停用')}</Tag>
        ),
    },
    {
      title: t('pages.system.common.column.option', '操作'),
      key: 'option',
      width: 80,
      render: (_: any, record: WfMatrix) =>
        hasButton('matrix', 'matrix_delete') && (
          <a style={{ color: '#ff4d4f' }} onClick={() => handleRemoveMatrix(record.id)}>
            <DeleteOutlined /> {t('pages.system.common.remove', '删除')}
          </a>
        ),
    },
  ];

  return (
    <PageContainer
      title={t('pages.system.matrix.title', '组织矩阵')}
      subTitle={t('pages.system.matrix.subtitle', '管理条件维度与结果维度，供流程节点按字段动态解析办理人')}
    >
      <Row gutter={16}>
        <Col span={8}>
          <Card
            title={t('pages.system.matrix.listTitle', '矩阵列表')}
            size="small"
            extra={
              <Space>
                <Button
                  type="link"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={refreshMatrix}
                >
                  {t('pages.system.common.refresh', '刷新')}
                </Button>
                {hasButton('matrix', 'matrix_add') && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      matrixForm.resetFields();
                      setMatrixModalOpen(true);
                    }}
                  >
                    {t('pages.system.matrix.action.add', '新建矩阵')}
                  </Button>
                )}
              </Space>
            }
            styles={{ body: { padding: 12 } }}
          >
            <Table<WfMatrix>
              rowKey="id"
              size="small"
              loading={matrixLoading}
              dataSource={matrices}
              columns={matrixColumns}
              pagination={false}
              rowClassName={(r) =>
                String(r.id) === String(selectedId) ? 'ant-table-row-selected' : ''
              }
              onRow={(r) => ({
                onClick: () => setSelectedId(r.id),
                style: { cursor: 'pointer' },
              })}
              locale={{
                emptyText: <Empty description={t('pages.system.matrix.empty', '暂无矩阵')} />,
              }}
            />
          </Card>
        </Col>

        <Col span={16}>
          {!selectedMatrix ? (
            <Card size="small">
              <Empty description={t('pages.system.matrix.selectHint', '请选择左侧矩阵进行配置')} />
            </Card>
          ) : (
            <Card
              size="small"
              title={`${selectedMatrix.matrixName || ''} · ${
                selectedMatrix.matrixDesc || ''
              }`}
            >
              <Tabs
                items={[
                  {
                    key: 'fields',
                    label: t('pages.system.matrix.tab.fields', '字段定义'),
                    children: (
                      <>
                        <Space style={{ marginBottom: 12 }}>
                          {hasButton('matrix', 'matrix_edit') && (
                            <Button type="primary" icon={<EditOutlined />} onClick={openFieldModal}>
                              {t('pages.system.matrix.action.editFields', '编辑字段定义')}
                            </Button>
                          )}
                          <Button icon={<ReloadOutlined />} onClick={refreshFields}>
                            {t('pages.system.common.refresh', '刷新')}
                          </Button>
                        </Space>
                        <Table<WfMatrixField>
                          rowKey={(r) => r.fieldKey || String(Math.random())}
                          size="small"
                          loading={fieldsLoading}
                          dataSource={fields}
                          columns={fieldColumns}
                          pagination={false}
                          locale={{
                            emptyText: (
                              <Empty description={t('pages.system.matrix.field.empty', '暂无字段，请点击编辑')} />
                            ),
                          }}
                        />
                      </>
                    ),
                  },
                  {
                    key: 'data',
                    label: t('pages.system.matrix.tab.data', '数据行'),
                    children: (
                      <>
                        <Space style={{ marginBottom: 12 }}>
                          {hasButton('matrix', 'matrix_add') && (
                            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenDataModal}>
                              {t('pages.system.matrix.action.addData', '新增数据行')}
                            </Button>
                          )}
                          <Button icon={<ReloadOutlined />} onClick={refreshData}>
                            {t('pages.system.common.refresh', '刷新')}
                          </Button>
                        </Space>
                        <Table<WfMatrixData>
                          rowKey="id"
                          size="small"
                          loading={dataLoading}
                          dataSource={dataRows}
                          columns={dataColumns}
                          scroll={{ x: 'max-content' }}
                          pagination={{ pageSize: 10, showTotal: (total) => t('pages.system.common.total', '共 {total} 条', { total }) }}
                          locale={{
                            emptyText: (
                              <Empty description={t('pages.system.matrix.data.empty', '暂无数据行')} />
                            ),
                          }}
                        />
                      </>
                    ),
                  },
                  {
                    key: 'match',
                    label: t('pages.system.matrix.tab.match', '匹配测试'),
                    children: (
                      <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Form form={matchForm} layout="vertical">
                          {conditionFields.map((f) => (
                            <Form.Item
                              key={f.fieldKey}
                              name={`cond_${f.fieldKey}`}
                              label={`${f.displayName}（${t('pages.system.matrix.match.cond', '条件')}）`}
                            >
                              <Input placeholder={t('pages.system.matrix.match.condPlaceholder', '输入条件值（如部门ID）')} allowClear />
                            </Form.Item>
                          ))}
                          <Form.Item
                            name="valueField"
                            label={t('pages.system.matrix.match.resultField', '结果维度')}
                            rules={[{ required: true, message: t('pages.system.matrix.match.needResult', '请选择结果维度') }]}
                          >
                            <Select
                              placeholder={t('pages.system.matrix.match.resultPlaceholder', '选择结果维度字段')}
                              options={resultFields.map((f) => ({
                                value: f.fieldKey,
                                label: f.displayName,
                              }))}
                            />
                          </Form.Item>
                          <Button type="primary" onClick={handleMatch}>
                            {t('pages.system.matrix.match.test', '测试匹配')}
                          </Button>
                        </Form>
                        {matchResult && (
                          <Card size="small" title={t('pages.system.matrix.match.result', '匹配结果')}>
                            <Descriptions column={1} size="small" bordered>
                              <Descriptions.Item label={t('pages.system.matrix.match.hitRows', '命中行数')}>
                                <Tag color={matchResult.hitRows ? 'green' : 'red'}>{matchResult.hitRows ?? 0}</Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label={t('pages.system.matrix.match.users', '解析办理人')}>
                                {(matchResult.userIds || []).length ? (
                                  <Space wrap>
                                    {(matchResult.userIds || []).map((id) => (
                                      <Tag key={String(id)} color="blue">
                                        {matchNames[String(id)] || id}
                                      </Tag>
                                    ))}
                                  </Space>
                                ) : (
                                  '-'
                                )}
                              </Descriptions.Item>
                              <Descriptions.Item label={t('pages.system.matrix.match.effective', '生效条件')}>
                                <Space direction="vertical">
                                  {Object.entries(matchResult.effectiveConditions || {}).map(([k, v]) => (
                                    <span key={k}>
                                      {k} = {v}
                                    </span>
                                  ))}
                                </Space>
                              </Descriptions.Item>
                            </Descriptions>
                          </Card>
                        )}
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          )}
        </Col>
      </Row>

      {/* 新建矩阵 */}
      <Modal
        title={t('pages.system.matrix.modal.addTitle', '新建矩阵')}
        open={matrixModalOpen}
        onCancel={() => setMatrixModalOpen(false)}
        onOk={handleCreateMatrix}
        okText={t('pages.system.common.save', '保存')}
        cancelText={t('pages.system.common.cancel', '取消')}
        destroyOnHidden
      >
        <Form form={matrixForm} layout="vertical" preserve={false}>
          <Form.Item
            name="matrixName"
            label={t('pages.system.matrix.column.name', '矩阵名称')}
            rules={[{ required: true, message: t('pages.system.matrix.form.nameRequired', '请输入矩阵名称') }]}
          >
            <Input placeholder={t('pages.system.matrix.form.namePlaceholder', '如 部门负责人矩阵')} allowClear />
          </Form.Item>
          <Form.Item name="matrixDesc" label={t('pages.system.matrix.column.desc', '描述')}>
            <Input.TextArea rows={3} placeholder={t('pages.system.matrix.form.descPlaceholder', '可选')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 字段定义编辑 */}
      <Modal
        title={t('pages.system.matrix.modal.fieldTitle', '编辑字段定义（覆盖保存）')}
        open={fieldModalOpen}
        onCancel={() => setFieldModalOpen(false)}
        onOk={handleSaveFields}
        okText={t('pages.system.common.save', '保存')}
        cancelText={t('pages.system.common.cancel', '取消')}
        width={720}
        destroyOnHidden
      >
        <Table<WfMatrixField>
          rowKey={(_, idx) => String(idx)}
          size="small"
          dataSource={fieldRows}
          pagination={false}
          columns={[
            {
              title: t('pages.system.matrix.field.key', '字段键值'),
              render: (_: any, _r: WfMatrixField, idx: number) => (
                <Input
                  value={fieldRows[idx].fieldKey}
                  onChange={(e) => updateFieldRow(idx, { fieldKey: e.target.value })}
                  placeholder="fieldKey"
                />
              ),
            },
            {
              title: t('pages.system.matrix.field.name', '显示名'),
              render: (_: any, _r: WfMatrixField, idx: number) => (
                <Input
                  value={fieldRows[idx].displayName}
                  onChange={(e) => updateFieldRow(idx, { displayName: e.target.value })}
                />
              ),
            },
            {
              title: t('pages.system.matrix.field.type', '维度'),
              width: 110,
              render: (_: any, _r: WfMatrixField, idx: number) => (
                <Select
                  value={fieldRows[idx].fieldType}
                  onChange={(v) => updateFieldRow(idx, { fieldType: v })}
                  options={[
                    { value: 0, label: t('pages.system.matrix.field.cond', '条件维度') },
                    { value: 1, label: t('pages.system.matrix.field.result', '结果维度') },
                  ]}
                />
              ),
            },
            {
              title: t('pages.system.matrix.field.browser', '浏览类型'),
              width: 150,
              render: (_: any, _r: WfMatrixField, idx: number) => (
                <Select
                  value={fieldRows[idx].browserType}
                  onChange={(v) => updateFieldRow(idx, { browserType: v })}
                  options={BROWSER_TYPE_OPTIONS}
                />
              ),
            },
            {
              title: t('pages.system.matrix.field.order', '排序'),
              width: 80,
              render: (_: any, _r: WfMatrixField, idx: number) => (
                <InputNumber
                  min={1}
                  value={fieldRows[idx].fieldOrder}
                  onChange={(v) => updateFieldRow(idx, { fieldOrder: v ?? 1 })}
                />
              ),
            },
            {
              title: t('pages.system.common.column.option', '操作'),
              width: 70,
              render: (_: any, _r: WfMatrixField, idx: number) => (
                <a style={{ color: '#ff4d4f' }} onClick={() => removeFieldRow(idx)}>
                  <DeleteOutlined />
                </a>
              ),
            },
          ]}
        />
        <Button type="dashed" block icon={<PlusOutlined />} onClick={addFieldRow} style={{ marginTop: 12 }}>
          {t('pages.system.matrix.action.addField', '新增字段')}
        </Button>
      </Modal>

      {/* 数据行新增 */}
      <Modal
        title={t('pages.system.matrix.modal.dataTitle', '新增数据行')}
        open={dataModalOpen}
        onCancel={() => setDataModalOpen(false)}
        onOk={handleSaveData}
        okText={t('pages.system.common.save', '保存')}
        cancelText={t('pages.system.common.cancel', '取消')}
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label={t('pages.system.matrix.data.order', '行序')}>
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              value={dataDraft.dataOrder}
              onChange={(v) => setDataDraft((d) => ({ ...d, dataOrder: v ?? 1 }))}
            />
          </Form.Item>
          {fields.map((f) => (
            <Form.Item
              key={f.fieldKey}
              label={`${f.displayName}${f.fieldType === 1 ? '（结果·人员ID）' : ''}`}
            >
              {renderDraftField(f)}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default Matrix;
