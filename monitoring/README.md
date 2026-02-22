# Verinode Monitoring System

## Overview

This directory contains the complete monitoring infrastructure for the Verinode platform, providing comprehensive observability across all system components including backend services, databases, smart contracts, and blockchain operations.

## Architecture

The monitoring stack consists of:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboarding
- **Loki**: Log aggregation and search
- **Alertmanager**: Alert routing and notifications
- **Node Exporter**: System metrics collection
- **Contract Monitor**: Smart contract event monitoring
- **Various Exporters**: Database and service-specific metrics

## Components

### 1. Infrastructure Configuration
- `prometheus/config.yml` - Prometheus server configuration
- `prometheus/rules.yml` - Alerting rules and thresholds
- `grafana/dashboards/` - Pre-built monitoring dashboards
- `loki/config.yml` - Log aggregation configuration
- `alertmanager/config.yml` - Alert routing and notification rules
- `promtail/config.yml` - Log shipping configuration

### 2. Backend Services
- `src/services/monitoringService.ts` - Core system metrics collection
- `src/middleware/logging.ts` - HTTP request/response logging
- `src/utils/metricsCollector.ts` - Application metrics instrumentation

### 3. Smart Contract Monitoring
- `scripts/contract-monitor.js` - Stellar/Soroban contract event monitoring
- `monitoring/contract-metrics.yml` - Contract monitoring configuration

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 16+
- Access to Stellar testnet/mainnet

### 1. Environment Setup
```bash
# Copy environment file
cp .env.example .env

# Edit environment variables
# Set your SMTP credentials for email alerts
# Set database credentials
# Configure network settings
```

### 2. Start Monitoring Stack
```bash
# Start the monitoring infrastructure
docker-compose -f docker-compose.monitoring.yml up -d

# Start the main application with monitoring
docker-compose up -d
```

### 3. Access Monitoring Interfaces
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Loki**: http://localhost:3100

## Dashboards

### System Overview
- CPU, memory, disk usage
- Network I/O statistics
- System load and uptime
- Process information

### Application Metrics
- HTTP request rates and response times
- Error rates and success percentages
- Database query performance
- Proof issuance and verification metrics

### Database Monitoring
- Connection pool statistics
- Query performance metrics
- Database size and growth
- Index usage efficiency

### Smart Contract Monitoring
- Contract invocation rates
- Transaction success/failure rates
- Gas usage statistics
- Event emission tracking
- Blockchain synchronization status

## Alerting

### Alert Types
- **System Health**: CPU/memory/disk thresholds
- **Application Performance**: Response time degradation, error spikes
- **Database Issues**: Connection problems, slow queries
- **Blockchain**: Node sync issues, transaction failures
- **Business Metrics**: Low user activity, proof verification failures

### Notification Channels
- Email notifications
- Slack webhook integration
- PagerDuty escalation
- Webhook endpoints

## Log Management

### Log Categories
- **Application Logs**: HTTP requests, business operations
- **Security Logs**: Authentication attempts, access control
- **Error Logs**: Application errors and exceptions
- **Audit Logs**: Compliance-related activities
- **Contract Logs**: Smart contract events and invocations

### Log Retention
- Default retention: 30 days
- Configurable per log type
- Automatic log rotation and compression

## Smart Contract Monitoring

### Features
- Real-time contract event monitoring
- Transaction success/failure tracking
- Gas usage analysis
- Contract state change detection
- Custom event alerting

### Configuration
Edit `monitoring/contract-metrics.yml` to:
- Add/remove contract addresses
- Configure event monitoring
- Set alert thresholds
- Define custom metrics

### Running Contract Monitor
```bash
# Run as standalone service
node scripts/contract-monitor.js

# Or via Docker
docker-compose -f docker-compose.monitoring.yml up contract-monitor
```

## Customization

### Adding New Metrics
1. Define metrics in `src/utils/metricsCollector.ts`
2. Update Prometheus configuration if needed
3. Add panels to appropriate Grafana dashboards

### Creating Custom Dashboards
1. Access Grafana at http://localhost:3000
2. Navigate to "Create" → "Dashboard"
3. Add panels using PromQL queries
4. Save dashboard to `monitoring/grafana/dashboards/`

### Modifying Alert Rules
1. Edit `monitoring/prometheus/rules.yml`
2. Update thresholds and conditions
3. Reload Prometheus configuration:
   ```bash
   curl -X POST http://localhost:9090/-/reload
   ```

## Security Considerations

### Access Control
- Grafana admin credentials should be changed
- Enable authentication for metrics endpoints
- Restrict access to monitoring interfaces
- Use HTTPS in production

### Data Protection
- Logs contain sensitive information
- Implement proper log filtering
- Encrypt data at rest and in transit
- Regular security audits

## Troubleshooting

### Common Issues

**Prometheus not scraping targets:**
- Check target status in Prometheus UI
- Verify network connectivity
- Review Prometheus logs

**Grafana dashboards not loading:**
- Check data source configuration
- Verify Prometheus is accessible
- Review Grafana logs

**Alerts not firing:**
- Test alert rules in Prometheus
- Check Alertmanager configuration
- Verify notification channels

**Logs not appearing in Loki:**
- Check Promtail configuration
- Verify log file paths
- Review Loki ingestion logs

### Health Checks
```bash
# Check Prometheus
curl http://localhost:9090/-/healthy

# Check Grafana
curl http://localhost:3000/api/health

# Check Loki
curl http://localhost:3100/ready

# Check Alertmanager
curl http://localhost:9093/-/healthy
```

## Performance Optimization

### Resource Usage
- Monitor container resource consumption
- Adjust retention policies based on storage
- Optimize scrape intervals for high-frequency metrics
- Use recording rules for expensive queries

### Scaling Considerations
- For high-traffic applications, consider:
  - Prometheus federation
  - Remote storage integration
  - Load balancing for Grafana
  - Distributed Loki setup

## Maintenance

### Regular Tasks
- Monitor disk space usage
- Review and rotate old logs
- Update monitoring stack components
- Test alerting configurations
- Review dashboard performance

### Backup Strategy
- Regular backup of Grafana dashboards
- Prometheus configuration backup
- Alertmanager configuration backup
- Loki data retention policies

## Contributing

### Adding New Monitoring Features
1. Create feature branch
2. Implement monitoring components
3. Add appropriate tests
4. Update documentation
5. Submit pull request

### Monitoring Best Practices
- Use meaningful metric names
- Include appropriate labels
- Set realistic alert thresholds
- Document dashboard purposes
- Regular monitoring review

## Support

For issues and questions:
- Check the troubleshooting section above
- Review logs in `logs/` directory
- Consult component documentation
- Open GitHub issues for bugs