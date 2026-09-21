package hrms

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type PayrollRepository interface {
	GetCompensationStructure(ctx context.Context, tenantID, employeeID uuid.UUID) (*CompensationStructure, error)
	ListActiveCompensationStructures(ctx context.Context, tenantID uuid.UUID) ([]CompensationStructure, error)
	GetDistinctPunchDatesInMonth(ctx context.Context, tenantID, employeeID uuid.UUID, year, month int) ([]time.Time, error)
	GetApprovedLeaveDaysInMonth(ctx context.Context, tenantID, employeeID uuid.UUID, year, month int) (float64, error)
	CreateOrUpdatePayrollRun(ctx context.Context, run *PayrollRun) error
	ListPayrollRuns(ctx context.Context, tenantID uuid.UUID) ([]PayrollRun, error)
	CreatePayslip(ctx context.Context, p *Payslip) error
	ListPayslips(ctx context.Context, tenantID uuid.UUID, employeeID *uuid.UUID, year, month *int) ([]Payslip, error)
	GetPayslipByID(ctx context.Context, tenantID, payslipID uuid.UUID) (*Payslip, error)
	UpsertITDeclaration(ctx context.Context, decl *ITDeclaration) error
	GetITDeclaration(ctx context.Context, tenantID, employeeID uuid.UUID, financialYear string) (*ITDeclaration, error)
	CreateReimbursementClaim(ctx context.Context, claim *ReimbursementClaim) error
	ListReimbursementClaims(ctx context.Context, tenantID uuid.UUID, employeeID *uuid.UUID) ([]ReimbursementClaim, error)
}

type payrollRepository struct {
	db *sqlx.DB
}

func NewPayrollRepository(db *sqlx.DB) PayrollRepository {
	return &payrollRepository{db: db}
}

func (r *payrollRepository) GetCompensationStructure(ctx context.Context, tenantID, employeeID uuid.UUID) (*CompensationStructure, error) {
	var comp CompensationStructure
	query := `
		SELECT id, tenant_id, employee_id, basic, hra, special_allowance, provident_fund, professional_tax, effective_date, created_at
		FROM hrms_compensation_structures
		WHERE tenant_id = $1 AND employee_id = $2
		ORDER BY effective_date DESC
		LIMIT 1`
	err := r.db.GetContext(ctx, &comp, query, tenantID, employeeID)
	if err != nil {
		return nil, err
	}
	return &comp, nil
}

func (r *payrollRepository) ListActiveCompensationStructures(ctx context.Context, tenantID uuid.UUID) ([]CompensationStructure, error) {
	var comps []CompensationStructure
	query := `
		SELECT DISTINCT ON (employee_id)
			id, tenant_id, employee_id, basic, hra, special_allowance, provident_fund, professional_tax, effective_date, created_at
		FROM hrms_compensation_structures
		WHERE tenant_id = $1
		ORDER BY employee_id, effective_date DESC`
	err := r.db.SelectContext(ctx, &comps, query, tenantID)
	return comps, err
}

func (r *payrollRepository) GetDistinctPunchDatesInMonth(ctx context.Context, tenantID, employeeID uuid.UUID, year, month int) ([]time.Time, error) {
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, 0)

	var dates []time.Time
	query := `
		SELECT DISTINCT date_trunc('day', punched_at) as punch_date
		FROM hrms_attendance_punches
		WHERE tenant_id = $1 AND employee_id = $2
		  AND punched_at >= $3 AND punched_at < $4
		ORDER BY punch_date ASC`
	err := r.db.SelectContext(ctx, &dates, query, tenantID, employeeID, startDate, endDate)
	return dates, err
}

func (r *payrollRepository) GetApprovedLeaveDaysInMonth(ctx context.Context, tenantID, employeeID uuid.UUID, year, month int) (float64, error) {
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, 0)

	var totalLeaveDays *float64
	query := `
		SELECT COALESCE(SUM(total_days), 0.0)
		FROM hrms_leave_requests
		WHERE tenant_id = $1 AND employee_id = $2
		  AND status = 'approved'
		  AND from_date < $4 AND to_date >= $3`
	err := r.db.GetContext(ctx, &totalLeaveDays, query, tenantID, employeeID, startDate, endDate)
	if err != nil || totalLeaveDays == nil {
		return 0.0, err
	}
	return *totalLeaveDays, nil
}

