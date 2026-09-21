import React from 'react';
import { MyWorkdayHub } from '../../views/hub/MyWorkdayHub';

export const HubPage: React.FC = () => {
  return (
    <div className="page-container page-hub" style={{ width: '100%', minHeight: '100%' }}>
      <MyWorkdayHub />
    </div>
  );
};

export default HubPage;
