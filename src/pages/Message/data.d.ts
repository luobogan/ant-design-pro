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
  /** 消息分类：1=聊天 2=流程通知（流程通知固定进 type=3 系统通知会话） */
  category?: number;
  /** 通知业务状态：undefined=待处理 1=已处理 2=已办结（审批同意/流程办结时后端回写） */
  bizState?: number;
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
  /** 会话展示头像（私聊 = 对方成员头像，后端回填） */
  avatar?: string;
  /** 会话类型：1=两人 2=群 3=系统通知（流程消息，每人一条，不进聊天列表） */
  type?: number;
  lastMessage?: string;
  /** 最近消息时间（格式 YYYY-MM-DD HH:mm:ss，字符串本身即可比较大小） */
  lastTime?: string;
  unreadCount?: number;
  memberCount?: number;
  memberIds?: string[];
  /** 是否置顶（后端由会话成员表回填，仅当前用户维度） */
  pinned?: number;
  /** 是否免打扰 */
  mute?: number;
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
