import { useEffect, useMemo, useState } from 'react';
import { Select, Space, Switch, Tag, TreeSelect, Typography, message } from 'antd';
import * as deptApi from '@/services/system/dept';
import * as userApi from '@/services/system/user';
import * as roleApi from '@/services/system/role';

const { Text } = Typography;

/** 授权项：shareType 2=部门 3=个人 4=角色 5=分部 */
export interface ShareItem {
  shareType: number;
  shareId: number;
}

interface Props {
  /** 是否全员可见 */
  all: boolean;
  onAllChange: (v: boolean) => void;
  /** 部门/个人授权项（不含全员） */
  items: ShareItem[];
  onItemsChange: (items: ShareItem[]) => void;
}

/**
 * 门户授权编辑器（页面/菜单可见范围共用）
 * 对标泛微 commonshareinfo / elementshareinfo（§14.3）：全员开关 + 部门树选择 + 人员搜索 + 角色选择，
 * 已选项以标签展示（部门名/人员名/角色名反显），可移除。未配置授权 = 全员可见（由后端口径决定）。
 */
const PortalShareEditor: React.FC<Props> = ({ all, onAllChange, items, onItemsChange }) => {
  const [deptTree, setDeptTree] = useState<any[]>([]);
  const [deptName, setDeptName] = useState<Record<string, string>>({});
  const [userName, setUserName] = useState<Record<string, string>>({});
  const [deptSel, setDeptSel] = useState<number | undefined>();
  const [userSel, setUserSel] = useState<number | undefined>();
  const [userOpts, setUserOpts] = useState<{ value: number; label: string }[]>([]);
  const [roleList, setRoleList] = useState<{ id: number; roleName: string }[]>([]);
  const [roleName, setRoleName] = useState<Record<string, string>>({});
  const [roleSel, setRoleSel] = useState<number | undefined>();
  const [branchSel, setBranchSel] = useState<number | undefined>();

  /** 分部选项：部门树顶层（单一租户根则取其子部门），对标 shareinnerhp type=6 */
  const { branchOptions, branchNameMap } = useMemo(() => {
    const empty = { branchOptions: [] as { value: number; label: string }[], branchNameMap: {} as Record<string, string> };
    if (!deptTree.length) return empty;
    const roots = deptTree as any[];
    const list = roots.length === 1 && roots[0].children?.length ? roots[0].children : roots;
    const map: Record<string, string> = {};
    const options = list.map((n: any) => {
      map[String(n.value)] = n.title;
      return { value: n.value, label: n.title };
    });
    return { branchOptions: options, branchNameMap: map };
  }, [deptTree]);

  /* 角色列表（角色可见用） */
  useEffect(() => {
    let alive = true;
    roleApi
      .list({})
      .then((res: any) => {
        if (!alive) return;
        const arr = Array.isArray(res?.data) ? res.data : res?.data?.records || [];
        const map: Record<string, string> = {};
        const roles = (arr || []).map((r: any) => {
          map[String(r.id)] = r.roleName || String(r.id);
          return { id: r.id, roleName: r.roleName || String(r.id) };
        });
        setRoleList(roles);
        setRoleName((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* 部门树（带数据权限范围） */
  useEffect(() => {
    let alive = true;
    deptApi
      .treeScope({})
      .then((res: any) => {
        if (!alive) return;
        const raw = Array.isArray(res) ? res : res?.data || [];
        const map: Record<string, string> = {};
        const toTree = (nodes: any[]): any[] =>
          (nodes || []).map((n: any) => {
            map[String(n.id ?? n.key)] = n.name ?? n.title;
            return {
              title: n.name ?? n.title,
              value: n.id ?? n.key,
              children: toTree(n.children || []),
            };
          });
        setDeptTree(toTree(raw));
        setDeptName(map);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* 反显已选人员姓名（id → name） */
  useEffect(() => {
    const ids = items.filter((i) => i.shareType === 3).map((i) => i.shareId);
    if (!ids.length) return;
    let alive = true;
    userApi
      .names({ ids: ids.join(',') })
      .then((res: any) => {
        if (!alive) return;
        const arr = res?.data || [];
        setUserName((prev) => {
          const m = { ...prev };
          (arr || []).forEach((u: any) => {
            m[String(u.id)] = u.name || u.account || String(u.id);
          });
          return m;
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [items]);

  const addDept = (v: any) => {
    const id = Number(v);
    setDeptSel(undefined);
    if (!id) return;
    if (items.some((i) => i.shareType === 2 && i.shareId === id)) {
      message.warning('该部门已添加');
      return;
    }
    onItemsChange([...items, { shareType: 2, shareId: id }]);
  };

  const searchUsers = (kw: string) => {
    if (!kw || !kw.trim()) {
      setUserOpts([]);
      return;
    }
    userApi
      .list({ name: kw, account: kw, current: 1, size: 20 })
      .then((res: any) => {
        const records = res?.data?.records || res?.records || [];
        setUserOpts(
          (records || []).map((u: any) => ({
            value: u.id,
            label: `${u.name || ''}${u.account ? `（${u.account}）` : ''}`,
          })),
        );
      })
      .catch(() => setUserOpts([]));
  };

  const addUser = (v: any) => {
    const id = Number(v);
    setUserSel(undefined);
    if (!id) return;
    if (items.some((i) => i.shareType === 3 && i.shareId === id)) {
      message.warning('该用户已添加');
      return;
    }
    onItemsChange([...items, { shareType: 3, shareId: id }]);
  };

  const addRole = (v: any) => {
    const id = Number(v);
    setRoleSel(undefined);
    if (!id) return;
    if (items.some((i) => i.shareType === 4 && i.shareId === id)) {
      message.warning('该角色已添加');
      return;
    }
    onItemsChange([...items, { shareType: 4, shareId: id }]);
  };

  const addBranch = (v: any) => {
    const id = Number(v);
    setBranchSel(undefined);
    if (!id) return;
    if (items.some((i) => i.shareType === 5 && i.shareId === id)) {
      message.warning('该分部已添加');
      return;
    }
    onItemsChange([...items, { shareType: 5, shareId: id }]);
  };

  const removeItem = (type: number, id: number) =>
    onItemsChange(items.filter((x) => !(x.shareType === type && x.shareId === id)));

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <span>全员可见：</span>
        <Switch checked={all} onChange={onAllChange} />
        <Text type="secondary">开启后所有登录用户均可见</Text>
      </Space>

      {!all && (
        <>
          <Space style={{ marginBottom: 12 }} wrap>
            <TreeSelect
              value={deptSel}
              onChange={addDept}
              treeData={deptTree}
              placeholder="选择部门"
              style={{ width: 220 }}
              treeDefaultExpandAll
              allowClear
            />
            <Select
              showSearch
              value={userSel}
              onChange={addUser}
              onSearch={searchUsers}
              filterOption={false}
              placeholder="搜索人员（姓名/账号）"
              style={{ width: 240 }}
              options={userOpts}
              allowClear
              notFoundContent={null}
            />
            <Select
              showSearch
              value={roleSel}
              onChange={addRole}
              placeholder="选择角色"
              style={{ width: 180 }}
              options={roleList.map((r) => ({ value: r.id, label: r.roleName }))}
              optionFilterProp="label"
              allowClear
            />
            <Select
              showSearch
              value={branchSel}
              onChange={addBranch}
              placeholder="选择分部（顶层部门）"
              style={{ width: 200 }}
              options={branchOptions}
              optionFilterProp="label"
              allowClear
            />
          </Space>
          <Space size={[8, 8]} wrap>
            {items.length === 0 ? (
              <Text type="secondary">暂未配置部门/个人/角色/分部授权</Text>
            ) : (
              items.map((it) => (
                <Tag
                  key={`${it.shareType}-${it.shareId}`}
                  color={
                    it.shareType === 2
                      ? 'blue'
                      : it.shareType === 4
                        ? 'purple'
                        : it.shareType === 5
                          ? 'geekblue'
                          : 'green'
                  }
                  closable
                  onClose={() => removeItem(it.shareType, it.shareId)}
                >
                  {it.shareType === 2
                    ? '部门'
                    : it.shareType === 4
                      ? '角色'
                      : it.shareType === 5
                        ? '分部'
                        : '个人'}
                  ：
                  {it.shareType === 2
                    ? deptName[String(it.shareId)] || it.shareId
                    : it.shareType === 4
                      ? roleName[String(it.shareId)] || it.shareId
                      : it.shareType === 5
                        ? branchNameMap[String(it.shareId)] || it.shareId
                        : userName[String(it.shareId)] || it.shareId}
                </Tag>
              ))
            )}
          </Space>
        </>
      )}
    </div>
  );
};

export default PortalShareEditor;
