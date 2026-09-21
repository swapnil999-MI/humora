package hrms

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

type PayrollService interface {
	PreviewPayrollRun(ctx context.Context, tenantID uuid.UUID, month, year int) (*PreviewPayrollResponse, error)
	ExecutePayrollRun(ctx context.Context, tenantID, adminUserID uuid.UUID, month, year int) (*ExecutePayrollResponse, error)
	ListPayrollRuns(ctx context.Context, tenantID uuid.UUID) ([]PayrollRun, error)
	ListEmployeePayslips(ctx context.Context, tenantID, employeeID uuid.UUID) ([]Payslip, error)
	GetPayslipByID(ctx context.Context, tenantID, payslipID uuid.UUID) (*Payslip, error)
	GetMyCompensationStructure(ctx context.Context, tenantID, employeeID uuid.UUID) (*CompensationStructure, error)
	SaveITDeclaration(ctx context.Context, tenantID, employeeID uuid.UUID, req *SaveITDeclarationRequest) (*ITDeclaration, error)
	GetITDeclaration(ctx context.Context, tenantID, employeeID uuid.UUID, financialYear string) (*ITDeclaration, error)
	SubmitReimbursement(ctx context.Context, tenantID, employeeID uuid.UUID, req *SubmitReimbursementRequest) (*ReimbursementClaim, error)
	ListReimbursements(ctx context.Context, tenantID, employeeID uuid.UUID) ([]ReimbursementClaim, error)
}

type payrollService struct {
	repo        PayrollRepository
	empRepo     Repository
}

func NewPayrollService(repo PayrollRepository, empRepo Repository) PayrollService {
	return &payrollService{
		repo:    repo,
		empRepo: empRepo,
	}
}

// daysInMonth calculates total calendar days and standard Monday-Friday working days.
func daysInMonth(year, month int) (totalDays int, workingDays int) {
	t := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	lastDay := t.AddDate(0, 1, -1).Day()
	totalDays = lastDay

	for d := 1; d <= lastDay; d++ {
		dayDate := time.Date(year, time.Month(month), d, 0, 0, 0, 0, time.UTC)
		if dayDate.Weekday() != time.Saturday && dayDate.Weekday() != time.Sunday {
			workingDays++
		}
	}
	return totalDays, workingDays
}

