import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, message, Row, Select, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import {
  ARCHIVE_NODE_KEY_ANY,
  parseArchiveManage,
  parseRecallManage,
  updateDefinition,
  WfProcessNode,
} from '@/services/workflow';

/**
 * 「归档与撤回」配置面板（流程级）。
 *
 * <p>对标 E9（`workflow_base`）：{@code isoverrb}（归档可强制收回）、{@code isoveriv}（归档可干预）、
 * {@code isrejectremind}（退回是否提醒）等流程级开关；节点级退回配置（允许被撤回的节点 / 排除选择 /
 * 节点前附加操作）在「流转设置 → 节点信息 → 退回设置」中配置。</p>
 *
 * <p><b>单一事实源</b>：本面板写入 {@code wf_process_definition.archive_manage / recall_manage}，
 * 流程监控按同一份配置决定「强制归档 / 强制收回 / 回退」的显隐，后端再按同一份配置做强制校验。</p>
 *
 * <p><b>默认值口径</b>：既有能力（强制归档 / 强制收回 / 监控回退）默认<b>开启</b>，
 * 以便「打开面板直接保存」不改变现状；全新能力（归档后强制收回 / 归档后流程干预）默认<b>关闭</b>，
 * 需显式开启。保存时所有键都会显式写出，使策略从「未配置」变为「已配置」，语义可追溯。</p>
 */

const { Paragraph, Text } = Typography;

/** 面板表单状态（两列 JSON 的内存视图） */
interface FormState {
  /** 允许强制归档 */
  forceArchiveEnabled: boolean;
  /** 可归档节点范围；['*'] = 全部节点 */
  archiveNodeKeys: string[];
  /** 归档后允许强制收回 */
  recallFromArchiveEnabled: boolean;
  /** 归档后允许流程干预 */
  interveneFromArchiveEnabled: boolean;
  /** 允许强制收回 */
  recallEnabled: boolean;
  /** 允许监控回退 */
  rejectEnabled: boolean;
  /** 允许前端用户选择是否提醒（总闸） */
  remindSelect: boolean;
  /** 强制收回落点范围 */
  recallTargetScope: 'create' | 'history' | 'all' | 'specified';
  /** 强制收回落点「指定清单」（recallTargetScope=specified 时生效） */
  recallTargetNodeKeys: string[];
}

const DEFAULT_STATE: FormState = {
  forceArchiveEnabled: true,
  archiveNodeKeys: [ARCHIVE_NODE_KEY_ANY],
  recallFromArchiveEnabled: false,
  interveneFromArchiveEnabled: false,
  recallEnabled: true,
  rejectEnabled: true,
  remindSelect: false,
  recallTargetScope: 'all',
  recallTargetNodeKeys: [],
};

/** 强制收回落点范围选项（与后端 WfArchiveRecallPolicy.SCOPE_* 对齐） */
const SCOPE_OPTIONS = [
  { label: '仅创建节点', value: 'create' },
  { label: '已办节点 + 创建节点', value: 'history' },
  { label: '任意可停留节点', value: 'all' },
  { label: '指定清单', value: 'specified' },
];

export interface ArchiveRecallPanelProps {
  /** 当前流程定义ID */
  defId?: number | string;
  /** 归档管理策略JSON（archive_manage） */
  archiveManage?: string;
  /** 撤回管理策略JSON（recall_manage） */
  recallManage?: string;
  /** 当前流程节点列表（可归档节点范围的数据源） */
  nodes?: WfProcessNode[];
  /** 保存成功回调（父级据此回读定义并刷新页签） */
  onSaved?: () => void;
}

/** 由两列 JSON 还原表单状态（未配置 → 默认值；非法 JSON → 默认值） */
const toFormState = (archiveJson?: string, recallJson?: string): FormState => {
  const a = parseArchiveManage(archiveJson);
  const r = parseRecallManage(recallJson);
  return {
    forceArchiveEnabled: a?.forceArchiveEnabled ?? DEFAULT_STATE.forceArchiveEnabled,
    archiveNodeKeys:
      a?.archiveApplicableNodeKeys && a.archiveApplicableNodeKeys.length
        ? a.archiveApplicableNodeKeys
        : DEFAULT_STATE.archiveNodeKeys,
    recallFromArchiveEnabled: a?.recallFromArchiveEnabled ?? DEFAULT_STATE.recallFromArchiveEnabled,
    interveneFromArchiveEnabled:
      a?.interveneFromArchiveEnabled ?? DEFAULT_STATE.interveneFromArchiveEnabled,
    recallEnabled: r?.recallEnabled ?? DEFAULT_STATE.recallEnabled,
    rejectEnabled: r?.rejectEnabled ?? DEFAULT_STATE.rejectEnabled,
    remindSelect: r?.remindSelect ?? DEFAULT_STATE.remindSelect,
    recallTargetScope: (r?.recallTargetScope as FormState['recallTargetScope']) || DEFAULT_STATE.recallTargetScope,
    recallTargetNodeKeys:
      r?.recallTargetNodeKeys && r.recallTargetNodeKeys.length
        ? r.recallTargetNodeKeys
        : DEFAULT_STATE.recallTargetNodeKeys,
  };
};

