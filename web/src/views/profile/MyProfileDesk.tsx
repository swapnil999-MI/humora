import React, { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchMyProfile,
  updateMyProfile,
  uploadProfileMedia,
} from '../../store/hrmsSlice';
import { addToast } from '../../store/uiSlice';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building,
  Briefcase,
  CreditCard,
  Shield,
  GraduationCap,
  Laptop,
  Edit3,
  Check,
  X,
  Plus,
  Sparkles,
  Heart,
  Award,
  Camera,
  Palette,
  Upload,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';

const BANNER_PRESETS = [
  {
    name: 'Champagne Gold Matrix',
    value: 'linear-gradient(135deg, #181715 0%, #29241b 40%, #543f17 75%, #b45309 100%)',
    preview: '#b45309',
  },
  {
    name: 'Smoky Obsidian Velvet',
    value: 'linear-gradient(135deg, #121110 0%, #1f1d1a 50%, #2f2c27 100%)',
    preview: '#1f1d1a',
  },
  {
    name: 'Warm Cashmere Slate',
    value: 'linear-gradient(135deg, #26231f 0%, #3d3730 50%, #574e44 100%)',
    preview: '#574e44',
  },
  {
    name: 'Molten Bronze Elegance',
    value: 'linear-gradient(135deg, #1a1510 0%, #382513 50%, #78350f 100%)',
    preview: '#78350f',
  },
  {
    name: 'Cognac Amber Glow',
    value: 'linear-gradient(135deg, #1c1510 0%, #451a03 50%, #92400e 100%)',
    preview: '#92400e',
  },
  {
    name: 'Midnight Monolith',
    value: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)',
    preview: '#27272a',
  },
];

const AVATAR_PRESETS = [
  {
    name: 'Executive Alice',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
  },
  {
    name: 'Tech Lead',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  },
  {
    name: 'Senior Dev',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
  },
  {
    name: 'Product Designer',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
  },
  {
    name: 'Staff Architect',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
  },
  {
    name: 'Engineering Lead',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
  },
];

