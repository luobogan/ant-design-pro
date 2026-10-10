import { BellOutlined } from '@ant-design/icons';
import { useNavigate } from '@umijs/max';
import { Badge, Button, Tooltip, theme } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { getUnreadCount } from '@/pages/Message/service';
import { pickPayload } from '@/utils/utils';
import { connectMessageSocket, onConnectChange, onUnreadChange } from '@/utils/messageSocket';

/**
 * 顶部消息铃铛：展示全局未读红点，点击进入消息中心。
 *
 * 未读数有三条更新途径，互相兜底（任一失效不至于永远停在旧值）：
 *  1. 首屏拉取一次；
 *  2. WS /user/queue/unread 实时推送；
 *  3. 兜底补偿 —— WS 每次（重）连成功后、以及页面重新切回可见时，重新拉一次全量未读。
 *     WS 断线期间服务端不会补推消息，不主动重拉就会出现「角标一直不更新」。
 */
export default function MessageBell() {
  const navigate = useNavigate();
  const [total, setTotal] = useState<number>(0);
  const { token } = theme.useToken();

  // 统一按 pickPayload 剥载荷：request() 返回形态可能是 载荷 / {data:载荷} / {data:{data:载荷}}
  const applyPayload = useCallback((raw: any) => {
    const payload = pickPayload(raw);
    if (payload && typeof payload.totalUnread === 'number') {
      setTotal(payload.totalUnread);
    }
  }, []);

  // 全量重拉（首屏 / 重连补偿 / 页面切回可见）
  const refresh = useCallback(() => {
    getUnreadCount()
      .then(applyPayload)
      .catch(() => {});
  }, [applyPayload]);

  useEffect(() => {
    refresh();

    connectMessageSocket();
    const offUnread = onUnreadChange(applyPayload);
    // WS 重连后补拉：断线期间漏掉的未读在这里追平
    const offConnect = onConnectChange(refresh);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      offUnread();
      offConnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [applyPayload, refresh]);

  return (
    <Tooltip title="消息中心">
      <Button
        type="text"
        onClick={() => navigate('/message')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 8px',
        }}
        aria-label="消息中心"
      >
        <Badge count={total} size="small" offset={[2, 2]}>
          <BellOutlined style={{ fontSize: 18, color: token.colorText }} />
        </Badge>
      </Button>
    </Tooltip>
  );
}