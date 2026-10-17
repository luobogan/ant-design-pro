import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Descriptions, Popconfirm, Space, Table, Typography, Upload, message } from 'antd';
import { InboxOutlined, ReloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { portalApi } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { PortalElementRegister } from '@/services/portal';

const { Text } = Typography;

/** manifest.json 模板（对标泛微 hpElTemplate.zip 开发模板 §15.3 B6，本地化为文本模板下载） */
const MANIFEST_TEMPLATE = {
  elementType: 'myElement',
  elementName: '我的自定义元素',
  version: '1.0.0',
  desc: '元素描述（可选）',
  dataProvider: '可选：后端取数 Provider 标识（未部署时元素仅登记不取数）',
  settingSchema: {},
};

/** 下载 manifest.json 模板（对标 developguide：下载模板 → 开发 → 注册） */
const downloadManifestTemplate = () => {
  const blob = new Blob([JSON.stringify(MANIFEST_TEMPLATE, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'manifest.json';
  a.click();
  URL.revokeObjectURL(url);
};

const fmtSize = (v?: number) => {
  if (!v) return '-';
  return v > 1024 * 1024 ? `${(v / 1024 / 1024).toFixed(2)} MB` : `${(v / 1024).toFixed(1)} KB`;
};

/**
 * 元素注册（对标泛微 elementregister §15.3 B5 + developguide §15.3 B6）
 * 后端：/element-register/{upload,list,remove}
 * 语义：上传 zip 元素开发包（含 manifest.json）→ 校验（命名规范/租户唯一/不与内置 6 类冲突）
 * → 登记。注册类型经 /element-types 下发；设计器按「后端已注册 ∩ 前端渲染器」呈现，
 * 故自定义元素须前端发版部署对应渲染器后方可设计/渲染（编译型前端约束，UI 明示）。
 */
const PortalElementRegisterPage: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_element_register_manage');

  const [list, setList] = useState<PortalElementRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.getElementRegisterList();
      setList(data || []);
    } catch (e) {
      console.error('[portal] 加载元素注册列表失败', e);
      message.error('加载元素注册列表失败');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      message.error('仅支持 .zip 元素开发包');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('包大小不能超过 10MB');
      return false;
    }
    setUploading(true);
    try {
      const id = await portalApi.uploadElementRegister(file);
      if (id) {
        message.success('元素注册成功');
        setFileList([]);
        load();
      } else {
        message.error('注册失败：包不合法（缺 manifest.json / 命名不规范 / 与内置类型冲突 / 同租户已注册）');
      }
    } catch (e) {
      console.error('[portal] 上传元素包失败', e);
      message.error('上传失败');
    } finally {
      setUploading(false);
    }
    return false; // 阻止 antd 默认自动上传（已手动 fetch）
  };

  const handleRemove = async (id?: number) => {
    if (id == null) return;
    try {
      const ok = await portalApi.removeElementRegister(id);
      if (ok) {
        message.success('已注销');
        load();
      } else {
        message.error('注销失败');
      }
    } catch (e) {
      console.error('[portal] 注销元素注册失败', e);
      message.error('注销失败');
    }
  };

  const columns = [
    {
      title: '元素类型',
      dataIndex: 'elementType',
      key: 'elementType',
      render: (v: string) => <Text code>{v}</Text>,
    },
    { title: '元素名称', dataIndex: 'elementName', key: 'elementName' },
    { title: '版本', dataIndex: 'version', key: 'version', width: 90, render: (v: string) => v || '-' },
    { title: '包大小', dataIndex: 'packageSize', key: 'packageSize', width: 100, render: fmtSize },
    { title: '注册时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
    {
      title: '操作',
      key: 'op',
      width: 90,
      render: (_: any, row: PortalElementRegister) => (
        <Popconfirm title="确认注销该元素注册？注销后该类型从元素类型列表下线" onConfirm={() => handleRemove(row.id)} disabled={!canManage}>
          <Button type="link" size="small" danger disabled={!canManage}>
            注销
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      {!canManage && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="只读模式：需要「元素注册」按钮权限才能上传/注销" />
      )}

      <Card
        title="开发指南（对标 developguide）"
        size="small"
        style={{ marginBottom: 16, maxWidth: 860 }}
        extra={
          <Button size="small" onClick={downloadManifestTemplate}>
            下载 manifest.json 模板
          </Button>
        }
      >
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
          <li>下载 manifest.json 模板，填写 elementType（小写字母开头、字母数字、≤64，租户唯一且不与内置 6 类冲突）与 elementName。</li>
          <li>开发元素包：manifest.json + 前端渲染器组件 + 后端取数 Provider（可选），打包为 .zip。</li>
          <li>在下方上传注册；注册类型经「元素类型」接口下发。</li>
        </ol>
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          message="编译型前端约束：自定义元素须随前端发版部署对应渲染器后，才会出现在设计器元素面板并可设计/渲染；仅注册未部署时只作登记（类型会进入 /element-types，但设计器按交集过滤）。"
        />
      </Card>

      <Upload.Dragger
        accept=".zip"
        maxCount={1}
        fileList={fileList}
        beforeUpload={handleUpload}
        onRemove={() => {
          setFileList([]);
        }}
        disabled={!canManage || uploading}
        showUploadList={false}
        style={{ maxWidth: 860, marginBottom: 16 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽元素开发包（.zip，≤10MB）至此注册</p>
        <p className="ant-upload-hint">包内须包含 manifest.json（elementType / elementName 必填）</p>
      </Upload.Dragger>

      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ReloadOutlined />} onClick={load}>
          刷新
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        columns={columns as any}
        pagination={false}
        size="middle"
        expandable={{
          expandedRowRender: (row) => (
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="manifest.json">
                <pre style={{ margin: 0, maxHeight: 240, overflow: 'auto', fontSize: 12 }}>
                  {row.manifestJson
                    ? (() => {
                        try {
                          return JSON.stringify(JSON.parse(row.manifestJson), null, 2);
                        } catch {
                          return row.manifestJson;
                        }
                      })()
                    : '-'}
                </pre>
              </Descriptions.Item>
              <Descriptions.Item label="包路径">{row.packagePath || '-'}</Descriptions.Item>
            </Descriptions>
          ),
        }}
      />
    </div>
  );
};

export default PortalElementRegisterPage;
