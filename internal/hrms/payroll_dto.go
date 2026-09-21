package hrms

import "time"

// PreviewPayrollRequest specifies month and year to preview payroll.
type PreviewPayrollRequest struct {
	Month int `json:"month"` // 1 - 12
	Year  int `json:"year"`
}

// PayrollPreviewItem holds attendance and compensation breakdown for a single employee.
type PayrollPreviewItem struct {
	EmployeeID         string  `json:"employee_id"`
	EmployeeName       string  `json:"employee_name"`
	EmployeeCode       string  `json:"employee_code"`
	DepartmentName     string  `json:"department_name"`
	DesignationTitle   string  `json:"designation_title"`
	TotalDays          int     `json:"total_days"`
	WorkingDays        int     `json:"working_days"`
	PresentDays        float64 `json:"present_days"`
	ApprovedLeaveDays  float64 `json:"approved_leave_days"`
	LOPDays            float64 `json:"lop_days"`
	PayableDays        float64 `json:"payable_days"`
	MonthlyBaseGross   float64 `json:"monthly_base_gross"`
	ProratedBasic      float64 `json:"prorated_basic"`
	ProratedHRA        float64 `json:"prorated_hra"`
	SpecialAllowance   float64 `json:"special_allowance"`
	GrossEarnings      float64 `json:"gross_earnings"`
	PFDeduction        float64 `json:"pf_deduction"`
	PTDeduction        float64 `json:"pt_deduction"`
	TDSDeduction       float64 `json:"tds_deduction"`
	LOPDeduction       float64 `json:"lop_deduction"`
	TotalDeductions    float64 `json:"total_deductions"`
	NetPay             float64 `json:"net_pay"`
	HasBiometricRecord bool    `json:"has_biometric_record"`
}

// PreviewPayrollResponse summarizes pre-run payroll calculations across the company.
type PreviewPayrollResponse struct {
	Month           int                  `json:"month"`
	Year            int                  `json:"year"`
	PayPeriod       string               `json:"pay_period"`
	TotalEmployees  int                  `json:"total_employees"`
	TotalGross      float64              `json:"total_gross"`
	TotalDeductions float64              `json:"total_deductions"`
	TotalNet        float64              `json:"total_net"`
	Employees       []PayrollPreviewItem `json:"employees"`
}

// ExecutePayrollRequest triggers the official payroll run and payslip generation.
type ExecutePayrollRequest struct {
	Month int `json:"month"`
	Year  int `json:"year"`
}

// ExecutePayrollResponse returns summary of finalized payroll run.
type ExecutePayrollResponse struct {
	RunID           string  `json:"run_id"`
	Month           int     `json:"month"`
	Year            int     `json:"year"`
	PayPeriod       string  `json:"pay_period"`
	TotalEmployees  int     `json:"total_employees"`
	TotalGross      float64 `json:"total_gross"`
	TotalDeductions float64 `json:"total_deductions"`
	TotalNet        float64 `json:"total_net"`
	PayslipsCreated int     `json:"payslips_created"`
	ProcessedAt     string  `json:"processed_at"`
	Message         string  `json:"message"`
}

// SaveITDeclarationRequest holds employee's chosen regime and declarations.
type SaveITDeclarationRequest struct {
	Regime                string  `json:"regime"` // 'new' or 'old'
	FinancialYear         string  `json:"financial_year"`
	Sec80CTotal           float64 `json:"sec_80c_total"`
	Sec80DHealthInsurance float64 `json:"sec_80d_health_insurance"`
	Sec80DParents         float64 `json:"sec_80d_parents"`
	HRAAnnualRentPaid     float64 `json:"hra_annual_rent_paid"`
	HRALandlordPAN        *string `json:"hra_landlord_pan,omitempty"`
	HomeLoanInterest      float64 `json:"home_loan_interest"`
	NPSContribution       float64 `json:"nps_contribution"`
}

// SubmitReimbursementRequest holds claim submission details.
type SubmitReimbursementRequest struct {
	Category     string    `json:"category"` // 'broadband', 'learning', 'travel', 'wellness', 'office_supplies'
	Amount       float64   `json:"amount"`
	BillNumber   *string   `json:"bill_number,omitempty"`
	BillDate     time.Time `json:"bill_date"`
	MerchantName string    `json:"merchant_name"`
	Description  *string   `json:"description,omitempty"`
	ReceiptURL   *string   `json:"receipt_url,omitempty"`
}
