import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Drawer,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { CopyOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { formApi, fieldApi } from '@/services/formmode';
import type { FieldDefinition } from '@/services/formmode/typings';
import * as roleApi from '@/services/authority/role';
import {
  getFieldAuthorizesBySubject,
  getRightVersion,
  resolveModeId,
  saveFieldAuthorizesBySubject,
} from '@/services/formmode/rightApi';

type RightValue = 0 | 1 | 2;

interface Props {
  open: boolean;
  initialFormId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

const RIGHT_OPTIONS = [
  { value: 0, label: '隐藏' },
  { value: 1, label: '只读' },
  { value: 2, label: '可编辑' },
];

const SubjectFieldRightDrawer: React.FC<Props> = ({ open, initialFormId, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [roleId, setRoleId] = useState<string>();
  const [copyRoleId, setCopyRoleId] = useState<string>();
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [fieldDefs, setFieldDefs] = useState<Record<string, FieldDefinition[]>>({});
  const [modeIdByForm, setModeIdByForm] = useState<Record<string, string>>({});
  const [versions, setVersions] = useState<Record<string, number>>({});
  // key = modeId，value = fieldId -> rightvalue
  const [rights, setRights] = useState<Record<string, Record<number, RightValue>>>({});
  const [selectedFields, setSelectedFields] = useState<Record<string, number[]>>({});
  const [fieldSearch, setFieldSearch] = useState<Record<string, string>>({});
  const [importVisible, setImportVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<{ valid: number; errors: string[] } | null>(null);

  const loadRolesAndForms = async () => {
    setLoading(true);
    try {
      const [roleRes, formRes]: any[] = await Promise.all([
        roleApi.list({ current: 1, size: 1000 }).catch(() => []),
        formApi.getAll().catch(() => []),
      ]);
      const roleRecords = Array.isArray(roleRes) ? roleRes : roleRes?.records || roleRes?.data?.records || roleRes?.data || [];
      const formRecords = Array.isArray(formRes) ? formRes : formRes?.data || [];
      setRoles(roleRecords.map((r: any) => ({
        id: String(r.id || r.roleId || ''),
        name: r.roleName || r.name || r.roleAlias || String(r.id || ''),
      })).filter((r: any) => r.id));
      setForms(formRecords.filter((f: any) => f?.id && f?.status !== 0).map((f: any) => ({
        id: String(f.id),
        name: f.formName || f.name || String(f.id),
      })));
    } catch {
      message.error('加载角色/表单失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSubjectRights = async (subjectId?: string) => {
    if (!subjectId) { setRights({}); return; }
    try {
      const list = await getFieldAuthorizesBySubject(1, subjectId);
      const next: Record<string, Record<number, RightValue>> = {};
      list.forEach((a) => {
        const mid = String(a.modeid);
        const rv = Number(a.rightvalue) as RightValue;
        if (!next[mid]) next[mid] = {};
        next[mid][Number(a.fieldid)] = rv;
      });
      setRights(next);
    } catch {
      setRights({});
    }
  };

  useEffect(() => {
    if (open) {
      setSelectedFormIds(initialFormId ? [String(initialFormId)] : []);
      loadRolesAndForms();
    }
  }, [open, initialFormId]);

  useEffect(() => {
    if (open && roleId) loadSubjectRights(roleId);
    else setRights({});
  }, [open, roleId]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      for (const formId of selectedFormIds) {
        if (!fieldDefs[formId]) {
          const defs = await fieldApi.getByFormId(formId).catch(() => []);
          setFieldDefs((prev) => ({ ...prev, [formId]: Array.isArray(defs) ? defs : [] }));
        }
        if (!modeIdByForm[formId]) {
          const mid = (await resolveModeId(formId).catch(() => null)) || formId;
          setModeIdByForm((prev) => ({ ...prev, [formId]: String(mid) }));
          const v = await getRightVersion(String(mid)).catch(() => 0);
          setVersions((prev) => ({ ...prev, [String(mid)]: Number(v || 0) }));
        }
      }
    })();
  }, [open, selectedFormIds.join(',')]);

  const setRightsForFields = (formId: string, fieldIds: number[], rv: RightValue) => {
    const mid = modeIdByForm[formId] || formId;
    setRights((prev) => {
      const next = { ...prev, [mid]: { ...(prev[mid] || {}) } };
      fieldIds.forEach((fid) => { next[mid][fid] = rv; });
      return next;
    });
  };

  const copyFromRole = async () => {
    if (!copyRoleId) { message.warning('请选择要复制的角色'); return; }
    await loadSubjectRights(copyRoleId);
    message.success('已复制源角色配置，请检查后保存');
  };

  const handleSave = async () => {
    if (!roleId) { message.warning('请选择授权角色'); return; }
    if (!selectedFormIds.length) { message.warning('请选择要配置的表单'); return; }
    setSaving(true);
    try {
      const modeVersions: Record<string, number> = {};
      const modes: any[] = [];
      selectedFormIds.forEach((formId) => {
        const mid = String(modeIdByForm[formId] || formId);
        modeVersions[mid] = versions[mid] ?? 0;
        const defs = fieldDefs[formId] || [];
        const fields = defs
          .map((f) => ({ fieldId: Number(f.id), rightvalue: rights[mid]?.[Number(f.id)] }))
          .filter((f) => f.rightvalue !== undefined) as Array<{ fieldId: number; rightvalue: RightValue }>;
        modes.push({ modeId: mid, formId, fields });
      });
      await saveFieldAuthorizesBySubject({ objtype: 1, objid: roleId, tenantId: '000000', modeVersions, modes });
      message.success('字段权限已保存');
      onSaved?.();
      onClose();
    } catch (e: any) {
      message.error(e?.msg || e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows: string[][] = [[
      'formId', 'formName', 'fieldId', 'fieldName', 'fieldLabel', 'objType', 'objId', 'rightValue', 'rightName',
    ]];
    selectedFormIds.forEach((formId) => {
      const mid = String(modeIdByForm[formId] || formId);
      const form = forms.find((f) => f.id === formId);
      (fieldDefs[formId] || []).forEach((f) => {
        const rv = rights[mid]?.[Number(f.id)];
        if (rv === undefined) return;
        rows.push([
          `"${formId}"`, `"${form?.name || ''}"`, `"${f.id}"`, `"${f.fieldName}"`, `"${f.fieldLabel}"`,
          '1', `"${roleId || ''}"`, String(rv), RIGHT_OPTIONS.find((o) => o.value === rv)?.label || '',
        ]);
      });
    });
    const csv = '\ufeff' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '建模字段权限_按主体.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = (text: string): string[][] => text.replace(/^\ufeff/, '').split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')) || []);

  const previewImport = () => {
    const rows = parseCsv(importText);
    if (rows.length < 2) { message.warning('CSV内容为空'); return; }
    const header = rows[0];
    const idx = (name: string) => header.indexOf(name);
    const iForm = idx('formId'), iField = idx('fieldId'), iRight = idx('rightValue'), iObj = idx('objId');
    if (iForm < 0 || iField < 0 || iRight < 0) { message.warning('缺少 formId/fieldId/rightValue 列'); return; }
    const errors: string[] = [];
    const updates: Array<{ formId: string; fieldId: number; rv: RightValue }> = [];
    rows.slice(1).forEach((r, i) => {
      const formId = String(r[iForm] || '').trim();
      const fieldId = Number(r[iField]);
      const rv = Number(r[iRight]) as RightValue;
      const objId = iObj >= 0 ? String(r[iObj] || '').trim() : roleId;
      if (!selectedFormIds.includes(formId)) { errors.push(`第${i + 2}行：formId未选择`); return; }
      if (!Number.isFinite(fieldId)) { errors.push(`第${i + 2}行：fieldId非法`); return; }
      if (![0, 1, 2].includes(rv)) { errors.push(`第${i + 2}行：rightValue非法`); return; }
      if (objId && String(objId) !== String(roleId)) { errors.push(`第${i + 2}行：objId与当前角色不一致`); return; }
      const exists = (fieldDefs[formId] || []).some((f) => Number(f.id) === fieldId);
      if (!exists) { errors.push(`第${i + 2}行：字段不存在`); return; }
      updates.push({ formId, fieldId, rv });
    });
    setImportPreview({ valid: updates.length, errors: errors.slice(0, 20) });
    (window as any).__subjectFieldImportUpdates = updates;
  };

  const applyImport = () => {
    const updates = (window as any).__subjectFieldImportUpdates || [];
    updates.forEach((u: any) => setRightsForFields(u.formId, [u.fieldId], u.rv));
    setImportVisible(false);
    setImportText('');
    setImportPreview(null);
    message.success(`已导入 ${updates.length} 条配置，请检查后保存`);
  };

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));
  const formOptions = forms.map((f) => ({ value: f.id, label: f.name }));

  const buildColumns = (formId: string): ColumnsType<FieldDefinition> => [
    { title: '字段名', dataIndex: 'fieldName', width: 140 },
    { title: '字段名称', dataIndex: 'fieldLabel', width: 180 },
    { title: '字段ID', dataIndex: 'id', width: 100 },
    {
      title: '权限',
      key: 'rightvalue',
      width: 140,
      render: (_v, record) => {
        const mid = String(modeIdByForm[formId] || formId);
        return (
          <Select
            size="small"
            style={{ width: 110 }}
            value={rights[mid]?.[Number(record.id)]}
            options={RIGHT_OPTIONS}
            placeholder="未设置"
            onChange={(rv) => setRightsForFields(formId, [Number(record.id)], rv as RightValue)}
          />
        );
      },
    },
  ];

  return (
    <Drawer
      title="按主体配置字段权限"
      width={1100}
      open={open}
      onClose={onClose}
      loading={loading}
      extra={<Button type="primary" loading={saving} onClick={handleSave}>保存</Button>}
    >
      <Card size="small" title="授权主体" style={{ marginBottom: 12 }}>
        <Space wrap>
          <span>角色：</span>
          <Select
            showSearch
            style={{ width: 260 }}
            placeholder="请选择角色"
            value={roleId}
            options={roleOptions}
            onChange={(v) => setRoleId(String(v))}
            optionFilterProp="label"
          />
          <span style={{ color: '#999' }}>第一版仅支持角色维度；其它主体请使用表单维度的字段权限配置。</span>
        </Space>
      </Card>

      <Card size="small" title={initialFormId ? '当前表单' : '选择表单'} style={{ marginBottom: 12 }}>
        {initialFormId ? (
          <Space wrap>
            <Tag color="blue">{forms.find((f) => f.id === String(initialFormId))?.name || String(initialFormId)}</Tag>
            <span style={{ color: '#999' }}>从当前行进入，表单已锁定，不能再选择其它表单。</span>
          </Space>
        ) : (
          <Select
            mode="multiple"
            showSearch
            style={{ width: '100%' }}
            placeholder="选择要配置字段权限的表单（可多选）"
            value={selectedFormIds}
            options={formOptions}
            optionFilterProp="label"
            onChange={(v) => setSelectedFormIds(v.map(String))}
          />
        )}
        <Space style={{ marginTop: 8 }} wrap>
          <Select
            showSearch
            style={{ width: 240 }}
            placeholder="复制自角色（可选）"
            value={copyRoleId}
            options={roleOptions.filter((o) => o.value !== roleId)}
            optionFilterProp="label"
            onChange={(v) => setCopyRoleId(String(v))}
          />
          <Button icon={<CopyOutlined />} onClick={copyFromRole}>复制配置</Button>
          <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!selectedFormIds.length}>导出CSV</Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportVisible(true)} disabled={!selectedFormIds.length}>导入CSV</Button>
        </Space>
      </Card>

      {selectedFormIds.map((formId) => {
        const form = forms.find((f) => f.id === formId);
        const keyword = (fieldSearch[formId] || '').trim().toLowerCase();
        const defs = (fieldDefs[formId] || []).filter((f) =>
          !keyword || String(f.fieldName).toLowerCase().includes(keyword) || String(f.fieldLabel).toLowerCase().includes(keyword));
        const mid = String(modeIdByForm[formId] || formId);
        const selected = selectedFields[formId] || [];
        return (
          <Card key={formId} size="small" title={<Space><span>{form?.name || formId}</span><Tag color="blue">{mid}</Tag></Space>} style={{ marginBottom: 12 }}>
            <Space wrap style={{ marginBottom: 8 }}>
              <Input.Search
                allowClear
                size="small"
                style={{ width: 220 }}
                placeholder="搜索字段"
                value={fieldSearch[formId] || ''}
                onChange={(e) => setFieldSearch((p) => ({ ...p, [formId]: e.target.value }))}
              />
              <Button size="small" onClick={() => setSelectedFields((p) => ({ ...p, [formId]: defs.map((f) => Number(f.id)) }))}>全选</Button>
              <Button size="small" onClick={() => setSelectedFields((p) => ({ ...p, [formId]: [] }))}>清空</Button>
              <Button size="small" onClick={() => setSelectedFields((p) => ({ ...p, [formId]: defs.map((f) => Number(f.id)).filter((id) => !selected.includes(id)) }))}>反选</Button>
              <Select
                size="small"
                style={{ width: 120 }}
                placeholder="批量设置"
                options={RIGHT_OPTIONS}
                onChange={(rv) => setRightsForFields(formId, selected.length ? selected : defs.map((f) => Number(f.id)), rv as RightValue)}
              />
            </Space>
            <Table
              rowKey={(r) => String(r.id)}
              size="small"
              columns={buildColumns(formId)}
              dataSource={defs}
              pagination={false}
              scroll={{ y: 320 }}
              rowSelection={{
                selectedRowKeys: selected.map(String),
                onChange: (keys) => setSelectedFields((p) => ({ ...p, [formId]: keys.map(Number) })),
              }}
            />
          </Card>
        );
      })}

      <Modal
        title="导入字段权限 CSV"
        open={importVisible}
        onCancel={() => { setImportVisible(false); setImportPreview(null); }}
        onOk={applyImport}
        okText="应用导入"
        okButtonProps={{ disabled: !importPreview || importPreview.valid === 0 }}
        width={720}
      >
        <Input.TextArea
          rows={10}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="粘贴从 Excel 复制的 CSV 内容，列：formId,formName,fieldId,fieldName,fieldLabel,objType,objId,rightValue,rightName"
        />
        <Button style={{ marginTop: 8 }} onClick={previewImport}>预览差异</Button>
        {importPreview && (
          <div style={{ marginTop: 8 }}>
            <div>有效配置：{importPreview.valid} 条；错误：{importPreview.errors.length} 条</div>
            {importPreview.errors.map((e, i) => <div key={i} style={{ color: '#ff4d4f' }}>{e}</div>)}
          </div>
        )}
      </Modal>
    </Drawer>
  );
};

export default SubjectFieldRightDrawer;
