import { FileTextOutlined, LinkOutlined } from '@ant-design/icons';
import { Avatar, Card, Flex, Tag, theme, Tooltip, Typography } from 'antd';
import type { MessageAttachment, MessageVO } from '../data';

interface Props {
  message: MessageVO;
  currentUserId?: string;
  onOpenBiz?: (bizRefType?: string, bizRefId?: string) => void;
}

function formatSize(size?: number) {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function MessageItem({
  message,
  currentUserId,
  onOpenBiz,
}: Props) {
  const outgoing = String(message.senderId) === String(currentUserId);
  const { token } = theme.useToken();

  const renderAttachments = (attachments?: MessageAttachment[]) => {
    if (!attachments || attachments.length === 0) return null;
    return (
      <Flex vertical gap={6} style={{ marginTop: 6 }}>
        {attachments.map((a) => (
          <a
            key={a.id || a.fileId}
            href={a.fileUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Card
              size="small"
              style={{ width: 240, background: token.colorBgContainer }}
            >
              <Flex align="center" gap={8}>
                <FileTextOutlined style={{ color: token.colorPrimary }} />
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.fileName || a.fileId}
                </span>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {formatSize(a.fileSize)}
                </Typography.Text>
              </Flex>
            </Card>
          </a>
        ))}
      </Flex>
    );
  };

  const renderBizRef = () => {
    if (!message.bizRefType || !message.bizRefId) return null;
    return (
      <Card
        size="small"
        style={{
          width: 240,
          marginTop: 6,
          cursor: 'pointer',
          background: token.colorBgContainer,
        }}
        onClick={() => onOpenBiz?.(message.bizRefType, message.bizRefId)}
      >
        <Flex align="center" gap={8}>
          <LinkOutlined style={{ color: token.colorPrimary }} />
          <div>
            <Tag color="blue">
              {message.bizRefType === 'WF_TASK' ? '待办任务' : '流程实例'}
            </Tag>
            <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
              点击查看关联流程 {message.bizRefId}
            </div>
          </div>
        </Flex>
      </Card>
    );
  };

  /**
   * 自己发出消息的已读回执：两人会话显示「已读/未读」，群会话显示「已读 N/M」。
   */
  const renderReceipt = () => {
    if (!outgoing) return null;
    const total = message.receiverCount ?? 0;
    if (total <= 0) return null;
    const readCount = message.readCount ?? 0;
    const allRead = readCount >= total;
    const text = total > 1 ? `已读 ${readCount}/${total}` : allRead ? '已读' : '未读';
    return (
      <span style={{ marginLeft: 6, color: allRead ? token.colorPrimary : token.colorTextSecondary }}>
        {text}
      </span>
    );
  };

  // 消息列表统一用 Avatar 展示发送者头像：对方在气泡左侧、自己在气泡右侧
  const avatarNode = (
    <Avatar
      src={message.senderAvatar || undefined}
      size={32}
      style={{ flexShrink: 0, background: token.colorPrimary }}
    >
      {(message.senderName || (outgoing ? '我' : '?')).slice(0, 1)}
    </Avatar>
  );

  return (
    <Flex
      justify={outgoing ? 'flex-end' : 'flex-start'}
      align="flex-start"
      gap={8}
      style={{ margin: '10px 0' }}
    >
      {!outgoing && avatarNode}
      <div style={{ maxWidth: '68%' }}>
        {!outgoing && message.senderName && (
          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 2 }}>
            {message.senderName}
          </div>
        )}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: outgoing ? token.colorPrimary : token.colorBgElevated,
            color: outgoing ? '#fff' : token.colorText,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
          {renderAttachments(message.attachments)}
          {renderBizRef()}
        </div>
        <div
          style={{
            fontSize: 11,
            color: token.colorTextTertiary,
            marginTop: 2,
            textAlign: outgoing ? 'right' : 'left',
          }}
        >
          <Tooltip title={message.createTime}>
            {String(message.createTime || '').slice(11, 19) || '--:--'}
          </Tooltip>
          {renderReceipt()}
        </div>
      </div>
    </Flex>
  );
}
