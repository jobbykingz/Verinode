#!/usr/bin/env node

// Monitoring System Test Script
// Tests all monitoring components to ensure they're working correctly

const { monitoringService } = require('./src/services/monitoringService');
const { metricsCollector } = require('./src/utils/metricsCollector');
const { WinstonLogger } = require('./src/utils/logger');

async function runTests() {
  console.log('🧪 Starting Monitoring System Tests...\n');
  
  const logger = new WinstonLogger();
  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Monitoring Service
  console.log('1. Testing Monitoring Service...');
  totalTests++;
  try {
    const systemMetrics = monitoringService.getSystemMetrics();
    const appMetrics = monitoringService.getApplicationMetrics();
    
    console.log('   ✅ System metrics collected:', Object.keys(systemMetrics).length, 'categories');
    console.log('   ✅ Application metrics collected:', Object.keys(appMetrics).length, 'categories');
    passedTests++;
  } catch (error) {
    console.log('   ❌ Monitoring Service test failed:', error.message);
  }

  // Test 2: Metrics Collector
  console.log('\n2. Testing Metrics Collector...');
  totalTests++;
  try {
    // Record some test metrics
    metricsCollector.recordHttpRequest('GET', '/test', 200, 50);
    metricsCollector.incrementHttpRequestsInFlight();
    metricsCollector.decrementHttpRequestsInFlight();
    metricsCollector.recordDatabaseQuery('find', 'users', 10);
    metricsCollector.setDatabaseConnections(5);
    metricsCollector.recordBlockchainTransaction('payment', true, 200);
    metricsCollector.recordContractInvocation('proof-contract', 'verify', true);
    metricsCollector.recordProofIssuance('document');
    metricsCollector.recordProofVerification('document', true, 150);
    metricsCollector.recordUserActivity('login', 'regular');
    metricsCollector.setActiveUsers(10);
    metricsCollector.collectProcessMetrics();
    
    const metrics = await metricsCollector.getMetrics();
    console.log('   ✅ Metrics collected successfully');
    console.log('   ✅ Metrics size:', metrics.length, 'characters');
    passedTests++;
  } catch (error) {
    console.log('   ❌ Metrics Collector test failed:', error.message);
  }

  // Test 3: Prometheus Metrics Format
  console.log('\n3. Testing Prometheus Metrics Format...');
  totalTests++;
  try {
    const prometheusMetrics = monitoringService.getPrometheusMetrics();
    const hasHelp = prometheusMetrics.includes('# HELP');
    const hasType = prometheusMetrics.includes('# TYPE');
    const hasMetrics = prometheusMetrics.includes(' ');
    
    if (hasHelp && hasType && hasMetrics) {
      console.log('   ✅ Prometheus metrics format is correct');
      passedTests++;
    } else {
      console.log('   ❌ Prometheus metrics format is incorrect');
    }
  } catch (error) {
    console.log('   ❌ Prometheus metrics test failed:', error.message);
  }

  // Test 4: Logger Functionality
  console.log('\n4. Testing Logger...');
  totalTests++;
  try {
    logger.info('Test info message', { test: true });
    logger.warn('Test warning message', { warning: true });
    logger.error('Test error message', new Error('Test error'));
    logger.debug('Test debug message', { debug: true });
    console.log('   ✅ Logger working correctly');
    passedTests++;
  } catch (error) {
    console.log('   ❌ Logger test failed:', error.message);
  }

  // Test 5: System Metrics Collection
  console.log('\n5. Testing System Metrics Collection...');
  totalTests++;
  try {
    const metrics = monitoringService.getSystemMetrics();
    const requiredFields = ['cpu', 'memory', 'disk', 'network', 'uptime'];
    const hasAllFields = requiredFields.every(field => field in metrics);
    
    if (hasAllFields) {
      console.log('   ✅ System metrics structure is correct');
      console.log('   ✅ CPU usage:', metrics.cpu.usage.toFixed(2) + '%');
      console.log('   ✅ Memory usage:', metrics.memory.usage.toFixed(2) + '%');
      console.log('   ✅ Uptime:', Math.floor(metrics.uptime / 60), 'minutes');
      passedTests++;
    } else {
      console.log('   ❌ System metrics missing required fields');
    }
  } catch (error) {
    console.log('   ❌ System metrics test failed:', error.message);
  }

  // Test 6: Application Metrics
  console.log('\n6. Testing Application Metrics...');
  totalTests++;
  try {
    const metrics = monitoringService.getApplicationMetrics();
    const httpMetrics = metrics.http.requests;
    const proofMetrics = metrics.proof;
    
    console.log('   ✅ HTTP metrics available');
    console.log('   ✅ Proof metrics available');
    console.log('   ✅ Total HTTP requests:', httpMetrics.total);
    console.log('   ✅ Proofs issued:', proofMetrics.issued);
    passedTests++;
  } catch (error) {
    console.log('   ❌ Application metrics test failed:', error.message);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests} tests`);
  console.log(`🎯 Success Rate: ${((passedTests/totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Monitoring system is ready.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});