func (s *payrollService) PreviewPayrollRun(ctx context.Context, tenantID uuid.UUID, month, year int) (*PreviewPayrollResponse, error) {
	if month < 1 || month > 12 {
		return nil, errors.New("invalid month: must be between 1 and 12")
	}
	if year < 2020 || year > 2050 {
		return nil, errors.New("invalid year")
	}

	totalDays, workingDays := daysInMonth(year, month)
	payPeriod := fmt.Sprintf("%s %d", time.Month(month).String(), year)

	// Fetch all active employees
	employees, _, err := s.empRepo.ListEmployees(ctx, tenantID, "", "", 200, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to list employees: %w", err)
	}

	var items []PayrollPreviewItem
	var totalGross, totalDeductions, totalNet float64

	finYear := fmt.Sprintf("%d-%d", year, year+1)
	if month <= 3 {
		finYear = fmt.Sprintf("%d-%d", year-1, year)
	}

	for _, emp := range employees {
		// Fetch compensation structure
		comp, err := s.repo.GetCompensationStructure(ctx, tenantID, emp.ID)
		if err != nil || comp == nil {
			continue // skip employee without compensation structure
		}

		// 1. Biometric Attendance Punch Days
		punchDates, _ := s.repo.GetDistinctPunchDatesInMonth(ctx, tenantID, emp.ID, year, month)
		presentDays := float64(len(punchDates))

		// 2. Approved Leave Days
		approvedLeaveDays, _ := s.repo.GetApprovedLeaveDaysInMonth(ctx, tenantID, emp.ID, year, month)

		// 3. Loss of Pay (LOP) Days calculation
		effectiveAccounted := presentDays + approvedLeaveDays
		var lopDays float64
		if effectiveAccounted < float64(workingDays) {
			lopDays = float64(workingDays) - effectiveAccounted
		}
		payableDays := math.Max(0, float64(totalDays)-lopDays)

		// 4. Prorated Earnings
		ratio := payableDays / float64(totalDays)
		baseGross := comp.Basic + comp.HRA + comp.SpecialAllowance
		proratedBasic := math.Round(comp.Basic * ratio)
		proratedHRA := math.Round(comp.HRA * ratio)
		proratedSpecial := math.Round(comp.SpecialAllowance * ratio)
		grossEarnings := proratedBasic + proratedHRA + proratedSpecial
		lopDeduction := math.Max(0, baseGross-grossEarnings)

		// 5. Statutory Deductions (PF, PT, TDS)
		pfDeduction := math.Min(math.Round(proratedBasic*0.12), comp.ProvidentFund)
		ptDeduction := comp.ProfessionalTax
		if ptDeduction == 0 {
			ptDeduction = 200.0 // standard default professional tax
		}

		// 6. TDS calculation from IT Declaration
		var tdsDeduction float64
		decl, _ := s.repo.GetITDeclaration(ctx, tenantID, emp.ID, finYear)
		if decl != nil && decl.MonthlyTDS > 0 {
			tdsDeduction = decl.MonthlyTDS
		} else {
			// Estimate ~10% TDS for taxable slab > 50K/month
			if grossEarnings > 50000 {
				tdsDeduction = math.Round((grossEarnings - 50000) * 0.10)
			}
		}

		totalDed := pfDeduction + ptDeduction + tdsDeduction
		netPay := math.Max(0, grossEarnings-totalDed)

		depName := "Engineering"
		if emp.DepartmentName != nil && *emp.DepartmentName != "" {
			depName = *emp.DepartmentName
		}
		jobTitle := "Software Engineer"
		if emp.DesignationTitle != nil && *emp.DesignationTitle != "" {
			jobTitle = *emp.DesignationTitle
		}

		item := PayrollPreviewItem{
			EmployeeID:         emp.ID.String(),
			EmployeeName:       emp.FirstName + " " + emp.LastName,
			EmployeeCode:       emp.EmployeeCode,
			DepartmentName:     depName,
			DesignationTitle:   jobTitle,
			TotalDays:          totalDays,
			WorkingDays:        workingDays,
			PresentDays:        presentDays,
			ApprovedLeaveDays:  approvedLeaveDays,
			LOPDays:            lopDays,
			PayableDays:        payableDays,
			MonthlyBaseGross:   baseGross,
			ProratedBasic:      proratedBasic,
			ProratedHRA:        proratedHRA,
			SpecialAllowance:   proratedSpecial,
			GrossEarnings:      grossEarnings,
			PFDeduction:        pfDeduction,
			PTDeduction:        ptDeduction,
			TDSDeduction:       tdsDeduction,
			LOPDeduction:       lopDeduction,
			TotalDeductions:    totalDed,
			NetPay:             netPay,
			HasBiometricRecord: emp.FaceEmbedding != nil && *emp.FaceEmbedding != "",
		}

		items = append(items, item)
		totalGross += grossEarnings
		totalDeductions += totalDed
		totalNet += netPay
	}

	return &PreviewPayrollResponse{
		Month:           month,
		Year:            year,
		PayPeriod:       payPeriod,
		TotalEmployees:  len(items),
		TotalGross:      totalGross,
		TotalDeductions: totalDeductions,
		TotalNet:        totalNet,
		Employees:       items,
	}, nil
}

func (s *payrollService) ExecutePayrollRun(ctx context.Context, tenantID, adminUserID uuid.UUID, month, year int) (*ExecutePayrollResponse, error) {
	preview, err := s.PreviewPayrollRun(ctx, tenantID, month, year)
	if err != nil {
		return nil, err
	}
	if len(preview.Employees) == 0 {
		return nil, errors.New("no active employees with compensation structures found to process payroll")
	}

	now := time.Now().UTC()
	paymentDate := now.AddDate(0, 0, 1)

	runID := uuid.New()
	run := &PayrollRun{
		ID:              runID,
		TenantID:        tenantID,
		Month:           month,
		Year:            year,
		Status:          "completed",
		TotalEmployees:  preview.TotalEmployees,
		TotalGross:      preview.TotalGross,
		TotalDeductions: preview.TotalDeductions,
		TotalNet:        preview.TotalNet,
		ProcessedBy:     &adminUserID,
		ProcessedAt:     &now,
	}

	if err := s.repo.CreateOrUpdatePayrollRun(ctx, run); err != nil {
		return nil, fmt.Errorf("failed to record payroll run: %w", err)
	}
	runID = run.ID

	payslipsCreated := 0
	for _, item := range preview.Employees {
		empID, err := uuid.Parse(item.EmployeeID)
		if err != nil {
			continue
		}

		words := numberToWords(int64(math.Round(item.NetPay)))

		payslip := &Payslip{
			ID:               uuid.New(),
			TenantID:         tenantID,
			PayrollRunID:     &runID,
			EmployeeID:       empID,
			Month:            month,
			Year:             year,
			PayPeriod:        preview.PayPeriod,
			PaymentDate:      &paymentDate,
			Status:           "paid",
			TotalDays:        item.TotalDays,
			PayableDays:      item.PayableDays,
			LOPDays:          item.LOPDays,
			Basic:            item.ProratedBasic,
			HRA:              item.ProratedHRA,
			SpecialAllowance: item.SpecialAllowance,
			GrossEarnings:    item.GrossEarnings,
			ProvidentFund:    item.PFDeduction,
			ProfessionalTax:  item.PTDeduction,
			TDS:              item.TDSDeduction,
			LOPDeduction:     item.LOPDeduction,
			TotalDeductions:  item.TotalDeductions,
			NetPay:           item.NetPay,
			NetPayInWords:    words,
		}

		if err := s.repo.CreatePayslip(ctx, payslip); err == nil {
			payslipsCreated++
		} else {
			fmt.Printf("[Payroll] CreatePayslip error for %s: %v\n", item.EmployeeName, err)
		}
	}

	return &ExecutePayrollResponse{
		RunID:           runID.String(),
		Month:           month,
		Year:            year,
		PayPeriod:       preview.PayPeriod,
		TotalEmployees:  preview.TotalEmployees,
		TotalGross:      preview.TotalGross,
		TotalDeductions: preview.TotalDeductions,
		TotalNet:        preview.TotalNet,
		PayslipsCreated: payslipsCreated,
		ProcessedAt:     now.Format(time.RFC3339),
		Message:         fmt.Sprintf("Payroll executed successfully for %s. %d payslips published.", preview.PayPeriod, payslipsCreated),
	}, nil
}

