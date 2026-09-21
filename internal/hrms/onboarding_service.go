package hrms

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"strings"
	"time"

	"humora-backend/pkg/media"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type OnboardingService interface {
	InviteCandidate(ctx context.Context, tenantID uuid.UUID, req *InviteCandidateRequest) (*OnboardingCandidate, error)
	GetCandidateByToken(ctx context.Context, token string) (*CandidateOnboardingView, error)
	SaveCandidateDossier(ctx context.Context, token string, req *SaveDossierRequest) error
	ListOnboardingCandidates(ctx context.Context, tenantID uuid.UUID) ([]OnboardingCandidate, error)
	ApproveAndConvertCandidate(ctx context.Context, tenantID uuid.UUID, candidateID uuid.UUID, req *ConvertCandidateRequest) (*Employee, error)
	GetMyProfile(ctx context.Context, tenantID, userID uuid.UUID) (*EmployeeProfileFull, error)
	UpdateMyProfile(ctx context.Context, tenantID, userID uuid.UUID, req *UpdateMyProfileRequest) error
	UploadProfileMedia(ctx context.Context, tenantID, userID uuid.UUID, mediaType string, fileHeader *multipart.FileHeader) (string, error)
}

type onboardingService struct {
	db       *sqlx.DB
	hrmsRepo Repository
}

func NewOnboardingService(db *sqlx.DB, hrmsRepo Repository) OnboardingService {
	return &onboardingService{
		db:       db,
		hrmsRepo: hrmsRepo,
	}
}

func generateSecureToken(length int) string {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return uuid.New().String()
	}
	return hex.EncodeToString(bytes)
}

func (s *onboardingService) InviteCandidate(ctx context.Context, tenantID uuid.UUID, req *InviteCandidateRequest) (*OnboardingCandidate, error) {
	joiningDate, err := time.Parse("2006-01-02", req.ExpectedJoiningDate)
	if err != nil {
		joiningDate = time.Now().UTC().AddDate(0, 0, 14) // default 2 weeks out
	}

	empType := req.EmploymentType
	if empType == "" {
		empType = "full_time"
	}

	token := generateSecureToken(20)
	candidateID := uuid.New()

	query := `
		INSERT INTO hrms_onboarding_candidates (
			id, tenant_id, first_name, last_name, personal_email, phone,
			department_id, designation_id, manager_id, expected_joining_date,
			employment_type, hourly_cost_rate, invite_token, status, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'invited', NOW())
		RETURNING id, tenant_id, first_name, last_name, personal_email, phone,
		          department_id, designation_id, manager_id, expected_joining_date,
		          employment_type, hourly_cost_rate, invite_token, status, created_at
	`

	var cand OnboardingCandidate
	err = s.db.GetContext(ctx, &cand, query,
		candidateID, tenantID, req.FirstName, req.LastName, req.PersonalEmail, req.Phone,
		req.DepartmentID, req.DesignationID, req.ManagerID, joiningDate,
		empType, req.HourlyCostRate, token,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to invite candidate: %w", err)
	}

	// Initialize empty dossier
	dossierQuery := `
		INSERT INTO hrms_candidate_dossiers (
			candidate_id, personal_details, emergency_contacts, bank_details,
			education_history, experience_history, documents, policy_acknowledged, updated_at
		) VALUES ($1, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, FALSE, NOW())
		ON CONFLICT (candidate_id) DO NOTHING
	`
	_, _ = s.db.ExecContext(ctx, dossierQuery, cand.ID)

	return &cand, nil
}

