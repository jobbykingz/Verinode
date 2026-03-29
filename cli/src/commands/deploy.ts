import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { apiClient } from '../utils/api';
import { logSuccess, logError, logInfo, readJsonFile } from '../utils/helpers';

interface Contract {
  id: string;
  name: string;
  address: string;
  status: string;
  deployedAt: string;
}

export const deployCommand = new Command('deploy')
  .description('Contract deployment commands');

deployCommand
  .command('list')
  .description('List deployed contracts')
  .action(async () => {
    try {
      const spinner = ora('Fetching contracts...').start();
      const contracts: Contract[] = await apiClient.get('/contracts');
      spinner.stop();

      if (contracts.length === 0) {
        logInfo('No contracts found');
        return;
      }

      console.table(contracts.map(c => ({
        ID: c.id,
        Name: c.name,
        Address: c.address,
        Status: c.status,
        Deployed: c.deployedAt ? new Date(c.deployedAt).toLocaleDateString() : 'N/A'
      })));
    } catch (error) {
      logError(`Failed to list contracts: ${error.message}`);
    }
  });

deployCommand
  .command('contract')
  .description('Deploy a new contract')
  .option('-f, --file <file>', 'Contract configuration file')
  .option('-n, --network <network>', 'Target network', 'mainnet')
  .action(async (options) => {
    try {
      let contractData;

      if (options.file) {
        contractData = await readJsonFile(options.file);
      } else {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter contract name:'
          },
          {
            type: 'input',
            name: 'source',
            message: 'Enter contract source code path:'
          },
          {
            type: 'list',
            name: 'network',
            message: 'Select target network:',
            choices: ['mainnet', 'testnet', 'local'],
            default: options.network
          }
        ]);
        contractData = answers;
      }

      const spinner = ora(`Deploying contract to ${contractData.network}...`).start();

      // Simulate deployment progress
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = await apiClient.post('/contracts/deploy', {
        ...contractData,
        network: options.network
      });

      spinner.stop();
      logSuccess(`Contract deployed successfully!`);
      logInfo(`Contract ID: ${result.id}`);
      logInfo(`Contract Address: ${result.address}`);
    } catch (error) {
      logError(`Failed to deploy contract: ${error.message}`);
    }
  });

deployCommand
  .command('status <id>')
  .description('Check deployment status')
  .action(async (id) => {
    try {
      const spinner = ora('Checking status...').start();
      const status = await apiClient.get(`/contracts/${id}/status`);
      spinner.stop();

      logInfo(`Contract ${id} status: ${status.state}`);
      if (status.details) {
        console.log('Details:', status.details);
      }
    } catch (error) {
      logError(`Failed to check status: ${error.message}`);
    }
  });

deployCommand
  .command('upgrade <id>')
  .description('Upgrade an existing contract')
  .option('-f, --file <file>', 'New contract source file')
  .action(async (id, options) => {
    try {
      if (!options.file) {
        logError('Contract source file is required for upgrade');
        return;
      }

      const sourceCode = await readJsonFile(options.file);

      const spinner = ora('Upgrading contract...').start();
      const result = await apiClient.put(`/contracts/${id}/upgrade`, {
        sourceCode
      });
      spinner.stop();

      logSuccess('Contract upgraded successfully');
      logInfo(`New version: ${result.version}`);
    } catch (error) {
      logError(`Failed to upgrade contract: ${error.message}`);
    }
  });