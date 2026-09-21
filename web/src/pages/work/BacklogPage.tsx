import React from 'react';
import { BacklogView } from '../../views/work/BacklogView';

export const BacklogPage: React.FC = () => {
  return (
    <div className="page-container page-backlog" style={{ width: '100%', minHeight: '100%' }}>
      <BacklogView />
    </div>
  );
};

export default BacklogPage;