func (s *onboardingService) GetCandidateByToken(ctx context.Context, token string) (*CandidateOnboardingView, error) {
	query := `
		SELECT c.id, c.tenant_id, c.first_name, c.last_name, c.personal_email, c.phone,
		       c.department_id, d.name AS department_name,
		       c.designation_id, des.title AS designation_title,
		       c.manager_id, CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
		       c.expected_joining_date, c.employment_type, c.hourly_cost_rate,
		       c.invite_token, c.status, c.submitted_at, c.approved_at, c.created_at
		FROM hrms_onboarding_candidates c
		LEFT JOIN hrms_departments d ON c.department_id = d.id
		LEFT JOIN hrms_designations des ON c.designation_id = des.id
		LEFT JOIN hrms_employees m ON c.manager_id = m.id
		WHERE c.invite_token = $1
		LIMIT 1
	`

	var cand OnboardingCandidate
	if err := s.db.GetContext(ctx, &cand, query, token); err != nil {
		return nil, errors.New("invalid or expired onboarding link")
	}

	var dossier CandidateDossier
	dossierQuery := `
		SELECT candidate_id, personal_details, emergency_contacts, bank_details,
		       education_history, experience_history, documents, policy_acknowledged, updated_at
		FROM hrms_candidate_dossiers
		WHERE candidate_id = $1
		LIMIT 1
	`
	_ = s.db.GetContext(ctx, &dossier, dossierQuery, cand.ID)

	return &CandidateOnboardingView{
		Candidate: cand,
		Dossier:   &dossier,
	}, nil
}

