package configs

import (
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"
)

var (
	AlphabeticChars          = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
	SpecialChars             = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~\\"
	AlphaSpecialChars        = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+-=[]{}|;':\",./<>?`~\\"
	AlphaNumericChars        = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	AlphaNumericSpecialChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;':\",./<>?`~\\"
)

type ServerConfig struct {
	Port                  string
	Env                   string
	JWTSecret             string
	JWTAccessTokenExpiry  time.Duration
	JWTRefreshTokenExpiry time.Duration
	PasswordSecret        string
	FrontendBaseURL       string
	AllowedOrigins        string
	CookieDomain          string
	LogLevel              string
	// ProxyHeader names the header carrying the real client IP (e.g. X-Forwarded-For)
	// when the server runs behind a reverse proxy. Empty means use the socket address.
	ProxyHeader    string
	TrustedProxies []string
	// PublicSignup lets anyone create a new organization (and become its superadmin)
	// after the first one exists. Off by default outside local/test.
	PublicSignup bool
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       string
}

type TelegramConfig struct {
	BotToken    string
	ChatID      string
	CooldownMin int
}

type MinioConfig struct {
	Endpoint        string
	AccessKeyID     string
	SecretAccessKey string
	UseSSL          bool
	DefaultBucket   string
	Region          string
	PublicURL       string
}

type S3Config struct {
	Endpoint        string
	AccessKeyID     string
	SecretAccessKey string
	UseSSL          bool
	DefaultBucket   string
	Region          string
	PublicURL       string
}

type CharsetConfig struct {
	Alphabetic          string
	Special             string
	AlphaSpecial        string
	AlphaNumeric        string
	AlphaNumericSpecial string
}

type OAuthConfig struct {
	GoogleClientID        string
	GoogleClientSecret    string
	GithubClientID        string
	GithubClientSecret    string
	MicrosoftClientID     string
	MicrosoftClientSecret string
	RedirectBaseURL       string
}

type Config struct {
	Server        ServerConfig
	DB            DatabaseConfig
	Redis         RedisConfig
	Telegram      TelegramConfig
	Minio         MinioConfig
	S3            S3Config
	StorageDriver string
	Charset       CharsetConfig
	OAuth         OAuthConfig
}

var AppConfig *Config

