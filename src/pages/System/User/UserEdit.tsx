import { CalendarOutlined, UserOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  message,
  Row,
  Select,
  Space,
  TreeSelect,
} from 'antd';
import { useModel, useRequest } from '@umijs/max';
import moment from 'moment';
import React, { useMemo, useState } from 'react';
import * as userApi from '@/services/system/user';
import * as tenantApi from '@/services/system/tenant';
import * as deptApi from '@/services/system/dept';
import ImageUploader from '@/components/ImageUploader';
import UserExtFields, { normalizeExtData } from './UserExtFields';

interface User {
  id: string;
  account: string;
  name: string;
  realName: string;
  tenantId?: string;
  tenantName?: string;
  platform?: string;
  phone?: string;
  email?: string;
  sex?: number;
  birthday?: string;
  userCode?: string;
  workCode?: string;
  personStatus?: number;
  certificateNum?: string;
  roleId?: string;
  deptId?: string;
  positionId?: string;
  managerId?: string;
  avatar?: string;
  isManager?: number;
  status?: number;
}

interface UserEditProps {
  user: User;
  onOk: () => void;
  onCancel: () => void;
  roleTree?: any[];
  deptTree?: any[];
  positionList?: any[];
}

const UserEdit: React.FC<UserEditProps> = ({
  user,
  onOk,
  onCancel,
  roleTree = [],
  deptTree = [],
  positionList = [],
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [managerOptions, setManagerOptions] = useState<any[]>([]);

  const { initialState } = useModel('@@initialState');

  let currentTenantId = '000000';
  if (initialState?.user?.tenantId) {
    currentTenantId = initialState.user.tenantId;
  } else if (initialState?.user?.tenant_id) {
    currentTenantId = initialState.user.tenant_id;
  } else {
    try {
      const userInfoStr = localStorage.getItem('sword-user-info');
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        currentTenantId = userInfo.tenantId || userInfo.tenant_id || '000000';
      }
    } catch (e) {
      currentTenantId = '000000';
    }
  }

  const isSuperAdmin = currentTenantId === '000000';

  const { data: tenantData } = useRequest(() => tenantApi.list({}));

  // 部门树按数据权限裁剪：非超管仅见授权部门子树
  const { data: scopedDeptData } = useRequest(() => deptApi.treeScope({}));
  const effectiveDeptTree = useMemo(() => {
    const data = Array.isArray(scopedDeptData)
      ? scopedDeptData
      : scopedDeptData?.data || deptTree;
    return data || [];
  }, [scopedDeptData, deptTree]);

  // P2：字段配置驱动（对齐 ecology getHrmResourceAddForm）
  const { data: schemaRes } = useRequest(() =>
    userApi.addFormSchema({ tenantId: isSuperAdmin ? user.tenantId || '000000' : currentTenantId }),
  );
  const formSchema = useMemo(() => userApi.normalizeFormSchema(schemaRes), [schemaRes]);

  // P2：自定义字段值回显（对齐 ecology cus_fielddata）
  const { data: extRes } = useRequest(() => userApi.extData({ userId: user.id }), {
    refreshDeps: [user?.id],
  });
  const extValues = useMemo(() => {
    const raw = extRes?.data || extRes || {};
    return typeof raw === 'object' && raw !== null ? raw : {};
  }, [extRes]);

  const tenantOptions = useMemo(() => {
    const records = Array.isArray(tenantData)
      ? tenantData
      : tenantData?.records || tenantData?.data || [];
    return records.map((tenant: any) => ({
      label: tenant.tenantName || tenant.name || tenant.id,
      value: tenant.tenantId || tenant.id,
    }));
  }, [tenantData]);

  const currentTenantLabel = tenantOptions.find((t) => t.value === currentTenantId)?.label || currentTenantId;

  const fetchManagers = (keyword?: string) => {
    const params: any = { tenantId: isSuperAdmin ? (user.tenantId || '000000') : currentTenantId, size: 50 };
    if (keyword) {
      params.realName = keyword;
    }
    userApi
      .list(params)
      .then((res: any) => {
        const records = res?.data?.records || res?.records || res?.data || [];
        setManagerOptions(
          records.map((u: any) => ({
            label: `${u.realName || u.name || ''}（${u.account}）`,
            value: String(u.id),
          })),
        );
      })
      .catch(() => {});
  };

  React.useEffect(() => {
    if (user) {
      const tenantIdValue = isSuperAdmin ? user.tenantId || '000000' : currentTenantId;
      form.setFieldsValue({
        tenantId: tenantIdValue,
        account: user.account,
        workCode: user.workCode,
        personStatus: user.personStatus ?? 1,
        certificateNum: user.certificateNum,
        name: user.name,
        realName: user.realName,
        phone: user.phone,
        email: user.email,
        sex: user.sex ?? 0,
        birthday: user.birthday ? moment(user.birthday) : null,
        avatar: user.avatar || undefined,
        managerId: user.managerId ? String(user.managerId) : undefined,
        roleId: user.roleId
          ? typeof user.roleId === 'string'
            ? user.roleId.split(',')
            : user.roleId
          : undefined,
        deptId: user.deptId
          ? typeof user.deptId === 'string'
            ? user.deptId.split(',')
            : user.deptId
          : undefined,
        positionId: user.positionId
          ? typeof user.positionId === 'string'
            ? user.positionId.split(',')
            : user.positionId
          : undefined,
      });
    }
    fetchManagers();
  }, [user, form, isSuperAdmin, currentTenantId]);

  // 自定义字段回显：日期控件需转 moment
  React.useEffect(() => {
    if (!formSchema.length || !extValues || Object.keys(extValues).length === 0) return;
    const mapped: Record<string, any> = {};
    formSchema.forEach((g) =>
      (g.fields || []).forEach((f) => {
        const v = extValues[f.fieldId];
        if (v === undefined || v === null || v === '') return;
        mapped[f.fieldId] = f.eleType === 'date' ? moment(v) : v;
      }),
    );
    form.setFieldsValue({ extData: mapped });
  }, [formSchema, extValues, form]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const submitValues = { ...values };

      if (submitValues.birthday) {
        submitValues.birthday = moment(submitValues.birthday).format('YYYY-MM-DD HH:mm:ss');
      }

      if (Array.isArray(submitValues.roleId)) {
        submitValues.roleId = submitValues.roleId.join(',');
      }
      if (Array.isArray(submitValues.deptId)) {
        submitValues.deptId = submitValues.deptId.join(',');
      }
      if (Array.isArray(submitValues.positionId)) {
        submitValues.positionId = submitValues.positionId.join(',');
      }

      const avatarVal = submitValues.avatar;
      submitValues.avatar = typeof avatarVal === 'string' ? avatarVal : avatarVal?.url;

      const filteredValues: any = {
        id: user.id,
        tenantId: submitValues.tenantId,
        account: submitValues.account,
        workCode: submitValues.workCode,
        personStatus: submitValues.personStatus,
        certificateNum: submitValues.certificateNum,
        name: submitValues.name,
        realName: submitValues.realName,
        phone: submitValues.phone,
        email: submitValues.email,
        sex: submitValues.sex,
        birthday: submitValues.birthday,
        roleId: submitValues.roleId,
        deptId: submitValues.deptId,
        postId: submitValues.positionId,
        managerId: submitValues.managerId ? String(submitValues.managerId) : undefined,
        avatar: submitValues.avatar || undefined,
        // P2：自定义字段值 -> blade_user_ext_data（对齐 ecology cus_fielddata）
        extData: normalizeExtData(submitValues.extData),
      };

      await userApi.update(filteredValues);
      message.success('修改成功');
      onOk();
    } catch (_error) {
      message.error('修改失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 字段唯一性预检（编辑场景排除自身；对齐 ecology HrmResourceCheck.jsp）
  const precheckUnique = async (
    field: 'account' | 'workCode' | 'certificateNum',
    value?: string,
  ) => {
    if (!value) return;
    const tenantId = form.getFieldValue('tenantId') || currentTenantId;
    const res: any = await userApi.checkFieldUnique({
      field,
      value,
      tenantId,
      excludeId: user.id,
    });
    const available = typeof res === 'boolean' ? res : res?.data;
    if (available === false) {
      throw new Error(
        field === 'workCode'
          ? '当前工号已被使用'
          : field === 'account'
            ? '当前登录账号已被使用'
            : '当前证件号已被使用',
      );
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>基础信息</h3>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="tenantId" label="所属租户" rules={[{ required: true, message: '请选择所属租户' }]}>
              {isSuperAdmin ? (
                <Select placeholder="请选择所属租户" options={tenantOptions} />
              ) : (
                <Input disabled value={currentTenantLabel} />
              )}
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="account" label="登录账号" rules={[{ required: true, message: '请输入登录账号' }]}>
              <Input disabled placeholder="登录账号不可修改" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="workCode"
              label="工号"
              rules={[{ validator: (_, v) => precheckUnique('workCode', v) }]}
            >
              <Input placeholder="请输入工号" />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <Divider />

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>详细信息</h3>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name" label="用户昵称" rules={[{ required: true, message: '请输入用户昵称' }]}>
              <Input placeholder="请输入用户昵称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="realName" label="用户姓名" rules={[{ required: true, message: '请输入用户姓名' }]}>
              <Input placeholder="请输入用户姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="phone"
              label="手机号码"
              rules={[{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码' }]}
            >
              <Input placeholder="请输入手机号码" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="email" label="电子邮箱" rules={[{ type: 'email', message: '请输入正确的电子邮箱' }]}>
              <Input placeholder="请输入电子邮箱" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="sex" label="用户性别">
              <Select
                placeholder="请选择用户性别"
                options={[
                  { label: '男', value: 1 },
                  { label: '女', value: 2 },
                  { label: '未知', value: 0 },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="birthday" label="用户生日">
              <DatePicker placeholder="请选择用户生日" style={{ width: '100%' }} suffixIcon={<CalendarOutlined />} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="personStatus" label="人员状态" rules={[{ required: true, message: '请选择人员状态' }]}>
              <Select placeholder="请选择人员状态" options={userApi.PERSON_STATUS_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="certificateNum"
              label="证件号"
              rules={[{ validator: (_, v) => precheckUnique('certificateNum', v) }]}
            >
              <Input placeholder="请输入证件号" />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <Divider />

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>职责信息</h3>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="roleId" label="所属角色" rules={[{ required: true, message: '请选择所属角色' }]}>
              <TreeSelect
                treeData={roleTree}
                placeholder="请选择所属角色"
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="deptId" label="所属部门" rules={[{ required: true, message: '请选择所属部门' }]}>
              <TreeSelect
                treeData={effectiveDeptTree}
                placeholder="请选择所属部门"
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="positionId" label="所属岗位" rules={[{ required: true, message: '请选择所属岗位' }]}>
              <TreeSelect
                treeData={positionList.map((p: any) => ({
                  title: p.positionName || p.name,
                  value: p.id,
                  key: p.id,
                }))}
                placeholder="请选择所属岗位"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="managerId" label="直接上级">
              <Select
                showSearch
                allowClear
                placeholder="搜索并选择直属主管"
                defaultActiveFirstOption={false}
                filterOption={false}
                options={managerOptions}
                onSearch={fetchManagers}
                notFoundContent={null}
                suffixIcon={<UserOutlined />}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="avatar" label="头像">
              <ImageUploader
                returnObject
                uploadUrl="/api/blade-resource/oss/endpoint/put-file"
                style={{ width: 96, height: 96 }}
              />
            </Form.Item>
          </Col>
        </Row>
      </div>

      {/* P2：配置驱动的自定义字段（对齐 ecology HrmResourceAddNew.jsp 分组渲染） */}
      <UserExtFields groups={formSchema} />

      <Form.Item style={{ textAlign: 'right', marginTop: 32 }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            确定
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default UserEdit;
