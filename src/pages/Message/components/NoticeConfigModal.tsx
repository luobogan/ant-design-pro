import { Modal, message, Spin, Switch, Typography, theme } from 'antd';
import { useEffect, useState } from 'react';
import { listDefinitions } from '@/services/workflow';
import {
  getMyNoticeConfig,
  muteNoticeConfig,
  resetNoticeConfig,
} from '../../service';

type FlowOption = {
  flowKey: string;
  label: string;
};

type NoticeConfigModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * 流程通知设置（三期 T11.1，对齐 ecology 用户级提醒配置）：
 *
 * <p>语义"默认全部接收、只存屏蔽记录"——Switch 关 = 屏蔽（写 enabled=0），
 * Switch 开 = 恢复接收（删行）；「全部流程」行（flowKey='*'）作为一键兜底开关，
 * 精确配置优先于通配。</p>
 */
export default function NoticeConfigModal({
  open,
  onClose,
}: NoticeConfigModalProps) {
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  /** flowKey → 是否屏蔽（渲染 Switch checked=!muted） */
  const [muted, setMuted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      listDefinitions().catch(() => null),
      getMyNoticeConfig().catch(() => null),
    ])
      .then(([defsRes, cfgRes]) => {
        const defs = ((defsRes as any)?.data as any[]) ?? [];
        setFlows(
          defs
            .filter((d) => d?.procKey)
            .map((d) => ({
              flowKey: String(d.procKey),
              label: String(d.name || d.procKey),
            })),
        );
        const map: Record<string, boolean> = {};
        for (const c of ((cfgRes as any)?.data as any[]) ?? []) {
          if (c?.flowKey) map[String(c.flowKey)] = Number(c.enabled) === 0;
        }
        setMuted(map);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const toggle = async (flowKey: string, wantReceive: boolean) => {
    setMuted((prev) => ({ ...prev, [flowKey]: !wantReceive }));
    try {
      if (wantReceive) {
        await resetNoticeConfig(flowKey);
      } else {
        await muteNoticeConfig(flowKey);
      }
    } catch {
      message.error('保存失败，请重试');
      setMuted((prev) => ({ ...prev, [flowKey]: !wantReceive }));
    }
  };

  const rows: FlowOption[] = [
    { flowKey: '*', label: '全部流程（兜底开关）' },
    ...flows,
  ];

  return (
    <Modal
      title="流程通知设置"
      open={open}
      onCancel={onClose}
      footer={null}
      width={420}
    >
      <Typography.Paragraph
        type="secondary"
        style={{ fontSize: 12, marginBottom: 12 }}
      >
        默认接收全部流程通知；关闭某个流程后，其待办/办结通知不再推送给你。精确设置优先于「全部流程」。
      </Typography.Paragraph>
      <Spin spinning={loading}>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {rows.map((f) => (
            <div
              key={f.flowKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 4px',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <span style={{ fontSize: 14 }}>
                {f.label}
                <span
                  style={{
                    color: token.colorTextTertiary,
                    fontSize: 12,
                    marginLeft: 8,
                  }}
                >
                  {f.flowKey}
                </span>
              </span>
              <Switch
                checked={!muted[f.flowKey]}
                checkedChildren="接收"
                unCheckedChildren="屏蔽"
                onChange={(checked) => toggle(f.flowKey, checked)}
              />
            </div>
          ))}
        </div>
      </Spin>
    </Modal>
  );
}