// LoadConfig initializes AppConfig from environment variables.
func LoadConfig() {
	LoadEnv()

	port := GetEnv(PortEnv)
	if port == "" {
		port = "8000"
	}

	// A missing ENV must not silently enable development secrets on a server:
	// treat it as production so the strict checks below run. Developers set ENV=local.
	env := GetEnv(EnvEnv)
	if env == "" {
		env = "production"
	}
	local := isLocalEnv(env)

	jwtSecret := GetEnv(JwtSecretEnv)
	if jwtSecret == "" && local {
		jwtSecret = devJWTSecret
	}

	accessExpiryStr := GetEnv(JwtAccessTokenExpiryMinEnv)
	accessExpiryMin, err := strconv.Atoi(accessExpiryStr)
	if err != nil || accessExpiryMin <= 0 {
		accessExpiryMin = 60 // 1 hour default
	}

	refreshExpiryStr := GetEnv(JwtRefreshTokenExpiryDaysEnv)
	refreshExpiryDays, err := strconv.Atoi(refreshExpiryStr)
	if err != nil || refreshExpiryDays <= 0 {
		refreshExpiryDays = 30 // 30 days default
	}

	passwordSecret := GetEnv(PasswordSecretEnv)
	if passwordSecret == "" && local {
		passwordSecret = DevPasswordSecret
	}

	frontendURL := GetEnv(FrontendBaseURLEnv)
	if frontendURL == "" && local {
		frontendURL = "http://192.168.1.50:3000"
	}

	allowedOrigins := GetEnv(AllowedOriginsEnv)
	if allowedOrigins == "" && local {
		allowedOrigins = "http://192.168.1.50:3000,http://192.168.1.50:5173,http://192.168.1.50:8090,http://192.168.1.50:8000,http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
	}

	cookieDomain := GetEnv(CookieDomainEnv)
	logLevel := GetEnv(LogLevelEnv)
	if logLevel == "" {
		logLevel = "info"
	}

	dbHost := GetEnv(DbHostEnv)
	if dbHost == "" {
		dbHost = "127.0.0.1"
	}
	dbPort := GetEnv(DbPortEnv)
	if dbPort == "" {
		dbPort = "5432"
	}
	dbUser := GetEnv(DbUserEnv)
	if dbUser == "" {
		dbUser = "postgres"
	}
	dbPassword := GetEnv(DbPasswordEnv)
	if dbPassword == "" && local {
		dbPassword = "postgres_humora_password"
	}
	dbName := GetEnv(DbNameEnv)
	if dbName == "" {
		dbName = "humora_local"
	}
	dbSSLMode := GetEnv(DbSSLModeEnv)
	if dbSSLMode == "" {
		dbSSLMode = "disable"
	}

	redisHost := GetEnv(RedisHostEnv)
	if redisHost == "" {
		redisHost = "127.0.0.1"
	}
	redisPort := GetEnv(RedisPortEnv)
	if redisPort == "" {
		redisPort = "6379"
	}
	redisPassword := GetEnv(RedisPasswordEnv)
	redisDB := GetEnv(RedisDBEnv)
	if redisDB == "" {
		redisDB = "0"
	}

	// MinIO
	minioEndpoint := GetEnv(MinioEndpointEnv)
	if minioEndpoint == "" {
		minioEndpoint = "127.0.0.1:9000"
	}
	minioAccessKey := GetEnv(MinioAccessKeyEnv)
	if minioAccessKey == "" && local {
		minioAccessKey = "minioadmin"
	}
	minioSecretKey := GetEnv(MinioSecretKeyEnv)
	if minioSecretKey == "" && local {
		minioSecretKey = "minioadmin"
	}
	minioUseSSL, _ := strconv.ParseBool(GetEnv(MinioUseSSLEnv))
	minioBucket := GetEnv(MinioBucketEnv)
	if minioBucket == "" {
		minioBucket = "humora-media"
	}
	minioRegion := GetEnv(MinioRegionEnv)
	if minioRegion == "" {
		minioRegion = "us-east-1"
	}
	minioPublicURL := GetEnv(MinioPublicURLEnv)
	if minioPublicURL == "" && local {
		minioPublicURL = "http://192.168.1.50:9000"
	}

	storageDriver := GetEnv(StorageDriverEnv)
	if storageDriver == "" {
		storageDriver = "minio"
	}

	AppConfig = &Config{
		Server: ServerConfig{
			Port:                  port,
			Env:                   env,
			JWTSecret:             jwtSecret,
			JWTAccessTokenExpiry:  time.Duration(accessExpiryMin) * time.Minute,
			JWTRefreshTokenExpiry: time.Duration(refreshExpiryDays) * 24 * time.Hour,
			PasswordSecret:        passwordSecret,
			FrontendBaseURL:       frontendURL,
			AllowedOrigins:        allowedOrigins,
			CookieDomain:          cookieDomain,
			LogLevel:              logLevel,
			ProxyHeader:           GetEnv(ProxyHeaderEnv),
			TrustedProxies:        splitCSV(GetEnv(TrustedProxiesEnv)),
			PublicSignup:          GetEnv(PublicSignupEnv) == "true",
		},
		DB: DatabaseConfig{
			Host:     dbHost,
			Port:     dbPort,
			User:     dbUser,
			Password: dbPassword,
			Name:     dbName,
			SSLMode:  dbSSLMode,
		},
		Redis: RedisConfig{
			Host:     redisHost,
			Port:     redisPort,
			Password: redisPassword,
			DB:       redisDB,
		},
		Telegram: TelegramConfig{
			BotToken:    GetEnv(TelegramBotTokenEnv),
			ChatID:      GetEnv(TelegramChatIDEnv),
			CooldownMin: 30,
		},
		Minio: MinioConfig{
			Endpoint:        minioEndpoint,
			AccessKeyID:     minioAccessKey,
			SecretAccessKey: minioSecretKey,
			UseSSL:          minioUseSSL,
			DefaultBucket:   minioBucket,
			Region:          minioRegion,
			PublicURL:       minioPublicURL,
		},
		S3: S3Config{
			Endpoint:        GetEnv(S3EndpointEnv),
			AccessKeyID:     GetEnv(S3AccessKeyEnv),
			SecretAccessKey: GetEnv(S3SecretKeyEnv),
			UseSSL:          false,
			DefaultBucket:   minioBucket,
			Region:          "us-east-1",
			PublicURL:       GetEnv(S3PublicURLEnv),
		},
		StorageDriver: storageDriver,
		Charset: CharsetConfig{
			Alphabetic:          AlphabeticChars,
			Special:             SpecialChars,
			AlphaSpecial:        AlphaSpecialChars,
			AlphaNumeric:        AlphaNumericChars,
			AlphaNumericSpecial: AlphaNumericSpecialChars,
		},
		OAuth: OAuthConfig{
			GoogleClientID:        GetEnv(GoogleClientIDEnv),
			GoogleClientSecret:    GetEnv(GoogleClientSecretEnv),
			GithubClientID:        GetEnv(GithubClientIDEnv),
			GithubClientSecret:    GetEnv(GithubClientSecretEnv),
			MicrosoftClientID:     GetEnv(MicrosoftClientIDEnv),
			MicrosoftClientSecret: GetEnv(MicrosoftClientSecretEnv),
			RedirectBaseURL:       GetEnv(OAuthRedirectBaseURLEnv),
		},
	}

	if !local {
		if errs := AppConfig.validate(); len(errs) > 0 {
			log.Fatalf("[Config] Refusing to start in %q environment with unsafe configuration:\n  - %s", env, strings.Join(errs, "\n  - "))
		}
	}

	log.Printf("[Config] Loaded configuration for env: %s, port: %s, db: %s", env, port, dbName)
}

