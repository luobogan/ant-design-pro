import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import { ImportOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { portalApi } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { PortalPage, PortalPageExportData, PortalPageSaveData, PortalPageShare, PortalTheme } from '@/services/portal';
import PortalShareEditor from '../components/PortalShareEditor';

const { Text } = Typography;

/**
 * 门户页面管理
 *
 * 门户（blade_portal_page）的新建 / 编辑 / 设默认 / 删除。
 * 后端接口：GET /page/list、POST /page/submit、POST /page/default、POST /page/remove。
 *
 * 设计原则：门户页面是「配置容器」——删除页面会级联逻辑删除其元素与授权，
 * 因此删除用 Popconfirm 二次确认；默认页同一时刻只有一个（后端保证）。
 */
const PortalPageManage: React.FC = () => {
  // 按钮权限挂在「门户(portal)」菜单下（portal_page_manage），故显式指定 menuCode
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_page_manage');

  const [list, setList] = useState<PortalPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PortalPage | null>(null);
  const [form] = Form.useForm<PortalPageSaveData>();
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [themes, setThemes] = useState<PortalTheme[]>([]);

  /* 页面可见范围（授权：1全员/2部门/3个人，对标 elementshareinfo） */
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePage, setSharePage] = useState<PortalPage | null>(null);
  const [shareItems, setShareItems] = useState<PortalPageShare[]>([]);
  const [shareAll, setShareAll] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);

  useEffect(() => {
    portalApi
      .getThemeList()
      .then((data) => setThemes(data || []))
      .catch(() => setThemes([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.getPageList();
      setList(data || []);
    } catch (e) {
      console.error('[portal] 加载门户页面失败', e);
      message.error('加载门户页面失败');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isDefault: 0, pageType: 1, sort: 0 });
    setModalOpen(true);
  };

  const openEdit = (record: PortalPage) => {
    setEditing(record);
    form.setFieldsValue({
      pageId: record.id,
      pageCode: record.pageCode,
      pageName: record.pageName,
      isDefault: record.isDefault,
      pageType: record.pageType ?? 1,
      sort: record.sort,
      theme: record.theme,
      remark: record.remark,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const ok = await portalApi.submitPage({
        pageId: editing?.id,
        pageCode: values.pageCode,
        pageName: values.pageName,
        isDefault: values.isDefault ? 1 : 0,
        pageType: values.pageType ?? 1,
        sort: values.sort,
        theme: values.theme,
        remark: values.remark,
      });
      if (ok) {
        message.success(editing ? '页面已更新' : '页面已创建');
        setModalOpen(false);
        load();
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存门户页面失败', e);
      message.error('保存失败，请检查页面编码是否重复');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (record: PortalPage) => {
    try {
      const ok = await portalApi.setDefaultPage(record.id as number);
      if (ok) {
        message.success(`「${record.pageName}」已设为默认门户`);
        load();
      } else {
        message.error('设置失败');
      }
    } catch (e) {
      console.error('[portal] 设置默认门户失败', e);
      message.error('设置失败');
    }
  };

  const handleRemove = async (record: PortalPage) => {
    try {
      const ok = await portalApi.removePage(record.id as number);
      if (ok) {
        message.success(`「${record.pageName}」已删除`);
        load();
      } else {
        message.error('删除失败');
      }
    } catch (e) {
      console.error('[portal] 删除门户页面失败', e);
      message.error('删除失败');
    }
  };

  const handleExport = async (record: PortalPage) => {
    try {
      const data = await portalApi.exportPage(record.id as number);
      if (!data || !data.page) {
        message.error('导出失败：未获取到配置');
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${record.pageCode || 'portal'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success(`已导出「${record.pageName}」配置`);
    } catch (e) {
      console.error('[portal] 导出失败', e);
      message.error('导出失败');
    }
  };

  const beforeImportUpload = (file: File) => {
    const isJson =
      file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
    if (!isJson) {
      message.error('仅支持 JSON 文件');
      return Upload.LIST_IGNORE;
    }
    setImportFile(file);
    return false;
  };

  const handleImport = async () => {
    if (!importFile) {
      message.error('请先选择 JSON 文件');
      return;
    }
    setImporting(true);
    try {
      const text = await importFile.text();
      const data = JSON.parse(text) as PortalPageExportData;
      if (!data.page) {
        message.error('文件格式不正确：缺少 page 字段');
        return;
      }
      const newId = await portalApi.importPage(data);
      message.success(`导入成功，新页面ID：${newId}`);
      setImportOpen(false);
      setImportFile(null);
      load();
    } catch (e) {
      console.error('[portal] 导入失败', e);
      message.error('导入失败：' + (e instanceof Error ? e.message : '请检查文件格式'));
    } finally {
      setImporting(false);
    }
  };

  /* 复制页面（页面 + 元素 + 授权） */
  const handleDuplicate = async (record: PortalPage) => {
    try {
      const newId = await portalApi.duplicatePage(record.id as number);
      if (newId != null) {
        message.success(`已复制为「${record.pageName} 副本」`);
        load();
      } else {
        message.error('复制失败');
      }
    } catch (e) {
      console.error('[portal] 复制页面失败', e);
      message.error('复制失败');
    }
  };

  /* ==================== 页面可见范围（授权） ==================== */
  const openShare = async (record: PortalPage) => {
    setSharePage(record);
    setShareOpen(true);
    setShareLoading(true);
    try {
      const items = (await portalApi.getPageShareList(record.id as number)) || [];
      setShareItems(items.filter((s) => s.shareType !== 1));
      setShareAll(items.some((s) => s.shareType === 1));
    } catch (e) {
      console.error('[portal] 加载页面授权失败', e);
      message.error('加载授权失败');
      setShareItems([]);
      setShareAll(false);
    } finally {
      setShareLoading(false);
    }
  };

  const submitShare = async () => {
    if (!sharePage) return;
    setShareSaving(true);
    try {
      // 全员可见优先：开启时仅提交 shareType=1；否则提交部门/个人集合
      const payload: PortalPageShare[] = shareAll
        ? [{ shareType: 1, shareId: 0 }]
        : shareItems.filter((s) => s.shareType === 2 || s.shareType === 3 || s.shareType === 4 || s.shareType === 5);
      const ok = await portalApi.savePageShare(sharePage.id as number, payload);
      if (ok) {
        message.success('可见范围已更新');
        setShareOpen(false);
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存页面授权失败', e);
      message.error('保存失败');
    } finally {
      setShareSaving(false);
    }
  };

  const columns = [
    {
      title: '页面名称',
      dataIndex: 'pageName',
      key: 'pageName',
      render: (v: string, r: PortalPage) => (
        <Space>
          <Text strong>{v}</Text>
          {r.isDefault === 1 && <Tag color="blue">默认</Tag>}
        </Space>
      ),
    },
    { title: '页面编码', dataIndex: 'pageCode', key: 'pageCode', width: 160 },
    {
      title: '类型',
      dataIndex: 'pageType',
      key: 'pageType',
      width: 110,
      render: (v: number) =>
        v === 0 ? <Tag color="orange">登录前</Tag> : <Tag color="blue">登录后</Tag>,
    },
    {
      title: '访问',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 90,
      render: (v: number) => (v && v > 0 ? v.toLocaleString() : 0),
    },
    { title: '主题', dataIndex: 'theme', key: 'theme', width: 100, render: (v: string) => v || 'default' },
    { title: '排序', dataIndex: 'sort', key: 'sort', width: 70 },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      render: (_: any, record: PortalPage) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => handleExport(record)}>
            导出
          </Button>
          <Button type="link" size="small" onClick={() => history.push(`/portal/design?pageId=${record.id}`)}>
            设计
          </Button>
          <Button type="link" size="small" disabled={!canManage} onClick={() => handleDuplicate(record)}>
            复制
          </Button>
          <Button type="link" size="small" disabled={!canManage} onClick={() => openShare(record)}>
            可见范围
          </Button>
          {record.isDefault !== 1 && (
            <Button type="link" size="small" onClick={() => handleSetDefault(record)}>
              设为默认
            </Button>
          )}
          <Button type="link" size="small" disabled={!canManage} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="删除门户页面"
            description="将同时删除该页面的元素与授权配置，不可恢复。"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => handleRemove(record)}
          >
            <Button type="link" size="small" danger disabled={!canManage}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>
            门户页面管理
          </Typography.Title>
          <Text type="secondary">管理门户页面（容器）与默认页；元素编排请进入「设计」</Text>
        </Space>
        <Space>
          <Button icon={<ImportOutlined />} disabled={!canManage} onClick={() => setImportOpen(true)}>
            导入
          </Button>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} disabled={!canManage} onClick={openCreate}>
            新建页面
          </Button>
        </Space>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="提示"
        description="登录用户看到的是「被授权的默认门户」；删除页面会级联清理其元素、授权与个性化设置。"
      />

      <Table
        rowKey="id"
        loading={loading}
        columns={columns as any}
        dataSource={list}
        pagination={false}
      />

      <Modal
        title={editing ? '编辑门户页面' : '新建门户页面'}
        open={modalOpen}
        onOk={handleSubmit}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="pageName"
            label="页面名称"
            rules={[{ required: true, message: '请输入页面名称' }]}
          >
            <Input placeholder="如：集团门户" maxLength={64} />
          </Form.Item>
          <Form.Item
            name="pageCode"
            label="页面编码"
            rules={[
              { required: true, message: '请输入页面编码' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: '仅支持字母、数字、下划线与连字符' },
            ]}
            extra="编码唯一，供接口按 code 指定门户页"
          >
            <Input placeholder="如：default、group" maxLength={64} disabled={!!editing} />
          </Form.Item>
          <Form.Item name="isDefault" label="设为默认门户" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item name="pageType" label="页面类型" extra="登录后门户=登录后首页；登录前门户=登录页展示（免登录）">
            <Select
              options={[
                { value: 1, label: '登录后门户' },
                { value: 0, label: '登录前门户' },
              ]}
            />
          </Form.Item>
          <Form.Item name="sort" label="排序号" extra="数字越小越靠前（管理端展示顺序）">
            <Input type="number" placeholder="0" />
          </Form.Item>
          <Form.Item
            name="theme"
            label="绑定主题"
            extra="选择主题库中的主题；留空则使用租户默认主题"
          >
            <Select
              allowClear
              placeholder="默认主题"
              options={themes.map((t) => ({ value: t.themeKey, label: t.themeName }))}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="页面用途说明" maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入门户页面"
        open={importOpen}
        onOk={handleImport}
        confirmLoading={importing}
        onCancel={() => {
          setImportOpen(false);
          setImportFile(null);
        }}
        okText="导入"
        cancelText="取消"
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
          <Upload
            accept=".json,application/json"
            maxCount={1}
            beforeUpload={beforeImportUpload}
            onRemove={() => setImportFile(null)}
          >
            <Button icon={<ImportOutlined />}>选择 JSON 文件</Button>
          </Upload>
          <Alert
            type="info"
            showIcon
            message="导入说明"
            description="将按文件重建页面、元素与授权，自动生成唯一页面编码；导入页不会抢占默认首页。"
          />
        </Space>
      </Modal>

      <Modal
        title={`可见范围 · ${sharePage?.pageName || ''}`}
        open={shareOpen}
        onOk={submitShare}
        confirmLoading={shareSaving}
        onCancel={() => setShareOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Spin spinning={shareLoading}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="登录用户仅能看到被授权的门户页；默认页/机构默认页同样受此授权约束。"
          />
          <PortalShareEditor
            all={shareAll}
            onAllChange={(v) => {
              setShareAll(v);
              if (v) setShareItems([]);
            }}
            items={shareItems}
            onItemsChange={setShareItems}
          />
        </Spin>
      </Modal>
    </div>
  );
};

export default PortalPageManage;
