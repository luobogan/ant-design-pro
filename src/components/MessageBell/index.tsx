import { BellOutlined } from '@ant-design/icons';
import { useNavigate } from '@umijs/max';
import { Badge, Button, Tooltip, theme } from 'antd';
import { useEffect, useState } from 'react';
import { getUnreadCount } from '@/pages/Message/service';
import { connectMessageSocket, onUnreadChange } from '@/utils/messageSocket';

/**
 * 顶部消息铃铛：展示全局未读红点，点击进入消息中心。
 * 通过 WS 订阅 /user/queue/unread 实时更新角标。
 */
export default function MessageBell() {
  const navigate = useNavigate();
  const [total, setTotal] = useState<number>(0);
  const { token } = theme.useToken();

  useEffect(() => {
    // 初始拉取（断线补偿）
    getUnreadCount()
      .then((res) => {
        if (res?.data) setTotal(res.data.totalUnread || 0);
      })
      .catch(() => {});

    connectMessageSocket();
    const off = onUnreadChange((payload: any) => {
      if (payload && typeof payload.totalUnread === 'number') {
        setTotal(payload.totalUnread);
      }
    });
    return () => {
      off();
    };
  }, []);

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
