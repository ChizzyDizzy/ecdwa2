/**
 * Stress Testing Script
 * Tests system behavior under extreme load conditions
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const CONFIG = {
  targetUrl: process.env.API_GATEWAY_URL || 'http://localhost:3000',
  reportDir: path.join(__dirname, 'reports'),
};

// Ensure reports directory exists
if (!fs.existsSync(CONFIG.reportDir)) {
  fs.mkdirSync(CONFIG.reportDir, { recursive: true });
}

/**
 * Generate stress test configuration
 */
function generateStressTestConfig() {
  return {
    config: {
      target: CONFIG.targetUrl,
      phases: [
        // Ramp up to breaking point
        { duration: 60, arrivalRate: 10, rampTo: 100, name: 'Ramp up' },
        { duration: 120, arrivalRate: 100, rampTo: 500, name: 'Increase pressure' },
        { duration: 180, arrivalRate: 500, rampTo: 1000, name: 'Stress test' },
        { duration: 120, arrivalRate: 1000, name: 'Maximum load' },
        { duration: 60, arrivalRate: 1000, rampTo: 0, name: 'Cool down' },
      ],
      http: {
        timeout: 30,
        pool: 100,
      },
      ensure: {
        maxErrorRate: 50, // Allow higher error rate during stress test
      },
    },
    scenarios: [
      {
        name: 'API Gateway Stress',
        weight: 30,
        flow: [
          { get: { url: '/health' } },
        ],
      },
      {
        name: 'Product Service Stress',
        weight: 40,
        flow: [
          { get: { url: '/api/products' } },
          { get: { url: `/api/products/${Math.floor(Math.random() * 1000)}` } },
        ],
      },
      {
        name: 'User Service Stress',
        weight: 30,
        flow: [
          {
            post: {
              url: '/api/users/login',
              json: {
                email: 'stress-test@example.com',
                password: 'TestPassword123!',
              },
            },
          },
        ],
      },
    ],
  };
}

/**
 * Run stress test
 */
async function runStressTest() {
  console.log('===================================');
  console.log('CloudRetail Stress Test');
  console.log('===================================');
  console.log(`Target URL: ${CONFIG.targetUrl}`);
  console.log('WARNING: This will push the system to its limits!');
  console.log('-----------------------------------\n');

  const config = generateStressTestConfig();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const configPath = path.join(CONFIG.reportDir, `stress-test-config-${timestamp}.json`);
  const reportPath = path.join(CONFIG.reportDir, `stress-test-${timestamp}.json`);

  // Save configuration
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log('Test Phases:');
  config.config.phases.forEach((phase, index) => {
    console.log(`  ${index + 1}. ${phase.name}: ${phase.duration}s @ ${phase.arrivalRate}${phase.rampTo ? `->${phase.rampTo}` : ''} req/s`);
  });
  console.log('\nStarting stress test...\n');

  return new Promise((resolve, reject) => {
    const artillery = exec(`artillery run ${configPath} --output ${reportPath}`, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large output
    });

    let lastErrorRate = 0;
    let breakingPoint = null;

    artillery.stdout.on('data', (data) => {
      process.stdout.write(data);

      // Try to detect breaking point
      const errorRateMatch = data.match(/Errors:\s+(\d+)/);
      if (errorRateMatch) {
        const currentErrorRate = parseInt(errorRateMatch[1]);
        if (currentErrorRate > lastErrorRate * 2 && currentErrorRate > 100 && !breakingPoint) {
          breakingPoint = {
            time: new Date().toISOString(),
            errors: currentErrorRate,
          };
          console.log('\n⚠️  Potential breaking point detected!');
        }
        lastErrorRate = currentErrorRate;
      }
    });

    artillery.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    artillery.on('close', (code) => {
      console.log('\n===================================');
      console.log('Stress Test Completed');
      console.log('===================================');

      if (breakingPoint) {
        console.log('\nBreaking Point Analysis:');
        console.log(`  Time: ${breakingPoint.time}`);
        console.log(`  Error count at breaking point: ${breakingPoint.errors}`);
      } else {
        console.log('\n✅ System handled maximum load without breaking!');
      }

      // Read and analyze results
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        analyzeStressTestResults(report);
        resolve(report);
      } catch (err) {
        console.error('Error reading report:', err.message);
        if (code !== 0) {
          reject(new Error(`Stress test exited with code ${code}`));
        } else {
          resolve();
        }
      }
    });
  });
}

