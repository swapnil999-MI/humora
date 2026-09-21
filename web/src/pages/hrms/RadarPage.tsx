import React from 'react';
import { TeamRadarDesk } from '../../views/hrms/TeamRadarDesk';

export const RadarPage: React.FC = () => {
  return (
    <div className="page-container page-radar" style={{ width: '100%', minHeight: '100%' }}>
      <TeamRadarDesk />
    </div>
  );
};

export default RadarPage;