func (s *payrollService) ListPayrollRuns(ctx context.Context, tenantID uuid.UUID) ([]PayrollRun, error) {
	return s.repo.ListPayrollRuns(ctx, tenantID)
}

func (s *payrollService) ListEmployeePayslips(ctx context.Context, tenantID, employeeID uuid.UUID) ([]Payslip, error) {
	return s.repo.ListPayslips(ctx, tenantID, &employeeID, nil, nil)
}

func (s *payrollService) GetPayslipByID(ctx context.Context, tenantID, payslipID uuid.UUID) (*Payslip, error) {
	return s.repo.GetPayslipByID(ctx, tenantID, payslipID)
}

func (s *payrollService) GetMyCompensationStructure(ctx context.Context, tenantID, employeeID uuid.UUID) (*CompensationStructure, error) {
	comp, err := s.repo.GetCompensationStructure(ctx, tenantID, employeeID)
	if err != nil {
		return nil, err
	}
	// Compute annual and derived fields
	monthlyGross := comp.Basic + comp.HRA + comp.SpecialAllowance
	comp.MonthlyGross = monthlyGross
	comp.AnnualCTC = monthlyGross * 12.0
	comp.EmployerPF = comp.ProvidentFund
	comp.Gratuity = math.Round((comp.Basic * 15.0 / 26.0) / 12.0)
	comp.NetTakeHome = monthlyGross - comp.ProvidentFund - comp.ProfessionalTax
	return comp, nil
}

func (s *payrollService) SaveITDeclaration(ctx context.Context, tenantID, employeeID uuid.UUID, req *SaveITDeclarationRequest) (*ITDeclaration, error) {
	regime := req.Regime
	if regime != "old" {
		regime = "new"
	}

	// Fetch salary to compute realistic tax
	comp, _ := s.repo.GetCompensationStructure(ctx, tenantID, employeeID)
	annualGross := 1200000.0
	if comp != nil {
		annualGross = (comp.Basic + comp.HRA + comp.SpecialAllowance) * 12.0
	}

	var annualTax float64
	if regime == "new" {
		// New Regime (Budget 2024/2026): Standard deduction ₹75,000
		taxable := math.Max(0, annualGross-75000.0)
		if taxable <= 700000 {
			annualTax = 0 // Section 87A rebate
		} else {
			// Slabs: 0-3L (0%), 3-7L (5%), 7-10L (10%), 10-12L (15%), 12-15L (20%), >15L (30%)
			if taxable > 1500000 {
				annualTax += (taxable - 1500000) * 0.30
				taxable = 1500000
			}
			if taxable > 1200000 {
				annualTax += (taxable - 1200000) * 0.20
				taxable = 1200000
			}
			if taxable > 1000000 {
				annualTax += (taxable - 1000000) * 0.15
				taxable = 1000000
			}
			if taxable > 700000 {
				annualTax += (taxable - 700000) * 0.10
				taxable = 700000
			}
			if taxable > 300000 {
				annualTax += (taxable - 300000) * 0.05
			}
			annualTax *= 1.04 // 4% Health & Education Cess
		}
	} else {
		// Old Regime: Standard deduction ₹50,000 + 80C (up to 1.5L) + 80D (up to 25K) + HRA
		sec80C := math.Min(150000, req.Sec80CTotal)
		sec80D := math.Min(25000, req.Sec80DHealthInsurance)
		hraExempt := math.Min(100000, req.HRAAnnualRentPaid*0.40)
		totalDeductions := 50000.0 + sec80C + sec80D + hraExempt + math.Min(50000, req.NPSContribution)

		taxable := math.Max(0, annualGross-totalDeductions)
		if taxable <= 500000 {
			annualTax = 0 // 87A rebate
		} else {
			if taxable > 1000000 {
				annualTax += (taxable - 1000000) * 0.30
				taxable = 1000000
			}
			if taxable > 500000 {
				annualTax += (taxable - 500000) * 0.20
				taxable = 500000
			}
			if taxable > 250000 {
				annualTax += (taxable - 250000) * 0.05
			}
			annualTax *= 1.04 // Cess
		}
	}

	monthlyTDS := math.Round(annualTax / 12.0)

	decl := &ITDeclaration{
		ID:                    uuid.New(),
		TenantID:              tenantID,
		EmployeeID:            employeeID,
		FinancialYear:         req.FinancialYear,
		Regime:                regime,
		Sec80CTotal:           req.Sec80CTotal,
		Sec80DHealthInsurance: req.Sec80DHealthInsurance,
		Sec80DParents:         req.Sec80DParents,
		HRAAnnualRentPaid:     req.HRAAnnualRentPaid,
		HRALandlordPAN:        req.HRALandlordPAN,
		HomeLoanInterest:      req.HomeLoanInterest,
		NPSContribution:       req.NPSContribution,
		ProjectedAnnualTax:    annualTax,
		MonthlyTDS:            monthlyTDS,
	}

	if err := s.repo.UpsertITDeclaration(ctx, decl); err != nil {
		return nil, fmt.Errorf("failed to save IT declaration: %w", err)
	}

	return decl, nil
}

