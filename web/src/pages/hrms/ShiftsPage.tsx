import React from 'react';
import { ShiftManagementDesk } from '../../views/hrms/ShiftManagementDesk';

export const ShiftsPage: React.FC = () => {
  return (
    <div className="page-container page-shifts" style={{ width: '100%', minHeight: '100%' }}>
      <ShiftManagementDesk />
    </div>
  );
};

export default ShiftsPage;
