import React from 'react';
import { EmployeeDirectory } from '../../views/hrms/EmployeeDirectory';

export const DirectoryPage: React.FC = () => {
  return (
    <div className="page-container page-directory" style={{ width: '100%', minHeight: '100%' }}>
      <EmployeeDirectory />
    </div>
  );
};

export default DirectoryPage;
