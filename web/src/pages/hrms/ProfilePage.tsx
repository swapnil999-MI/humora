import React from 'react';
import { MyProfileDesk } from '../../views/profile/MyProfileDesk';

export const ProfilePage: React.FC = () => {
  return (
    <div className="page-container page-profile" style={{ width: '100%', minHeight: '100%' }}>
      <MyProfileDesk />
    </div>
  );
};

export default ProfilePage;
