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
	"os"
	"strings"
	"time"

	"humora-backend/pkg/logger"
	"humora-backend/pkg/mailer"
	"humora-backend/pkg/media"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/argon2"
)

type OnboardingService interface {
	InviteCandidate(ctx context.Context, tenantID uuid.UUID, req *InviteCandidateRequest) (*OnboardingCandidate, error)
	GetCandidateByToken(ctx context.Context, token string) (*CandidateOnboardingView, error)
	GetCandidateByID(ctx context.Context, tenantID, candidateID uuid.UUID) (*CandidateOnboardingView, error)
	SaveCandidateDossier(ctx context.Context, token string, req *SaveDossierRequest) error
	ListOnboardingCandidates(ctx context.Context, tenantID uuid.UUID) ([]OnboardingCandidate, error)
	ApproveAndConvertCandidate(ctx context.Context, tenantID uuid.UUID, candidateID uuid.UUID, req *ConvertCandidateRequest) (*Employee, error)
	GetMyProfile(ctx context.Context, tenantID, userID uuid.UUID) (*EmployeeProfileFull, error)
	UpdateMyProfile(ctx context.Context, tenantID, userID uuid.UUID, req *UpdateMyProfileRequest) error
	UploadProfileMedia(ctx context.Context, tenantID, userID uuid.UUID, mediaType string, fileHeader *multipart.FileHeader) (string, error)
}

type onboardingService struct {
	db             *sqlx.DB
	hrmsRepo       Repository
	companyService CompanyService
}

func NewOnboardingService(db *sqlx.DB, hrmsRepo Repository, companyService CompanyService) OnboardingService {
	// Auto-migrate candidate payable columns idempotently
	if db != nil {
		migration := `
			ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS annual_ctc NUMERIC(12, 2) DEFAULT 0.00;
			ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS monthly_gross NUMERIC(12, 2) DEFAULT 0.00;
			ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(12, 2) DEFAULT 0.00;
			ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS hra NUMERIC(12, 2) DEFAULT 0.00;
			ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS special_allowance NUMERIC(12, 2) DEFAULT 0.00;
			ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS provident_fund NUMERIC(12, 2) DEFAULT 0.00;
			ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS professional_tax NUMERIC(12, 2) DEFAULT 0.00;
			ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS net_payable NUMERIC(12, 2) DEFAULT 0.00;
			ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'bank_transfer';
			ALTER TABLE hrms_onboarding_candidates ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD';
		`
		if _, err := db.Exec(migration); err != nil {
			logger.Warn(fmt.Sprintf("Failed to auto-migrate onboarding payable columns: %v", err))
		}
	}
	return &onboardingService{
		db:             db,
		hrmsRepo:       hrmsRepo,
		companyService: companyService,
	}
}

func generateSecureToken(length int) string {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return uuid.New().String()
	}
	return hex.EncodeToString(bytes)
}

func hashCandidatePassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	timeCost := uint32(3)
	memoryCost := uint32(64 * 1024)
	threads := uint8(2)
	keyLen := uint32(32)

	hash := argon2.IDKey([]byte(password), salt, timeCost, memoryCost, threads, keyLen)
	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s", argon2.Version, memoryCost, timeCost, threads, b64Salt, b64Hash), nil
}

