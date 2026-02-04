import CircuitBreaker from 'opossum';
import { logger } from './logger.middleware';

/**
 * Circuit Breaker Configuration
 */
const circuitBreakerOptions = {
  timeout: 5000, // 5 seconds
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 30000, // 30 seconds before attempting to close circuit
  rollingCountTimeout: 10000, // 10 second rolling window
  rollingCountBuckets: 10, // Number of buckets in rolling window
  name: 'cloudretail-circuit-breaker',
};

/**
 * Create Circuit Breaker for a function
 * Implements fault tolerance with automatic recovery
 */
export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: Partial<typeof circuitBreakerOptions>
): CircuitBreaker<Parameters<T>, ReturnType<T>> {
  const breaker = new CircuitBreaker(fn, { ...circuitBreakerOptions, ...options });

  // Event listeners for monitoring
  breaker.on('open', () => {
    logger.warn('Circuit breaker opened', { name: breaker.name });
  });

  breaker.on('halfOpen', () => {
    logger.info('Circuit breaker half-open', { name: breaker.name });
  });

  breaker.on('close', () => {
    logger.info('Circuit breaker closed', { name: breaker.name });
  });

  breaker.on('failure', (error: Error) => {
    logger.error('Circuit breaker failure', {
      name: breaker.name,
      error: error.message,
    });
  });

  breaker.on('success', () => {
    logger.debug('Circuit breaker success', { name: breaker.name });
  });

  breaker.on('timeout', () => {
    logger.warn('Circuit breaker timeout', { name: breaker.name });
  });

  breaker.on('reject', () => {
    logger.warn('Circuit breaker rejected request', { name: breaker.name });
  });

  return breaker;
}

/**
 * Retry Policy for failed requests
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        logger.info(`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Bulkhead Pattern - Limit concurrent executions
 */
export class Bulkhead {
  private activeRequests = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrent: number) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeRequests >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.activeRequests++;

    try {
      return await fn();
    } finally {
      this.activeRequests--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

/**
 * Health Check for Service
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  details: {
    database?: boolean;
    cache?: boolean;
    eventBus?: boolean;
    [key: string]: any;
  };
}

export class HealthCheck {
  private checks: Map<string, () => Promise<boolean>> = new Map();

  registerCheck(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
  }

  async getStatus(): Promise<HealthStatus> {
    const details: any = {};
    let healthyCount = 0;
    const totalChecks = this.checks.size;

    for (const [name, check] of this.checks) {
      try {
        details[name] = await check();
        if (details[name]) healthyCount++;
      } catch (error) {
        details[name] = false;
        logger.error(`Health check failed for ${name}`, { error });
      }
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalChecks) {
      status = 'healthy';
    } else if (healthyCount > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: new Date(),
      uptime: process.uptime(),
      details,
    };
  }
}
