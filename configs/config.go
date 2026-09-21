package configs

import (
	"log"
	"strconv"
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

type Config struct {
	Server   ServerConfig
	DB       DatabaseConfig
	Redis    RedisConfig
	Telegram TelegramConfig
	Minio    MinioConfig
	S3       S3Config
	StorageDriver string
	Charset       CharsetConfig
}

var AppConfig *Config

// LoadConfig initializes AppConfig from environment variables.
func LoadConfig() {
	LoadEnv()

	port := GetEnv(PortEnv)
	if port == "" {
		port = "8000"
	}

	env := GetEnv(EnvEnv)
	if env == "" {
		env = "local"
	}

	jwtSecret := GetEnv(JwtSecretEnv)
	if jwtSecret == "" {
		jwtSecret = "humora-development-jwt-secret-super-secure-key-2026"
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
	if passwordSecret == "" {
		passwordSecret = "humora-secret-salt-2026"
	}

	frontendURL := GetEnv(FrontendBaseURLEnv)
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}

	allowedOrigins := GetEnv(AllowedOriginsEnv)
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
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
	if dbPassword == "" {
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
	if minioAccessKey == "" {
		minioAccessKey = "minioadmin"
	}
	minioSecretKey := GetEnv(MinioSecretKeyEnv)
	if minioSecretKey == "" {
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
	if minioPublicURL == "" {
		minioPublicURL = "http://localhost:9000"
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
	}

	log.Printf("[Config] Loaded configuration for env: %s, port: %s, db: %s", env, port, dbName)
}
