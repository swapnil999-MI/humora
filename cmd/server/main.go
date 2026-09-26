package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime/debug"
	"syscall"
	"time"

	"humora-backend/configs"
	"humora-backend/internal/fusion"
	"humora-backend/internal/health"
	"humora-backend/internal/hrms"
	"humora-backend/internal/identity"
	"humora-backend/internal/work"
	"humora-backend/pkg/alert"
	"humora-backend/pkg/logger"
	"humora-backend/pkg/media"
	"humora-backend/pkg/middleware"
	"humora-backend/pkg/response"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	// Configure GC soft memory target to pace Go GC smoothly and prevent OOM
	if os.Getenv("GOMEMLIMIT") == "" {
		debug.SetMemoryLimit(512 * 1024 * 1024) // 512 MiB
	}

	// 1. Load Configurations
	configs.LoadConfig()

	// 2. Initialize Structured Logger
	logger.InitLogger()
	logger.Info("Starting Humora Enterprise Platform Backend...")

	// 3. Connect to Database (optional on initial bootstrap so server can boot for health checks)
	if err := configs.ConnectDB(); err != nil {
		logger.Warn(fmt.Sprintf("Warning: PostgreSQL Database connection deferred: %v", err))
	} else {
		defer configs.DB.Close()
	}

	// 4. Initialize Redis
	if err := configs.InitRedis(); err != nil {
		logger.Warn(fmt.Sprintf("Warning: Redis connection deferred: %v", err))
	}

	// 5. Initialize MinIO Object Storage
	if err := media.Init(); err != nil {
		logger.Warn(fmt.Sprintf("Warning: MinIO Media storage initialization deferred: %v", err))
	}

	isLocal := configs.AppConfig.Server.Env == "local" || configs.AppConfig.Server.Env == "test" || configs.AppConfig.Server.Env == ""

	// 6. Initialize Fiber App
	app := fiber.New(fiber.Config{
		BodyLimit:             25 << 20, // 25 MB limit
		ReadBufferSize:        4096,     // 4KB optimized connection read buffer
		WriteBufferSize:       4096,     // 4KB optimized connection write buffer
		DisableStartupMessage: !isLocal,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			if code >= 500 {
				return response.Error(c, code, fmt.Sprintf("Internal server error occurred {{%s}}", err.Error()))
			}
			return response.Error(c, code, err.Error())
		},
	})

	// 7. Mount Global Middlewares
	app.Use(middleware.RecoverMiddleware())
	app.Use(middleware.SecurityHeaders())

	// Configure CORS
	allowedOrigins := configs.AppConfig.Server.AllowedOrigins
	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-CSRF-Token",
		ExposeHeaders:    "Origin, Content-Type, Accept, Authorization, Set-Cookie",
		AllowMethods:     "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS",
		AllowCredentials: true,
	}))

	// Mount structured request logger
	app.Use(middleware.Logger())

	// 8. Register Routes
	health.RegisterRoutes(app)

	// API V1 Base Group
	apiV1 := app.Group("/api/v1")
	apiV1.Get("/ping", func(c *fiber.Ctx) error {
		return response.Success(c, fiber.StatusOK, "Humora Enterprise API v1 active", fiber.Map{
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"env":       configs.AppConfig.Server.Env,
		})
	})

	// Mount Identity & Multi-Tenant Authentication
	identityRepo := identity.NewRepository(configs.DB)
	identityService := identity.NewService(identityRepo)
	identityHandler := identity.NewHandler(identityService)
	identity.RegisterRoutes(apiV1, identityHandler)

	// Mount HRMS Domain
	hrmsRepo := hrms.NewRepository(configs.DB)
	companyService := hrms.NewCompanyService(configs.DB)
	companyHandler := hrms.NewCompanyHandler(companyService)
	hrmsService := hrms.NewService(hrmsRepo)
	hrmsHandler := hrms.NewHandler(hrmsService)
	onboardingService := hrms.NewOnboardingService(configs.DB, hrmsRepo, companyService)
	onboardingHandler := hrms.NewOnboardingHandler(onboardingService)
	payrollRepo := hrms.NewPayrollRepository(configs.DB)
	payrollService := hrms.NewPayrollService(payrollRepo, hrmsRepo, companyService)
	payrollHandler := hrms.NewPayrollHandler(payrollService, hrmsRepo)
	hrms.RegisterRoutes(apiV1, hrmsHandler, onboardingHandler, payrollHandler, companyHandler)

	// Mount Agile Work Management Domain
	workRepo := work.NewRepository(configs.DB)
	workService := work.NewService(workRepo)
	workHandler := work.NewHandler(workService, hrmsRepo)
	work.RegisterRoutes(apiV1, workHandler)

	// Mount Cross-Domain Fusion Copilot
	fusionService := fusion.NewService(configs.DB, hrmsService, hrmsRepo, workService, workRepo)
	fusionHandler := fusion.NewHandler(fusionService)
	fusion.RegisterRoutes(apiV1, fusionHandler)

	port := configs.AppConfig.Server.Port
	if port == "" {
		port = "8000"
	}

	// 9. Graceful Shutdown Listener
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		logger.Info(fmt.Sprintf("Humora HTTP Server listening on port %s...", port))
		if err := app.Listen(fmt.Sprintf(":%s", port)); err != nil {
			log.Printf("Server listen error: %v", err)
		}
	}()

	<-stopChan
	logger.Info("Shutting down Humora Server gracefully...")
	if err := app.ShutdownWithTimeout(5 * time.Second); err != nil {
		alert.SendCriticalAlertSync("Humora Server forced to terminate", err)
		logger.Error(fmt.Sprintf("Server forced shutdown: %v", err))
	}
	logger.Info("Humora Server exited.")
}