func (r *payrollRepository) CreateOrUpdatePayrollRun(ctx context.Context, run *PayrollRun) error {
	query := `
		INSERT INTO hrms_payroll_runs (
			id, tenant_id, month, year, status, total_employees, total_gross, total_deductions, total_net, processed_by, processed_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
		) ON CONFLICT (tenant_id, month, year) DO UPDATE SET
			status = EXCLUDED.status,
			total_employees = EXCLUDED.total_employees,
			total_gross = EXCLUDED.total_gross,
			total_deductions = EXCLUDED.total_deductions,
			total_net = EXCLUDED.total_net,
			processed_by = EXCLUDED.processed_by,
			processed_at = EXCLUDED.processed_at
		RETURNING id`
	var persistedID uuid.UUID
	err := r.db.QueryRowContext(ctx, query,
		run.ID, run.TenantID, run.Month, run.Year, run.Status,
		run.TotalEmployees, run.TotalGross, run.TotalDeductions, run.TotalNet,
		run.ProcessedBy, run.ProcessedAt,
	).Scan(&persistedID)
	if err == nil {
		run.ID = persistedID
	}
	return err
}

func (r *payrollRepository) ListPayrollRuns(ctx context.Context, tenantID uuid.UUID) ([]PayrollRun, error) {
	var runs []PayrollRun
	query := `
		SELECT pr.id, pr.tenant_id, pr.month, pr.year, pr.status, pr.total_employees, pr.total_gross, pr.total_deductions, pr.total_net,
		       pr.processed_by, pr.processed_at, pr.created_at,
		       COALESCE(u.first_name || ' ' || u.last_name, '') as processed_by_name
		FROM hrms_payroll_runs pr
		LEFT JOIN users u ON pr.processed_by = u.id
		WHERE pr.tenant_id = $1
		ORDER BY pr.year DESC, pr.month DESC`
	err := r.db.SelectContext(ctx, &runs, query, tenantID)
	return runs, err
}

func (r *payrollRepository) CreatePayslip(ctx context.Context, p *Payslip) error {
	query := `
		INSERT INTO hrms_payslips (
			id, tenant_id, payroll_run_id, employee_id, month, year, pay_period, payment_date, status,
			total_days, payable_days, lop_days, basic, hra, conveyance, medical_allowance, special_allowance,
			bonus, gross_earnings, provident_fund, professional_tax, tds, lop_deduction, other_deductions,
			total_deductions, net_pay, net_pay_in_words
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9,
			$10, $11, $12, $13, $14, $15, $16, $17,
			$18, $19, $20, $21, $22, $23, $24,
			$25, $26, $27
		) ON CONFLICT (tenant_id, employee_id, month, year) DO UPDATE SET
			payroll_run_id = EXCLUDED.payroll_run_id,
			payment_date = EXCLUDED.payment_date,
			status = EXCLUDED.status,
			total_days = EXCLUDED.total_days,
			payable_days = EXCLUDED.payable_days,
			lop_days = EXCLUDED.lop_days,
			basic = EXCLUDED.basic,
			hra = EXCLUDED.hra,
			special_allowance = EXCLUDED.special_allowance,
			gross_earnings = EXCLUDED.gross_earnings,
			provident_fund = EXCLUDED.provident_fund,
			professional_tax = EXCLUDED.professional_tax,
			tds = EXCLUDED.tds,
			lop_deduction = EXCLUDED.lop_deduction,
			total_deductions = EXCLUDED.total_deductions,
			net_pay = EXCLUDED.net_pay,
			net_pay_in_words = EXCLUDED.net_pay_in_words`
	_, err := r.db.ExecContext(ctx, query,
		p.ID, p.TenantID, p.PayrollRunID, p.EmployeeID, p.Month, p.Year, p.PayPeriod, p.PaymentDate, p.Status,
		p.TotalDays, p.PayableDays, p.LOPDays, p.Basic, p.HRA, p.Conveyance, p.MedicalAllowance, p.SpecialAllowance,
		p.Bonus, p.GrossEarnings, p.ProvidentFund, p.ProfessionalTax, p.TDS, p.LOPDeduction, p.OtherDeductions,
		p.TotalDeductions, p.NetPay, p.NetPayInWords,
	)
	return err
}

