#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class IPFSSetup {
  constructor() {
    this.configPath = path.join(__dirname, '../config/ipfsConfig.js');
    this.ipfsConfigDir = path.join(__dirname, '../config/ipfs-config');
    this.ipfsClusterConfigDir = path.join(__dirname, '../config/ipfs-cluster');
    this.dockerComposePath = path.join(__dirname, '../docker-compose.yml');
    this.envExamplePath = path.join(__dirname, '../.env.example');
    
    this.setupSteps = [
      'validateEnvironment',
      'createDirectories',
      'generateIPFSConfig',
      'generateClusterConfig',
      'updateEnvironment',
      'setupDockerCompose',
      'createInitScripts',
      'verifySetup'
    ];
  }

  async run() {
    console.log('🚀 Starting IPFS setup for Verinode...\n');
    
    try {
      for (const step of this.setupSteps) {
        console.log(`📋 Executing: ${step}`);
        await this[step]();
        console.log(`✅ Completed: ${step}\n`);
      }
      
      console.log('🎉 IPFS setup completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('1. Review the generated configuration files');
      console.log('2. Update your .env file with the required environment variables');
      console.log('3. Run: docker-compose up -d');
      console.log('4. Verify IPFS is running: curl http://localhost:5001/api/v0/version');
      
    } catch (error) {
      console.error(`❌ Setup failed: ${error.message}`);
      process.exit(1);
    }
  }

  async validateEnvironment() {
    console.log('  🔍 Validating environment...');
    
    // Check required dependencies
    const requiredCommands = ['docker', 'docker-compose'];
    for (const cmd of requiredCommands) {
      try {
        execSync(`${cmd} --version`, { stdio: 'pipe' });
      } catch (error) {
        throw new Error(`${cmd} is not installed or not in PATH`);
      }
    }
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 16) {
      throw new Error(`Node.js version ${nodeVersion} is not supported. Please use Node.js 16 or higher.`);
    }
    
    console.log('  ✅ Environment validation passed');
  }

  async createDirectories() {
    console.log('  📁 Creating directories...');
    
    const directories = [
      this.ipfsConfigDir,
      this.ipfsClusterConfigDir,
      path.join(__dirname, '../logs'),
      path.join(__dirname, '../data/ipfs'),
      path.join(__dirname, '../data/ipfs-cluster')
    ];
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`    Created: ${dir}`);
      }
    }
  }

  async generateIPFSConfig() {
    console.log('  ⚙️  Generating IPFS configuration...');
    
    const ipfsConfig = {
      API: {
        HTTPHeaders: {
          'Access-Control-Allow-Origin': ['*'],
          'Access-Control-Allow-Methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
        }
      },
      Addresses: {
        Swarm: [
          '/ip4/0.0.0.0/tcp/4001',
          '/ip4/0.0.0.0/udp/4001/quic',
          '/ip6/::/tcp/4001',
          '/ip6/::/udp/4001/quic'
        ],
        API: '/ip4/0.0.0.0/tcp/5001',
        Gateway: '/ip4/0.0.0.0/tcp/8080'
      },
      Datastore: {
        StorageMax: '10GB',
        GCPeriod: '1h'
      },
      Swarm: {
        ConnMgr: {
          HighWater: 1000,
          LowWater: 100,
          GracePeriod: '20s'
        }
      },
      Gateway: {
        HTTPHeaders: {
          'Access-Control-Allow-Origin': ['*'],
          'Access-Control-Allow-Methods': ['GET', 'HEAD', 'OPTIONS']
        }
      },
      Discovery: {
        MDNS: {
          Enabled: true,
          Interval: '10s'
        }
      },
      Experimental: {
        FilestoreEnabled: false,
        UrlstoreEnabled: false,
        ShardingEnabled: false
      }
    };
    
    const configPath = path.join(this.ipfsConfigDir, 'config');
    fs.writeFileSync(configPath, JSON.stringify(ipfsConfig, null, 2));
    console.log(`    Generated: ${configPath}`);
  }

  async generateClusterConfig() {
    console.log('  🔗 Generating IPFS Cluster configuration...');
    
    const clusterSecret = this.generateClusterSecret();
    
    const clusterConfig = {
      cluster: {
        listen_multiaddress: '/ip4/0.0.0.0/tcp/9094',
        secret: clusterSecret,
        peername: 'verinode-cluster',
        bootstrap: [],
        leave_on_shutdown: false,
        enable_relay_hop: false,
        sync_removal_delay: '1m',
        state_sync_interval: '1m',
        pin_recover_interval: '12h',
        monitor_ping_interval: '15s',
        peer_watch_interval: '5s'
      },
      consensus: {
        crdt: {
          cluster_name: 'verinode',
          trusted_peers: []
        }
      },
      datastore: {
        type: 'badger',
        badger: {
          dir: '/data/ipfs-cluster/datastore'
        }
      },
      ipfs_connector: {
        ipfshttp: {
          node_multiaddress: '/dns4/ipfs/tcp/5001',
          connect_swarms_delay: '30s',
          pin_timeout: '10m',
          unpin_timeout: '10m'
        }
      },
      pintracker: {
        max_parallel_pins: 10,
        pin_recover_interval: '12h'
      },
      informer: {
        disk_interval: '30s',
        pin_interval: '30s'
      },
      measurements: {
        base_metric_ttl: '30m',
        recent_metric_ttl: '10m'
      },
      restapi: {
        http_listen_multiaddress: '/ip4/0.0.0.0/tcp/9094',
        read_timeout: '1m',
        write_timeout: '1m',
        max_header_size: 1048576,
        cors_allowed_origins: ['*'],
        cors_allowed_methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        cors_allowed_headers: ['Content-Type', 'User-Agent']
      },
      ipfsproxy: {
        listen_multiaddress: '/ip4/0.0.0.0/tcp/9095',
        node_multiaddress: '/dns4/ipfs/tcp/5001'
      }
    };
    
    const configPath = path.join(this.ipfsClusterConfigDir, 'service.json');
    fs.writeFileSync(configPath, JSON.stringify(clusterConfig, null, 2));
    console.log(`    Generated: ${configPath}`);
    
    // Save cluster secret to .env
    await this.updateEnvFile('IPFS_CLUSTER_SECRET', clusterSecret);
  }

  generateClusterSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  async updateEnvironment() {
    console.log('  🌍 Updating environment configuration...');
    
    const envVariables = {
      'IPFS_HOST': 'ipfs',
      'IPFS_PORT': '5001',
      'IPFS_PROTOCOL': 'http',
      'IPFS_GATEWAY_PORT': '8080',
      'IPFS_GATEWAY_HOST': '0.0.0.0',
      'IPFS_GATEWAY_CORS': 'true',
      'IPFS_GATEWAY_CACHE': 'true',
      'IPFS_GATEWAY_RATE_LIMIT': 'true',
      'IPFS_GATEWAY_MAX_SIZE': '104857600', // 100MB
      'PINNING_AUTO_CRITICAL': 'true',
      'PINNING_BACKUP_ENABLED': 'false',
      'IPNS_AUTO_REFRESH': 'false',
      'VERIFICATION_ALGORITHM': 'SHA256',
      'VERIFICATION_TIMEOUT': '30000',
      'VERIFICATION_MAX_RETRIES': '3',
      'IPFS_METRICS_ENABLED': 'true',
      'IPFS_LOG_LEVEL': 'info'
    };
    
    for (const [key, value] of Object.entries(envVariables)) {
      await this.updateEnvFile(key, value);
    }
  }

  async updateEnvFile(key, value) {
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add the variable
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
    
    fs.writeFileSync(envPath, envContent);
  }

  async setupDockerCompose() {
    console.log('  🐳 Setting up Docker Compose configuration...');
    
    // Check if docker-compose.yml exists
    if (!fs.existsSync(this.dockerComposePath)) {
      throw new Error('docker-compose.yml not found. Please run this from the project root.');
    }
    
    console.log('    ✅ Docker Compose configuration is ready');
  }

  async createInitScripts() {
    console.log('  📜 Creating initialization scripts...');
    
    // Create IPFS init script
    const ipfsInitScript = `#!/bin/bash
# IPFS Initialization Script

set -e

echo "🚀 Initializing IPFS for Verinode..."

# Wait for IPFS to be ready
echo "⏳ Waiting for IPFS to start..."
until curl -s http://localhost:5001/api/v0/version > /dev/null; do
    echo "   Waiting for IPFS API..."
    sleep 2
done

echo "✅ IPFS is ready!"

# Initialize repository if not exists
if [ ! -d "/data/ipfs" ]; then
    echo "📁 Initializing IPFS repository..."
    ipfs init --profile server
fi

# Configure CORS
echo "⚙️  Configuring CORS..."
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET", "POST", "PUT", "DELETE", "OPTIONS"]'
ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Methods '["GET", "HEAD", "OPTIONS"]'

# Configure swarm
echo "🌐 Configuring swarm..."
ipfs config --json Swarm.ConnMgr.HighWater 1000
ipfs config --json Swarm.ConnMgr.LowWater 100

# Configure datastore
echo "💾 Configuring datastore..."
ipfs config --json Datastore.StorageMax '"10GB"'

echo "🎉 IPFS initialization completed!"
`;
    
    const initScriptPath = path.join(__dirname, 'ipfs-init.sh');
    fs.writeFileSync(initScriptPath, ipfsInitScript);
    fs.chmodSync(initScriptPath, '755');
    console.log(`    Created: ${initScriptPath}`);
    
    // Create health check script
    const healthCheckScript = `#!/bin/bash
# IPFS Health Check Script

set -e

echo "🔍 Checking IPFS health..."

# Check IPFS API
if curl -s http://localhost:5001/api/v0/version > /dev/null; then
    echo "✅ IPFS API is accessible"
else
    echo "❌ IPFS API is not accessible"
    exit 1
fi

# Check IPFS Gateway
if curl -s http://localhost:8080/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme > /dev/null; then
    echo "✅ IPFS Gateway is accessible"
else
    echo "❌ IPFS Gateway is not accessible"
    exit 1
fi

# Check IPFS Cluster (if enabled)
if curl -s http://localhost:9094/id > /dev/null; then
    echo "✅ IPFS Cluster is accessible"
else
    echo "⚠️  IPFS Cluster is not accessible (optional)"
fi

echo "🎉 IPFS health check completed!"
`;
    
    const healthScriptPath = path.join(__dirname, 'ipfs-health-check.sh');
    fs.writeFileSync(healthScriptPath, healthCheckScript);
    fs.chmodSync(healthScriptPath, '755');
    console.log(`    Created: ${healthScriptPath}`);
  }

  async verifySetup() {
    console.log('  🔧 Verifying setup...');
    
    // Check if all required files exist
    const requiredFiles = [
      this.configPath,
      path.join(this.ipfsConfigDir, 'config'),
      path.join(this.ipfsClusterConfigDir, 'service.json'),
      path.join(__dirname, 'ipfs-init.sh'),
      path.join(__dirname, 'ipfs-health-check.sh'),
      this.dockerComposePath
    ];
    
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file not found: ${file}`);
      }
    }
    
    // Validate configuration files
    try {
      const ipfsConfig = JSON.parse(fs.readFileSync(path.join(this.ipfsConfigDir, 'config'), 'utf8'));
      if (!ipfsConfig.API || !ipfsConfig.Addresses) {
        throw new Error('Invalid IPFS configuration');
      }
    } catch (error) {
      throw new Error(`IPFS configuration validation failed: ${error.message}`);
    }
    
    try {
      const clusterConfig = JSON.parse(fs.readFileSync(path.join(this.ipfsClusterConfigDir, 'service.json'), 'utf8'));
      if (!clusterConfig.cluster || !clusterConfig.restapi) {
        throw new Error('Invalid IPFS Cluster configuration');
      }
    } catch (error) {
      throw new Error(`IPFS Cluster configuration validation failed: ${error.message}`);
    }
    
    console.log('    ✅ All configuration files are valid');
  }
}

// CLI interface
if (require.main === module) {
  const setup = new IPFSSetup();
  
  // Handle command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`
IPFS Setup Script for Verinode

Usage: node ipfsSetup.js [command]

Commands:
  (no args)    Run complete setup
  help         Show this help message
  verify       Verify existing setup
  clean        Clean up generated files

Examples:
  node ipfsSetup.js              # Run complete setup
  node ipfsSetup.js verify       # Verify setup only
  node ipfsSetup.js clean        # Clean up files
`);
    process.exit(0);
  }
  
  if (command === 'verify') {
    setup.verifySetup().then(() => {
      console.log('✅ Setup verification completed successfully!');
    }).catch((error) => {
      console.error(`❌ Verification failed: ${error.message}`);
      process.exit(1);
    });
  } else if (command === 'clean') {
    console.log('🧹 Cleaning up generated files...');
    const filesToClean = [
      path.join(__dirname, '../config/ipfs-config'),
      path.join(__dirname, '../config/ipfs-cluster'),
      path.join(__dirname, 'ipfs-init.sh'),
      path.join(__dirname, 'ipfs-health-check.sh')
    ];
    
    for (const file of filesToClean) {
      if (fs.existsSync(file)) {
        fs.rmSync(file, { recursive: true, force: true });
        console.log(`  Removed: ${file}`);
      }
    }
    
    console.log('✅ Cleanup completed!');
  } else {
    setup.run();
  }
}

module.exports = IPFSSetup;
