/**
 * 消息中心实时推送客户端（STOMP over SockJS）
 *
 * 约定：
 *  - 网关已将 /api/blade-message/ws/** 代理到 blade-message 服务（StripPrefix=1 → /ws/message）
 *  - 握手时通过 ?token= 透传 JWT，后端解析 user_id 作为 STOMP 用户目的地路由依据
 *  - 服务端推送：/user/queue/message（新消息）、/user/queue/unread（未读红点聚合）
 */
import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WS_ENDPOINT = '/api/blade-message/ws/message';

type Handler = (payload: any) => void;

let client: Client | null = null;
const messageHandlers = new Set<Handler>();
const unreadHandlers = new Set<Handler>();
const readHandlers = new Set<Handler>();

/**
 * 在线状态心跳：后端活跃窗口 90s，这里 60s 续期一次，避免长连接被误判离线。
 * 服务端入口：@MessageMapping("presence/ping")，应用前缀 /app。
 */
const PRESENCE_PING_MS = 60_000;
let presenceTimer: ReturnType<typeof setInterval> | undefined;

function startPresencePing() {
  stopPresencePing();
  const send = () => {
    if (client?.connected) {
      try {
        client.publish({ destination: '/app/presence/ping', body: '' });
      } catch (e) {
        // 心跳失败不影响主流程，等待下一轮
      }
    }
  };
  send();
  presenceTimer = setInterval(send, PRESENCE_PING_MS);
}

function stopPresencePing() {
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = undefined;
  }
}

function getToken(): string {
  return localStorage.getItem('sword-token') || '';
}

export function connectMessageSocket() {
  const token = getToken();
  if (!token) return;
  if (client && (client.active || client.connected)) return;

  // 显式限定传输方式，排除 iframe-* 传输：跨域时 sockjs-client 会去加载
  // <endpoint>/iframe.html，而 Spring Framework 7 已移除 SockJS iframe 资源，必然 404
  const socketFactory = () =>
    new SockJS(`${WS_ENDPOINT}?token=${encodeURIComponent(token)}`, undefined, {
      transports: ['websocket', 'xhr-streaming', 'xhr-polling'],
    });
  client = new Client({
    webSocketFactory: socketFactory,
    reconnectDelay: 3000,
    onConnect: () => {
      // 连接成功后开始在线心跳续期
      startPresencePing();
      client?.subscribe('/user/queue/message', (frame: IMessage) => {
        try {
          const payload = JSON.parse(frame.body);
          messageHandlers.forEach((h) => h(payload));
        } catch (e) {
          // 忽略无法解析的帧
        }
      });
      client?.subscribe('/user/queue/unread', (frame: IMessage) => {
        try {
          const payload = JSON.parse(frame.body);
          unreadHandlers.forEach((h) => h(payload));
        } catch (e) {
          // 忽略无法解析的帧
        }
      });
      // 已读回执：会话内其他成员已读后，刷新自己发出消息的「已读/未读」
      client?.subscribe('/user/queue/read', (frame: IMessage) => {
        try {
          const payload = JSON.parse(frame.body);
          readHandlers.forEach((h) => h(payload));
        } catch (e) {
          // 忽略无法解析的帧
        }
      });
    },
    onStompError: (frame) => {
      console.warn('[messageSocket] STOMP 错误', frame.body);
    },
  });
  client.activate();
}

export function onNewMessage(handler: Handler): () => void {
  messageHandlers.add(handler);
  return () => messageHandlers.delete(handler);
}

export function onUnreadChange(handler: Handler): () => void {
  unreadHandlers.add(handler);
  return () => unreadHandlers.delete(handler);
}

/** 已读回执：payload 含 sessionId，调用方可据此刷新当前会话消息 */
export function onReadChange(handler: Handler): () => void {
  readHandlers.add(handler);
  return () => readHandlers.delete(handler);
}

export function disconnectMessageSocket() {
  stopPresencePing();
  if (client) {
    client.deactivate();
    client = null;
  }
}
