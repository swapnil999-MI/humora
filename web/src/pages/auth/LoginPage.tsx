import React from 'react';
import { LoginView } from '../../views/auth/LoginView';

export const LoginPage: React.FC = () => {
  return (
    <div className="page-container page-login" style={{ width: '100%', height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
      <LoginView />
    </div>
  );
};

export default LoginPage;