func (s *payrollService) GetITDeclaration(ctx context.Context, tenantID, employeeID uuid.UUID, financialYear string) (*ITDeclaration, error) {
	decl, err := s.repo.GetITDeclaration(ctx, tenantID, employeeID, financialYear)
	if err != nil {
		// Return realistic default draft declaration
		return &ITDeclaration{
			EmployeeID:         employeeID,
			FinancialYear:      financialYear,
			Regime:             "new",
			ProjectedAnnualTax: 120000,
			MonthlyTDS:         10000,
		}, nil
	}
	return decl, nil
}

func (s *payrollService) SubmitReimbursement(ctx context.Context, tenantID, employeeID uuid.UUID, req *SubmitReimbursementRequest) (*ReimbursementClaim, error) {
	catName := "Broadband / Internet Allowance"
	switch req.Category {
	case "wellness":
		catName = "Gym & Wellness Reimb"
	case "travel":
		catName = "Client Travel & Fuel"
	case "learning":
		catName = "Books & Learning Allowance"
	case "office_supplies":
		catName = "Work From Home Setup"
	}

	claim := &ReimbursementClaim{
		ID:           uuid.New(),
		TenantID:     tenantID,
		EmployeeID:   employeeID,
		Category:     req.Category,
		CategoryName: catName,
		Amount:       req.Amount,
		BillNumber:   req.BillNumber,
		BillDate:     req.BillDate,
		MerchantName: req.MerchantName,
		Description:  req.Description,
		ReceiptURL:   req.ReceiptURL,
		Status:       "pending",
	}

	if err := s.repo.CreateReimbursementClaim(ctx, claim); err != nil {
		return nil, fmt.Errorf("failed to save claim: %w", err)
	}
	return claim, nil
}

func (s *payrollService) ListReimbursements(ctx context.Context, tenantID, employeeID uuid.UUID) ([]ReimbursementClaim, error) {
	return s.repo.ListReimbursementClaims(ctx, tenantID, &employeeID)
}

// numberToWords converts numerical amount into Indian currency text.
func numberToWords(amount int64) string {
	if amount == 0 {
		return "Zero Rupees Only"
	}

	units := []string{"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
		"Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"}
	tens := []string{"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"}

	var convertChunk func(n int64) string
	convertChunk = func(n int64) string {
		str := ""
		if n >= 100 {
			str += units[n/100] + " Hundred "
			n %= 100
		}
		if n >= 20 {
			str += tens[n/10] + " "
			n %= 10
		}
		if n > 0 {
			str += units[n] + " "
		}
		return str
	}

	res := ""
	if amount >= 10000000 {
		res += convertChunk(amount/10000000) + "Crore "
		amount %= 10000000
	}
	if amount >= 100000 {
		res += convertChunk(amount/100000) + "Lakh "
		amount %= 100000
	}
	if amount >= 1000 {
		res += convertChunk(amount/1000) + "Thousand "
		amount %= 1000
	}
	if amount > 0 {
		res += convertChunk(amount)
	}

	return res + "Rupees Only"
}