export const MyProfileDesk: React.FC = () => {
  const dispatch = useAppDispatch();
  const { myProfile, isLoadingProfile } = useAppSelector((state) => state.hrms);
  const { user } = useAppSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState<
    'personal' | 'emergency' | 'bank' | 'career' | 'skills_assets'
  >('personal');

  // Inline editing state for personal details
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [phone, setPhone] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');

  // Emergency contact modal state
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('Spouse');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');

  // Banner & Avatar Customization state
  const [isBannerPickerOpen, setIsBannerPickerOpen] = useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dispatch(fetchMyProfile());
  }, [dispatch]);

  useEffect(() => {
    if (myProfile) {
      setPhone(myProfile.employee.phone || '');
      setPersonalEmail(myProfile.employee.personal_email || '');
      setCurrentAddress(myProfile.personal_details?.current_address || '');
      setPermanentAddress(myProfile.personal_details?.permanent_address || '');
      setBloodGroup(myProfile.personal_details?.blood_group || 'O+');
      setMaritalStatus(myProfile.personal_details?.marital_status || 'Single');
    }
  }, [myProfile]);

  const handleSelectBanner = async (bannerVal: string) => {
    try {
      await dispatch(updateMyProfile({ banner_url: bannerVal })).unwrap();
      dispatch(addToast({ type: 'success', message: 'Cover banner updated successfully' }));
      setIsBannerPickerOpen(false);
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to update banner' }));
    }
  };

  const handleSelectAvatar = async (avatarUrl: string) => {
    try {
      await dispatch(updateMyProfile({ avatar_url: avatarUrl })).unwrap();
      dispatch(addToast({ type: 'success', message: 'Profile photo updated successfully' }));
      setIsAvatarPickerOpen(false);
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to update avatar' }));
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mediaType: 'avatar' | 'banner'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMedia(true);
    try {
      await dispatch(uploadProfileMedia({ file, mediaType })).unwrap();
      dispatch(
        addToast({
          type: 'success',
          message: `${mediaType === 'avatar' ? 'Profile photo' : 'Cover banner'} uploaded successfully`,
        })
      );
      if (mediaType === 'avatar') {
        setIsAvatarPickerOpen(false);
      } else {
        setIsBannerPickerOpen(false);
      }
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Upload failed' }));
    } finally {
      setIsUploadingMedia(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSavePersonal = async () => {
    try {
      await dispatch(
        updateMyProfile({
          phone: phone,
          personal_email: personalEmail,
          personal_details: {
            ...myProfile?.personal_details,
            current_address: currentAddress,
            permanent_address: permanentAddress,
            blood_group: bloodGroup,
            marital_status: maritalStatus,
          },
        })
      ).unwrap();
      dispatch(
        addToast({
          type: 'success',
          message: 'Personal profile updated successfully',
        })
      );
      setIsEditingPersonal(false);
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          message: err || 'Failed to update personal profile',
        })
      );
    }
  };

  const handleAddEmergencyContact = async () => {
    if (!newContactName || !newContactPhone) return;

    const existingContacts = myProfile?.emergency_contacts || [];
    const updatedContacts = [
      ...existingContacts,
      {
        name: newContactName,
        relationship: newContactRelation,
        phone: newContactPhone,
        email: newContactEmail,
      },
    ];

    try {
      await dispatch(
        updateMyProfile({
          emergency_contacts: updatedContacts,
        })
      ).unwrap();
      dispatch(
        addToast({
          type: 'success',
          message: 'Emergency contact added successfully',
        })
      );
      setIsAddContactOpen(false);
      setNewContactName('');
      setNewContactPhone('');
      setNewContactEmail('');
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          message: err || 'Failed to add contact',
        })
      );
    }
  };

  const emp = myProfile?.employee;
  const personal = myProfile?.personal_details || {};
  const emergency = myProfile?.emergency_contacts || [];
  const bank = myProfile?.bank_details || {};
  const education = myProfile?.education_history || [];
  const experience = myProfile?.experience_history || [];
  const skills = myProfile?.skills || [];
  const assets = myProfile?.assigned_assets || [];

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Executive Cover Banner & Overlapping Profile Avatar */}
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
        }}
      >
        {/* Cover Banner Canvas */}
        <div
          style={{
            height: '190px',
            width: '100%',
            position: 'relative',
            ...(emp?.banner_url
              ? emp.banner_url.startsWith('linear-gradient') ||
                emp.banner_url.startsWith('radial-gradient')
                ? { background: emp.banner_url }
                : {
                    backgroundImage: `url(${emp.banner_url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
              : {
                  background:
                    'linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 70%, #4338ca 100%)',
                }),
          }}
        >
          {/* Subtle dark gradient overlay for text readability */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.55) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Change Cover Banner Action */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '20px',
              zIndex: 5,
            }}
          >
            <button
              onClick={() => setIsBannerPickerOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 16px',
                background: 'rgba(18, 17, 16, 0.88)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(245, 158, 11, 0.45)',
                borderRadius: 'var(--radius-full)',
                color: '#faf8f5',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 245, 230, 0.15)',
                transition: 'all var(--transition-fast)',
              }}
              title="Change Cover Banner"
            >
              <Palette size={14} color="var(--accent-primary)" />
              <span style={{ color: '#faf8f5', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                Change Cover
              </span>
            </button>
          </div>
        </div>

        {/* Hero Details & Overlapping Avatar */}
        <div
          style={{
            padding: '0 28px 24px 28px',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: '-44px',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
            {/* Overlapping Avatar Container */}
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '88px',
                  height: '88px',
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  border: '3px solid var(--surface-1)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '30px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {emp?.avatar_url ? (
                  <img
                    src={emp.avatar_url}
                    alt={emp.first_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>{emp ? emp.first_name.charAt(0).toUpperCase() : 'U'}</span>
                )}
              </div>

              {/* Camera / Edit Avatar Trigger */}
              <button
                onClick={() => setIsAvatarPickerOpen(true)}
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  border: '2px solid var(--surface-1)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  padding: 0,
                }}
                title="Change Profile Photo"
              >
                <Camera size={13} />
              </button>
            </div>

            {/* Name, Code, and Badges */}
            <div style={{ paddingBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1
                  style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  {emp ? `${emp.first_name} ${emp.last_name}` : 'Team Member'}
                </h1>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-3)',
                    color: 'var(--accent-primary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {emp?.employee_code || 'EMP-001'}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: 'var(--accent-emerald-subtle)',
                    color: 'var(--accent-emerald)',
                    fontWeight: 600,
                  }}
                >
                  Active Staff
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginTop: '8px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Briefcase size={14} color="var(--text-muted)" />
                  {emp?.designation_title || 'Software Engineer'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Building size={14} color="var(--text-muted)" />
                  {emp?.department_name || 'Engineering'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={14} color="var(--text-muted)" />
                  Joined{' '}
                  {emp
                    ? new Date(emp.date_of_joining).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })
                    : '2026'}
                </span>
              </div>
            </div>
          </div>

          {/* Work Contact Information */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '8px',
              paddingBottom: '4px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
              }}
            >
              <Mail size={14} color="var(--text-muted)" />
              <span>{emp?.work_email || user?.email}</span>
            </div>
            {emp?.phone && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}
              >
                <Phone size={14} color="var(--text-muted)" />
                <span>{emp.phone}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid var(--border-hairline)',
          paddingBottom: '2px',
        }}
      >
        <button
          className={`btn btn-sm ${activeTab === 'personal' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('personal')}
        >
          <User size={13} />
          Personal & Address
        </button>

        <button
          className={`btn btn-sm ${activeTab === 'emergency' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('emergency')}
        >
          <Heart size={13} />
          Emergency Contacts ({emergency.length})
        </button>

        <button
          className={`btn btn-sm ${activeTab === 'bank' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('bank')}
        >
          <CreditCard size={13} />
          Bank & Statutory
        </button>

        <button
          className={`btn btn-sm ${activeTab === 'career' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('career')}
        >
          <GraduationCap size={13} />
          Education & Career
        </button>

        <button
          className={`btn btn-sm ${activeTab === 'skills_assets' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('skills_assets')}
        >
          <Laptop size={13} />
          Skills & Company Assets
        </button>
      </div>

      {/* Tab 1: Personal & Address Details (Self-Editable) */}
      {activeTab === 'personal' && (
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '22px 26px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border-hairline)',
            }}
          >
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Personal Information
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Manage your personal contact numbers, residential addresses, and demographic details.
              </p>
            </div>

            {!isEditingPersonal ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditingPersonal(true)}
              >
                <Edit3 size={13} />
                Edit Details
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsEditingPersonal(false)}
                >
                  <X size={13} />
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSavePersonal}
                >
                  <Check size={13} />
                  Save Changes
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {/* Phone */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Mobile Phone
              </label>
              {isEditingPersonal ? (
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%', marginTop: '6px' }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              ) : (
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {phone || '—'}
                </div>
              )}
            </div>

            {/* Personal Email */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Personal Email
              </label>
              {isEditingPersonal ? (
                <input
                  type="email"
                  className="input-field"
                  style={{ width: '100%', marginTop: '6px' }}
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="personal@example.com"
                />
              ) : (
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {personalEmail || '—'}
                </div>
              )}
            </div>

            {/* Blood Group */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Blood Group
              </label>
              {isEditingPersonal ? (
                <select
                  className="select-field"
                  style={{ width: '100%', marginTop: '6px' }}
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              ) : (
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {bloodGroup || 'O+'}
                </div>
              )}
            </div>

            {/* Date of Birth */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Date of Birth
              </label>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>
                {personal.dob ? new Date(personal.dob).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'June 15, 1994'}
              </div>
            </div>

            {/* Gender */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Gender
              </label>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>
                {personal.gender || 'Female'}
              </div>
            </div>

            {/* Marital Status */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Marital Status
              </label>
              {isEditingPersonal ? (
                <select
                  className="select-field"
                  style={{ width: '100%', marginTop: '6px' }}
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                >
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Other">Other</option>
                </select>
              ) : (
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {maritalStatus || 'Single'}
                </div>
              )}
            </div>
          </div>

          {/* Addresses */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid var(--border-hairline)',
            }}
          >
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Current Residential Address
              </label>
              {isEditingPersonal ? (
                <textarea
                  className="textarea-field"
                  style={{ width: '100%', marginTop: '6px', height: '60px' }}
                  value={currentAddress}
                  onChange={(e) => setCurrentAddress(e.target.value)}
                />
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '4px' }}>
                  {currentAddress || 'Not specified'}
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Permanent Address
              </label>
              {isEditingPersonal ? (
                <textarea
                  className="textarea-field"
                  style={{ width: '100%', marginTop: '6px', height: '60px' }}
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                />
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '4px' }}>
                  {permanentAddress || 'Not specified'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Emergency Contacts */}
      {activeTab === 'emergency' && (
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '22px 26px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border-hairline)',
            }}
          >
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Emergency Contacts
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Individuals to reach in medical, safety, or office incident situations.
              </p>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsAddContactOpen(true)}
            >
              <Plus size={13} />
              Add Contact
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {emergency.map((c, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.name}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-primary-subtle)',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    {c.relationship}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={13} color="var(--text-muted)" />
                    <span>{c.phone}</span>
                  </div>
                  {c.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={13} color="var(--text-muted)" />
                      <span>{c.email}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Bank & Statutory Details */}
      {activeTab === 'bank' && (
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '22px 26px',
          }}
        >
          <div style={{ marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid var(--border-hairline)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Banking & Statutory Record
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Payroll direct deposit coordinates and governmental tax identifiers (encrypted & masked).
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Bank Name
              </label>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px' }}>
                {bank.bank_name || 'Silicon Valley Commercial Bank'}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Account Number
              </label>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                {bank.account_number_masked || '•••• •••• •••• 8912'}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Routing / IFSC Code
              </label>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                {bank.routing_number || '121000358'}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Tax Identifier (PAN / SSN)
              </label>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                {bank.tax_id_masked || '•••-••-4591'}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Direct Deposit Status
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--accent-emerald)',
                  }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-emerald)' }}>
                  Verified & Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Education & Experience */}
      {activeTab === 'career' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Experience */}
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '22px 26px',
            }}
          >
            <div style={{ marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--border-hairline)' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Work Experience
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {experience.map((exp, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '14px 16px',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {exp.role} • {exp.company}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{exp.period}</span>
                  </div>
                  {exp.summary && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
                      {exp.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Education */}
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '22px 26px',
            }}
          >
            <div style={{ marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--border-hairline)' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Education & Credentials
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {education.map((edu, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '14px 16px',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-hairline)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {edu.degree}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {edu.institution}
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {edu.year} • {edu.grade}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Skills & Assigned Company Assets */}
      {activeTab === 'skills_assets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Skills */}
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '22px 26px',
            }}
          >
            <div style={{ marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--border-hairline)' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Engineering & Professional Skills
              </h2>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {skills.map((skill, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Hardware Assets */}
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '22px 26px',
            }}
          >
            <div style={{ marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--border-hairline)' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Assigned Company Hardware Assets
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {assets.map((asset, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 16px',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-hairline)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Laptop size={16} color="var(--accent-primary)" />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {asset.asset_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Category: {asset.category} • Assigned: {asset.assigned_date}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-3)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    S/N: {asset.serial}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Emergency Contact Modal */}
      {isAddContactOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: '420px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Add Emergency Contact
              </h3>
              <button
                className="btn-ghost"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setIsAddContactOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%', marginTop: '6px' }}
                  placeholder="e.g. John Doe"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Relationship
                </label>
                <select
                  className="select-field"
                  style={{ width: '100%', marginTop: '6px' }}
                  value={newContactRelation}
                  onChange={(e) => setNewContactRelation(e.target.value)}
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Child">Child</option>
                  <option value="Friend">Friend</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%', marginTop: '6px' }}
                  placeholder="+1 (555) 000-0000"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  className="input-field"
                  style={{ width: '100%', marginTop: '6px' }}
                  placeholder="contact@example.com"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                />
              </div>
            </div>

            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                background: 'var(--surface-2)',
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsAddContactOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!newContactName || !newContactPhone}
                onClick={handleAddEmergencyContact}
              >
                <Check size={13} />
                Add Contact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cover Banner Customizer Modal */}
      {isBannerPickerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
          }}
        >
          <div
            style={{
              width: '540px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette size={16} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Customize Profile Cover Banner
                </h3>
              </div>
              <button
                className="btn-ghost"
                style={{ padding: '4px', cursor: 'pointer' }}
                onClick={() => setIsBannerPickerOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Upload Custom Banner from Disk */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Upload Custom Cover Image
                </label>
                <input
                  type="file"
                  ref={bannerFileInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload(e, 'banner')}
                />
                <button
                  type="button"
                  onClick={() => bannerFileInputRef.current?.click()}
                  disabled={isUploadingMedia}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '14px',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                  className="btn-ghost"
                >
                  {isUploadingMedia ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Uploading banner to media storage...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} color="var(--accent-primary)" />
                      <span>Choose Banner Image (PNG, JPG, WebP)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Curated Aesthetic Gradients */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Or Select Curated Obsidian Theme
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '10px',
                    marginTop: '8px',
                  }}
                >
                  {BANNER_PRESETS.map((preset) => {
                    const isSelected = emp?.banner_url === preset.value;
                    return (
                      <div
                        key={preset.name}
                        onClick={() => handleSelectBanner(preset.value)}
                        style={{
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          border: isSelected
                            ? '2px solid var(--accent-primary)'
                            : '1px solid var(--border-hairline)',
                          cursor: 'pointer',
                          background: 'var(--surface-2)',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        <div
                          style={{
                            height: '48px',
                            background: preset.value,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            padding: '0 8px',
                          }}
                        >
                          {isSelected && (
                            <span
                              style={{
                                background: 'rgba(0,0,0,0.6)',
                                borderRadius: '50%',
                                padding: '2px',
                                display: 'flex',
                              }}
                            >
                              <Check size={12} color="#fff" />
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          }}
                        >
                          {preset.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                background: 'var(--surface-2)',
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsBannerPickerOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Customizer Modal */}
      {isAvatarPickerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
          }}
        >
          <div
            style={{
              width: '500px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={16} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Customize Profile Photo
                </h3>
              </div>
              <button
                className="btn-ghost"
                style={{ padding: '4px', cursor: 'pointer' }}
                onClick={() => setIsAvatarPickerOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Upload Custom Avatar from Disk */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Upload Custom Avatar Photo
                </label>
                <input
                  type="file"
                  ref={avatarFileInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload(e, 'avatar')}
                />
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  disabled={isUploadingMedia}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '14px',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                  className="btn-ghost"
                >
                  {isUploadingMedia ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Uploading avatar to media storage...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} color="var(--accent-primary)" />
                      <span>Choose Portrait Photo (PNG, JPG, WebP)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Curated Professional Executive Avatars */}
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Or Select Professional Persona
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    marginTop: '10px',
                  }}
                >
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = emp?.avatar_url === preset.url;
                    return (
                      <div
                        key={preset.name}
                        onClick={() => handleSelectAvatar(preset.url)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px',
                          borderRadius: 'var(--radius-sm)',
                          border: isSelected
                            ? '2px solid var(--accent-primary)'
                            : '1px solid var(--border-hairline)',
                          background: isSelected
                            ? 'var(--surface-3)'
                            : 'var(--surface-2)',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        <div style={{ position: 'relative' }}>
                          <img
                            src={preset.url}
                            alt={preset.name}
                            style={{
                              width: '56px',
                              height: '56px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '2px solid var(--border-subtle)',
                            }}
                          />
                          {isSelected && (
                            <span
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                background: 'var(--accent-primary)',
                                borderRadius: '50%',
                                padding: '2px',
                                display: 'flex',
                                border: '2px solid var(--surface-1)',
                              }}
                            >
                              <Check size={10} color="#fff" />
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: isSelected
                              ? 'var(--accent-primary)'
                              : 'var(--text-secondary)',
                            textAlign: 'center',
                          }}
                        >
                          {preset.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                background: 'var(--surface-2)',
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsAvatarPickerOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

