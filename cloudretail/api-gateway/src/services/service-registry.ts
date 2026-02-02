import axios from 'axios';
import { logger, createCircuitBreaker } from '@cloudretail/middleware';

interface Service {
  name: string;
  url: string;
  healthy: boolean;
  lastCheck: Date;
  failureCount: number;
}

/**
 * Service Registry
 * Manages service discovery and health checking
 */
export class ServiceRegistry {
  private services: Map<string, Service> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_FAILURES = 3;

  constructor() {
    this.registerServices();
  }

  /**
   * Register all microservices
   */
  private registerServices(): void {
    const services = [
      {
        name: 'user-service',
        url: process.env.USER_SERVICE_URL || 'http://localhost:3001',
      },
      {
        name: 'product-service',
        url: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
      },
      {
        name: 'order-service',
        url: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
      },
      {
        name: 'inventory-service',
        url: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3004',
      },
      {
        name: 'payment-service',
        url: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005',
      },
    ];

    services.forEach((service) => {
      this.services.set(service.name, {
        ...service,
        healthy: true,
        lastCheck: new Date(),
        failureCount: 0,
      });
    });

    logger.info('Services registered', {
      services: Array.from(this.services.keys()),
    });
  }

  /**
   * Get service URL with load balancing (round-robin)
   * In production, this would implement true load balancing
   */
  getServiceUrl(serviceName: string): string {
    const service = this.services.get(serviceName);

    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    if (!service.healthy) {
      logger.warn('Accessing unhealthy service', { serviceName });
    }

    return service.url;
  }

  /**
   * Get all registered services
   */
  getAllServices(): Service[] {
    return Array.from(this.services.values());
  }

  /**
   * Start periodic health checks for all services
   */
  startHealthChecks(): void {
    logger.info('Starting service health checks');

    // Initial health check
    this.checkAllServices();

    // Periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.checkAllServices();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      logger.info('Service health checks stopped');
    }
  }

  /**
   * Check health of all services
   */
  private async checkAllServices(): Promise<void> {
    const checks = Array.from(this.services.keys()).map((serviceName) =>
      this.checkServiceHealth(serviceName)
    );

    await Promise.all(checks);

    const healthyCount = Array.from(this.services.values()).filter(
      (s) => s.healthy
    ).length;

    logger.info('Health check completed', {
      total: this.services.size,
      healthy: healthyCount,
      unhealthy: this.services.size - healthyCount,
    });
  }

  /**
   * Check health of a specific service
   */
  private async checkServiceHealth(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);

    if (!service) return;

    try {
      // Create circuit breaker for health check
      const healthCheck = createCircuitBreaker(
        async () => {
          const response = await axios.get(`${service.url}/health`, {
            timeout: 5000,
          });
          return response.data;
        },
        { timeout: 5000, name: `${serviceName}-health-check` }
      );

      const result = await healthCheck.fire();

      // Service is healthy
      service.healthy = true;
      service.failureCount = 0;
      service.lastCheck = new Date();

      logger.debug('Service health check passed', {
        serviceName,
        status: result.status,
      });
    } catch (error) {
      service.failureCount++;
      service.lastCheck = new Date();

      if (service.failureCount >= this.MAX_FAILURES) {
        service.healthy = false;

        logger.error('Service marked as unhealthy', {
          serviceName,
          failureCount: service.failureCount,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } else {
        logger.warn('Service health check failed', {
          serviceName,
          failureCount: service.failureCount,
          maxFailures: this.MAX_FAILURES,
        });
      }
    }
  }

  /**
   * Manually mark a service as healthy or unhealthy
   */
  setServiceHealth(serviceName: string, healthy: boolean): void {
    const service = this.services.get(serviceName);

    if (service) {
      service.healthy = healthy;
      service.failureCount = healthy ? 0 : this.MAX_FAILURES;
      logger.info('Service health status updated', { serviceName, healthy });
    }
  }

  /**
   * Get service health status
   */
  getServiceHealth(serviceName: string): boolean {
    const service = this.services.get(serviceName);
    return service ? service.healthy : false;
  }
}
