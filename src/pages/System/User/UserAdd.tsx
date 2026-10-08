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
import Crypto from '@/utils/crypto';
import ImageUploader from '@/components/ImageUploader';
import UserExtFields, { normalizeExtData } from './UserExtFields';

interface UserAddProps {
  onOk: () => void;
  /** 保存成功（无论是否关闭弹窗）后回调查询列表刷新，不关闭弹窗时使用 */
  onSaved?: () => void;
  onCancel: () => void;
  roleTree?: any[];
  deptTree?: any[];
  positionList?: any[];
}

const UserAdd: React.FC<UserAddProps> = ({
  onOk,
  onSaved,
  onCancel,
  roleTree = [],
  deptTree = [],
  positionList = [],
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  // 直接上级候选（远程搜索，对齐 ecology ResourceBrowser 主账号过滤）
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

  // 部门树按数据权限裁剪：非超管仅见授权部门子树（对齐 ecology DepartmentBrowser3 rightLevel）
  const { data: scopedDeptData } = useRequest(() => deptApi.treeScope({}));
  const effectiveDeptTree = useMemo(() => {
    const data = Array.isArray(scopedDeptData)
      ? scopedDeptData
      : scopedDeptData?.data || deptTree;
    return data || [];
  }, [scopedDeptData, deptTree]);

  // P2：字段配置驱动（对齐 ecology getHrmResourceAddForm）——改配置即改表单
  const { data: schemaRes } = useRequest(() => userApi.addFormSchema({ tenantId: currentTenantId }));
  const formSchema = useMemo(() => userApi.normalizeFormSchema(schemaRes), [schemaRes]);

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

  // 远程搜索直接上级候选（主账号 account_type=0）；复用用户列表接口
  const fetchManagers = (keyword?: string) => {
    const params: any = { tenantId: form.getFieldValue('tenantId') || currentTenantId, size: 50 };
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
    fetchManagers();
    // 人员状态默认"正式"（对齐 ecology AddResourceBaseCmd 默认 status=1）
    form.setFieldsValue({ personStatus: 1 });
    if (!isSuperAdmin && currentTenantId && currentTenantId !== '000000') {
      form.setFieldsValue({ tenantId: currentTenantId });
    }
  }, [form, isSuperAdmin, currentTenantId]);

  // 字段唯一性预检（对齐 ecology HrmResourceCheck.jsp 的提交前校验）
  const precheckUnique = async (
    field: 'account' | 'workCode' | 'certificateNum',
    value?: string,
  ) => {
    if (!value) return;
    const tenantId = form.getFieldValue('tenantId') || currentTenantId;
    const res: any = await userApi.checkFieldUnique({ field, value, tenantId });
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

  // 按编码规则自动生成工号（prefix+日期+序列）
  const handleGenWorkCode = async () => {
    try {
      const tenantId = form.getFieldValue('tenantId') || currentTenantId;
      const res: any = await userApi.nextWorkCode({ tenantId });
      const code = typeof res === 'string' ? res : res?.data;
      if (code) {
        form.setFieldsValue({ workCode: code });
        message.success('已生成工号');
      } else {
        message.warning('未配置编码规则，请手工填写工号');
      }
    } catch (_e) {
      message.error('工号生成失败');
    }
  };

  /**
   * 提交用户。continueAdding=true 时保存后清空密码并保留租户/部门，停留在新增页（对齐 ecology SaveAndNew）。
   */
  const doSubmit = async (continueAdding: boolean) => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      const { confirmPassword, ...submitValues } = values;

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

      // 头像：ImageUploader 返回 {id,url}，仅取 url 存储
      const avatarVal = submitValues.avatar;
      submitValues.avatar = typeof avatarVal === 'string' ? avatarVal : avatarVal?.url;

      const filteredValues: any = {
        tenantId: submitValues.tenantId,
        account: submitValues.account,
        // 密码经 SM2 公钥加密后提交（后端 auth.private-key 解密后摘要存储，对齐登录链路）
        password: submitValues.password ? Crypto.encryptPassword(submitValues.password) : undefined,
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

      await userApi.submit(filteredValues);
      message.success(continueAdding ? '添加成功，可继续创建' : '添加成功');
      if (continueAdding) {
        // 清空密码/确认密码与自定义字段，保留租户、部门等，便于连续建档（对齐 ecology SaveAndNew）
        form.setFieldsValue({ password: undefined, confirmPassword: undefined, extData: {} });
        onSaved?.();
      } else {
        onOk();
      }
    } catch (_error: any) {
      if (_error?.errorFields) return; // 表单校验失败，不打扰
      message.error('添加失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} layout="vertical" style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>基础信息</h3>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="tenantId"
              label="所属租户"
              rules={[{ required: true, message: '请选择所属租户' }]}
            >
              {isSuperAdmin ? (
                <Select placeholder="请选择所属租户" options={tenantOptions} />
              ) : (
                <Input disabled value={currentTenantLabel} />
              )}
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="account"
              label="登录账号"
              rules={[
                { required: true, message: '请输入登录账号' },
                { validator: (_, v) => precheckUnique('account', v) },
              ]}
            >
              <Input placeholder="请输入登录账号" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="workCode" label="工号">
              <Input
                placeholder="留空自动生成，或手工输入"
                addonAfter={
                  <Button size="small" type="link" style={{ margin: -7 }} onClick={handleGenWorkCode}>
                    自动生成
                  </Button>
                }
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={['password']}
              rules={[
                { required: true, message: '请输入确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请输入确认密码" />
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
            <Form.Item
              name="personStatus"
              label="人员状态"
              rules={[{ required: true, message: '请选择人员状态' }]}
            >
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
            <Form.Item
              name="roleId"
              label="所属角色"
              rules={[{ required: true, message: '请选择所属角色' }]}
            >
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
            <Form.Item
              name="deptId"
              label="所属部门"
              rules={[{ required: true, message: '请选择所属部门' }]}
            >
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
            <Form.Item
              name="positionId"
              label="所属岗位"
              rules={[{ required: true, message: '请选择所属岗位' }]}
            >
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
          <Button
            type="primary"
            ghost
            loading={loading}
            onClick={() => doSubmit(true)}
          >
            保存并继续新增
          </Button>
          <Button type="primary" loading={loading} onClick={() => doSubmit(false)}>
            确定
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default UserAdd;
