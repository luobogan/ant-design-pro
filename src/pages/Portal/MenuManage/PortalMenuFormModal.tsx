/**
 * 门户菜单「新增/编辑」弹窗
 *
 * 从 MenuManage 抽出，供「菜单维护」页与「部门菜单权限」页共用（后者需要在菜单树上直接增改）。
 * 提交走 portalApi.submitMenu（menuId 为空=新增）。
 */
import { useEffect } from 'react';
import { Form, Input, InputNumber, Modal, Select, Switch } from 'antd';
import type { PortalMenu, PortalMenuSaveData } from '@/services/portal';

export interface PortalMenuFormValues {
  menuId?: number;
  parentId: number;
  menuName: string;
  icon: string;
  routeUrl: string;
  menuType: string;
  linkMode: number;
  sortOrder: number;
  visible: number;
}

interface Props {
  open: boolean;
  /** 编辑的菜单；null = 新增 */
  editing: PortalMenu | null;
  /** 当前菜单类型（新增时锁定；编辑时禁止改类型） */
  menuType: string;
  /** 同类型菜单列表（作父级候选） */
  sameTypeList: PortalMenu[];
  saving: boolean;
  onSubmit: (values: PortalMenuFormValues) => void;
  onCancel: () => void;
}

/** 常用 antd 图标（与前端 APP_ICON_MAP 对齐，未映射的会回退成 AppstoreOutlined） */
const ICON_OPTIONS = [
  { value: 'home', label: 'home 首页' },
  { value: 'appstore', label: 'appstore 应用' },
  { value: 'dashboard', label: 'dashboard 仪表' },
  { value: 'cluster', label: 'cluster 分支' },
  { value: 'message', label: 'message 消息' },
  { value: 'table', label: 'table 表格' },
  { value: 'edit', label: 'edit 编辑' },
  { value: 'profile', label: 'profile 档案' },
  { value: 'solution', label: 'solution 审批' },
  { value: 'notification', label: 'notification 通知' },
  { value: 'skin', label: 'skin 皮肤' },
];

const PortalMenuFormModal: React.FC<Props> = ({
  open,
  editing,
  menuType,
  sameTypeList,
  saving,
  onSubmit,
  onCancel,
}) => {
  const [form] = Form.useForm<PortalMenuFormValues>();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      menuId: editing?.id,
      parentId: editing?.parentId ?? 0,
      menuName: editing?.menuName,
      icon: editing?.icon,
      routeUrl: editing?.routeUrl,
      menuType,
      linkMode: editing?.linkMode ?? 1,
      sortOrder: editing?.sortOrder ?? 0,
      visible: editing?.visible ?? 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, menuType]);

  return (
    <Modal
      title={editing ? `编辑菜单 · ${editing.menuName}` : '新建菜单'}
      open={open}
      confirmLoading={saving}
      onOk={() => form.submit()}
      onCancel={onCancel}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      width={520}
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 16 }}
        onFinish={(values) => {
          onSubmit({
            ...values,
            menuType,
            parentId: Number(values.parentId) || 0,
            linkMode: Number(values.linkMode) || 1,
            sortOrder: Number(values.sortOrder) || 0,
            visible: values.visible ? 1 : 0,
          } as PortalMenuFormValues & PortalMenuSaveData);
        }}
      >
        <Form.Item name="menuId" hidden>
          <Input />
        </Form.Item>
        <Form.Item
          name="parentId"
          label="上级菜单"
          extra="顶级菜单请选择「（顶级）」；上级须为同类型"
          initialValue={0}
        >
          <Select
            options={[
              { value: 0, label: '（顶级）' },
              ...sameTypeList
                .filter((m) => m.id !== editing?.id)
                .map((m) => ({ value: m.id as number, label: m.menuName as string })),
            ]}
          />
        </Form.Item>
        <Form.Item name="menuName" label="菜单名称" rules={[{ required: true, message: '请输入菜单名称' }]}>
          <Input placeholder="如：流程中心" maxLength={128} />
        </Form.Item>
        <Form.Item name="icon" label="图标">
          <Select allowClear options={ICON_OPTIONS} placeholder="选择图标（可选）" />
        </Form.Item>
        <Form.Item name="routeUrl" label="链接地址" extra="顶级分组菜单可留空，仅用于展开子级">
          <Input placeholder="站内路由如 /workflow/todo" maxLength={512} />
        </Form.Item>
        <Form.Item name="linkMode" label="链接模式" initialValue={1}>
          <Select
            options={[
              { value: 1, label: '站内路由' },
              { value: 2, label: '外部链接' },
            ]}
          />
        </Form.Item>
        <Form.Item name="sortOrder" label="排序号" extra="数字越小越靠前" initialValue={0}>
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
        <Form.Item name="visible" label="是否可见" valuePropName="checked">
          <Switch checkedChildren="可见" unCheckedChildren="隐藏" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PortalMenuFormModal;
