import React, { useEffect, useState, useCallback } from 'react';
import { Button, Card, Empty, List, Modal, Select, Space, Spin, Tag, Tooltip, Upload, message } from 'antd';
import {
  EditOutlined,
  UploadOutlined,
  DownloadOutlined,
  HistoryOutlined,
  RollbackOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { request } from 'umi';
import {
  odocApi,
  taohongApi,
  odocContentUrl,
  type OdocDocInit,
  type OdocVersion,
  type OdocTaohongInfo,
} from '@/services/workflow';
import OdocEditorModal from './OdocEditorModal';
import OdocLayoutSeal from './OdocLayoutSeal';

/** 兼容 R 包装：取 data；若已是裸对象则原样返回（request 默认只解到 ApiResponse 信封层） */
const unwrap = (res: any): any => (res && res.data !== undefined ? res.data : res) || {};

interface OdocFieldProps {
  /** 正文ID（docId）；空时按 instanceId 首次初始化 */
  value?: any;
  instanceId?: any;
  defId?: any;
  fieldTitle?: string;
  disabled?: boolean;
  readOnly?: boolean;
  /** docId 创建后回写，供表单持久化 */
  onChange?: (v: any) => void;
}

const extToType = (name?: string): number => {
  const e = (name?.split('.').pop() || '').toLowerCase();
  if (e === 'doc') return 3;
  if (e === 'docx') return 7;
  if (e === 'pdf') return 12;
  if (e === 'ofd') return 13;
  return 7;
};

const fileTypeLabel = (t?: number) => {
  switch (t) {
    case 3: return 'doc';
    case 7: return 'docx';
    case 12: return 'pdf';
    case 13: return 'ofd';
    default: return 'docx';
  }
};

/**
 * 正文字段控件（fieldHtmlType=9）。
 *
 * <p>职责：按流程实例获取/创建正文 → 展示当前版本与版本历史 → 上传新版本 / 在线编辑(OnlyOffice)
 * / 回滚。value 为 docId；首次初始化得到 docId 后通过 onChange 回写，供流程表单持久化。</p>
 *
 * <p>在线编辑依赖后端 {@code editorType}：wps 走 WPS WebOffice，onlyoffice（默认）走 DOCS；
 * 未部署对应编辑器时 {@code canEdit=false}，仅保留「上传新版本 + 下载 + 回滚」，符合方案 L1 兜底。</p>
 */
const OdocField: React.FC<OdocFieldProps> = ({ value, instanceId, defId, fieldTitle, disabled, readOnly, onChange }) => {
  const locked = !!disabled || !!readOnly;
  const [loading, setLoading] = useState(false);
  const [docId, setDocId] = useState<any>(value);
  const [current, setCurrent] = useState<OdocVersion | undefined>();
  const [versions, setVersions] = useState<OdocVersion[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [initData, setInitData] = useState<OdocDocInit | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [info, setInfo] = useState<OdocTaohongInfo | null>(null);
  const [mouldId, setMouldId] = useState<any>(undefined);
  // 后端对「无当前版本」可能返回空的 {} 而非 null，版本号缺失即视为无当前版本
  const hasCurrent = !!(current && (current as any).versionId != null);

  const reload = useCallback(async (id: any) => {
    if (!instanceId) return;
    setLoading(true);
    try {
      // 重新拉取 init：上传首个版本后 current 由 null 变非 null，canEdit 才会变 true，
      // 「在线编辑」按钮依赖 canEdit；单纯拉 versions 不会刷新 canEdit / wpsEditorConfig
      const init = unwrap(await odocApi.init(instanceId, defId, fieldTitle, true, 'wps'));
      if (init?.docId) {
        setCanEdit(!!init.canEdit);
        setInitData(init);
        setCurrent(init.currentVersion);
        setVersions(init.versions || []);
      }
      taohongApi.info(init?.docId || id).then((r) => setInfo(unwrap(r))).catch(() => setInfo(null));
    } finally {
      setLoading(false);
    }
  }, [instanceId, defId, fieldTitle]);

  useEffect(() => {
    /**
     * 加载正文初始化信息。
     *
     * <p>无论正文是否已存在都必须调用：{@code canEdit} 决定「在线编辑」按钮是否渲染，
     * {@code wpsEditorConfig} 决定弹窗内渲染 WPS 还是 OnlyOffice，二者都只由 init 返回。
     * 后端 init 按 instanceId 复用已有正文（不会重复创建），故 keepDocId 场景安全。</p>
     *
     * <p>editor 显式传 'wps'：后端仅在 editor=wps 时返回 wpsEditorConfig；
     * 后端亦有 auto 兜底（WPS 已配置即走 WPS），此处为显式契约，避免依赖兜底。</p>
     */
    const loadInit = async (keepDocId: boolean) => {
      if (!instanceId) return;
      setLoading(true);
      try {
        // request 默认解到 ApiResponse 信封层，需再 unwrap 一层取 payload
        const init = unwrap(await odocApi.init(instanceId, defId, fieldTitle, true, 'wps'));
        if (!init?.docId) return;
        if (!keepDocId) {
          // 正文首次创建：init 返回的 docId 为权威值，并回写表单字段
          setDocId(init.docId);
          onChange?.(init.docId);
          setCurrent(init.currentVersion);
          setVersions(init.versions || []);
        }
        setCanEdit(!!init.canEdit);
        setInitData(init);
      } finally {
        setLoading(false);
      }
    };

    if (value) {
      // 正文已存在（表单已绑定 docId）：除刷新版本链外，仍须取编辑器配置，
      // 否则 canEdit 恒为 false、「在线编辑」按钮不渲染，弹窗内也拿不到 wpsEditorConfig
      setDocId(value);
      reload(value);
      loadInit(true);
      return;
    }
    loadInit(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, instanceId]);

  const handleUpload = async (fileData: any) => {
    if (!docId) {
      message.error('正文未初始化');
      return;
    }
    const fileId = fileData?.id;
    const fileName = fileData?.name || fileData?.fileName;
    if (!fileId) {
      message.error('文件上传未返回 ID');
      return;
    }
    try {
      await odocApi.saveVersion(docId, fileId, fileName, extToType(fileName), '上传新版本');
      message.success('新版本已保存');
      await reload(docId);
    } catch (e: any) {
      message.error(e?.msg || '保存版本失败');
    }
  };

  const handleRollback = async (toVersionId: any) => {
    try {
      await odocApi.rollback(docId, toVersionId);
      message.success('已回滚到该版本');
      await reload(docId);
    } catch (e: any) {
      message.error(e?.msg || '回滚失败');
    }
  };

  const handleTaohong = async () => {
    if (!mouldId) {
      message.warning('请先选择套红模板');
      return;
    }
    try {
      // fieldValues 传空即可：后端按实例的 formId+dataId 自动从关联表单业务表
      // （formtable_main_NN，如发文 main_10 / 集团收文 main_12 / 部门收文 main_11）读取字段值填充书签。
      await taohongApi.taohong(docId, mouldId, {});
      message.success('套红完成');
      await reload(docId);
    } catch (e: any) {
      message.error(e?.msg || '套红失败');
    }
  };

  const handleCancelTaohong = async () => {
    try {
      await taohongApi.cancel(docId);
      message.success('已取消套红');
      await reload(docId);
    } catch (e: any) {
      message.error(e?.msg || '取消失败');
    }
  };

  const uploadProps = {
    showUploadList: false,
    disabled: locked,
    customRequest: async (options: any) => {
      const form = new FormData();
      form.append('file', options.file);
      try {
        const res: any = await request('/api/blade-workflow/odoc/file/upload', {
          method: 'POST',
          data: form,
          skipErrorHandler: true,
        });
        if (res && res.data && res.data.id) {
          options.onSuccess(res.data);
          await handleUpload(res.data);
        } else {
          options.onError(new Error('上传失败'));
          message.error('文件上传失败');
        }
      } catch (err) {
        options.onError(err);
        message.error('文件上传失败');
      }
    },
  };

  return (
    <div style={{ minWidth: 280 }}>
      <Spin spinning={loading}>
        {!docId && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={instanceId ? '正文未创建' : '缺少流程实例上下文，无法初始化正文'}
            style={{ margin: '8px 0' }}
          />
        )}

        {docId && (
          <Card size="small" title={`正文：${fieldTitle || '未命名'}`} style={{ marginBottom: 8 }}>
            <Space wrap>
              {canEdit && !locked && (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setEditorOpen(true)}
                >
                  在线编辑
                </Button>
              )}
              {!locked && (
                <Button icon={<UploadOutlined />} disabled={locked}>
                  <Upload {...uploadProps}>上传新版本</Upload>
                </Button>
              )}
              <Button icon={<ReloadOutlined />} onClick={() => reload(docId)}>
                刷新
              </Button>
              {hasCurrent && (
                <Tooltip title="下载当前版本">
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={async () => {
                      const u = await odocContentUrl(current!.id);
                      if (u) window.open(u, '_blank');
                    }}
                  >
                    下载当前
                  </Button>
                </Tooltip>
              )}
            </Space>
            {hasCurrent && (
              <div style={{ marginTop: 8 }}>
                当前版本：v{String(current!.versionId)} · {String(current!.fileName)} ·{' '}
                <Tag>{fileTypeLabel(current!.docFileType)}</Tag>
                {current!.hasUsedTemplet === 1 && <Tag color="red">已套红</Tag>}
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              {info?.hasUsedTemplet === 1 ? <Tag color="red">文档已套红</Tag> : <Tag>未套红</Tag>}
              {info?.mustTaohong === 1 && <Tag color="volcano">本节点强制套红</Tag>}
            </div>
            {!locked && (
              <Space wrap style={{ marginTop: 8 }}>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择套红模板"
                  style={{ width: 220 }}
                  value={mouldId}
                  onChange={setMouldId}
                  options={(info?.moulds || []).map((m) => ({ label: m.mouldName, value: m.id }))}
                />
                <Button onClick={handleTaohong} disabled={info?.hasUsedTemplet === 1}>
                  套红
                </Button>
                {info?.hasUsedTemplet === 1 && (
                  <Button danger onClick={handleCancelTaohong}>
                    取消套红
                  </Button>
                )}
              </Space>
            )}
          </Card>
        )}

        {docId && (
          <OdocLayoutSeal docId={docId} currentVersion={current} locked={locked} />
        )}

        {docId && versions.length > 0 && (
          <Card size="small" title={<Space><HistoryOutlined />版本历史</Space>}>
            <List
              size="small"
              dataSource={versions}
              renderItem={(v) => (
                <List.Item
                  actions={[
                    <a
                      key="dl"
                      onClick={async () => {
                        const u = await odocContentUrl(v.id);
                        if (u) window.open(u, '_blank');
                      }}
                    >
                      下载
                    </a>,
                    !locked && v.id !== current?.id ? (
                      <a key="rb" onClick={() => handleRollback(v.id)}>
                        <RollbackOutlined /> 回滚
                      </a>
                    ) : null,
                  ].filter(Boolean) as any}
                >
                  <List.Item.Meta
                    title={`v${String(v.versionId)} · ${String(v.fileName)}`}
                    description={
                      <span>
                        {fileTypeLabel(v.docFileType)}
                        {v.versionDetail ? ` · ${v.versionDetail}` : ''}
                        {v.hasUsedTemplet === 1 ? ' · 已套红' : ''}
                        {v.createTime ? ` · ${v.createTime}` : ''}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}
      </Spin>

      <OdocEditorModal
        open={editorOpen}
        init={initData}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          reload(docId);
        }}
      />
    </div>
  );
};

export default OdocField;
