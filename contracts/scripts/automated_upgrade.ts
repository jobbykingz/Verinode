import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

async function runAutomatedUpgrade() {
  console.log('--- Starting Automated Zero-Downtime Upgrade Pipeline ---');
  
  try {
    // 1. Schedule the upgrade (compiles and installs WASM)
    console.log('1. Scheduling upgrade...');
    const scheduleRes = await axios.post(`${API_URL}/upgrades/schedule`, {
      contractName: 'VerinodeCore',
      contractAddress: 'C_EXAMPLE_PROXY_ADDRESS',
      contractPath: './target/wasm32-unknown-unknown/release/verinode_core.wasm',
      initiatedBy: 'CI/CD Pipeline'
    });
    
    const upgradeId = scheduleRes.data.data._id;
    console.log(`Scheduled successfully. Upgrade ID: ${upgradeId}`);

    // 2. Execute the upgrade
    console.log('2. Executing upgrade transaction...');
    const execRes = await axios.post(`${API_URL}/upgrades/${upgradeId}/execute`);
    console.log(`Upgrade Status: ${execRes.data.data.status}`);
  } catch (error: any) {
    console.error('Automated upgrade failed:', error.response?.data || error.message);
  }
}
runAutomatedUpgrade();