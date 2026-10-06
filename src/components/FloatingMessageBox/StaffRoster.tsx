import { MessageOutlined, SearchOutlined } from '@ant-design/icons';
import { Avatar, Badge, Empty, Flex, Input, List, Spin, Tooltip, Typography, theme } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as userApi from '@/services/system/user';

/** 人员条目（来自 /blade-system/user/list，天然限本租户） */
export interface RosterUser {
  id: string;
  name?: string;
  realName?: string;
  account?: string;
  avatar?: string;
}

interface Props {
  /** 在线用户ID集合（字符串形式，避免大整数精度问题） */
  onlineIds: Set<string>;
  /** 当前正在聊天的人员ID */
  activeUserId?: string;
  /** 点击某人员：发起/打开两人会话 */
  onSelect: (user: RosterUser) => void;
}

/**
 * 人员列表：展示本租户全公司人员，头像 + 快捷聊天小图标，角标标识在线状态。
 */
export default function StaffRoster({ onlineIds, activeUserId, onSelect }: Props) {
  const { token } = theme.useToken();
  const [users, setUsers] = useState<RosterUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');

  const fetchUsers = useCallback((kw: string) => {
    setLoading(true);
    userApi
      .list({
        current: 1,
        // 注意：后端 Query 绑定的是 size（非 pageSize），传错会退化为默认每页 10 条
        size: 500,
        account: kw || undefined,
        realName: kw || undefined,
      })
      .then((res: any) => {
        const records: any[] = res?.data?.records ?? [];
        setUsers(
          records.map((u) => ({
            id: String(u.id),
            name: u.name,
            realName: u.realName,
            account: u.account,
            avatar: u.avatar,
          })),
        );
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(keyword.trim()), 300);
    return () => clearTimeout(timer);
  }, [keyword, fetchUsers]);

  const onlineCount = useMemo(
    () => users.filter((u) => onlineIds.has(u.id)).length,
    [users, onlineIds],
  );

  const displayName = (u: RosterUser) => u.name || u.realName || u.account || u.id;

  return (
    <Flex vertical style={{ height: '100%', background: token.colorBgContainer }}>
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            全公司人员
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            <span style={{ color: token.colorSuccess }}>{onlineCount}</span>
            {` / ${users.length} 在线`}
          </Typography.Text>
        </Flex>
        <Input
          size="small"
          allowClear
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder="搜索姓名/账号"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && users.length === 0 ? (
          <Flex align="center" justify="center" style={{ height: 120 }}>
            <Spin />
          </Flex>
        ) : users.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无人员"
            style={{ marginTop: 24 }}
          />
        ) : (
          <List
            size="small"
            dataSource={users}
            renderItem={(u) => {
              const online = onlineIds.has(u.id);
              const active = String(u.id) === String(activeUserId);
              return (
                <List.Item
                  onClick={() => onSelect(u)}
                  style={{
                    cursor: 'pointer',
                    padding: '8px 12px',
                    background: active ? token.colorPrimaryBg : undefined,
                  }}
                >
                  <Flex align="center" gap={10} style={{ width: '100%' }}>
                    <Badge
                      dot
                      color={online ? token.colorSuccess : token.colorTextTertiary}
                      offset={[-2, 30]}
                    >
                      <Avatar src={u.avatar} style={{ background: token.colorPrimary }}>
                        {displayName(u).slice(0, 1)}
                      </Avatar>
                    </Badge>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text
                        ellipsis
                        style={{ fontSize: 13, display: 'block' }}
                      >
                        {displayName(u)}
                      </Typography.Text>
                      <Typography.Text
                        type="secondary"
                        ellipsis
                        style={{ fontSize: 12, display: 'block' }}
                      >
                        {online ? '在线' : '离线'}
                        {u.account ? ` · ${u.account}` : ''}
                      </Typography.Text>
                    </div>
                    <Tooltip title="发消息">
                      <MessageOutlined
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(u);
                        }}
                        style={{
                          color: active ? token.colorPrimary : token.colorTextSecondary,
                          cursor: 'pointer',
                        }}
                      />
                    </Tooltip>
                  </Flex>
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </Flex>
  );
}
