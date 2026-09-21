package hrms

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// OnboardingCandidate represents a prospective hire invited by HR.
type OnboardingCandidate struct {
	ID                  uuid.UUID  `db:"id" json:"id"`
	TenantID            uuid.UUID  `db:"tenant_id" json:"tenant_id"`
	FirstName           string     `db:"first_name" json:"first_name"`
	LastName            string     `db:"last_name" json:"last_name"`
	PersonalEmail       string     `db:"personal_email" json:"personal_email"`
	Phone               *string    `db:"phone" json:"phone,omitempty"`
	DepartmentID        *uuid.UUID `db:"department_id" json:"department_id,omitempty"`
	DepartmentName      *string    `db:"department_name" json:"department_name,omitempty"`
	DesignationID       *uuid.UUID `db:"designation_id" json:"designation_id,omitempty"`
	DesignationTitle    *string    `db:"designation_title" json:"designation_title,omitempty"`
	ManagerID           *uuid.UUID `db:"manager_id" json:"manager_id,omitempty"`
	ManagerName         *string    `db:"manager_name" json:"manager_name,omitempty"`
	ExpectedJoiningDate time.Time  `db:"expected_joining_date" json:"expected_joining_date"`
	EmploymentType      string     `db:"employment_type" json:"employment_type"`
	HourlyCostRate      float64    `db:"hourly_cost_rate" json:"hourly_cost_rate"`
	InviteToken         string     `db:"invite_token" json:"invite_token"`
	Status              string     `db:"status" json:"status"` // 'invited', 'in_progress', 'submitted', 'approved', 'rejected'
	SubmittedAt         *time.Time `db:"submitted_at" json:"submitted_at,omitempty"`
	ApprovedAt          *time.Time `db:"approved_at" json:"approved_at,omitempty"`
	CreatedAt           time.Time  `db:"created_at" json:"created_at"`
}

// CandidateDossier contains structured self-service onboarding data.
type CandidateDossier struct {
	CandidateID        uuid.UUID       `db:"candidate_id" json:"candidate_id"`
	PersonalDetails    json.RawMessage `db:"personal_details" json:"personal_details"`
	EmergencyContacts  json.RawMessage `db:"emergency_contacts" json:"emergency_contacts"`
	BankDetails        json.RawMessage `db:"bank_details" json:"bank_details"`
	EducationHistory   json.RawMessage `db:"education_history" json:"education_history"`
	ExperienceHistory  json.RawMessage `db:"experience_history" json:"experience_history"`
	Documents          json.RawMessage `db:"documents" json:"documents"`
	PolicyAcknowledged bool            `db:"policy_acknowledged" json:"policy_acknowledged"`
	UpdatedAt          time.Time       `db:"updated_at" json:"updated_at"`
}

// CandidateOnboardingView aggregates candidate meta + dossier for the onboarding portal.
type CandidateOnboardingView struct {
	Candidate OnboardingCandidate `json:"candidate"`
	Dossier   *CandidateDossier   `json:"dossier,omitempty"`
}

// EmployeeProfileFull represents an employee's comprehensive dossier in the ESS portal.
type EmployeeProfileFull struct {
	Employee          Employee        `json:"employee"`
	PersonalDetails   json.RawMessage `json:"personal_details"`
	EmergencyContacts json.RawMessage `json:"emergency_contacts"`
	BankDetails       json.RawMessage `json:"bank_details"`
	EducationHistory  json.RawMessage `json:"education_history"`
	ExperienceHistory json.RawMessage `json:"experience_history"`
	Skills            json.RawMessage `json:"skills"`
	AssignedAssets    json.RawMessage `json:"assigned_assets"`
}

// InviteCandidateRequest payload from HR to invite a new hire.
type InviteCandidateRequest struct {
	FirstName           string     `json:"first_name" validate:"required"`
	LastName            string     `json:"last_name" validate:"required"`
	PersonalEmail       string     `json:"personal_email" validate:"required,email"`
	Phone               *string    `json:"phone,omitempty"`
	DepartmentID        *uuid.UUID `json:"department_id,omitempty"`
	DesignationID       *uuid.UUID `json:"designation_id,omitempty"`
	ManagerID           *uuid.UUID `json:"manager_id,omitempty"`
	ExpectedJoiningDate string     `json:"expected_joining_date" validate:"required"`
	EmploymentType      string     `json:"employment_type"`
	HourlyCostRate      float64    `json:"hourly_cost_rate"`
}

// SaveDossierRequest payload from candidate filling onboarding forms.
type SaveDossierRequest struct {
	PersonalDetails    json.RawMessage `json:"personal_details"`
	EmergencyContacts  json.RawMessage `json:"emergency_contacts"`
	BankDetails        json.RawMessage `json:"bank_details"`
	EducationHistory   json.RawMessage `json:"education_history"`
	ExperienceHistory  json.RawMessage `json:"experience_history"`
	Documents          json.RawMessage `json:"documents"`
	PolicyAcknowledged bool            `json:"policy_acknowledged"`
	IsFinalSubmit      bool            `json:"is_final_submit"`
}

// ConvertCandidateRequest HR confirmation payload.
type ConvertCandidateRequest struct {
	CandidateID    uuid.UUID  `json:"candidate_id" validate:"required"`
	EmployeeCode   *string    `json:"employee_code,omitempty"`
	WorkEmail      *string    `json:"work_email,omitempty"`
	DepartmentID   *uuid.UUID `json:"department_id,omitempty"`
	DesignationID  *uuid.UUID `json:"designation_id,omitempty"`
	ManagerID      *uuid.UUID `json:"manager_id,omitempty"`
	HourlyCostRate *float64   `json:"hourly_cost_rate,omitempty"`
}

// UpdateMyProfileRequest payload for employee self-service profile updates.
type UpdateMyProfileRequest struct {
	PersonalEmail     *string         `json:"personal_email,omitempty"`
	Phone             *string         `json:"phone,omitempty"`
	AvatarURL         *string         `json:"avatar_url,omitempty"`
	BannerURL         *string         `json:"banner_url,omitempty"`
	PersonalDetails   json.RawMessage `json:"personal_details,omitempty"`
	EmergencyContacts json.RawMessage `json:"emergency_contacts,omitempty"`
	Skills            json.RawMessage `json:"skills,omitempty"`
}
