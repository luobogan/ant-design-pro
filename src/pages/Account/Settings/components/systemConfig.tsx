import { useAccess } from '@umijs/max';
import { Alert, Card, Form, Result, Switch, message } from 'antd';
import React, { useEffect, useState } from 'react';
import Settings from '../../../../../config/defaultSettings';
import {
  saveCaptchaMode,
  loadCaptchaMode,
  DEFAULT_TENANT_ID,
} from '@/utils/captchaSetting';
import { getTenantId } from '@/utils/authority';

/**
 * 系统配置（仅高级管理员可见/可改）
 * 当前提供：是否开启登录验证码（持久化到数据库参数 captcha_mode）
 */
const SystemConfigView: React.FC = () => {
  const { canAdmin } = useAccess();
  const [enabled, setEnabled] = useState<boolean>(Settings.captchaMode === true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 进入时按当前管理员所在租户加载本租户的验证码开关，避免误读全局兜底值
    const tid = getTenantId() || DEFAULT_TENANT_ID;
    loadCaptchaMode(tid).then((v) => setEnabled(v));
  }, []);

  if (!canAdmin) {
    return (
      <Result status="403" title="无权限" subTitle="仅高级管理员可配置系统参数" />
    );
  }

  const onToggle = async (checked: boolean) => {
    setSaving(true);
    try {
      await saveCaptchaMode(checked);
      setEnabled(checked);
      message.success('已保存登录验证码配置');
    } catch (e) {
      message.error('保存失败，请确认是否具有管理员权限');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="登录安全配置" bordered={false}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message={`该配置按租户隔离保存在数据库（参数键：captcha_mode:<当前租户>），修改后将在下次登录时生效。`}
      />
      <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 14 }}>
        <Form.Item
          label="开启登录验证码"
          tooltip="关闭后登录页不再要求输入图形验证码；开启后登录需校验图形验证码"
        >
          <Switch
            checked={enabled}
            loading={saving}
            onChange={onToggle}
            checkedChildren="开启"
            unCheckedChildren="关闭"
          />
        </Form.Item>
      </Form>
    </Card>
  );
};

export default SystemConfigView;
