import React from 'react';
import { ApprovalsDesk } from '../../views/hrms/ApprovalsDesk';

export const ApprovalsPage: React.FC = () => {
  return (
    <div className="page-container page-approvals" style={{ width: '100%', minHeight: '100%' }}>
      <ApprovalsDesk />
    </div>
  );
};

export default ApprovalsPage;
