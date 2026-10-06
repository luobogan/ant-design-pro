import { SendOutlined } from '@ant-design/icons';
import { Avatar, Button, Flex, Input, Spin, Tag, Typography, theme } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type {
  AttachmentMeta,
  MessageSendDTO,
  MessageVO,
  SessionVO,
} from '../data';
import AttachmentUpload from './AttachmentUpload';
import BizReferencePicker, { type BizReference } from './BizReferencePicker';
import EmojiPicker from './EmojiPicker';
import MessageItem from './MessageItem';

interface Props {
  session?: SessionVO;
  messages: MessageVO[];
  currentUserId?: string;
  loading?: boolean;
  onSend: (dto: MessageSendDTO) => void;
  onOpenBiz: (bizRefType?: string, bizRefId?: string) => void;
}

export default function ChatPanel({
  session,
  messages,
  currentUserId,
  loading,
  onSend,
  onOpenBiz,
}: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [biz, setBiz] = useState<BizReference | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<any>(null);
  const { token } = theme.useToken();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /** 在光标处插入表情；取不到原生节点时退化为追加到末尾 */
  const insertEmoji = (emoji: string) => {
    const dom: HTMLTextAreaElement | undefined =
      textAreaRef.current?.resizableTextArea?.textArea;
    if (!dom) {
      setText((prev) => prev + emoji);
      return;
    }
    const start = dom.selectionStart ?? text.length;
    const end = dom.selectionEnd ?? start;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      try {
        dom.focus();
        const pos = start + emoji.length;
        dom.setSelectionRange(pos, pos);
      } catch (e) {
        // 忽略光标恢复失败
      }
    });
  };

  const handleSend = () => {
    if (!session) return;
    if (!text.trim() && attachments.length === 0 && !biz) return;
    const contentType = biz ? 4 : attachments.length > 0 ? 3 : 1;
    onSend({
      sessionId: String(session.id),
      contentType,
      content: text.trim(),
      attachments: attachments.length ? attachments : undefined,
      bizRefType: biz?.bizRefType,
      bizRefId: biz?.bizRefId,
    });
    setText('');
    setAttachments([]);
    setBiz(undefined);
  };

  if (!session) {
    return (
      <Flex
        align="center"
        justify="center"
        style={{ height: '100%', background: token.colorBgLayout }}
      >
        <Typography.Text type="secondary">选择一个会话开始聊天</Typography.Text>
      </Flex>
    );
  }

  return (
    <Flex vertical style={{ height: '100%', background: token.colorBgLayout }}>
      <Flex
        align="center"
        gap={8}
        style={{
          padding: '12px 16px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Avatar style={{ background: token.colorPrimary }}>
          {(session.name || '会话').slice(0, 1)}
        </Avatar>
        <div>
          <div style={{ fontWeight: 600 }}>
            {session.name ||
              (session.memberCount && session.memberCount > 2
                ? `群聊（${session.memberCount}）`
                : '私聊会话')}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {session.memberCount ?? 0} 名成员
          </Typography.Text>
        </div>
      </Flex>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <Flex align="center" justify="center" style={{ height: '100%' }}>
            <Spin />
          </Flex>
        ) : (
          messages.map((m) => (
            <MessageItem
              key={m.id}
              message={m}
              currentUserId={currentUserId}
              onOpenBiz={onOpenBiz}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <Flex
        vertical
        gap={8}
        style={{
          padding: 12,
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Flex align="center" gap={12}>
          <EmojiPicker onSelect={insertEmoji} />
          <AttachmentUpload value={attachments} onChange={setAttachments} />
          <BizReferencePicker value={biz} onChange={setBiz} />
        </Flex>
        <Flex align="flex-end" gap={8}>
          <Input.TextArea
            ref={textAreaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入消息，Enter 发送"
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            style={{ flex: 1 }}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={handleSend}>
            发送
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );
}
