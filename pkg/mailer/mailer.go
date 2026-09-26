package mailer

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"strings"
	"time"
)

type SMTPConfig struct {
	Host       string
	Port       int
	Username   string
	Password   string
	FromEmail  string
	FromName   string
	Encryption string // "starttls", "ssl", "none"
}

// SendEmail transmits an HTML email through SMTP or logs to console in fallback/dev mode.
func SendEmail(cfg *SMTPConfig, to string, subject string, htmlBody string) error {
	if cfg == nil || cfg.Host == "" {
		log.Printf("[Mailer/DevFallback] To: %s | Subject: %q\n[Body]\n%s\n", to, subject, htmlBody)
		return nil
	}

	fromName := cfg.FromName
	if fromName == "" {
		fromName = "Humora HRMS"
	}
	fromEmail := cfg.FromEmail
	if fromEmail == "" {
		fromEmail = cfg.Username
	}

	addr := net.JoinHostPort(cfg.Host, fmt.Sprintf("%d", cfg.Port))

	// Build RFC 822 MIME message
	headers := make(map[string]string)
	headers["From"] = fmt.Sprintf("%s <%s>", fromName, fromEmail)
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"
	headers["Date"] = time.Now().Format(time.RFC1123Z)

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + htmlBody

	host := strings.TrimSpace(cfg.Host)
	username := strings.TrimSpace(cfg.Username)
	password := strings.TrimSpace(cfg.Password)

	// If Google/Gmail SMTP and password is 16 chars with spaces (e.g. "abcd efgh ijkl mnop"), strip spaces
	if strings.Contains(strings.ToLower(host), "gmail") || strings.Contains(strings.ToLower(host), "google") {
		if strings.Count(password, " ") == 3 && len(strings.ReplaceAll(password, " ", "")) == 16 {
			password = strings.ReplaceAll(password, " ", "")
		}
	}

	auth := smtp.PlainAuth("", username, password, host)

	// SSL/TLS connection (typically port 465)
	if strings.EqualFold(cfg.Encryption, "ssl") || cfg.Port == 465 {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: false,
			ServerName:         cfg.Host,
		}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			log.Printf("[Mailer/Error] TLS Dial to %s failed: %v", addr, err)
			return fmt.Errorf("failed to establish SSL/TLS connection to %s: %w", addr, err)
		}
		defer conn.Close()

		client, err := smtp.NewClient(conn, cfg.Host)
		if err != nil {
			return err
		}
		defer client.Quit()

		if err := client.Auth(auth); err != nil {
			return formatSMTPAuthError(err, cfg.Host)
		}
		if err := client.Mail(fromEmail); err != nil {
			return err
		}
		if err := client.Rcpt(to); err != nil {
			return err
		}
		w, err := client.Data()
		if err != nil {
			return err
		}
		if _, err := w.Write([]byte(message)); err != nil {
			return err
		}
		return w.Close()
	}

	// STARTTLS or Standard connection (typically port 587 or 25)
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		log.Printf("[Mailer/Warning] SMTP Dial to %s failed: %v", addr, err)
		return fmt.Errorf("failed to connect to SMTP server %s: %w", addr, err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, cfg.Host)
	if err != nil {
		return err
	}
	defer client.Quit()

	if ok, _ := client.Extension("STARTTLS"); ok || strings.EqualFold(cfg.Encryption, "starttls") {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: false,
			ServerName:         cfg.Host,
		}
		if err := client.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("STARTTLS negotiation failed: %w", err)
		}
	}

	if cfg.Username != "" && cfg.Password != "" {
		if err := client.Auth(auth); err != nil {
			return formatSMTPAuthError(err, cfg.Host)
		}
	}

	if err := client.Mail(fromEmail); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write([]byte(message)); err != nil {
		return err
	}
	return w.Close()
}

// SendTestEmail sends a test email to verify SMTP gateway connectivity.
func SendTestEmail(cfg *SMTPConfig, recipient string) error {
	subject := "Humora HRMS — SMTP Gateway Test Connection"
	body := fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head><meta charset="UTF-8"></head>
	<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090a0f; color: #f1f5f9; padding: 32px 16px;">
		<div style="max-width: 560px; margin: 0 auto; background: #131722; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
			<div style="margin-bottom: 24px; text-align: center;">
				<h2 style="color: #6366f1; margin: 0; font-size: 22px;">Humora HRMS</h2>
				<p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">Corporate Email Delivery Gateway</p>
			</div>
			<div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
				<p style="color: #10b981; margin: 0; font-weight: 600; font-size: 15px;">✓ Connection Test Successful</p>
				<p style="color: #cbd5e1; font-size: 13px; margin: 6px 0 0 0;">Your SMTP gateway configuration is operating correctly. Automated onboarding invitations, monthly salary slips, and password reset OTPs will now be delivered via this channel.</p>
			</div>
			<div style="font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 16px;">
				<strong>Host:</strong> %s:%d &bull; <strong>Encryption:</strong> %s &bull; <strong>Sender:</strong> %s
			</div>
		</div>
	</body>
	</html>
	`, cfg.Host, cfg.Port, cfg.Encryption, cfg.FromEmail)

	return SendEmail(cfg, recipient, subject, body)
}

// SendCandidateInviteEmail sends employee onboarding invitation with token link.
func SendCandidateInviteEmail(cfg *SMTPConfig, recipient, candidateName, companyName, inviteURL string) error {
	subject := fmt.Sprintf("Welcome to %s — Complete Your Employee Onboarding", companyName)
	body := fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head><meta charset="UTF-8"></head>
	<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090a0f; color: #f1f5f9; padding: 32px 16px;">
		<div style="max-width: 560px; margin: 0 auto; background: #131722; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
			<div style="margin-bottom: 24px;">
				<h2 style="color: #6366f1; margin: 0; font-size: 22px;">%s</h2>
				<p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">Employee Onboarding Portal</p>
			</div>
			<p style="font-size: 15px; color: #e2e8f0; line-height: 1.5;">Dear <strong>%s</strong>,</p>
			<p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
				You have been invited to join <strong>%s</strong>. To set up your employee profile, emergency contacts, statutory details, and account credentials, please click the button below:
			</p>
			<div style="text-align: center; margin: 32px 0;">
				<a href="%s" style="background: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);">Complete Your Profile</a>
			</div>
			<p style="font-size: 12px; color: #64748b; line-height: 1.5;">
				If the button does not work, copy and paste this link in your browser:<br>
				<a href="%s" style="color: #6366f1; word-break: break-all;">%s</a>
			</p>
			<div style="font-size: 11px; color: #475569; border-top: 1px solid #1e293b; padding-top: 16px; margin-top: 24px;">
				This link is personalized and secure. Please do not forward this email.
			</div>
		</div>
	</body>
	</html>
	`, companyName, candidateName, companyName, inviteURL, inviteURL, inviteURL)

	return SendEmail(cfg, recipient, subject, body)
}

