import { history } from '@umijs/max';
import { Button, Result } from 'antd';
import React from 'react';
import styles from './Login.less';

const RegisterResult: React.FC = () => {
  const handleLogin = () => {
    history.push('/user/login');
  };

  const handleBack = () => {
    history.push('/user/register');
  };

  return (
    <div className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Sword Admin</h1>
        </div>
        <div className={styles.form}>
          <Result
            status="success"
            title="注册成功！"
            subTitle="您的账号已成功创建，请使用注册的账号密码登录系统。"
            extra={[
              <Button type="primary" key="login" onClick={handleLogin}>
                去登录
              </Button>,
              <Button key="back" onClick={handleBack}>
                返回注册
              </Button>,
            ]}
          />
        </div>
      </div>
    </div>
  );
};

export default RegisterResult;