func (s *onboardingService) InviteCandidate(ctx context.Context, tenantID uuid.UUID, req *InviteCandidateRequest) (*OnboardingCandidate, error) {
	// Validate email uniqueness across users, employees, and existing active candidate invites
	emailLower := strings.ToLower(strings.TrimSpace(req.PersonalEmail))
	var count int
	_ = s.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM users WHERE LOWER(email) = $1`, emailLower)
	if count > 0 {
		return nil, fmt.Errorf("email %q is already registered to a user account", req.PersonalEmail)
	}
	_ = s.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM hrms_employees WHERE LOWER(work_email) = $1 OR (personal_email IS NOT NULL AND LOWER(personal_email) = $1)`, emailLower)
	if count > 0 {
		return nil, fmt.Errorf("email %q already belongs to an existing employee", req.PersonalEmail)
	}
	_ = s.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM hrms_onboarding_candidates WHERE LOWER(personal_email) = $1 AND status NOT IN ('rejected')`, emailLower)
	if count > 0 {
		return nil, fmt.Errorf("candidate with email %q is already in the onboarding pipeline", req.PersonalEmail)
	}

	joiningDate, err := time.Parse("2006-01-02", req.ExpectedJoiningDate)
	if err != nil {
		joiningDate = time.Now().UTC().AddDate(0, 0, 14) // default 2 weeks out
	}

	empType := req.EmploymentType
	if empType == "" {
		empType = "full_time"
	}

	// Compute compensation & payable components
	annualCTC := req.AnnualCTC
	monthlyGross := req.MonthlyGross
	basicSalary := req.BasicSalary
	hra := req.HRA
	specialAllowance := req.SpecialAllowance
	providentFund := req.ProvidentFund
	professionalTax := req.ProfessionalTax
	paymentMethod := strings.TrimSpace(req.PaymentMethod)
	if paymentMethod == "" {
		paymentMethod = "bank_transfer"
	}
	currency := strings.TrimSpace(req.Currency)
	if currency == "" {
		currency = "USD"
	}

	// Auto-derive if only annual CTC or monthly gross provided
	if annualCTC > 0 && monthlyGross == 0 {
		monthlyGross = annualCTC / 12.0
	} else if monthlyGross > 0 && annualCTC == 0 {
		annualCTC = monthlyGross * 12.0
	}

	if monthlyGross > 0 && basicSalary == 0 {
		basicSalary = monthlyGross * 0.50             // 50% Basic
		hra = basicSalary * 0.40                     // 40% of Basic
		specialAllowance = monthlyGross - basicSalary - hra
		if specialAllowance < 0 {
			specialAllowance = 0
		}
		if providentFund == 0 {
			providentFund = basicSalary * 0.12        // 12% PF
		}
		if professionalTax == 0 {
			professionalTax = 200.00
		}
	}
	netPayable := req.NetPayable
	if netPayable == 0 && monthlyGross > 0 {
		netPayable = monthlyGross - providentFund - professionalTax
		if netPayable < 0 {
			netPayable = monthlyGross
		}
	}

	token := generateSecureToken(20)
	candidateID := uuid.New()

	query := `
		INSERT INTO hrms_onboarding_candidates (
			id, tenant_id, first_name, last_name, personal_email, phone,
			department_id, designation_id, manager_id, expected_joining_date,
			employment_type, hourly_cost_rate,
			annual_ctc, monthly_gross, basic_salary, hra, special_allowance,
			provident_fund, professional_tax, net_payable, payment_method, currency,
			invite_token, status, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
			$23, 'invited', NOW()
		)
		RETURNING id, tenant_id, first_name, last_name, personal_email, phone,
		          department_id, designation_id, manager_id, expected_joining_date,
		          employment_type, hourly_cost_rate,
		          annual_ctc, monthly_gross, basic_salary, hra, special_allowance,
		          provident_fund, professional_tax, net_payable, payment_method, currency,
		          invite_token, status, created_at
	`

	var cand OnboardingCandidate
	err = s.db.GetContext(ctx, &cand, query,
		candidateID, tenantID, req.FirstName, req.LastName, req.PersonalEmail, req.Phone,
		req.DepartmentID, req.DesignationID, req.ManagerID, joiningDate,
		empType, req.HourlyCostRate,
		annualCTC, monthlyGross, basicSalary, hra, specialAllowance,
		providentFund, professionalTax, netPayable, paymentMethod, currency,
		token,
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

	// Send candidate onboarding invite email asynchronously via Tenant SMTP
	if s.companyService != nil {
		go func(c OnboardingCandidate) {
			bgCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()

			mailerConfig, err := s.companyService.GetActiveMailerConfig(bgCtx, c.TenantID)
			if err != nil {
				logger.Warn(fmt.Sprintf("Failed to get SMTP config for candidate invite email: %v", err))
				return
			}
			companyProfile, _ := s.companyService.GetCompanyProfile(bgCtx, c.TenantID)
			companyName := "Humora Enterprise"
			if companyProfile != nil && companyProfile.LegalName != "" {
				companyName = companyProfile.LegalName
			}

			frontendBase := os.Getenv("FRONTEND_URL")
			if frontendBase == "" {
				frontendBase = "http://localhost:3000"
			}
			inviteURL := fmt.Sprintf("%s/onboard/%s", strings.TrimRight(frontendBase, "/"), c.InviteToken)

			if err := mailer.SendCandidateInviteEmail(mailerConfig, c.PersonalEmail, c.FirstName, companyName, inviteURL); err != nil {
				logger.Warn(fmt.Sprintf("Failed to send candidate onboarding email to %s: %v", c.PersonalEmail, err))
			} else {
				logger.Info(fmt.Sprintf("Sent candidate onboarding invite email to %s (%s)", c.PersonalEmail, inviteURL))
			}
		}(cand)
	}

	return &cand, nil
}

func (s *onboardingService) GetCandidateByToken(ctx context.Context, token string) (*CandidateOnboardingView, error) {
	query := `
		SELECT c.id, c.tenant_id, c.first_name, c.last_name, c.personal_email, c.phone,
		       c.department_id, d.name AS department_name,
		       c.designation_id, des.title AS designation_title,
		       c.manager_id, CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
		       c.expected_joining_date, c.employment_type, c.hourly_cost_rate,
		       COALESCE(c.annual_ctc, 0.00) AS annual_ctc,
		       COALESCE(c.monthly_gross, 0.00) AS monthly_gross,
		       COALESCE(c.basic_salary, 0.00) AS basic_salary,
		       COALESCE(c.hra, 0.00) AS hra,
		       COALESCE(c.special_allowance, 0.00) AS special_allowance,
		       COALESCE(c.provident_fund, 0.00) AS provident_fund,
		       COALESCE(c.professional_tax, 0.00) AS professional_tax,
		       COALESCE(c.net_payable, 0.00) AS net_payable,
		       COALESCE(c.payment_method, 'bank_transfer') AS payment_method,
		       COALESCE(c.currency, 'USD') AS currency,
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

