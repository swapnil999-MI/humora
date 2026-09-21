import React from 'react';
import { AttendanceDesk } from '../../views/hrms/AttendanceDesk';

export const AttendancePage: React.FC = () => {
  return (
    <div className="page-container page-attendance" style={{ width: '100%', minHeight: '100%' }}>
      <AttendanceDesk />
    </div>
  );
};

export default AttendancePage;