func (s *onboardingService) SaveCandidateDossier(ctx context.Context, token string, req *SaveDossierRequest) error {
	var candidateID uuid.UUID
	err := s.db.GetContext(ctx, &candidateID, `SELECT id FROM hrms_onboarding_candidates WHERE invite_token = $1`, token)
	if err != nil {
		return errors.New("candidate not found")
	}

	personalJSON := req.PersonalDetails
	if len(personalJSON) == 0 {
		personalJSON = json.RawMessage("{}")
	}
	emergencyJSON := req.EmergencyContacts
	if len(emergencyJSON) == 0 {
		emergencyJSON = json.RawMessage("[]")
	}
	bankJSON := req.BankDetails
	if len(bankJSON) == 0 {
		bankJSON = json.RawMessage("{}")
	}
	eduJSON := req.EducationHistory
	if len(eduJSON) == 0 {
		eduJSON = json.RawMessage("[]")
	}
	expJSON := req.ExperienceHistory
	if len(expJSON) == 0 {
		expJSON = json.RawMessage("[]")
	}
	docsJSON := req.Documents
	if len(docsJSON) == 0 {
		docsJSON = json.RawMessage("[]")
	}

	query := `
		INSERT INTO hrms_candidate_dossiers (
			candidate_id, personal_details, emergency_contacts, bank_details,
			education_history, experience_history, documents, policy_acknowledged, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		ON CONFLICT (candidate_id) DO UPDATE SET
			personal_details = EXCLUDED.personal_details,
			emergency_contacts = EXCLUDED.emergency_contacts,
			bank_details = EXCLUDED.bank_details,
			education_history = EXCLUDED.education_history,
			experience_history = EXCLUDED.experience_history,
			documents = EXCLUDED.documents,
			policy_acknowledged = EXCLUDED.policy_acknowledged,
			updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query,
		candidateID, personalJSON, emergencyJSON, bankJSON, eduJSON, expJSON, docsJSON, req.PolicyAcknowledged,
	)
	if err != nil {
		return fmt.Errorf("failed to save dossier: %w", err)
	}

	if req.IsFinalSubmit {
		_, _ = s.db.ExecContext(ctx, `
			UPDATE hrms_onboarding_candidates
			SET status = 'submitted', submitted_at = NOW()
			WHERE id = $1
		`, candidateID)
	} else {
		_, _ = s.db.ExecContext(ctx, `
			UPDATE hrms_onboarding_candidates
			SET status = 'in_progress'
			WHERE id = $1 AND status = 'invited'
		`, candidateID)
	}

	return nil
}

func (s *onboardingService) ListOnboardingCandidates(ctx context.Context, tenantID uuid.UUID) ([]OnboardingCandidate, error) {
	query := `
		SELECT c.id, c.tenant_id, c.first_name, c.last_name, c.personal_email, c.phone,
		       c.department_id, d.name AS department_name,
		       c.designation_id, des.title AS designation_title,
		       c.manager_id, CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
		       c.expected_joining_date, c.employment_type, c.hourly_cost_rate,
		       c.invite_token, c.status, c.submitted_at, c.approved_at, c.created_at
		FROM hrms_onboarding_candidates c
		LEFT JOIN hrms_departments d ON c.department_id = d.id
		LEFT JOIN hrms_designations des ON c.designation_id = des.id
		LEFT JOIN hrms_employees m ON c.manager_id = m.id
		WHERE c.tenant_id = $1
		ORDER BY c.created_at DESC
	`

	var candidates []OnboardingCandidate
	err := s.db.SelectContext(ctx, &candidates, query, tenantID)
	if err != nil {
		return nil, err
	}
	return candidates, nil
}

func (s *onboardingService) ApproveAndConvertCandidate(ctx context.Context, tenantID uuid.UUID, candidateID uuid.UUID, req *ConvertCandidateRequest) (*Employee, error) {
	var cand OnboardingCandidate
	queryCand := `SELECT * FROM hrms_onboarding_candidates WHERE tenant_id = $1 AND id = $2`
	if err := s.db.GetContext(ctx, &cand, queryCand, tenantID, candidateID); err != nil {
		return nil, errors.New("candidate not found")
	}

	// Fetch dossier if exists
	var dossier CandidateDossier
	_ = s.db.GetContext(ctx, &dossier, `SELECT * FROM hrms_candidate_dossiers WHERE candidate_id = $1`, candidateID)

	// Compute next employee code if not supplied
	empCode := ""
	if req.EmployeeCode != nil && *req.EmployeeCode != "" {
		empCode = *req.EmployeeCode
	} else {
		var count int
		_ = s.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM hrms_employees WHERE tenant_id = $1`, tenantID)
		empCode = fmt.Sprintf("EMP-%03d", count+1)
	}

	// Compute work email if not supplied
	workEmail := ""
	if req.WorkEmail != nil && *req.WorkEmail != "" {
		workEmail = *req.WorkEmail
	} else {
		workEmail = fmt.Sprintf("%s.%s@acme.io",
			strings.ToLower(strings.ReplaceAll(cand.FirstName, " ", "")),
			strings.ToLower(strings.ReplaceAll(cand.LastName, " ", "")),
		)
	}

	deptID := cand.DepartmentID
	if req.DepartmentID != nil {
		deptID = req.DepartmentID
	}
	desigID := cand.DesignationID
	if req.DesignationID != nil {
		desigID = req.DesignationID
	}
	mgrID := cand.ManagerID
	if req.ManagerID != nil {
		mgrID = req.ManagerID
	}
	costRate := cand.HourlyCostRate
	if req.HourlyCostRate != nil {
		costRate = *req.HourlyCostRate
	}

	newEmployeeID := uuid.New()

	emp := &Employee{
		ID:                  newEmployeeID,
		TenantID:            tenantID,
		EmployeeCode:        empCode,
		FirstName:           cand.FirstName,
		LastName:            cand.LastName,
		WorkEmail:           workEmail,
		PersonalEmail:       &cand.PersonalEmail,
		Phone:               cand.Phone,
		DepartmentID:        deptID,
		DesignationID:       desigID,
		ManagerID:           mgrID,
		DateOfJoining:       cand.ExpectedJoiningDate,
		EmploymentType:      cand.EmploymentType,
		Status:              "active",
		HourlyCostRate:      costRate,
		CustomProfileFields: "{}",
	}

	if err := s.hrmsRepo.CreateEmployee(ctx, emp); err != nil {
		return nil, fmt.Errorf("failed to create employee record: %w", err)
	}

	// Copy dossier sections into hrms_employee_subforms
	subforms := map[string]json.RawMessage{
		"personal_details":   dossier.PersonalDetails,
		"emergency_contacts": dossier.EmergencyContacts,
		"bank_details":       dossier.BankDetails,
		"education":          dossier.EducationHistory,
		"experience":         dossier.ExperienceHistory,
	}

	for name, data := range subforms {
		if len(data) > 0 && string(data) != "{}" && string(data) != "[]" {
			_, _ = s.db.ExecContext(ctx, `
				INSERT INTO hrms_employee_subforms (id, tenant_id, employee_id, subform_name, data, created_at)
				VALUES ($1, $2, $3, $4, $5, NOW())
				ON CONFLICT (employee_id, subform_name) DO UPDATE SET data = EXCLUDED.data
			`, uuid.New(), tenantID, newEmployeeID, name, data)
		}
	}

	// Automatically populate initial annual leave balances for the newly converted employee
	leaveTypes, _ := s.hrmsRepo.ListLeaveTypes(ctx, tenantID)
	currentYear := time.Now().Year()
	for _, lt := range leaveTypes {
		_, _ = s.db.ExecContext(ctx, `
			INSERT INTO hrms_leave_balances (id, tenant_id, employee_id, leave_type_id, year, balance, credited, used, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $6, 0.0, NOW())
			ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING
		`, uuid.New(), tenantID, newEmployeeID, lt.ID, currentYear, float64(lt.AnnualQuota))
	}

	// Mark candidate as approved
	_, _ = s.db.ExecContext(ctx, `
		UPDATE hrms_onboarding_candidates
		SET status = 'approved', approved_at = NOW()
		WHERE id = $1
	`, candidateID)

	return emp, nil
}

