import React, { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select, Switch, Table, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { numberApi, odocDictApi, type OdocNumber } from '@/services/workflow';

/** 年份格式串：〔 + (显示年份? YYYY : '') + 〕 */
function yearText(r: OdocNumber): string {
  const pre = r.yearPre ?? '';
  const end = r.yearEnd ?? '';
  const year = r.showYear === 1 ? 'YYYY' : '';
  return `${pre}${year}${end}`;
}

/** 流水串：前缀 + 当前号（补零到 digit 位） */
function serialText(r: OdocNumber): string {
  const pre = r.serialPre ?? '';
  const cur = r.serial ?? 0;
  const digit = r.digit && r.digit > 0 ? r.digit : 0;
  const shown = r.fillZero === 1 && digit > 0 ? String(cur).padStart(digit, '0') : String(cur);
  return `${pre}${shown}`;
}

/**
 * 发文字号规则维护（对应 E9 odoc_numberManage / docNumber）。
 * 对应后端 /odoc/number/rule(s)（WfOdocController）；定稿节点取号由 WfOdocNumberAssignListener 消费。
 */
const OdocNumberManage: React.FC = () => {
  const [list, setList] = useState<OdocNumber[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [current, setCurrent] = useState<OdocNumber | null>(null);
  const [form] = Form.useForm();
  const [orgAbbrOptions, setOrgAbbrOptions] = useState<{ value: any; label: string }[]>([]);
  const [orgAbbrNameMap, setOrgAbbrNameMap] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await numberApi.rules();
      setList((res?.data as OdocNumber[]) || []);
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 机构代字字典（org_abbr），供文号「机关代字」下拉选择（对齐 E9 机构代字主数据）
  useEffect(() => {
    odocDictApi
      .list('org_abbr')
      .then((r) => {
        const arr = (r?.data as any[]) || [];
        setOrgAbbrOptions(
          arr.map((d) => ({ value: d.id, label: `${d.name}${d.code ? `（${d.code}）` : ''}` })),
        );
        const m: Record<string, string> = {};
        arr.forEach((d) => {
          if (d.id != null) m[String(d.id)] = d.name;
        });
        setOrgAbbrNameMap(m);
      })
      .catch(() => {
        setOrgAbbrOptions([]);
        setOrgAbbrNameMap({});
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const openAdd = () => {
    setCurrent(null);
    form.resetFields();
    form.setFieldsValue({ showYear: true, fillZero: true, digit: 3, isOpen: true, yearReset: true, serial: 0 });
    setEditOpen(true);
  };
  const openEdit = (r: OdocNumber) => {
    setCurrent(r);
    form.setFieldsValue({
      ...r,
      orgAbbrId: r.orgAbbrId != null ? String(r.orgAbbrId) : undefined,
      yearReset: r.yearReset !== 0,
      showYear: r.showYear === 1,
      fillZero: r.fillZero === 1,
      isOpen: r.isOpen === 1,
    });
    setEditOpen(true);
  };
  const handleSubmit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      const payload: OdocNumber = {
        id: current?.id,
        typeName: v.typeName,
        prefix: v.prefix,
        orgAbbrId: v.orgAbbrId ? Number(v.orgAbbrId) : undefined,
        yearReset: v.yearReset ? 1 : 0,
        yearPre: v.yearPre,
        yearEnd: v.yearEnd,
        showYear: v.showYear ? 1 : 0,
        serialPre: v.serialPre,
        digit: v.digit,
        fillZero: v.fillZero ? 1 : 0,
        defIds: v.defIds,
        isOpen: v.isOpen ? 1 : 0,
      };
      if (current?.id) {
        await numberApi.updateRule(payload);
      } else {
        await numberApi.createRule(payload);
      }
      message.success('已保存');
      setEditOpen(false);
      reload();
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };
  const handleRemove = async (id: any) => {
    try {
      await numberApi.removeRule(id);
      message.success('已删除');
      reload();
    } catch (e: any) {
      message.error(e?.msg || '删除失败');
    }
  };

  const columns = [
    { title: '文号名称', dataIndex: 'typeName', key: 'typeName', width: 140, render: (v: string) => v || '-' },
    { title: '机关代字', dataIndex: 'prefix', key: 'prefix', width: 110, render: (v: string) => v || '-' },
    { title: '年份格式', key: 'year', width: 130, render: (_: any, r: OdocNumber) => yearText(r) || '-' },
    { title: '当前流水', key: 'serial', width: 120, render: (_: any, r: OdocNumber) => serialText(r) },
    { title: '位数', dataIndex: 'digit', key: 'digit', width: 70, render: (v: number) => v ?? '-' },
    { title: '绑定流程', dataIndex: 'defIds', key: 'defIds', ellipsis: true, render: (v: string) => v || '全部' },
    {
      title: '启用',
      dataIndex: 'isOpen',
      key: 'isOpen',
      width: 80,
      render: (v: number) => <Tag color={v === 1 ? 'green' : 'default'}>{v === 1 ? '启用' : '停用'}</Tag>,
    },
    {
      title: '已用',
      dataIndex: 'isUsed',
      key: 'isUsed',
      width: 70,
      render: (v: number) => (v === 1 ? <Tag color="blue">是</Tag> : '否'),
    },
    {
      title: '操作',
      key: 'op',
      width: 120,
      render: (_: any, r: OdocNumber) => (
        <>
          <Button type="link" size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Button type="link" size="small" danger onClick={() => handleRemove(r.id)}>
            删除
          </Button>
        </>
      ),
    },
  ];

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          新增文号规则
        </Button>
      </div>
      <Table<OdocNumber> rowKey="id" loading={loading} columns={columns} dataSource={list} pagination={false} />

      <Modal
        title={current ? '编辑文号规则' : '新增文号规则'}
        open={editOpen}
        onOk={handleSubmit}
        onCancel={() => setEditOpen(false)}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="typeName" label="文号名称" rules={[{ required: true, message: '请输入文号名称' }]}>
            <Input placeholder="如：普发文件" />
          </Form.Item>
          <Form.Item
            name="orgAbbrId"
            label="机构代字（字典）"
            tooltip="从机构代字主数据下拉选择，选后自动填入下方「机关代字」；也可手填下方文本"
          >
            <Select
              allowClear
              placeholder="选择机构代字"
              options={orgAbbrOptions}
              onChange={(val) => {
                if (val != null) {
                  const name = orgAbbrNameMap[String(val)];
                  if (name) form.setFieldsValue({ prefix: name });
                }
              }}
            />
          </Form.Item>
          <Form.Item name="prefix" label="机关代字" rules={[{ required: true, message: '请输入或选择机关代字' }]}>
            <Input placeholder="如：X政发（与机构代字字典一致）" />
          </Form.Item>
          <Form.Item name="showYear" label="显示年份" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="yearPre" label="年份前缀">
            <Input placeholder="如：〔" />
          </Form.Item>
          <Form.Item name="yearEnd" label="年份后缀">
            <Input placeholder="如：〕" />
          </Form.Item>
          <Form.Item name="serialPre" label="流水前缀">
            <Input placeholder="如：第" />
          </Form.Item>
          <Form.Item name="digit" label="流水位数">
            <InputNumber min={0} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="fillZero" label="流水补零" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="defIds" label="绑定流程定义ID（逗号分隔，留空=全部）">
            <Input placeholder="留空对所有流程生效" />
          </Form.Item>
          <Form.Item name="isOpen" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            name="yearReset"
            label="跨年流水归零"
            valuePropName="checked"
            tooltip="开=进入新历年流水从 1 重计；关=跨年累计不断号（如档案类文号）"
          >
            <Switch />
          </Form.Item>
          {current ? (
            <Form.Item label="当前流水号">
              <Input value={String(current.serial ?? 0)} disabled />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
};

export default OdocNumberManage;
