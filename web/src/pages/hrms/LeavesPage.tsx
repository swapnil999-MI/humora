import React from 'react';
import { HrmsDashboard } from '../../views/hrms/HrmsDashboard';

export const LeavesPage: React.FC = () => {
  return (
    <div className="page-container page-leaves" style={{ width: '100%', minHeight: '100%' }}>
      <HrmsDashboard />
    </div>
  );
};

export default LeavesPage;