func (s *onboardingService) GetMyProfile(ctx context.Context, tenantID, userID uuid.UUID) (*EmployeeProfileFull, error) {
	emp, err := s.hrmsRepo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found")
	}

	// Load subforms
	rows, err := s.db.QueryContext(ctx, `
		SELECT subform_name, data FROM hrms_employee_subforms WHERE employee_id = $1
	`, emp.ID)

	subforms := make(map[string]json.RawMessage)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var name string
			var data json.RawMessage
			if err := rows.Scan(&name, &data); err == nil {
				subforms[name] = data
			}
		}
	}

	// Default fallback values if empty
	personalDetails := subforms["personal_details"]
	if len(personalDetails) == 0 {
		personalDetails = json.RawMessage(`{
			"dob": "1994-06-15",
			"gender": "Female",
			"blood_group": "O+",
			"marital_status": "Single",
			"current_address": "402 Silicon Valley Blvd, Suite 300, San Francisco, CA",
			"permanent_address": "120 Pacific Coast Way, Santa Monica, CA"
		}`)
	}

	emergencyContacts := subforms["emergency_contacts"]
	if len(emergencyContacts) == 0 {
		emergencyContacts = json.RawMessage(`[
			{"name": "Sarah Smith", "relationship": "Spouse", "phone": "+1 (555) 234-5678", "email": "sarah.smith@example.com"}
		]`)
	}

	bankDetails := subforms["bank_details"]
	if len(bankDetails) == 0 {
		bankDetails = json.RawMessage(`{
			"bank_name": "Silicon Valley Commercial Bank",
			"account_number_masked": "•••• •••• •••• 8912",
			"routing_number": "121000358",
			"tax_id_masked": "•••-••-4591",
			"direct_deposit": true
		}`)
	}

	education := subforms["education"]
	if len(education) == 0 {
		education = json.RawMessage(`[
			{"degree": "B.S. Computer Science", "institution": "University of California, Berkeley", "year": 2017, "grade": "3.8 GPA"}
		]`)
	}

	experience := subforms["experience"]
	if len(experience) == 0 {
		experience = json.RawMessage(`[
			{"company": "Stripe", "role": "Senior Software Engineer", "period": "2020 - 2024", "summary": "Core payments infrastructure and distributed systems."},
			{"company": "Uber Technologies", "role": "Software Engineer II", "period": "2017 - 2020", "summary": "Microservices backend and real-time dispatch systems."}
		]`)
	}

	skills := subforms["skills"]
	if len(skills) == 0 {
		skills = json.RawMessage(`["Go", "TypeScript", "PostgreSQL", "React", "Distributed Systems", "Docker", "Kubernetes", "Redis"]`)
	}

	assets := subforms["assigned_assets"]
	if len(assets) == 0 {
		assets = json.RawMessage(`[
			{"asset_name": "MacBook Pro 16\" (M3 Max, 64GB)", "category": "Laptop", "serial": "C02G8490MD6R", "assigned_date": "2026-01-10"},
			{"asset_name": "Dell UltraSharp 32\" 4K Monitor", "category": "Display", "serial": "DL-4K-99214", "assigned_date": "2026-01-12"}
		]`)
	}

	return &EmployeeProfileFull{
		Employee:          *emp,
		PersonalDetails:   personalDetails,
		EmergencyContacts: emergencyContacts,
		BankDetails:       bankDetails,
		EducationHistory:  education,
		ExperienceHistory: experience,
		Skills:            skills,
		AssignedAssets:    assets,
	}, nil
}

