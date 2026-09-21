import React from 'react';
import { KanbanBoard } from '../../views/work/KanbanBoard';

export const KanbanPage: React.FC = () => {
  return (
    <div className="page-container page-kanban" style={{ width: '100%', minHeight: '100%' }}>
      <KanbanBoard />
    </div>
  );
};

export default KanbanPage;
