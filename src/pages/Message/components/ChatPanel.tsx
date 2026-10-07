import { SendOutlined, VerticalAlignBottomOutlined } from '@ant-design/icons';
import { Avatar, Button, Flex, Input, Spin, Typography, theme } from 'antd';
import { useLayoutEffect, useRef, useState } from 'react';
import type {
  AttachmentMeta,
  MessageSendDTO,
  MessageVO,
  SessionVO,
} from '../data';
import { formatGroupTime, needGroupSeparator } from '../time';
import AttachmentUpload from './AttachmentUpload';
import BizReferencePicker, { type BizReference } from './BizReferencePicker';
import EmojiPicker from './EmojiPicker';
import MessageItem from './MessageItem';

interface Props {
  session?: SessionVO;
  messages: MessageVO[];
  currentUserId?: string;
  loading?: boolean;
  /** 是否还有更早的历史（由父级 useMessageHistory 维护） */
  hasMore?: boolean;
  /** 正在加载更早的历史（顶部小 spinner） */
  loadingMore?: boolean;
  /** 滚动到顶时加载更早一页历史 */
  onLoadMore?: () => void;
  onSend: (dto: MessageSendDTO) => void;
  onOpenBiz: (bizRefType?: string, bizRefId?: string) => void;
}

/** 触发加载更多的滚动阈值（距顶部 px） */
const LOAD_MORE_THRESHOLD = 48;
/** 「回到底部」按钮出现阈值（距底部 px） */
const JUMP_BUTTON_THRESHOLD = 360;

export default function ChatPanel({
  session,
  messages,
  currentUserId,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  onSend,
  onOpenBiz,
}: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [biz, setBiz] = useState<BizReference | undefined>();
  const [showJump, setShowJump] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<any>(null);
  const { token } = theme.useToken();

  // —— 历史分页：滚动位置保持 ——
  // 顶部前置插入更早消息后，浏览器默认保持 scrollTop 数值不变 ⇒ 视图会"跳"到旧内容。
  // 这里在插入前后记录 scrollHeight，把差值补回 scrollTop，让视口锚定在原消息上。
  const prevLenRef = useRef(0);
  const prevHeightRef = useRef(0);
  const prevFirstIdRef = useRef<string | number | undefined>(undefined);
  const prevLastIdRef = useRef<string | number | undefined>(undefined);
  const pendingPrependRef = useRef(false);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setShowJump(
      el.scrollHeight - el.scrollTop - el.clientHeight > JUMP_BUTTON_THRESHOLD,
    );
    if (!hasMore || loadingMore || !onLoadMore) return;
    if (el.scrollTop <= LOAD_MORE_THRESHOLD) {
      pendingPrependRef.current = true;
      onLoadMore();
    }
  };

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  useLayoutEffect(() => {
    const el = listRef.current;
    const prevLen = prevLenRef.current;
    const prevHeight = prevHeightRef.current;
    const prevFirst = prevFirstIdRef.current;
    const prevLast = prevLastIdRef.current;
    const firstId = messages[0]?.id;
    const lastId = messages[messages.length - 1]?.id;
    prevLenRef.current = messages.length;
    prevFirstIdRef.current = firstId;
    prevLastIdRef.current = lastId;
    if (!el) return;
    prevHeightRef.current = el.scrollHeight;
    if (
      pendingPrependRef.current &&
      messages.length > prevLen &&
      firstId !== prevFirst
    ) {
      // 前置插入历史：把视口锚回原先看到的消息位置
      el.scrollTop += el.scrollHeight - prevHeight;
      pendingPrependRef.current = false;
      return;
    }
    pendingPrependRef.current = false;
    if (lastId !== prevLast) {
      // 追加新消息 / 切换会话初始加载：滚动到底部
      el.scrollTop = el.scrollHeight;
    }
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
        <Avatar src={session.avatar || undefined} style={{ background: token.colorPrimary }}>
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

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div
          ref={listRef}
          onScroll={handleScroll}
          style={{ height: '100%', overflow: 'auto', padding: '12px 16px' }}
        >
          {/* 历史分页状态：顶部加载中 / 到底提示 */}
          <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
            {loadingMore && <Spin size="small" />}
            {!loadingMore && !hasMore && messages.length > 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                没有更多信息了
              </Typography.Text>
            )}
          </div>
          {loading ? (
            <Flex align="center" justify="center" style={{ height: '80%' }}>
              <Spin />
            </Flex>
          ) : (
            messages.map((m, idx) => (
              <div key={m.id}>
                {needGroupSeparator(messages[idx - 1]?.createTime, m.createTime) && (
                  <div style={{ textAlign: 'center', margin: '14px 0 6px' }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {formatGroupTime(m.createTime)}
                    </Typography.Text>
                  </div>
                )}
                <MessageItem
                  message={m}
                  currentUserId={currentUserId}
                  onOpenBiz={onOpenBiz}
                />
              </div>
            ))
          )}
        </div>
        {showJump && !loading && (
          <Button
            size="small"
            icon={<VerticalAlignBottomOutlined />}
            onClick={scrollToBottom}
            style={{
              position: 'absolute',
              bottom: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            回到底部
          </Button>
        )}
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