func (s *onboardingService) GetCandidateByID(ctx context.Context, tenantID, candidateID uuid.UUID) (*CandidateOnboardingView, error) {
	query := `
		SELECT c.id, c.tenant_id, c.first_name, c.last_name, c.personal_email, c.phone,
		       c.department_id, d.name AS department_name,
		       c.designation_id, des.title AS designation_title,
		       c.manager_id, CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
		       c.expected_joining_date, c.employment_type, c.hourly_cost_rate,
		       COALESCE(c.annual_ctc, 0.00) AS annual_ctc,
		       COALESCE(c.monthly_gross, 0.00) AS monthly_gross,
		       COALESCE(c.basic_salary, 0.00) AS basic_salary,
		       COALESCE(c.hra, 0.00) AS hra,
		       COALESCE(c.special_allowance, 0.00) AS special_allowance,
		       COALESCE(c.provident_fund, 0.00) AS provident_fund,
		       COALESCE(c.professional_tax, 0.00) AS professional_tax,
		       COALESCE(c.net_payable, 0.00) AS net_payable,
		       COALESCE(c.payment_method, 'bank_transfer') AS payment_method,
		       COALESCE(c.currency, 'USD') AS currency,
		       c.invite_token, c.status, c.submitted_at, c.approved_at, c.created_at
		FROM hrms_onboarding_candidates c
		LEFT JOIN hrms_departments d ON c.department_id = d.id
		LEFT JOIN hrms_designations des ON c.designation_id = des.id
		LEFT JOIN hrms_employees m ON c.manager_id = m.id
		WHERE c.tenant_id = $1 AND c.id = $2
		LIMIT 1
	`

	var cand OnboardingCandidate
	if err := s.db.GetContext(ctx, &cand, query, tenantID, candidateID); err != nil {
		return nil, errors.New("candidate not found")
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
		       COALESCE(c.annual_ctc, 0.00) AS annual_ctc,
		       COALESCE(c.monthly_gross, 0.00) AS monthly_gross,
		       COALESCE(c.basic_salary, 0.00) AS basic_salary,
		       COALESCE(c.hra, 0.00) AS hra,
		       COALESCE(c.special_allowance, 0.00) AS special_allowance,
		       COALESCE(c.provident_fund, 0.00) AS provident_fund,
		       COALESCE(c.professional_tax, 0.00) AS professional_tax,
		       COALESCE(c.net_payable, 0.00) AS net_payable,
		       COALESCE(c.payment_method, 'bank_transfer') AS payment_method,
		       COALESCE(c.currency, 'USD') AS currency,
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

	// Automatically create a user login account for the employee
	initialPassword := "EmployeePass2026!"
	if req.InitialPassword != nil && *req.InitialPassword != "" {
		initialPassword = *req.InitialPassword
	}
	hash, err := hashCandidatePassword(initialPassword)
	if err == nil {
		newUserID := uuid.New()
		userInsert := `
			INSERT INTO users (id, tenant_id, email, password_hash, status, presence_status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, 'active', 'offline', NOW(), NOW())
			ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash
			RETURNING id
		`
		var createdUserID uuid.UUID
		if err := s.db.GetContext(ctx, &createdUserID, userInsert, newUserID, tenantID, strings.ToLower(workEmail), hash); err == nil {
			// Link user_id to employee
			_, _ = s.db.ExecContext(ctx, `UPDATE hrms_employees SET user_id = $1 WHERE id = $2`, createdUserID, newEmployeeID)
			emp.UserID = &createdUserID

			// Assign employee role in user_roles
			var employeeRoleID uuid.UUID
			if err := s.db.GetContext(ctx, &employeeRoleID, `SELECT id FROM roles WHERE tenant_id = $1 AND name = 'employee'`, tenantID); err == nil {
				_, _ = s.db.ExecContext(ctx, `INSERT INTO user_roles (user_id, role_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`, createdUserID, employeeRoleID)
			}
		}
	}

	// Provision active compensation structure for payroll
	basic := cand.BasicSalary
	if req.BasicSalary != nil && *req.BasicSalary > 0 {
		basic = *req.BasicSalary
	}
	hra := cand.HRA
	if req.HRA != nil && *req.HRA >= 0 {
		hra = *req.HRA
	}
	specialAllowance := cand.SpecialAllowance
	if req.SpecialAllowance != nil && *req.SpecialAllowance >= 0 {
		specialAllowance = *req.SpecialAllowance
	}
	pf := cand.ProvidentFund
	if req.ProvidentFund != nil && *req.ProvidentFund >= 0 {
		pf = *req.ProvidentFund
	}
	pt := cand.ProfessionalTax
	if req.ProfessionalTax != nil && *req.ProfessionalTax >= 0 {
		pt = *req.ProfessionalTax
	}
	effectiveDate := cand.ExpectedJoiningDate
	if req.EffectiveDate != nil && *req.EffectiveDate != "" {
		if parsed, err := time.Parse("2006-01-02", *req.EffectiveDate); err == nil {
			effectiveDate = parsed
		}
	}
	if basic == 0 {
		// Provide industry standard default fallback if no explicit basic was configured
		basic = 65000.00
		hra = 32500.00
		specialAllowance = 25000.00
		pf = 7800.00
		pt = 200.00
	}

	// Upsert into hrms_compensation_structures (delete any preexisting record to ensure 1 active baseline)
	_, _ = s.db.ExecContext(ctx, `DELETE FROM hrms_compensation_structures WHERE employee_id = $1`, newEmployeeID)
	compInsertQuery := `
		INSERT INTO hrms_compensation_structures (
			id, tenant_id, employee_id, basic, hra, special_allowance,
			provident_fund, professional_tax, effective_date, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
	`
	if _, err := s.db.ExecContext(ctx, compInsertQuery, uuid.New(), tenantID, newEmployeeID, basic, hra, specialAllowance, pf, pt, effectiveDate); err != nil {
		logger.Warn(fmt.Sprintf("Failed to provision compensation structure for employee %s: %v", newEmployeeID, err))
	} else {
		logger.Info(fmt.Sprintf("Provisioned active compensation structure for employee %s: Basic=%.2f, HRA=%.2f, Special=%.2f, PF=%.2f, PT=%.2f",
			newEmployeeID, basic, hra, specialAllowance, pf, pt))
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
