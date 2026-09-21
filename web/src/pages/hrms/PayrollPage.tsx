import React from 'react';
import { PayrollDesk } from '../../views/hrms/PayrollDesk';

export const PayrollPage: React.FC = () => {
  return (
    <div className="page-container page-payroll" style={{ width: '100%', minHeight: '100%' }}>
      <PayrollDesk />
    </div>
  );
};

export default PayrollPage;
