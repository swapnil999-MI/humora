import React from 'react';
import { TeamCapacityDesk } from '../../views/hrms/TeamCapacityDesk';

export const CapacityPage: React.FC = () => {
  return (
    <div className="page-container page-capacity" style={{ width: '100%', minHeight: '100%' }}>
      <TeamCapacityDesk />
    </div>
  );
};

export default CapacityPage;