func (r *payrollRepository) ListPayslips(ctx context.Context, tenantID uuid.UUID, employeeID *uuid.UUID, year, month *int) ([]Payslip, error) {
	var payslips []Payslip
	baseQuery := `
		SELECT p.id, p.tenant_id, p.payroll_run_id, p.employee_id, p.month, p.year, p.pay_period, p.payment_date, p.status,
		       p.total_days, p.payable_days, p.lop_days, p.basic, p.hra, p.conveyance, p.medical_allowance, p.special_allowance,
		       p.bonus, p.gross_earnings, p.provident_fund, p.professional_tax, p.tds, p.lop_deduction, p.other_deductions,
		       p.total_deductions, p.net_pay, p.net_pay_in_words, p.created_at,
		       e.first_name || ' ' || e.last_name as employee_name,
		       e.employee_code as employee_code,
		       COALESCE(des.title, 'Software Engineer') as designation_title,
		       COALESCE(dep.name, 'Engineering') as department_name,
		       COALESCE(e.date_of_joining, CURRENT_DATE) as date_of_joining,
		       'HDFC Bank Ltd' as bank_name,
		       '•••• •••• 8821' as bank_account_masked,
		       'HDFC0001824' as bank_ifsc,
		       'ABCDE1234F' as pan,
		       '101234567890' as uan
		FROM hrms_payslips p
		JOIN hrms_employees e ON p.employee_id = e.id
		LEFT JOIN hrms_designations des ON e.designation_id = des.id
		LEFT JOIN hrms_departments dep ON e.department_id = dep.id
		WHERE p.tenant_id = $1`

	args := []interface{}{tenantID}
	idx := 2

	if employeeID != nil {
		baseQuery += fmt.Sprintf(" AND p.employee_id = $%d", idx)
		args = append(args, *employeeID)
		idx++
	}
	if year != nil {
		baseQuery += fmt.Sprintf(" AND p.year = $%d", idx)
		args = append(args, *year)
		idx++
	}
	if month != nil {
		baseQuery += fmt.Sprintf(" AND p.month = $%d", idx)
		args = append(args, *month)
		idx++
	}

	baseQuery += " ORDER BY p.year DESC, p.month DESC, e.first_name ASC"
	err := r.db.SelectContext(ctx, &payslips, baseQuery, args...)
	return payslips, err
}

