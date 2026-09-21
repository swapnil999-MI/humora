import React from 'react';
import { useAppSelector } from '../store/store';
import { HubPage } from './hub/HubPage';
import { AttendancePage } from './hrms/AttendancePage';
import { LeavesPage } from './hrms/LeavesPage';
import { CapacityPage } from './hrms/CapacityPage';
import { ProfilePage } from './hrms/ProfilePage';
import { OnboardingPage } from './hrms/OnboardingPage';
import { DirectoryPage } from './hrms/DirectoryPage';
import { ApprovalsPage } from './hrms/ApprovalsPage';
import { ShiftsPage } from './hrms/ShiftsPage';
import { RadarPage } from './hrms/RadarPage';
import { PayrollPage } from './hrms/PayrollPage';
import { CompanySettingsPage } from './hrms/CompanySettingsPage';
import { KanbanPage } from './work/KanbanPage';
import { ListPage } from './work/ListPage';
import { BacklogPage } from './work/BacklogPage';

interface PageRouterProps {
  onOpenCandidateWizard?: (token: string) => void;
}

export const PageRouter: React.FC<PageRouterProps> = ({ onOpenCandidateWizard }) => {
  const { activePage } = useAppSelector((state) => state.ui);

  switch (activePage) {
    // Employee Self-Service Space
    case 'hub':
      return <HubPage />;
    case 'attendance':
      return <AttendancePage />;
    case 'leaves':
      return <LeavesPage />;
    case 'payroll':
      return <PayrollPage />;
    case 'profile':
      return <ProfilePage />;

    // Management & Operations Console
    case 'shifts':
      return <ShiftsPage />;
    case 'radar':
      return <RadarPage />;
    case 'approvals':
      return <ApprovalsPage />;
    case 'capacity':
      return <CapacityPage />;
    case 'directory':
      return <DirectoryPage />;
    case 'onboarding':
      return <OnboardingPage onOpenCandidateWizard={onOpenCandidateWizard} />;
    case 'company_settings':
      return <CompanySettingsPage />;

    // Agile Work & Projects
    case 'kanban':
      return <KanbanPage />;
    case 'list':
      return <ListPage />;
    case 'backlog':
      return <BacklogPage />;

    default:
      return <HubPage />;
  }
};

export default PageRouter;
