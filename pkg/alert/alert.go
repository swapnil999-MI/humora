package alert

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html"
	"humora-backend/configs"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// AlertThrottler manages deduplication and rate limiting of alert notifications.
type AlertThrottler struct {
	mu           sync.Mutex
	seenErrors   map[string]time.Time
	lastSentTime time.Time
}

var (
	httpClient = &http.Client{
		Timeout: 5 * time.Second,
	}

	throttler = &AlertThrottler{
		seenErrors: make(map[string]time.Time),
	}

	MinAlertInterval = 3 * time.Second
)

type TelegramPayload struct {
	ChatID    string `json:"chat_id"`
	Text      string `json:"text"`
	ParseMode string `json:"parse_mode"`
}

func getSuppressionWindow() time.Duration {
	if configs.AppConfig != nil && configs.AppConfig.Telegram.CooldownMin > 0 {
		return time.Duration(configs.AppConfig.Telegram.CooldownMin) * time.Minute
	}
	return 30 * time.Minute
}

func (t *AlertThrottler) ShouldSuppress(key string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	suppressionWindow := getSuppressionWindow()

	if now.Sub(t.lastSentTime) < MinAlertInterval {
		return true
	}

	for k, timestamp := range t.seenErrors {
		if now.Sub(timestamp) > suppressionWindow {
			delete(t.seenErrors, k)
		}
	}

	if lastSeen, exists := t.seenErrors[key]; exists {
		if now.Sub(lastSeen) < suppressionWindow {
			return true
		}
	}

	t.seenErrors[key] = now
	t.lastSentTime = now
	return false
}

func hashKey(str string) string {
	h := sha256.Sum256([]byte(str))
	return hex.EncodeToString(h[:8])
}

func IsActionableDeveloperError(errStr string) bool {
	if errStr == "" {
		return false
	}
	lower := strings.ToLower(errStr)

	criticalSubstrings := []string{
		"postgres", "pq:", "sql:", "driver: bad connection",
		"too many connections", "deadlock detected", "cannot assign requested address",
		"dial tcp", "redis", "connection refused", "no buffer space available",
	}
	for _, crit := range criticalSubstrings {
		if strings.Contains(lower, crit) {
			return true
		}
	}

	ignorableSubstrings := []string{
		"context canceled", "client closed connection", "broken pipe",
		"connection reset", "invalid credentials", "invalid password",
		"record not found", "unauthorized", "forbidden", "csrf token mismatch",
	}
	for _, ign := range ignorableSubstrings {
		if strings.Contains(lower, ign) {
			return false
		}
	}

	return true
}

func SendTelegramMessage(messageHTML string) {
	if configs.AppConfig == nil {
		return
	}
	botToken := configs.AppConfig.Telegram.BotToken
	chatID := configs.AppConfig.Telegram.ChatID

	if botToken == "" || chatID == "" {
		return
	}

	go func() {
		apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)

		payload := TelegramPayload{
			ChatID:    chatID,
			Text:      messageHTML,
			ParseMode: "HTML",
		}

		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return
		}

		req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, apiURL, bytes.NewBuffer(bodyBytes))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := httpClient.Do(req)
		if err != nil {
			return
		}
		_ = resp.Body.Close()
	}()
}

func SendServerError(c *fiber.Ctx, errStr string, latency time.Duration) {
	if !IsActionableDeveloperError(errStr) {
		return
	}

	method := c.Method()
	path := c.Path()
	errorFingerprint := fmt.Sprintf("%s:%s:%s", method, path, errStr)
	alertKey := hashKey(errorFingerprint)

	if throttler.ShouldSuppress(alertKey) {
		return
	}

	env := "local"
	if configs.AppConfig != nil && configs.AppConfig.Server.Env != "" {
		env = configs.AppConfig.Server.Env
	}

	escapedMethod := html.EscapeString(method)
	escapedPath := html.EscapeString(path)
	ip := html.EscapeString(c.IP())
	escapedErr := html.EscapeString(errStr)
	now := time.Now().Format("2006-01-02 15:04:05 MST")

	msg := fmt.Sprintf(
		"🚨 <b>[HUMORA SERVER ERROR 500]</b>\n\n"+
			"📍 <b>Endpoint:</b> <code>%s %s</code>\n"+
			"⏱ <b>Latency:</b> <code>%v</code>\n"+
			"🖥 <b>IP:</b> <code>%s</code>\n"+
			"🌍 <b>Env:</b> <code>%s</code>\n\n"+
			"❌ <b>Error:</b>\n<code>%s</code>\n\n"+
			"⏰ <b>Time:</b> <code>%s</code>",
		escapedMethod, escapedPath, latency, ip, env, escapedErr, now,
	)

	SendTelegramMessage(msg)
}

func SendCriticalAlert(title string, err error) {
	errStr := "N/A"
	if err != nil {
		errStr = err.Error()
	}

	alertKey := hashKey("critical:" + title + ":" + errStr)
	if throttler.ShouldSuppress(alertKey) {
		return
	}

	env := "local"
	if configs.AppConfig != nil && configs.AppConfig.Server.Env != "" {
		env = configs.AppConfig.Server.Env
	}

	escapedTitle := html.EscapeString(title)
	escapedErrStr := html.EscapeString(errStr)
	now := time.Now().Format("2006-01-02 15:04:05 MST")

	msg := fmt.Sprintf(
		"🚨 <b>[HUMORA CRITICAL ALERT]</b>\n\n"+
			"🔥 <b>Issue:</b> <b>%s</b>\n"+
			"🌍 <b>Env:</b> <code>%s</code>\n\n"+
			"❌ <b>Details:</b>\n<code>%s</code>\n\n"+
			"⏰ <b>Time:</b> <code>%s</code>",
		escapedTitle, env, escapedErrStr, now,
	)

	SendTelegramMessage(msg)
}

func SendCriticalAlertSync(title string, err error) {
	errStr := "N/A"
	if err != nil {
		errStr = err.Error()
	}

	if configs.AppConfig == nil {
		return
	}
	botToken := configs.AppConfig.Telegram.BotToken
	chatID := configs.AppConfig.Telegram.ChatID
	if botToken == "" || chatID == "" {
		return
	}

	env := "local"
	if configs.AppConfig.Server.Env != "" {
		env = configs.AppConfig.Server.Env
	}

	escapedTitle := html.EscapeString(title)
	escapedErrStr := html.EscapeString(errStr)
	now := time.Now().Format("2006-01-02 15:04:05 MST")

	msg := fmt.Sprintf(
		"🚨 <b>[HUMORA CRITICAL FATAL ALERT]</b>\n\n"+
			"🔥 <b>Issue:</b> <b>%s</b>\n"+
			"🌍 <b>Env:</b> <code>%s</code>\n\n"+
			"❌ <b>Details:</b>\n<code>%s</code>\n\n"+
			"⏰ <b>Time:</b> <code>%s</code>",
		escapedTitle, env, escapedErrStr, now,
	)

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
	payload := TelegramPayload{
		ChatID:    chatID,
		Text:      msg,
		ParseMode: "HTML",
	}

	bodyBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	req, reqErr := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewBuffer(bodyBytes))
	if reqErr != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, doErr := httpClient.Do(req)
	if doErr != nil {
		return
	}
	_ = resp.Body.Close()
}