func (r *payrollRepository) GetPayslipByID(ctx context.Context, tenantID, payslipID uuid.UUID) (*Payslip, error) {
	var p Payslip
	query := `
		SELECT p.id, p.tenant_id, p.payroll_run_id, p.employee_id, p.month, p.year, p.pay_period, p.payment_date, p.status,
		       p.total_days, p.payable_days, p.lop_days, p.basic, p.hra, p.conveyance, p.medical_allowance, p.special_allowance,
		       p.bonus, p.gross_earnings, p.provident_fund, p.professional_tax, p.tds, p.lop_deduction, p.other_deductions,
		       p.total_deductions, p.net_pay, p.net_pay_in_words, p.created_at,
		       e.first_name || ' ' || e.last_name as employee_name,
		       e.employee_code as employee_code,
		       COALESCE(des.title, 'Software Engineer') as designation_title,
		       COALESCE(dep.name, 'Engineering') as department_name,
		       COALESCE(e.date_of_joining, CURRENT_DATE) as date_of_joining,
		       'HDFC Bank Ltd' as bank_name,
		       '•••• •••• 8821' as bank_account_masked,
		       'HDFC0001824' as bank_ifsc,
		       'ABCDE1234F' as pan,
		       '101234567890' as uan
		FROM hrms_payslips p
		JOIN hrms_employees e ON p.employee_id = e.id
		LEFT JOIN hrms_designations des ON e.designation_id = des.id
		LEFT JOIN hrms_departments dep ON e.department_id = dep.id
		WHERE p.tenant_id = $1 AND p.id = $2`
	err := r.db.GetContext(ctx, &p, query, tenantID, payslipID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *payrollRepository) UpsertITDeclaration(ctx context.Context, decl *ITDeclaration) error {
	query := `
		INSERT INTO hrms_it_declarations (
			id, tenant_id, employee_id, financial_year, regime, sec_80c_total, sec_80d_health_insurance,
			sec_80d_parents, hra_annual_rent_paid, hra_landlord_pan, home_loan_interest, nps_contribution,
			projected_annual_tax, monthly_tds, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
		) ON CONFLICT (tenant_id, employee_id, financial_year) DO UPDATE SET
			regime = EXCLUDED.regime,
			sec_80c_total = EXCLUDED.sec_80c_total,
			sec_80d_health_insurance = EXCLUDED.sec_80d_health_insurance,
			sec_80d_parents = EXCLUDED.sec_80d_parents,
			hra_annual_rent_paid = EXCLUDED.hra_annual_rent_paid,
			hra_landlord_pan = EXCLUDED.hra_landlord_pan,
			home_loan_interest = EXCLUDED.home_loan_interest,
			nps_contribution = EXCLUDED.nps_contribution,
			projected_annual_tax = EXCLUDED.projected_annual_tax,
			monthly_tds = EXCLUDED.monthly_tds,
			updated_at = NOW()`
	_, err := r.db.ExecContext(ctx, query,
		decl.ID, decl.TenantID, decl.EmployeeID, decl.FinancialYear, decl.Regime,
		decl.Sec80CTotal, decl.Sec80DHealthInsurance, decl.Sec80DParents,
		decl.HRAAnnualRentPaid, decl.HRALandlordPAN, decl.HomeLoanInterest,
		decl.NPSContribution, decl.ProjectedAnnualTax, decl.MonthlyTDS,
	)
	return err
}

func (r *payrollRepository) GetITDeclaration(ctx context.Context, tenantID, employeeID uuid.UUID, financialYear string) (*ITDeclaration, error) {
	var decl ITDeclaration
	query := `
		SELECT id, tenant_id, employee_id, financial_year, regime, sec_80c_total, sec_80d_health_insurance,
		       sec_80d_parents, hra_annual_rent_paid, hra_landlord_pan, home_loan_interest, nps_contribution,
		       projected_annual_tax, monthly_tds, created_at, updated_at
		FROM hrms_it_declarations
		WHERE tenant_id = $1 AND employee_id = $2 AND financial_year = $3`
	err := r.db.GetContext(ctx, &decl, query, tenantID, employeeID, financialYear)
	if err != nil {
		return nil, err
	}
	return &decl, nil
}

func (r *payrollRepository) CreateReimbursementClaim(ctx context.Context, claim *ReimbursementClaim) error {
	query := `
		INSERT INTO hrms_reimbursement_claims (
			id, tenant_id, employee_id, category, category_name, amount, bill_number, bill_date,
			merchant_name, description, receipt_url, status
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		)`
	_, err := r.db.ExecContext(ctx, query,
		claim.ID, claim.TenantID, claim.EmployeeID, claim.Category, claim.CategoryName,
		claim.Amount, claim.BillNumber, claim.BillDate, claim.MerchantName, claim.Description,
		claim.ReceiptURL, claim.Status,
	)
	return err
}

func (r *payrollRepository) ListReimbursementClaims(ctx context.Context, tenantID uuid.UUID, employeeID *uuid.UUID) ([]ReimbursementClaim, error) {
	var claims []ReimbursementClaim
	baseQuery := `
		SELECT id, tenant_id, employee_id, category, category_name, amount, bill_number, bill_date,
		       merchant_name, description, receipt_url, status, reviewer_name, reviewed_by, created_at
		FROM hrms_reimbursement_claims
		WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	if employeeID != nil {
		baseQuery += " AND employee_id = $2"
		args = append(args, *employeeID)
	}
	baseQuery += " ORDER BY bill_date DESC, created_at DESC"
	err := r.db.SelectContext(ctx, &claims, baseQuery, args...)
	return claims, err
}
