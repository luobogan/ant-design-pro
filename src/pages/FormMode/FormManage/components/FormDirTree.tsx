import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Empty, Form, Input, InputNumber, message, Modal, Select, Space, Steps, Tree, TreeSelect,
} from 'antd';
import {
  DeleteOutlined, EditOutlined, PlusOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import AuthObjectPicker from '@/components/FormMode/AuthObjectPicker';
import {
  deleteModeDir, listModeDirAuth, listModeDirs, moveFormToDir, saveModeDir, saveModeDirAuth,
  type ModeDir, type ModeDirAuth,
} from '@/services/formmode/modeDirApi';
import { formApi } from '@/services/formmode';

interface Props {
  value?: string;
  onChange?: (dirId?: string) => void;
  onChanged?: () => void;
  movingFormId?: string;
  onMoved?: () => void;
}

const SUBJECT_TYPES = [
  { value: 1, label: '角色' },
  { value: 2, label: '部门' },
  { value: 3, label: '岗位' },
  { value: 4, label: '人员' },
  { value: 5, label: '分部' },
  { value: 7, label: '全员' },
];

const RIGHT_TYPES = [
  { value: 1, label: '可见' },
  { value: 2, label: '新增' },
  { value: 3, label: '编辑' },
  { value: 4, label: '删除' },
];

const DATA_SCOPE_TYPES = [
  { value: 1, label: '全部表单' },
  { value: 2, label: '本人创建' },
  { value: 3, label: '所在机构' },
  { value: 4, label: '所在机构及子级' },
  { value: 5, label: '自定义表单' },
];

const FormDirTree: React.FC<Props> = ({ value, onChange, onChanged, movingFormId, onMoved }) => {
  const [dirs, setDirs] = useState<ModeDir[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ModeDir | null>(null);
  const [form] = Form.useForm();
  const [authOpen, setAuthOpen] = useState(false);
  const [authDir, setAuthDir] = useState<ModeDir | null>(null);
  const [auths, setAuths] = useState<ModeDirAuth[]>([]);
  const [allForms, setAllForms] = useState<Array<{ id?: string; formName?: string }>>([]);
  const [authStep, setAuthStep] = useState(0);
  const [authSubjectType, setAuthSubjectType] = useState<number>(4);
  const [authSubjectIds, setAuthSubjectIds] = useState<string[]>([]);
  const [authRightTypes, setAuthRightTypes] = useState<number[]>([1]);
  const [authScopeType, setAuthScopeType] = useState<number>(1);
  const [authScopeValue, setAuthScopeValue] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listModeDirs();
      setDirs(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    formApi.getAll().then((rows: any) => setAllForms(Array.isArray(rows) ? rows : [])).catch(() => setAllForms([]));
  }, []);

  const treeData = useMemo(() => {
    const byParent = new Map<string, ModeDir[]>();
    dirs.forEach((d) => {
      const key = String(d.parentid || '0');
      byParent.set(key, [...(byParent.get(key) || []), d]);
    });
    const build = (parent: string): any[] => (byParent.get(parent) || []).map((d) => ({
      key: String(d.id),
      title: d.name || `目录${d.id}`,
      children: build(String(d.id)),
    }));
    return build('0');
  }, [dirs]);

  const disabledParentIds = useMemo(() => {
    const result = new Set<string>();
    if (!editing?.id) return result;
    result.add(String(editing.id));
    let changed = true;
    while (changed) {
      changed = false;
      dirs.forEach((d) => {
        const id = String(d.id);
        const parent = String(d.parentid || '0');
        if (!result.has(id) && result.has(parent)) {
          result.add(id);
          changed = true;
        }
      });
    }
    return result;
  }, [dirs, editing?.id]);

  const parentTreeData = useMemo(() => {
    const convert = (nodes: any[]): any[] => nodes.map((node) => ({
      value: node.key,
      title: node.title,
      disabled: disabledParentIds.has(node.key),
      children: convert(node.children || []),
    }));
    return [{ value: '0', title: '根目录', children: convert(treeData) }];
  }, [treeData, disabledParentIds]);

  const openEdit = (dir?: ModeDir) => {
    setEditing(dir || null);
    form.setFieldsValue({
      name: dir?.name || '',
      parentid: dir ? String(dir.parentid || '0') : String(value || '0'),
      dsporder: dir?.dsporder ?? 0,
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    const values = await form.validateFields();
    await saveModeDir({
      ...(editing || {}),
      name: values.name,
      parentid: values.parentid === '0' ? 0 : Number(values.parentid),
      dsporder: Number(values.dsporder || 0),
    });
    message.success('目录已保存');
    setEditOpen(false);
    await load();
    onChanged?.();
  };

  const removeDir = async (dir: ModeDir) => {
    Modal.confirm({
      title: `删除目录「${dir.name}」？`,
      content: '请先删除子目录或把目录下表单移走',
      onOk: async () => {
        try {
          await deleteModeDir(String(dir.id));
          if (value === String(dir.id)) onChange?.();
          message.success('目录已删除');
          await load();
          onChanged?.();
        } catch (e: any) {
          message.error(e?.message || '删除失败');
        }
      },
    });
  };

  const openAuth = async (dir: ModeDir) => {
    const rows = await listModeDirAuth(String(dir.id));
    setAuthDir(dir);
    setAuths(rows);
    setAuthStep(0);
    const subjectType = rows[0]?.subjectType || 4;
    setAuthSubjectType(subjectType);
    setAuthSubjectIds(Array.from(new Set(
      rows.filter((r) => r.subjectType === subjectType).map((r) => String(r.subjectId || '0')),
    )));
    setAuthRightTypes(rows.length ? Array.from(new Set(rows.map((r) => Number(r.rightType)).filter(Boolean))) : [1]);
    setAuthScopeType(rows[0]?.scopeType || 1);
    setAuthScopeValue(rows[0]?.scopeValue || '');
    setAuthOpen(true);
  };

  const nextAuthStep = () => {
    if (authSubjectType !== 7 && !authSubjectIds.length) {
      message.warning('请选择授权对象');
      return;
    }
    setAuthStep(1);
  };

  const saveAuth = async () => {
    if (!authDir) return;
    if (!authRightTypes.length) {
      message.warning('请选择数据范围权限');
      return;
    }
    if (authScopeType === 5 && !authScopeValue) {
      message.warning('请选择自定义表单');
      return;
    }
    const subjectIds = authSubjectType === 7 ? ['0'] : authSubjectIds;
    const payload: ModeDirAuth[] = [];
    subjectIds.forEach((subjectId) => {
      authRightTypes.forEach((rightType) => {
        payload.push({
          dirId: String(authDir.id),
          subjectType: authSubjectType,
          subjectId,
          rightType,
          scopeType: authScopeType,
          scopeValue: authScopeType === 5 ? authScopeValue : undefined,
        });
      });
    });
    await saveModeDirAuth(String(authDir.id), payload);
    setAuths(payload);
    message.success('目录权限已保存');
    setAuthOpen(false);
  };

  const doMove = async () => {
    if (!movingFormId) return;
    if (!value) {
      message.warning('请先选择目标目录');
      return;
    }
    await moveFormToDir(movingFormId, value);
    message.success('表单已移动到所选目录');
    onMoved?.();
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>模块目录</strong>
        <Space size={0}>
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => openEdit()} />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            disabled={!value}
            onClick={() => openEdit(dirs.find((d) => String(d.id) === value))}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={!value}
            onClick={() => {
              const dir = dirs.find((d) => String(d.id) === value);
              if (dir) removeDir(dir);
            }}
          />
          <Button
            type="text"
            size="small"
            icon={<SafetyCertificateOutlined />}
            disabled={!value}
            onClick={() => {
              const dir = dirs.find((d) => String(d.id) === value);
              if (dir) openAuth(dir);
            }}
          />
        </Space>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {treeData.length ? (
          <Tree
            loading={loading}
            treeData={treeData}
            selectedKeys={value ? [value] : []}
            onSelect={(keys) => onChange?.(keys.length ? String(keys[0]) : undefined)}
          />
        ) : <Empty description="暂无目录" />}
      </div>
      {movingFormId ? (
        <Button type="primary" block style={{ marginTop: 8 }} onClick={doMove}>移动到所选目录</Button>
      ) : null}

      <Modal title={editing ? '编辑目录' : '新增目录'} open={editOpen} onCancel={() => setEditOpen(false)} onOk={submitEdit}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="目录名称" rules={[{ required: true, message: '请输入目录名称' }]}>
            <Input placeholder="请输入目录名称" />
          </Form.Item>
          <Form.Item name="parentid" label="上级目录">
            <TreeSelect
              treeData={parentTreeData}
              treeDefaultExpandAll
              placeholder="请选择上级目录"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="dsporder" label="排序号">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`目录权限 - ${authDir?.name || ''}`}
        open={authOpen}
        onCancel={() => (authStep === 0 ? setAuthOpen(false) : setAuthStep(0))}
        onOk={authStep === 0 ? nextAuthStep : saveAuth}
        okText={authStep === 0 ? '下一步' : '保存'}
        cancelText={authStep === 0 ? '取消' : '上一步'}
        width={720}
      >
        <Steps
          size="small"
          style={{ marginBottom: 20 }}
          current={authStep}
          items={[{ title: '授权对象' }, { title: '数据范围' }]}
        />
        {authStep === 0 ? (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div>
              <div style={{ marginBottom: 6 }}>授权对象类型</div>
              <Select
                style={{ width: 220 }}
                value={authSubjectType}
                options={SUBJECT_TYPES}
                onChange={(v) => {
                  setAuthSubjectType(v);
                  setAuthSubjectIds([]);
                }}
              />
            </div>
            {authSubjectType === 7 ? (
              <div style={{ color: '#666' }}>所有登录用户</div>
            ) : (
              <div>
                <div style={{ marginBottom: 6 }}>授权对象</div>
                <AuthObjectPicker
                  multiple
                  objtype={authSubjectType}
                  value={authSubjectIds}
                  onChange={(v) => setAuthSubjectIds(Array.isArray(v) ? v.map(String) : v ? [String(v)] : [])}
                />
              </div>
            )}
            {auths.length ? (
              <div style={{ color: '#999' }}>
                当前目录已有 {auths.length} 条权限配置，保存后将按本次选择全量替换。
              </div>
            ) : null}
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div>
              <div style={{ marginBottom: 6 }}>权限类型</div>
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                value={authRightTypes}
                options={RIGHT_TYPES}
                onChange={(v) => setAuthRightTypes(v.map(Number))}
              />
            </div>
            <div>
              <div style={{ marginBottom: 6 }}>数据范围</div>
              <Select
                style={{ width: 260 }}
                value={authScopeType}
                options={DATA_SCOPE_TYPES}
                onChange={(v) => {
                  setAuthScopeType(v);
                  if (v !== 5) setAuthScopeValue('');
                }}
              />
            </div>
            {authScopeType === 5 ? (
              <div>
                <div style={{ marginBottom: 6 }}>自定义表单</div>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  value={authScopeValue ? authScopeValue.split(',').filter(Boolean) : []}
                  options={allForms.map((f) => ({ value: String(f.id), label: `${f.formName || '未命名表单'}（${f.id}）` }))}
                  onChange={(values) => setAuthScopeValue(values.join(','))}
                />
              </div>
            ) : null}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default FormDirTree;
