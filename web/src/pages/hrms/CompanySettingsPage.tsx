import React from 'react';
import { CompanySettingsDesk } from '../../views/hrms/CompanySettingsDesk';

export const CompanySettingsPage: React.FC = () => {
  return (
    <div className="page-container page-company-settings" style={{ width: '100%', minHeight: '100%' }}>
      <CompanySettingsDesk />
    </div>
  );
};

export default CompanySettingsPage;
