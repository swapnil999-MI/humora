package configs

import (
	"os"

	"github.com/joho/godotenv"
)

// Environment variable keys
const (
	PortEnv                      = "PORT"
	EnvEnv                       = "ENV"
	FrontendBaseURLEnv           = "FRONTEND_BASE_URL"
	AllowedOriginsEnv            = "ALLOWED_ORIGINS"
	CookieDomainEnv              = "COOKIE_DOMAIN"
	LogLevelEnv                  = "LOG_LEVEL"
	ProxyHeaderEnv               = "PROXY_HEADER"
	TrustedProxiesEnv            = "TRUSTED_PROXIES"
	PublicSignupEnv              = "PUBLIC_SIGNUP"

	// Database keys
	DbHostEnv                    = "DB_HOST"
	DbPortEnv                    = "DB_PORT"
	DbUserEnv                    = "DB_USER"
	DbPasswordEnv                = "DB_PASSWORD"
	DbNameEnv                    = "DB_NAME"
	DbSSLModeEnv                 = "DB_SSLMODE"

	// JWT & Security keys
	JwtSecretEnv                 = "JWT_SECRET"
	JwtAccessTokenExpiryMinEnv   = "JWT_ACCESS_TOKEN_EXPIRY_MIN"
	JwtRefreshTokenExpiryDaysEnv = "JWT_REFRESH_TOKEN_EXPIRY_DAYS"
	PasswordSecretEnv            = "PASSWORD_SECRET"

	// Redis keys
	RedisHostEnv                 = "REDIS_HOST"
	RedisPortEnv                 = "REDIS_PORT"
	RedisPasswordEnv             = "REDIS_PASSWORD"
	RedisDBEnv                   = "REDIS_DB"

	// Telegram Alert keys
	TelegramBotTokenEnv          = "TELEGRAM_BOT_TOKEN"
	TelegramChatIDEnv            = "TELEGRAM_CHAT_ID"

	// MinIO keys
	MinioEndpointEnv             = "MINIO_ENDPOINT"
	MinioAccessKeyEnv            = "MINIO_ACCESS_KEY"
	MinioSecretKeyEnv            = "MINIO_SECRET_KEY"
	MinioUseSSLEnv               = "MINIO_USE_SSL"
	MinioBucketEnv               = "MINIO_DEFAULT_BUCKET"
	MinioRegionEnv               = "MINIO_REGION"
	MinioPublicURLEnv            = "MINIO_PUBLIC_URL"

	// AWS S3 keys (fallback/alternative)
	S3EndpointEnv                = "S3_ENDPOINT"
	S3AccessKeyEnv               = "S3_ACCESS_KEY"
	S3SecretKeyEnv               = "S3_SECRET_KEY"
	S3UseSSLEnv                  = "S3_USE_SSL"
	S3BucketEnv                  = "S3_DEFAULT_BUCKET"
	S3RegionEnv                  = "S3_REGION"
	S3PublicURLEnv               = "S3_PUBLIC_URL"

	// Storage Driver ("minio", "s3")
	StorageDriverEnv             = "STORAGE_DRIVER"

	// OAuth Social Login keys
	GoogleClientIDEnv        = "GOOGLE_CLIENT_ID"
	GoogleClientSecretEnv    = "GOOGLE_CLIENT_SECRET"
	GithubClientIDEnv        = "GITHUB_CLIENT_ID"
	GithubClientSecretEnv    = "GITHUB_CLIENT_SECRET"
	MicrosoftClientIDEnv     = "MICROSOFT_CLIENT_ID"
	MicrosoftClientSecretEnv = "MICROSOFT_CLIENT_SECRET"
	OAuthRedirectBaseURLEnv  = "OAUTH_REDIRECT_BASE_URL"
)

// LoadEnv loads the environment files depending on the ENV_FILE_PATH variable.
func LoadEnv() {
	envPath := os.Getenv("ENV_FILE_PATH")
	if envPath != "" {
		_ = godotenv.Load(envPath)
	}
	// Always fall back to generic .env if present
	_ = godotenv.Load()
}

// GetEnv retrieves the value of the environment variable named by key.
func GetEnv(key string) string {
	return os.Getenv(key)
}