const (
	devJWTSecret = "humora-development-jwt-secret-super-secure-key-2026"
	// DevPasswordSecret is the at-rest encryption secret used only in local/test environments.
	DevPasswordSecret = "humora-secret-salt-2026"
)

// isLocalEnv reports whether env is a developer environment where insecure defaults are allowed.
func isLocalEnv(env string) bool {
	return env == "local" || env == "test"
}

// IsLocal reports whether the server runs in a developer environment (local or test).
func (c *Config) IsLocal() bool {
	return isLocalEnv(c.Server.Env)
}

// validate returns every configuration problem that makes a deployed environment unsafe.
func (c *Config) validate() []string {
	var errs []string
	s := c.Server
	switch {
	case s.JWTSecret == "":
		errs = append(errs, "JWT_SECRET is required")
	case len(s.JWTSecret) < 32 || s.JWTSecret == devJWTSecret || strings.Contains(s.JWTSecret, "change-in-production"):
		errs = append(errs, "JWT_SECRET must be a random value of at least 32 characters (e.g. `openssl rand -base64 48`)")
	}
	if s.PasswordSecret == "" || s.PasswordSecret == DevPasswordSecret || s.PasswordSecret == "your-secret-salt-key" {
		errs = append(errs, "PASSWORD_SECRET is required and must not be a default value (it encrypts stored SMTP/identity secrets)")
	}
	if s.FrontendBaseURL == "" {
		errs = append(errs, "FRONTEND_BASE_URL is required (used in emailed links)")
	}
	if s.AllowedOrigins == "" {
		errs = append(errs, "ALLOWED_ORIGINS is required")
	} else if strings.Contains(s.AllowedOrigins, "*") {
		errs = append(errs, "ALLOWED_ORIGINS must not contain a wildcard because credentials are allowed")
	}
	if c.DB.Password == "" {
		errs = append(errs, "DB_PASSWORD is required")
	}
	if c.StorageDriver == "minio" && (c.Minio.AccessKeyID == "" || c.Minio.SecretAccessKey == "" || c.Minio.SecretAccessKey == "minioadmin") {
		errs = append(errs, "MINIO_ACCESS_KEY and MINIO_SECRET_KEY are required and must not be minioadmin")
	}
	o := c.OAuth
	if (o.GoogleClientID != "" || o.GithubClientID != "" || o.MicrosoftClientID != "") && o.RedirectBaseURL == "" {
		errs = append(errs, "OAUTH_REDIRECT_BASE_URL is required when an OAuth provider is configured")
	}
	// Test-only switches that disable anti-spoofing or write raw face images to disk.
	for _, name := range []string{"SKIP_LIVENESS_CHECK", "SKIP_FACE_PRESENCE_CHECK", "BIOMETRIC_DEBUG_DUMP"} {
		if GetEnv(name) == "true" {
			errs = append(errs, name+" is only allowed with ENV=local or ENV=test")
		}
	}
	if s.ProxyHeader != "" && len(s.TrustedProxies) == 0 {
		errs = append(errs, "TRUSTED_PROXIES is required when PROXY_HEADER is set, otherwise clients can spoof their IP")
	}
	return errs
}

func splitCSV(v string) []string {
	var out []string
	for _, part := range strings.Split(v, ",") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}

// String hides secrets when the config is printed.
func (c *Config) String() string {
	return fmt.Sprintf("Config{env=%s port=%s db=%s@%s/%s}", c.Server.Env, c.Server.Port, c.DB.User, c.DB.Host, c.DB.Name)
}
