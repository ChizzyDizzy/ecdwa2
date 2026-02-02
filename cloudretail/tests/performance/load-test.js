/**
 * Load Testing Script using Artillery
 * Runs comprehensive load tests against the CloudRetail API
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
  artilleryConfigPath: path.join(__dirname, 'artillery.yml'),
  reportDir: path.join(__dirname, 'reports'),
  targetUrl: process.env.API_GATEWAY_URL || 'http://localhost:3000',
};

// Ensure reports directory exists
if (!fs.existsSync(CONFIG.reportDir)) {
  fs.mkdirSync(CONFIG.reportDir, { recursive: true });
}

/**
 * Run Artillery load test
 */
async function runLoadTest() {
  console.log('===================================');
  console.log('CloudRetail Load Test');
  console.log('===================================');
  console.log(`Target URL: ${CONFIG.targetUrl}`);
  console.log(`Artillery Config: ${CONFIG.artilleryConfigPath}`);
  console.log('-----------------------------------\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(CONFIG.reportDir, `load-test-${timestamp}.json`);
  const htmlReportPath = path.join(CONFIG.reportDir, `load-test-${timestamp}.html`);

  return new Promise((resolve, reject) => {
    const artilleryCommand = `artillery run ${CONFIG.artilleryConfigPath} --output ${reportPath}`;

    console.log('Starting load test...\n');

    const artillery = exec(artilleryCommand, {
      env: { ...process.env, TARGET_URL: CONFIG.targetUrl },
    });

    artillery.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    artillery.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    artillery.on('close', (code) => {
      if (code !== 0) {
        console.error(`\nLoad test failed with code ${code}`);
        reject(new Error(`Load test exited with code ${code}`));
        return;
      }

      console.log('\n===================================');
      console.log('Load Test Completed');
      console.log('===================================');
      console.log(`Report saved to: ${reportPath}`);

      // Generate HTML report
      console.log('\nGenerating HTML report...');
      const reportCommand = `artillery report ${reportPath} --output ${htmlReportPath}`;

      exec(reportCommand, (error) => {
        if (error) {
          console.warn('Warning: Could not generate HTML report:', error.message);
        } else {
          console.log(`HTML report saved to: ${htmlReportPath}`);
        }

        // Parse and display summary
        try {
          const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
          displaySummary(report);
          resolve(report);
        } catch (err) {
          console.error('Error reading report:', err.message);
          resolve();
        }
      });
    });
  });
}

/**
 * Display test summary
 */
function displaySummary(report) {
  console.log('\n===================================');
  console.log('Test Summary');
  console.log('===================================');

  const aggregate = report.aggregate;

  if (aggregate) {
    console.log('\nRequests:');
    console.log(`  Total: ${aggregate.counters['http.requests'] || 0}`);
    console.log(`  Successful (2xx, 3xx): ${aggregate.counters['http.codes.200'] || 0}`);
    console.log(`  Client Errors (4xx): ${aggregate.counters['http.codes.400'] || 0}`);
    console.log(`  Server Errors (5xx): ${aggregate.counters['http.codes.500'] || 0}`);

    console.log('\nResponse Times (ms):');
    console.log(`  Min: ${aggregate.histograms['http.response_time']?.min || 'N/A'}`);
    console.log(`  Max: ${aggregate.histograms['http.response_time']?.max || 'N/A'}`);
    console.log(`  Median: ${aggregate.histograms['http.response_time']?.median || 'N/A'}`);
    console.log(`  p95: ${aggregate.histograms['http.response_time']?.p95 || 'N/A'}`);
    console.log(`  p99: ${aggregate.histograms['http.response_time']?.p99 || 'N/A'}`);

    console.log('\nThroughput:');
    console.log(`  Requests/sec: ${aggregate.rates['http.request_rate'] || 'N/A'}`);

    // Calculate error rate
    const totalRequests = aggregate.counters['http.requests'] || 0;
    const errors = (aggregate.counters['http.codes.400'] || 0) +
                   (aggregate.counters['http.codes.500'] || 0);
    const errorRate = totalRequests > 0 ? ((errors / totalRequests) * 100).toFixed(2) : 0;

    console.log('\nError Rate:');
    console.log(`  ${errorRate}%`);

    // Performance assessment
    console.log('\n===================================');
    console.log('Performance Assessment');
    console.log('===================================');

    const p95 = aggregate.histograms['http.response_time']?.p95 || Infinity;
    const p99 = aggregate.histograms['http.response_time']?.p99 || Infinity;

    if (errorRate > 5) {
      console.log('⚠️  WARNING: Error rate exceeds 5%');
    }

    if (p95 > 500) {
      console.log('⚠️  WARNING: p95 response time exceeds 500ms');
    }

    if (p99 > 1000) {
      console.log('⚠️  WARNING: p99 response time exceeds 1000ms');
    }

    if (errorRate <= 1 && p95 <= 500 && p99 <= 1000) {
      console.log('✅ PASSED: All performance thresholds met');
    } else if (errorRate <= 5 && p95 <= 1000 && p99 <= 2000) {
      console.log('⚠️  ACCEPTABLE: Performance within acceptable range');
    } else {
      console.log('❌ FAILED: Performance below acceptable thresholds');
    }
  }

  console.log('\n===================================\n');
}

/**
 * Quick smoke test
 */
async function runSmokeTest() {
  console.log('Running quick smoke test...\n');

  const smokeConfig = {
    target: CONFIG.targetUrl,
    phases: [{ duration: 30, arrivalRate: 5 }],
    scenarios: [
      {
        name: 'Smoke Test',
        flow: [
          { get: { url: '/health' } },
          { get: { url: '/api/products' } },
        ],
      },
    ],
  };

  const configPath = path.join(CONFIG.reportDir, 'smoke-test-config.json');
  fs.writeFileSync(configPath, JSON.stringify(smokeConfig, null, 2));

  return new Promise((resolve, reject) => {
    exec(`artillery run ${configPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Smoke test failed:', error.message);
        reject(error);
      } else {
        console.log(stdout);
        console.log('✅ Smoke test passed\n');
        resolve();
      }
    });
  });
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const testType = args[0] || 'load';

  (async () => {
    try {
      if (testType === 'smoke') {
        await runSmokeTest();
      } else if (testType === 'load') {
        await runLoadTest();
      } else {
        console.error('Unknown test type. Use "smoke" or "load"');
        process.exit(1);
      }
    } catch (error) {
      console.error('Test failed:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = {
  runLoadTest,
  runSmokeTest,
};
