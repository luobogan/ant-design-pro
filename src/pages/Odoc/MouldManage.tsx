import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Upload,
  message,
} from 'antd';
import { PlusOutlined, ScanOutlined } from '@ant-design/icons';
import { request } from 'umi';
import {
  mouldApi,
  type OdocBookmark,
  type OdocMould,
} from '@/services/workflow';

interface MouldManageProps {
  /** 流程定义ID（空=仅全局模板） */
  defId?: any;
}

const mouldTypeLabel: Record<number, string> = {
  1: '编辑模板',
  2: '套红模板',
  3: '打印模板',
  4: '版式模板',
};

interface BookmarkRow {
  id: any;
  name?: string;
  descript?: string;
  isContent: boolean;
  fieldKey?: string;
}

/**
 * 红头模板管理：上传 .docx 模板 → 扫描书签 → 标注「正文占位书签」与「书签→表单字段」映射。
 * 套红节点使用的套红模板即在此维护。
 */
const MouldManage: React.FC<MouldManageProps> = ({ defId }) => {
  const [list, setList] = useState<OdocMould[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [pendingFileId, setPendingFileId] = useState<any>(undefined);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [current, setCurrent] = useState<OdocMould | null>(null);
  const [rows, setRows] = useState<BookmarkRow[]>([]);
  const [savingBookmarks, setSavingBookmarks] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await mouldApi.list(defId);
      setList(data || []);
    } finally {
      setLoading(false);
    }
  }, [defId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleUpload = async (options: any) => {
    const fd = new FormData();
    fd.append('file', options.file);
    try {
      const res: any = await request('/api/blade-workflow/odoc/file/upload', {
        method: 'POST',
        data: fd,
        skipErrorHandler: true,
      });
      if (res?.data?.id) {
        setPendingFileId(res.data.id);
        options.onSuccess(res.data);
      } else {
        options.onError(new Error('上传失败'));
        message.error('文件上传失败');
      }
    } catch (e) {
      options.onError(e);
      message.error('文件上传失败');
    }
  };

  const handleCreate = async () => {
    const v = await form.validateFields();
    if (pendingFileId == null) {
      message.warning('请先上传 .docx 模板文件');
      return;
    }
    setSubmitting(true);
    try {
      await mouldApi.create({
        mouldName: v.mouldName,
        mouldType: v.mouldType,
        fileId: pendingFileId,
        defId,
        docTypeCode: v.docTypeCode,
      });
      message.success('模板已创建');
      setCreateOpen(false);
      form.resetFields();
      setPendingFileId(undefined);
      reload();
    } catch (e: any) {
      message.error(e?.msg || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openBookmarks = async (mould: OdocMould) => {
    setCurrent(mould);
    setDrawerOpen(true);
    setRows([]);
    try {
      const [bms, maps] = await Promise.all([
        mouldApi.bookmarks(mould.id),
        mouldApi.fieldMaps(mould.id).catch(() => []),
      ]);
      const mapByBm: Record<string, string> = {};
      (maps || []).forEach((m: any) => {
        if (m?.bookmarkId != null) mapByBm[String(m.bookmarkId)] = m.fieldKey;
      });
      setRows(
        (bms || []).map((b: OdocBookmark) => ({
          id: b.id,
          name: b.name,
          descript: b.descript,
          isContent: b.isContent === 1,
          fieldKey: mapByBm[String(b.id)],
        })),
      );
    } catch (e: any) {
      message.error(e?.msg || '加载书签失败');
    }
  };

  const handleExtract = async (mould: OdocMould) => {
    try {
      await mouldApi.extractBookmarks(mould.id);
      message.success('书签已重新扫描');
      openBookmarks(mould);
    } catch (e: any) {
      message.error(e?.msg || '扫描失败');
    }
  };

  const handleSaveBookmarks = async () => {
    if (!current) return;
    setSavingBookmarks(true);
    try {
      await mouldApi.updateBookmarks(
        current.id!,
        rows.map((r) => ({ id: r.id, isContent: r.isContent ? 1 : 0, descript: r.descript })),
      );
      await mouldApi.saveFieldMaps(
        current.id!,
        defId,
        rows
          .filter((r) => !r.isContent && r.fieldKey)
          .map((r) => ({ bookmarkId: r.id, fieldKey: r.fieldKey, scope: 'main', dateShowType: 0 })),
      );
      message.success('书签/字段映射已保存');
      setDrawerOpen(false);
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    } finally {
      setSavingBookmarks(false);
    }
  };

  const updateRow = (id: any, patch: Partial<BookmarkRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            form.setFieldsValue({ mouldType: 2 });
            setPendingFileId(undefined);
            setCreateOpen(true);
          }}
        >
          新建模板
        </Button>
        <span style={{ color: '#999' }}>上传含红头与书签的 .docx，扫描书签后配置正文占位与字段映射</span>
      </Space>

      <Table<OdocMould>
        rowKey="id"
        loading={loading}
        dataSource={list}
        pagination={false}
        columns={[
          { title: '模板名', dataIndex: 'mouldName' },
          {
            title: '类型',
            dataIndex: 'mouldType',
            render: (t: number) => <Tag>{mouldTypeLabel[t] || t}</Tag>,
          },
          { title: '文种', dataIndex: 'docTypeCode' },
          {
            title: '适用范围',
            render: (_: any, r) => (r.defId ? '当前流程' : '全局'),
          },
          {
            title: '操作',
            render: (_: any, r) => (
              <Space>
                <Button size="small" onClick={() => openBookmarks(r)}>
                  书签/映射
                </Button>
                <Button size="small" icon={<ScanOutlined />} onClick={() => handleExtract(r)}>
                  重新扫描
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={async () => {
                    await mouldApi.remove(r.id);
                    message.success('已删除');
                    reload();
                  }}
                >
                  删除
                </Button>
              </Space>
            ),
          },
        ]}
      />

      {/* 新建模板 */}
      <Modal
        open={createOpen}
        title="新建模板"
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
      >
        <div
          style={{
            background: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 12,
            color: '#389e0d',
            lineHeight: 1.6,
          }}
        >
          命名约定：把 docx 里的<b>书签名直接设为「表单字段名（列名）」</b>，套红时即可自动填充，
          <b>无需逐书签配置</b>；仅当书签名与字段名不一致时，才需要在「书签/映射」里指定对应字段。
        </div>
        <Form form={form} layout="vertical" initialValues={{ mouldType: 2 }}>
          <Form.Item label="模板名" name="mouldName" rules={[{ required: true, message: '请输入模板名' }]}>
            <Input placeholder="如：发文红头-标准" />
          </Form.Item>
          <Form.Item label="模板类型" name="mouldType" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '编辑模板', value: 1 },
                { label: '套红模板', value: 2 },
                { label: '打印模板', value: 3 },
                { label: '版式模板', value: 4 },
              ]}
            />
          </Form.Item>
          <Form.Item label="文种代码" name="docTypeCode">
            <Input placeholder="如 TONGZHI（通知）；可空" />
          </Form.Item>
          <Form.Item label="模板文件(.docx)" required>
            <Upload
              accept=".doc,.docx"
              maxCount={1}
              showUploadList={{ showRemoveIcon: false }}
              customRequest={handleUpload}
              onRemove={() => setPendingFileId(undefined)}
            >
              <Button>选择 .docx 文件</Button>
            </Upload>
            {pendingFileId != null && <Tag color="green" style={{ marginTop: 8 }}>已上传</Tag>}
          </Form.Item>
        </Form>
      </Modal>

      {/* 书签/字段映射编辑 */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={640}
        title={`书签/字段映射 - ${current?.mouldName || ''}`}
        extra={
          <Button type="primary" loading={savingBookmarks} onClick={handleSaveBookmarks}>
            保存
          </Button>
        }
      >
        <p style={{ color: '#999' }}>
          勾选「正文占位」的书签，套红时在该处插入正文（不填字段）；其余书签用于填表单字段值。
          <br />
          约定：<b>书签名 = 表单字段名（列名）时自动填充，留空即可</b>；仅当书签名与字段名不一致时，才在「表单字段名」里填写对应字段。
        </p>
        <Table<BookmarkRow>
          rowKey="id"
          loading={rows.length === 0}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '书签名', dataIndex: 'name' },
            {
              title: '正文占位',
              dataIndex: 'isContent',
              width: 90,
              render: (v: boolean, r) => (
                <Switch checked={v} onChange={(checked) => updateRow(r.id, { isContent: checked })} />
              ),
            },
            {
              title: '表单字段名',
              dataIndex: 'fieldKey',
              render: (v: string, r) =>
                r.isContent ? (
                  <span style={{ color: '#ccc' }}>—</span>
                ) : (
                  <Input
                    value={v}
                    placeholder={`默认同书签名：${r.name || ''}`}
                    onChange={(e) => updateRow(r.id, { fieldKey: e.target.value })}
                  />
                ),
            },
            {
              title: '描述',
              dataIndex: 'descript',
              render: (v: string, r) => (
                <Input value={v} onChange={(e) => updateRow(r.id, { descript: e.target.value })} />
              ),
            },
          ]}
        />
      </Drawer>
    </div>
  );
};

export default MouldManage;
