import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { navigateToPage, addToast } from '../store/uiSlice';
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
import { PulsePage } from './pulse/PulsePage';

interface PageRouterProps {
  onOpenCandidateWizard?: (token: string) => void;
}

const MANAGEMENT_PAGES = ['shifts', 'radar', 'approvals', 'capacity', 'directory', 'onboarding', 'company_settings'];
const ESS_PAGES = ['hub', 'attendance', 'leaves', 'payroll', 'profile'];

export const PageRouter: React.FC<PageRouterProps> = ({ onOpenCandidateWizard }) => {
  const dispatch = useAppDispatch();
  const { activePage } = useAppSelector((state) => state.ui);
  const { user } = useAppSelector((state) => state.auth);

  const userRoles = user?.roles || [];
  const isAdmin = userRoles.some((r) => ['superadmin', 'admin', 'hr_admin'].includes(r.toLowerCase()));
  const isEmployee = userRoles.some((r) => r.toLowerCase() === 'employee') && !isAdmin;

  useEffect(() => {
    if (isEmployee && MANAGEMENT_PAGES.includes(activePage)) {
      dispatch(addToast({
        type: 'error',
        message: 'Access Denied: Management Console requires administrative privileges.',
      }));
      dispatch(navigateToPage('hub'));
    } else if (isAdmin && ESS_PAGES.includes(activePage)) {
      dispatch(navigateToPage('company_settings'));
    }
  }, [activePage, isAdmin, isEmployee, dispatch]);

  // If unauthorized employee attempting management page, prevent render
  if (isEmployee && MANAGEMENT_PAGES.includes(activePage)) {
    return <HubPage />;
  }

  // If admin attempting ESS page, redirect to company setup
  if (isAdmin && ESS_PAGES.includes(activePage)) {
    return <CompanySettingsPage />;
  }

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

    // Team Pulse Collaboration
    case 'pulse':
      return <PulsePage />;

    default:
      return isAdmin ? <RadarPage /> : <HubPage />;
  }
};

export default PageRouter;
