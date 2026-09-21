import React from 'react';
import { OnboardingPipelineDesk } from '../../views/hrms/OnboardingPipelineDesk';

interface OnboardingPageProps {
  onOpenCandidateWizard?: (token: string) => void;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onOpenCandidateWizard }) => {
  return (
    <div className="page-container page-onboarding" style={{ width: '100%', minHeight: '100%' }}>
      <OnboardingPipelineDesk onOpenCandidateWizard={onOpenCandidateWizard} />
    </div>
  );
};

export default OnboardingPage;
