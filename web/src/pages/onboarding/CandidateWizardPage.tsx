import React from 'react';
import { CandidateOnboardingWizard } from '../../views/onboarding/CandidateOnboardingWizard';

interface CandidateWizardPageProps {
  token: string;
  onExit?: () => void;
}

export const CandidateWizardPage: React.FC<CandidateWizardPageProps> = ({ token, onExit }) => {
  return (
    <div className="page-container page-candidate-wizard" style={{ width: '100%', minHeight: '100vh' }}>
      <CandidateOnboardingWizard token={token} onExit={onExit} />
    </div>
  );
};

export default CandidateWizardPage;
