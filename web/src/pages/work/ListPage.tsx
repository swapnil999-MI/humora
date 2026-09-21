import React from 'react';
import { ListView } from '../../views/work/ListView';

export const ListPage: React.FC = () => {
  return (
    <div className="page-container page-list" style={{ width: '100%', minHeight: '100%' }}>
      <ListView />
    </div>
  );
};

export default ListPage;