// SendPayslipNotificationEmail notifies an employee that their monthly payslip is ready.
func SendPayslipNotificationEmail(cfg *SMTPConfig, recipient, employeeName, companyName, monthYear, netPayFormatted, payslipURL string) error {
	subject := fmt.Sprintf("Your Payslip for %s is Ready — %s", monthYear, companyName)
	body := fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head><meta charset="UTF-8"></head>
	<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090a0f; color: #f1f5f9; padding: 32px 16px;">
		<div style="max-width: 560px; margin: 0 auto; background: #131722; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
			<div style="margin-bottom: 24px;">
				<h2 style="color: #6366f1; margin: 0; font-size: 22px;">%s</h2>
				<p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">Salary Statement &bull; Pay Period: %s</p>
			</div>
			<p style="font-size: 15px; color: #e2e8f0; line-height: 1.5;">Hello <strong>%s</strong>,</p>
			<p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
				Your salary statement for <strong>%s</strong> has been calculated and processed by <strong>%s</strong>.
			</p>
			<div style="background: #1e2433; border: 1px solid #334155; border-radius: 8px; padding: 18px; margin: 20px 0; text-align: center;">
				<div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Net Disbursed Pay</div>
				<div style="font-size: 28px; font-weight: 700; color: #10b981; margin-top: 4px;">%s</div>
			</div>
			<div style="text-align: center; margin: 28px 0;">
				<a href="%s" style="background: #3b82f6; color: #ffffff; text-decoration: none; padding: 11px 24px; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">View & Download Payslip</a>
			</div>
			<div style="font-size: 11px; color: #475569; border-top: 1px solid #1e293b; padding-top: 16px; margin-top: 24px;">
				Confidential &bull; Generated by Humora Automated Statutory Payroll Engine
			</div>
		</div>
	</body>
	</html>
	`, companyName, monthYear, employeeName, monthYear, companyName, netPayFormatted, payslipURL)

	return SendEmail(cfg, recipient, subject, body)
}

// SendPasswordResetOTPEmail sends a 6-digit OTP for password recovery.
func SendPasswordResetOTPEmail(cfg *SMTPConfig, recipient, otpCode string) error {
	subject := "Humora — Password Reset Verification Code"
	body := fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head><meta charset="UTF-8"></head>
	<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090a0f; color: #f1f5f9; padding: 32px 16px;">
		<div style="max-width: 520px; margin: 0 auto; background: #131722; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
			<div style="margin-bottom: 24px; text-align: center;">
				<h2 style="color: #6366f1; margin: 0; font-size: 22px;">Security Verification</h2>
				<p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">Password Reset Request</p>
			</div>
			<p style="font-size: 14px; color: #94a3b8; line-height: 1.6; text-align: center;">
				We received a request to reset your Humora account password. Use the verification code below to proceed:
			</p>
			<div style="background: #1e2433; border: 1px solid #334155; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
				<div style="font-size: 36px; font-weight: 700; letter-spacing: 0.25em; color: #f8fafc; font-family: monospace;">%s</div>
				<div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">Valid for 10 minutes</div>
			</div>
			<p style="font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
				If you did not request this code, you can safely ignore this email. Your password will remain unchanged.
			</p>
		</div>
	</body>
	</html>
	`, otpCode)

	return SendEmail(cfg, recipient, subject, body)
}

func formatSMTPAuthError(err error, host string) error {
	if err == nil {
		return nil
	}
	errStr := err.Error()
	if strings.Contains(errStr, "535") || strings.Contains(errStr, "BadCredentials") {
		if strings.Contains(strings.ToLower(host), "gmail") || strings.Contains(strings.ToLower(host), "google") {
			return fmt.Errorf("Google SMTP Authentication Failed (535 BadCredentials): Google requires a 16-character 'Google App Password' (NOT your personal Google account password). Please enable 2-Step Verification on your Google Account, visit https://myaccount.google.com/apppasswords to generate an App Password, and paste it into the Password field.")
		}
		return fmt.Errorf("SMTP authentication failed (535): Invalid username or password. For services like Gmail, Outlook, or Yahoo, a dedicated 16-character App Password is required.")
	}
	return fmt.Errorf("SMTP authentication failed: %w", err)
}
