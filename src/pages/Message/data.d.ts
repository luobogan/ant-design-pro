// 消息中心类型定义（对齐后端 blade-message-api 契约）
// 主键统一使用字符串承载，避免雪花 ID 超出 JS 安全整数范围。

/** 内容类型：1文本 2富文本 3附件 4流程引用 */
export type ContentType = 1 | 2 | 3 | 4;

/** 业务引用类型 */
export type BizRefType = 'WF_INSTANCE' | 'WF_TASK' | string;

export interface MessageAttachment {
  id?: string;
  messageId?: string;
  fileId?: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  fileType?: string;
}

/** 发送消息时携带的附件元数据（前端直传 blade-resource 后回传） */
export interface AttachmentMeta {
  fileId?: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  fileType?: string;
}

export interface SessionMember {
  id?: string;
  sessionId?: string;
  userId?: string;
  unreadCount?: number;
  pinned?: number;
  mute?: number;
}

export interface Message {
  id?: string;
  tenantId?: string;
  sessionId?: string;
  senderId?: string;
  contentType?: ContentType;
  content?: string;
  quoteMsgId?: string;
  bizRefType?: BizRefType;
  bizRefId?: string;
  status?: number;
  createTime?: string;
}

export interface Session {
  id?: string;
  tenantId?: string;
  name?: string;
  type?: number;
  lastMessage?: string;
  lastTime?: string;
  unreadCount?: number;
  memberCount?: number;
  memberIds?: string[];
}

export interface MessageVO extends Message {
  senderName?: string;
  /** 发送人头像（供消息列表 Avatar 展示） */
  senderAvatar?: string;
  attachments?: MessageAttachment[];
  /** 当前用户是否已读 */
  read?: boolean;
  /** 接收方已读人数（不含发送人），用于自己发出消息的已读回执 */
  readCount?: number;
  /** 接收方总人数（不含发送人） */
  receiverCount?: number;
}

export interface SessionVO extends Session {
  members?: SessionMember[];
}

export interface SessionUnread {
  sessionId?: string;
  unreadCount?: number;
}

export interface UnreadCountVO {
  totalUnread?: number;
  sessionUnread?: SessionUnread[];
}

export interface MessageSendDTO {
  sessionId: string;
  contentType?: ContentType;
  content?: string;
  quoteMessageId?: string;
  bizRefType?: BizRefType;
  bizRefId?: string;
  attachments?: AttachmentMeta[];
}

export interface SessionCreateDTO {
  memberIds: string[];
  name?: string;
}
