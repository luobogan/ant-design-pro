import { Modal, Radio, Input, Space, message, Tag, Switch } from 'antd';
import { useEffect, useState, FC } from 'react';

export interface RejectCandidate {
  nodeKey: string;
  nodeName?: string;
  nodeType?: number;
  operators?: string;
}

export interface RejectCandidates {
  type?: number;
  defaultNodeKey?: string;
  nodes?: RejectCandidate[];
}

interface RejectNodePickerProps {
  open: boolean;
  title?: string;
  candidates: RejectCandidates | null;
  confirmLoading?: boolean;
  onCancel: () => void;
  onOk: (params: {
    targetNodeKey: string;
    opinion: string;
    resubmitMode: number;
    runPreOperate: boolean;
  }) => Promise<void> | void;
}

/**
 * 退回目标节点选择弹窗（监控「回退」与办理页「退回」共用）：
 * 展示候选节点 radio 表（节点名 + 当前操作者），意见必填，退回后再提交支持逐级 / 直达。
 */
const RejectNodePicker: FC<RejectNodePickerProps> = ({
  open,
  title = '回退到指定节点',
  candidates,
  confirmLoading,
  onCancel,
  onOk,
}) => {
  const [targetKey, setTargetKey] = useState<string | undefined>(undefined);
  const [opinion, setOpinion] = useState('');
  const [resubmitMode, setResubmitMode] = useState<number>(1);
  // 回退后是否执行目标节点的「节点前附加操作」：缺省开启（与常规流转一致）；
  // 关闭则跳过，避免退回场景对目标节点重复触发业务副作用。
  const [runPreOperate, setRunPreOperate] = useState<boolean>(true);

  useEffect(() => {
    if (open) {
      setTargetKey(candidates?.defaultNodeKey);
      setOpinion('');
      setResubmitMode(1);
      setRunPreOperate(true);
    }
  }, [open, candidates]);

  const list = candidates?.nodes || [];
  // 后端按「离当前节点由近及远」返回（最近可退回在最前）。退回场景下最近可退节点最相关，
  // 故保持「最近可退在最上 → 创建/填单在最下」的倒序时间轴，箭头朝下表示可退回方向。
  const ordered = list;

  const handleOk = async () => {
    if (!targetKey) {
      message.warning('请选择退回节点');
      return;
    }
    if (!opinion || !opinion.trim()) {
      message.warning('回退意见必填（监管留痕，便于审计）');
      return;
    }
    await onOk({ targetNodeKey: targetKey, opinion: opinion.trim(), resubmitMode, runPreOperate });
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={confirmLoading}
      destroyOnClose
      width={560}
    >
      <div style={{ marginBottom: 8 }}>请选择退回目标节点（自上而下＝从最近可退到最先办理/创建，箭头表示可退回方向，最上为最近可退回）：</div>
      <Radio.Group
        value={targetKey}
        onChange={(e) => setTargetKey(e.target.value)}
        style={{ display: 'block' }}
      >
        <div>
          {ordered.map((n, i) => {
            const isDefault = n.nodeKey === candidates?.defaultNodeKey;
            const color = n.nodeKey === targetKey ? '#1677ff' : isDefault ? '#52c41a' : '#bfbfbf';
            const isLast = i === ordered.length - 1;
            return (
              <div key={n.nodeKey} style={{ display: 'flex' }}>
                {/* 左列：圆点 → 竖线 → 箭头，flex 拉伸保证与下一个圆点对齐 */}
                <div
                  style={{
                    width: 20,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      marginTop: 4,
                      borderRadius: '50%',
                      background: color,
                      border: '2px solid #fff',
                      boxShadow: `0 0 0 1px ${color}`,
                      flexShrink: 0,
                    }}
                  />
                  {!isLast && (
                    <div
                      style={{
                        flex: 1,
                        width: 0,
                        borderLeft: '2px solid #d9d9d9',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          bottom: -1,
                          left: -4,
                          width: 0,
                          height: 0,
                          borderLeft: '5px solid transparent',
                          borderRight: '5px solid transparent',
                          borderTop: '7px solid #d9d9d9',
                        }}
                      />
                    </div>
                  )}
                </div>
                {/* 右列：节点内容 */}
                <div style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
                  <Radio value={n.nodeKey}>
                    <Space>
                      <span>{n.nodeName || n.nodeKey}</span>
                      {n.nodeType === 0 && <Tag>创建/填单</Tag>}
                      {isDefault && <Tag color="green">默认（最近可退回）</Tag>}
                    </Space>
                  </Radio>
                  {n.operators && (
                    <div style={{ color: '#999', fontSize: 12, paddingLeft: 24 }}>
                      当前操作者：{n.operators}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Radio.Group>
      {list.length === 0 && (
        <div style={{ color: '#999' }}>该实例当前无可退回节点（无已办理的节点）</div>
      )}
      <div style={{ marginTop: 12 }}>退回后再提交：</div>
      <Radio.Group
        value={resubmitMode}
        onChange={(e) => setResubmitMode(e.target.value)}
        style={{ marginTop: 4 }}
      >
        <Radio value={1}>逐级审批（缺省）</Radio>
        <Radio value={2}>直达本节点</Radio>
      </Radio.Group>
      <div style={{ marginTop: 12 }}>
        <Space>
          <span>退回后执行目标节点的「节点前附加操作」</span>
          <Switch checked={runPreOperate} onChange={(v) => setRunPreOperate(v)} />
        </Space>
        <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
          关闭则跳过目标节点的前附加操作（如自动生成文号/字段赋值），避免退回时重复触发业务副作用；缺省开启。
        </div>
      </div>
      <div style={{ marginTop: 12 }}>回退意见（必填）：</div>
      <Input.TextArea
        value={opinion}
        onChange={(e) => setOpinion(e.target.value)}
        rows={3}
        placeholder="监管留痕，便于审计"
        style={{ marginTop: 4 }}
      />
    </Modal>
  );
};

export default RejectNodePicker;