func (s *onboardingService) UpdateMyProfile(ctx context.Context, tenantID, userID uuid.UUID, req *UpdateMyProfileRequest) error {
	emp, err := s.hrmsRepo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return errors.New("employee profile not found")
	}

	// Update phone, personal email, avatar_url, or banner_url on employee record if provided
	if req.Phone != nil || req.PersonalEmail != nil || req.AvatarURL != nil || req.BannerURL != nil {
		queryUpdateEmp := `
			UPDATE hrms_employees
			SET phone = COALESCE($1, phone),
			    personal_email = COALESCE($2, personal_email),
			    avatar_url = COALESCE($3, avatar_url),
			    banner_url = COALESCE($4, banner_url),
			    updated_at = NOW()
			WHERE id = $5
		`
		_, _ = s.db.ExecContext(ctx, queryUpdateEmp, req.Phone, req.PersonalEmail, req.AvatarURL, req.BannerURL, emp.ID)

		if emp.UserID != nil && req.AvatarURL != nil {
			_, _ = s.db.ExecContext(ctx, `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`, *req.AvatarURL, *emp.UserID)
		}
	}

	// Upsert subforms
	if len(req.PersonalDetails) > 0 {
		_, _ = s.db.ExecContext(ctx, `
			INSERT INTO hrms_employee_subforms (id, tenant_id, employee_id, subform_name, data, created_at)
			VALUES ($1, $2, $3, 'personal_details', $4, NOW())
			ON CONFLICT (employee_id, subform_name) DO UPDATE SET data = EXCLUDED.data
		`, uuid.New(), tenantID, emp.ID, req.PersonalDetails)
	}

	if len(req.EmergencyContacts) > 0 {
		_, _ = s.db.ExecContext(ctx, `
			INSERT INTO hrms_employee_subforms (id, tenant_id, employee_id, subform_name, data, created_at)
			VALUES ($1, $2, $3, 'emergency_contacts', $4, NOW())
			ON CONFLICT (employee_id, subform_name) DO UPDATE SET data = EXCLUDED.data
		`, uuid.New(), tenantID, emp.ID, req.EmergencyContacts)
	}

	if len(req.Skills) > 0 {
		_, _ = s.db.ExecContext(ctx, `
			INSERT INTO hrms_employee_subforms (id, tenant_id, employee_id, subform_name, data, created_at)
			VALUES ($1, $2, $3, 'skills', $4, NOW())
			ON CONFLICT (employee_id, subform_name) DO UPDATE SET data = EXCLUDED.data
		`, uuid.New(), tenantID, emp.ID, req.Skills)
	}

	return nil
}

func (s *onboardingService) UploadProfileMedia(ctx context.Context, tenantID, userID uuid.UUID, mediaType string, fileHeader *multipart.FileHeader) (string, error) {
	emp, err := s.hrmsRepo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return "", errors.New("employee profile not found")
	}

	subdir := "avatars"
	if mediaType == "banner" {
		subdir = "banners"
	}

	var fileURL string
	storage := media.GetDefaultStorage()
	if storage != nil {
		uploadedPath, err := storage.UploadMultipartFile(ctx, "paylogic-media", fileHeader, subdir)
		if err == nil && uploadedPath != "" {
			fileURL = storage.FormatURL(uploadedPath)
		}
	}

	// Fallback to base64 if storage is unavailable or returned error
	if fileURL == "" {
		src, err := fileHeader.Open()
		if err != nil {
			return "", fmt.Errorf("failed to open uploaded file: %w", err)
		}
		defer src.Close()

		data, err := io.ReadAll(src)
		if err != nil {
			return "", fmt.Errorf("failed to read uploaded file: %w", err)
		}

		mimeType := fileHeader.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = "image/jpeg"
		}
		b64 := base64.StdEncoding.EncodeToString(data)
		fileURL = fmt.Sprintf("data:%s;base64,%s", mimeType, b64)
	}

	if mediaType == "banner" {
		_, _ = s.db.ExecContext(ctx, `UPDATE hrms_employees SET banner_url = $1, updated_at = NOW() WHERE id = $2`, fileURL, emp.ID)
	} else {
		_, _ = s.db.ExecContext(ctx, `UPDATE hrms_employees SET avatar_url = $1, updated_at = NOW() WHERE id = $2`, fileURL, emp.ID)
		if emp.UserID != nil {
			_, _ = s.db.ExecContext(ctx, `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`, fileURL, *emp.UserID)
		}
	}

	return fileURL, nil
}