/**
 * Analyze stress test results
 */
function analyzeStressTestResults(report) {
  console.log('\n===================================');
  console.log('Stress Test Analysis');
  console.log('===================================');

  const aggregate = report.aggregate;

  if (aggregate) {
    const totalRequests = aggregate.counters['http.requests'] || 0;
    const errors = (aggregate.counters['http.codes.400'] || 0) +
                   (aggregate.counters['http.codes.500'] || 0) +
                   (aggregate.counters['errors.ETIMEDOUT'] || 0) +
                   (aggregate.counters['errors.ECONNREFUSED'] || 0);
    const errorRate = totalRequests > 0 ? ((errors / totalRequests) * 100).toFixed(2) : 0;

    console.log('\nSystem Resilience:');
    console.log(`  Total requests attempted: ${totalRequests}`);
    console.log(`  Successful requests: ${totalRequests - errors}`);
    console.log(`  Failed requests: ${errors}`);
    console.log(`  Overall error rate: ${errorRate}%`);

    console.log('\nResponse Times Under Stress (ms):');
    console.log(`  Min: ${aggregate.histograms['http.response_time']?.min || 'N/A'}`);
    console.log(`  Max: ${aggregate.histograms['http.response_time']?.max || 'N/A'}`);
    console.log(`  Median: ${aggregate.histograms['http.response_time']?.median || 'N/A'}`);
    console.log(`  p95: ${aggregate.histograms['http.response_time']?.p95 || 'N/A'}`);
    console.log(`  p99: ${aggregate.histograms['http.response_time']?.p99 || 'N/A'}`);

    console.log('\nCapacity Assessment:');
    const maxRate = aggregate.rates['http.request_rate'] || 0;
    console.log(`  Peak request rate achieved: ${maxRate.toFixed(2)} req/s`);

    if (errorRate < 10) {
      console.log('  ✅ Excellent: System maintained stability under extreme load');
    } else if (errorRate < 30) {
      console.log('  ⚠️  Good: System degraded gracefully under stress');
    } else if (errorRate < 50) {
      console.log('  ⚠️  Fair: System struggled under maximum load');
    } else {
      console.log('  ❌ Poor: System failed under stress');
    }

    console.log('\nRecommendations:');
    if (errorRate > 30) {
      console.log('  - Consider horizontal scaling to handle peak load');
      console.log('  - Implement circuit breakers to prevent cascade failures');
      console.log('  - Review and optimize slow database queries');
      console.log('  - Increase resource limits (CPU, memory, connections)');
    }

    const p99 = aggregate.histograms['http.response_time']?.p99 || 0;
    if (p99 > 5000) {
      console.log('  - Response times degrade significantly under load');
      console.log('  - Implement caching for frequently accessed data');
      console.log('  - Consider asynchronous processing for heavy operations');
    }
  }

  console.log('\n===================================\n');
}

/**
 * Spike test - sudden traffic spike
 */
async function runSpikeTest() {
  console.log('===================================');
  console.log('CloudRetail Spike Test');
  console.log('===================================\n');

  const config = {
    config: {
      target: CONFIG.targetUrl,
      phases: [
        { duration: 30, arrivalRate: 10, name: 'Normal load' },
        { duration: 60, arrivalRate: 500, name: 'Sudden spike' },
        { duration: 30, arrivalRate: 10, name: 'Back to normal' },
      ],
    },
    scenarios: [
      {
        flow: [
          { get: { url: '/api/products' } },
        ],
      },
    ],
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const configPath = path.join(CONFIG.reportDir, `spike-test-config-${timestamp}.json`);

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  return new Promise((resolve, reject) => {
    exec(`artillery run ${configPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Spike test failed:', error.message);
        reject(error);
      } else {
        console.log(stdout);
        console.log('✅ Spike test completed\n');
        resolve();
      }
    });
  });
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const testType = args[0] || 'stress';

  (async () => {
    try {
      if (testType === 'spike') {
        await runSpikeTest();
      } else {
        await runStressTest();
      }
    } catch (error) {
      console.error('Test failed:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = {
  runStressTest,
  runSpikeTest,
};