const ArchiveRecallPanel: React.FC<ArchiveRecallPanelProps> = ({
  defId,
  archiveManage,
  recallManage,
  nodes,
  onSaved,
}) => {
  const [form, setForm] = useState<FormState>(() => toFormState(archiveManage, recallManage));
  const [saving, setSaving] = useState(false);
  /** 策略JSON非法时提示一次（不阻断编辑，按默认值兜底） */
  const [invalidJson, setInvalidJson] = useState<boolean>(
    () => !!(archiveManage?.trim() && !parseArchiveManage(archiveManage))
      || !!(recallManage?.trim() && !parseRecallManage(recallManage)),
  );

  // 切换流程时按新定义重置表单
  useEffect(() => {
    setForm(toFormState(archiveManage, recallManage));
    setInvalidJson(
      !!(archiveManage?.trim() && !parseArchiveManage(archiveManage))
      || !!(recallManage?.trim() && !parseRecallManage(recallManage)),
    );
  }, [archiveManage, recallManage, defId]);

  /** 可归档节点候选项：全部节点 + 流程内节点（仅列出可停留的办理节点） */
  const nodeOptions = useMemo(() => {
    const list = (nodes || [])
      .filter((n) => n.nodeKey)
      .map((n) => ({
        label: `${n.nodeName || n.nodeKey}（${n.nodeKey}）`,
        value: String(n.nodeKey),
      }));
    return [{ label: '全部节点（不限制）', value: ARCHIVE_NODE_KEY_ANY }, ...list];
  }, [nodes]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /** 节点范围多选：选中「全部节点」时清掉其余项；取消全部时回落为不限制 */
  const onArchiveNodesChange = (values: string[]) => {
    if (values.includes(ARCHIVE_NODE_KEY_ANY)) {
      set('archiveNodeKeys', values.length > 1 ? [ARCHIVE_NODE_KEY_ANY] : [ARCHIVE_NODE_KEY_ANY]);
    } else {
      set('archiveNodeKeys', values);
    }
  };

  const handleSave = async () => {
    if (defId == null) {
      message.error('未选中流程定义，无法保存');
      return;
    }
    setSaving(true);
    try {
      const archive = {
        forceArchiveEnabled: form.forceArchiveEnabled,
        archiveApplicableNodeKeys: form.archiveNodeKeys.length ? form.archiveNodeKeys : [ARCHIVE_NODE_KEY_ANY],
        recallFromArchiveEnabled: form.recallFromArchiveEnabled,
        interveneFromArchiveEnabled: form.interveneFromArchiveEnabled,
      };
      const recall = {
        recallEnabled: form.recallEnabled,
        rejectEnabled: form.rejectEnabled,
        remindSelect: form.remindSelect,
        recallTargetScope: form.recallTargetScope,
        recallTargetNodeKeys: form.recallTargetNodeKeys,
      };
      // 只带 id + 两列：后端 updateById 默认 NOT_NULL，其它列不会被清空
      await updateDefinition(defId as number, {
        id: defId,
        archiveManage: JSON.stringify(archive),
        recallManage: JSON.stringify(recall),
      });
      message.success('归档与撤回策略已保存');
      setInvalidJson(false);
      onSaved?.();
    } catch (e: any) {
      message.error(e?.msg || e?.message || '保存归档与撤回策略失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {invalidJson && (
        <Alert
          type="warning"
          showIcon
          message="策略配置内容无法解析，已按默认值展示；保存后将覆盖为当前表单内容。"
        />
      )}

      <Card size="small" title="归档管理（流程级）">
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          对标 E9「归档可强制收回 / 归档可干预」。配置在<strong>流程设计</strong>侧录入，
          <strong>流程监控</strong>按同一份配置决定「强制归档 / 强制收回 / 回退」的可用性，
          后端接口亦按同一份配置强校验（隐藏的按钮无法越权调用）。
        </Paragraph>
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <Space direction="vertical" size={4}>
              <Text strong>允许强制归档</Text>
              <Switch
                checked={form.forceArchiveEnabled}
                onChange={(v) => set('forceArchiveEnabled', v)}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                关闭后监控端不再提供「强制归档」，接口亦拒绝执行。
              </Text>
            </Space>
          </Col>
          <Col span={12}>
            <Space direction="vertical" size={4}>
              <Text strong>可归档节点范围</Text>
              <Select
                mode="multiple"
                allowClear
                style={{ width: '100%' }}
                value={form.archiveNodeKeys}
                options={nodeOptions}
                onChange={onArchiveNodesChange}
                placeholder="默认全部节点"
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                逐节点裁决：只有落在范围内的节点才能被强制归档。
              </Text>
            </Space>
          </Col>
          <Col span={12}>
            <Space direction="vertical" size={4}>
              <Text strong>归档后允许强制收回</Text>
              <Switch
                checked={form.recallFromArchiveEnabled}
                onChange={(v) => set('recallFromArchiveEnabled', v)}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                对标 E9 <Text code>isoverrb</Text>：已归档实例可被强制收回并重新办理。
              </Text>
            </Space>
          </Col>
          <Col span={12}>
            <Space direction="vertical" size={4}>
              <Text strong>归档后允许流程干预</Text>
              <Switch
                checked={form.interveneFromArchiveEnabled}
                onChange={(v) => set('interveneFromArchiveEnabled', v)}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                对标 E9 <Text code>isoveriv</Text>：已归档实例可被回退 / 流转到指定节点。
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card size="small" title="撤回管理（流程级）">
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          节点级退回配置（可退回节点白名单 / 排除选择 / 提醒已走过节点 / 允许变更退回节点 /
          节点前附加操作）在<strong>流转设置 → 节点信息 → 退回设置</strong>中按节点配置。
        </Paragraph>
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <Space direction="vertical" size={4}>
              <Text strong>允许强制收回</Text>
              <Switch checked={form.recallEnabled} onChange={(v) => set('recallEnabled', v)} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                监控端「强制收回」（原地回退，实例不终止）的总闸。
              </Text>
            </Space>
          </Col>
          <Col span={12}>
            <Space direction="vertical" size={4}>
              <Text strong>允许监控回退</Text>
              <Switch checked={form.rejectEnabled} onChange={(v) => set('rejectEnabled', v)} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                监控端「回退 / 流转到节点」的总闸。
              </Text>
            </Space>
          </Col>
          <Col span={12}>
            <Space direction="vertical" size={4}>
              <Tooltip title="对齐 E9 workflow_base.isrejectremind：总闸关闭时，节点级「提醒已走过节点」不生效">
                <Text strong>允许前端用户选择是否提醒</Text>
              </Tooltip>
              <Switch checked={form.remindSelect} onChange={(v) => set('remindSelect', v)} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                提醒总闸；节点级「提醒已走过节点」作为节点覆盖。
              </Text>
            </Space>
          </Col>
          <Col span={12}>
            <Space direction="vertical" size={4}>
              <Text strong>强制收回落点范围</Text>
              <Select
                style={{ width: '100%' }}
                value={form.recallTargetScope}
                options={SCOPE_OPTIONS}
                onChange={(v) => set('recallTargetScope', v)}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                限制「强制收回」可落到哪些节点（可停留的办理节点）。
              </Text>
            </Space>
          </Col>
          {form.recallTargetScope === 'specified' && (
            <Col span={12}>
              <Space direction="vertical" size={4}>
                <Text strong>指定清单（允许的收回落点）</Text>
                <Select
                  mode="multiple"
                  allowClear
                  style={{ width: '100%' }}
                  value={form.recallTargetNodeKeys}
                  options={nodeOptions.filter((o) => o.value !== ARCHIVE_NODE_KEY_ANY)}
                  onChange={(v) => set('recallTargetNodeKeys', v)}
                  placeholder="请选择允许的收回落点节点"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  仅清单内节点可作为「强制收回」的落点；后端会强校验，越界直接拒绝。
                </Text>
              </Space>
            </Col>
          )}
        </Row>
      </Card>

      <Space>
        <Button type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>
        <Button onClick={() => setForm(toFormState(archiveManage, recallManage))}>重置</Button>
        {!form.recallFromArchiveEnabled && !form.interveneFromArchiveEnabled && (
          <Tag color="default">归档后的收回 / 干预能力当前关闭</Tag>
        )}
      </Space>
    </Space>
  );
};

export default ArchiveRecallPanel;
