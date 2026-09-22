import React from 'react';
import { PulseDesk } from '../../views/pulse/PulseDesk';

export const PulsePage: React.FC = () => {
  return (
    <div className="page-container page-pulse" style={{ width: '100%', height: '100%' }}>
      <PulseDesk />
    </div>
  );
};

export default PulsePage;
