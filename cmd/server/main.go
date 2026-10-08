package main

import (
	"context"
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
	"humora-backend/internal/notify"
	"humora-backend/internal/pulse"
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

	isLocal := configs.AppConfig.IsLocal()

	// 3. Connect to Database. Locally the server may boot without it for health checks;
	// deployed instances must not accept traffic they cannot serve.
	if err := configs.ConnectDB(); err != nil {
		if !isLocal {
			log.Fatalf("PostgreSQL connection failed: %v", err)
		}
		logger.Warn(fmt.Sprintf("Warning: PostgreSQL Database connection deferred: %v", err))
	} else {
		defer configs.DB.Close()
	}

	// 4. Initialize Redis
	if err := configs.InitRedis(); err != nil {
		logger.Warn(fmt.Sprintf("Warning: Redis connection deferred (rate limits fall back to per-instance memory): %v", err))
	} else {
		defer configs.RedisClient.Close()
	}

	// 5. Initialize MinIO Object Storage
	if err := media.Init(); err != nil {
		logger.Warn(fmt.Sprintf("Warning: MinIO Media storage initialization deferred: %v", err))
	}

	// 6. Initialize Fiber App
	app := fiber.New(fiber.Config{
		BodyLimit:       25 << 20, // 25 MB limit
		ReadBufferSize:  4096,     // 4KB optimized connection read buffer
		WriteBufferSize: 4096,     // 4KB optimized connection write buffer
		// Bound slow clients so they cannot hold connections open indefinitely.
		// Pulse WebSockets manage their own deadlines after the upgrade.
		ReadTimeout:           60 * time.Second,
		WriteTimeout:          60 * time.Second,
		IdleTimeout:           120 * time.Second,
		DisableStartupMessage: !isLocal,
		// Behind a load balancer, read the client IP from the proxy header (only from trusted proxies)
		// so rate limits and audit logs see real clients instead of the proxy.
		ProxyHeader:             configs.AppConfig.Server.ProxyHeader,
		EnableTrustedProxyCheck: len(configs.AppConfig.Server.TrustedProxies) > 0,
		TrustedProxies:          configs.AppConfig.Server.TrustedProxies,
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
	identityAuthExt := identity.NewAuthExtService(identityRepo)
	identityHandler := identity.NewHandler(identityService, identityAuthExt)
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

	// Mount Pulse End-to-End Encrypted Messaging
	pulseRepo := pulse.NewRepository(configs.DB)
	pulseHub := pulse.NewHub(pulseRepo)
	// Push notifications (optional): wake offline phones through Firebase Cloud Messaging.
	if sender, err := pulse.NewFCMSenderFromEnv(context.Background()); err != nil {
		logger.Warn(fmt.Sprintf("Pulse push disabled: %v", err))
	} else if sender != nil {
		pulseHub.SetPusher(pulse.NewPusher(pulseRepo, pulseHub, sender))
		logger.Info("Pulse push notifications enabled (FCM)")
	}
	pulseHandler := pulse.NewHandler(pulse.NewService(pulseRepo, pulseHub))
	pulse.RegisterRoutes(apiV1, pulseHandler, pulseHub)

	// In-app notifications (leave decisions, approvals waiting, payslips, assignments ...),
	// with a content-free push to phones when Firebase is configured.
	var notifyPush notify.PushFunc
	if p := pulseHub.Pusher(); p != nil {
		notifyPush = p.UsersNotified
	}
	notify.Init(configs.DB, notifyPush)
	notify.RegisterRoutes(apiV1, notify.NewHandler(configs.DB))

	port := configs.AppConfig.Server.Port
	if port == "" {
		port = "8000"
	}

	// 9. Graceful Shutdown Listener
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	listenErr := make(chan error, 1)
	go func() {
		logger.Info(fmt.Sprintf("Humora HTTP Server listening on port %s...", port))
		listenErr <- app.Listen(fmt.Sprintf(":%s", port))
	}()

	select {
	case <-stopChan:
	case err := <-listenErr:
		// e.g. port already in use: exit non-zero so the orchestrator restarts or alerts.
		log.Fatalf("Server listen error: %v", err)
	}
	logger.Info("Shutting down Humora Server gracefully...")
	// Leave in-flight requests (payroll runs, uploads) time to finish before the orchestrator kills us.
	if err := app.ShutdownWithTimeout(20 * time.Second); err != nil {
		alert.SendCriticalAlertSync("Humora Server forced to terminate", err)
		logger.Error(fmt.Sprintf("Server forced shutdown: %v", err))
	}
	logger.Info("Humora Server exited.")
}
