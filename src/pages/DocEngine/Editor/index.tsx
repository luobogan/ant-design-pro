import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  message,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import { getEditorConfig, getEngineSetting, saveEngineSetting, searchDocPage, listCategoryTree, DocDetail, DocSecCategory } from '@/services/doc';
import UniverEditor from './UniverEditor';
import WpsEditor from './WpsEditor';
import PdfViewer from './PdfViewer';

/**
 * 内容引擎 - 在线编辑 / 预览（菜单 code=docengine_editor, path=/docengine/editor）。
 *
 * 三方案按文件类型 + 方案入参清晰分工、可共存：
 *   - Univer（开源）：Office 文档（xlsx/xls/csv/docx/doc/pptx/ppt）在线编辑；
 *   - WPS SDK（kdocs jssdk）：同为 Office 文档的可选在线编辑方案（需配置 appId/secret）；
 *   - PDF.js（开源）：PDF 文件只读预览（pdfjs 为只读，与编辑方案互不冲突）。
 * 后端 /doc/editor/config 据主文件扩展名 + editor 入参返回对应配置。
 *
 * 文档ID 支持手动输入，也可点「选择文档」弹出检索框从文档中心挑选（按标题/编号搜索）。
 */
const DocEditor: React.FC = () => {
  const [cfg, setCfg] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState<string>('auto');
  const [defaultEngine, setDefaultEngine] = useState<string>('univer');
  const [thirdPlatform, setThirdPlatform] = useState<string>('none');
  const [wpsAppId, setWpsAppId] = useState<string>('');
  const [wpsAppSecret, setWpsAppSecret] = useState<string>('');
  const [wpsJssdkUrl, setWpsJssdkUrl] = useState<string>('');
  const [wpsEnabled, setWpsEnabled] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // 加载编辑器默认设置（默认方案 univer/wps + 第三方平台接入配置），用于「自动」选项与设置面板
  useEffect(() => {
    getEngineSetting()
      .then((s: any) => {
        if (s) {
          setDefaultEngine(s.defaultEngine || 'univer');
          setThirdPlatform(s.thirdPlatform || 'none');
          setWpsAppId(s.wpsAppId || '');
          setWpsAppSecret(s.wpsAppSecret || '');
          setWpsJssdkUrl(s.wpsJssdkUrl || '');
          setWpsEnabled(!!s.wpsEnabled);
        }
      })
      .catch(() => {});
  }, []);

  const onSaveSetting = async () => {
    setSaving(true);
    try {
      await saveEngineSetting({
        defaultEngine,
        thirdPlatform,
        wpsAppId,
        wpsAppSecret,
        wpsJssdkUrl,
      });
      message.success('已保存编辑器设置');
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 文档选择弹框
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [docs, setDocs] = useState<DocDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [kw, setKw] = useState('');
  const [catId, setCatId] = useState<number | string | undefined>(undefined);
  const [catOptions, setCatOptions] = useState<{ value: any; label: string }[]>([]);

  const onGet = async (pDocId?: string, pFileId?: string, pMode?: string, pEditor?: string) => {
    let id = pDocId;
    let mode = pMode;
    let fileId = pFileId;
    if (!id) {
      const v = await form.validateFields();
      id = v.docId;
      mode = v.mode;
      fileId = undefined;
    } else {
      form.setFieldsValue({ docId: id, mode: mode || 'edit' });
    }
    if (!id) {
      message.warning('请选择文档');
      return;
    }
    setLoading(true);
    try {
      setCfg(await getEditorConfig(id, mode || 'edit', pEditor || editor, fileId));
    } catch (e: any) {
      message.error(e?.msg || '获取失败');
      setCfg(null);
    } finally {
      setLoading(false);
    }
  };

  // 支持从详情页「用 Univer 打开」带 docId/fileId 直达预览
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const qDocId = qs.get('docId');
    if (qDocId) {
      onGet(
        qDocId,
        qs.get('fileId') || undefined,
        qs.get('mode') || undefined,
        qs.get('editor') || undefined,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDocs = async (p: number, keyword: string, secCategoryId?: number | string) => {
    setPickerLoading(true);
    try {
      const res = await searchDocPage({ current: p, size: 10, keyword, secCategoryId });
      setDocs(res.list);
      setTotal(res.total);
      setPage(p);
      setKw(keyword);
    } catch (e: any) {
      message.error(e?.msg || '文档检索失败');
    } finally {
      setPickerLoading(false);
    }
  };

  // 目录树拍平成下拉选项（兼容嵌套 children 与平铺两种返回）
  const flattenCats = (list: any[], depth = 0): { value: any; label: string }[] => {
    if (!list) return [];
    return list.flatMap((c: any) => [
      { value: c.id, label: (depth > 0 ? '　'.repeat(depth) : '') + (c.name || '') },
      ...flattenCats(c.children || [], depth + 1),
    ]);
  };

  const openPicker = () => {
    setPickerOpen(true);
    fetchDocs(1, '', catId);
    listCategoryTree()
      .then((list) => setCatOptions(flattenCats(list || [])))
      .catch(() => {});
  };

  const chooseDoc = (row: DocDetail) => {
    form.setFieldsValue({ docId: row.id });
    setPickerOpen(false);
    onGet(String(row.id));
  };

  // 按「方案 + 扩展名」判断能否预览/编辑；不支持的格式统一提示「格式不正确」
  // - pdfjs：仅 pdf
  // - univer（开源）：docx/xlsx/pptx/csv（Univer 不支持老版二进制 .doc/.xls/.ppt 与 .wps/.et）
  // - wps：doc/docx/xls/xlsx/ppt/pptx/wps/et（需后端启用 WPS 方案）
  const UNIVER_EXT = ['docx', 'xlsx', 'pptx', 'csv'];
  const WPS_EXT = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'wps', 'et'];
  const canPreview = (cfg: any) => {
    const ext = (cfg?.fileExt || '').toLowerCase();
    switch (cfg?.editorType) {
      case 'pdfjs':
        return ext === 'pdf';
      case 'univer':
        return UNIVER_EXT.includes(ext);
      case 'wps':
        return WPS_EXT.includes(ext);
      default:
        return false;
    }
  };

  const dispatch = (c: any) => {
    switch (c?.editorType) {
      case 'wps':
        return <WpsEditor cfg={c} />;
      case 'pdfjs':
        return <PdfViewer cfg={c} />;
      case 'univer':
      default:
        return <UniverEditor cfg={c} />;
    }
  };

  const columns = [
    { title: '文档ID', dataIndex: 'id', width: 120 },
    {
      title: '标题',
      dataIndex: 'docSubject',
      render: (text: string, row: DocDetail) => (
        <a onClick={() => chooseDoc(row)} style={{ fontWeight: 600 }} title="点击选择该文档">
          {text || '(未命名)'}
        </a>
      ),
    },
    {
      title: '状态',
      dataIndex: 'docStatus',
      width: 70,
      render: (s: number) => <Tag>{s ?? '-'}</Tag>,
    },
    {
      title: '操作',
      width: 70,
      render: (_: any, row: DocDetail) => (
        <Button type="link" onClick={() => chooseDoc(row)}>
          选择
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card title="编辑器设置（默认引擎 / 第三方平台）" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <span>默认打开方式：</span>
            <Radio.Group value={defaultEngine} onChange={(e) => setDefaultEngine(e.target.value)}>
              <Radio value="univer">Univer（开源）</Radio>
              <Radio value="wps" disabled={thirdPlatform !== 'wps' || !wpsEnabled}>
                WPS（{thirdPlatform !== 'wps' ? '未启用第三方平台' : wpsEnabled ? '可用' : '未填写 appId/appSecret'}）
              </Radio>
            </Radio.Group>
            <span style={{ color: '#888' }}>
              当前默认：{defaultEngine === 'wps' ? 'WPS' : 'Univer'}（方案选「自动」时生效）
            </span>
          </Space>

          <Space wrap align="start">
            <span>第三方平台：</span>
            <Select
              value={thirdPlatform}
              style={{ width: 200 }}
              onChange={(v) => setThirdPlatform(v)}
              options={[
                { value: 'none', label: '无（仅用 Univer）' },
                { value: 'wps', label: 'WPS 在线编辑（kdocs jssdk）' },
              ]}
            />
            <Button type="primary" loading={saving} onClick={onSaveSetting}>
              保存默认设置
            </Button>
          </Space>

          {thirdPlatform === 'wps' && (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Input
                addonBefore="app-id"
                placeholder="WPS 开放平台应用 ID"
                value={wpsAppId}
                onChange={(e) => setWpsAppId(e.target.value)}
                style={{ width: 520 }}
              />
              <Input.Password
                addonBefore="app-secret"
                placeholder="WPS 开放平台应用密钥（用于服务端签名）"
                value={wpsAppSecret}
                onChange={(e) => setWpsAppSecret(e.target.value)}
                style={{ width: 520 }}
              />
              <Input
                addonBefore="jssdk"
                placeholder="kdocs jssdk 脚本地址"
                value={wpsJssdkUrl}
                onChange={(e) => setWpsJssdkUrl(e.target.value)}
                style={{ width: 520 }}
              />
            </Space>
          )}
        </Space>
      </Card>
      <Card title="在线编辑 / 预览">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="多格式在线编辑与预览：Univer / WPS SDK / PDF.js 三方案共存"
          description="Office 文档可在「Univer / WPS」间切换；PDF 固定走 PDF.js 只读预览。文档ID 可输入，也可点「选择文档」从文档中心检索。"
        />
      <Form form={form} layout="inline" initialValues={{ mode: 'edit' }}>
        <Form.Item
          name="docId"
          label="文档ID"
          rules={[{ required: true, message: '请输入或选择文档' }]}
        >
          <Input placeholder="docId" style={{ width: 240 }} />
        </Form.Item>
        <Form.Item>
          <Button onClick={openPicker}>选择文档</Button>
        </Form.Item>
        <Form.Item name="mode" label="模式">
          <Input placeholder="edit/view" style={{ width: 120 }} />
        </Form.Item>
        <Form.Item label="方案">
          <Radio.Group
            value={editor}
            onChange={(e) => setEditor(e.target.value)}
            optionType="button"
          >
            <Radio value="auto">自动（默认 {defaultEngine === 'wps' ? 'WPS' : 'Univer'}）</Radio>
            <Radio value="univer">Univer</Radio>
            <Radio value="wps">WPS</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item>
          <Button type="primary" loading={loading} onClick={() => onGet()}>
            获取配置
          </Button>
        </Form.Item>
      </Form>

      {cfg && (
        <>
          <Descriptions style={{ marginTop: 16 }} bordered column={2} size="small">
            <Descriptions.Item label="编辑器方案">{cfg.editorType}</Descriptions.Item>
            <Descriptions.Item label="文件类型">{cfg.fileExt || '-'}</Descriptions.Item>
            <Descriptions.Item label="文件名">{cfg.fileName || '-'}</Descriptions.Item>
            <Descriptions.Item label="只读">{String(cfg.readOnly ?? false)}</Descriptions.Item>
            <Descriptions.Item label="预览">{String(cfg.preview ?? false)}</Descriptions.Item>
            <Descriptions.Item label="加载URL">{cfg.documentUrl || '-'}</Descriptions.Item>
          </Descriptions>
          {canPreview(cfg) ? (
            dispatch(cfg)
          ) : (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              message="格式不正确"
              description={`当前格式「${cfg.fileExt || '未知'}」暂不支持在线预览/编辑，仅支持 docx/xlsx/pdf 等 Office 与 PDF 格式。`}
            />
          )}
        </>
      )}

      <Modal
        title="选择文档"
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        footer={null}
        width={760}
        destroyOnClose
      >
        <Space style={{ marginBottom: 12 }} wrap>
          <select
            value={catId ?? ''}
            onChange={(e) => {
              const v = e.target.value ? e.target.value : undefined;
              setCatId(v);
              fetchDocs(1, kw, v);
            }}
            style={{ width: 200, height: 32, padding: '0 8px' }}
          >
            <option value="">全部目录</option>
            {catOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Input.Search
            placeholder="按标题/编号搜索"
            value={kw}
            allowClear
            enterButton
            style={{ width: 320 }}
            onChange={(e) => setKw(e.target.value)}
            onSearch={(v) => fetchDocs(1, v, catId)}
          />
        </Space>
        <Table<DocDetail>
          rowKey="id"
          size="small"
          loading={pickerLoading}
          dataSource={docs}
          columns={columns}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => fetchDocs(p, kw, catId),
          }}
        />
      </Modal>
    </Card>
    </>
  );
};

export default DocEditor;
