import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { apiClient } from '../utils/api';
import { logSuccess, logError, logInfo, readJsonFile } from '../utils/helpers';

interface Proof {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export const proofCommand = new Command('proof')
  .description('Proof management commands');

proofCommand
  .command('list')
  .description('List all proofs')
  .action(async () => {
    try {
      const spinner = ora('Fetching proofs...').start();
      const proofs: Proof[] = await apiClient.get('/proofs');
      spinner.stop();

      if (proofs.length === 0) {
        logInfo('No proofs found');
        return;
      }

      console.table(proofs.map(p => ({
        ID: p.id,
        Name: p.name,
        Status: p.status,
        Created: new Date(p.createdAt).toLocaleDateString()
      })));
    } catch (error) {
      logError(`Failed to list proofs: ${error.message}`);
    }
  });

proofCommand
  .command('create')
  .description('Create a new proof')
  .option('-f, --file <file>', 'JSON file containing proof data')
  .action(async (options) => {
    try {
      let proofData;

      if (options.file) {
        proofData = await readJsonFile(options.file);
      } else {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter proof name:'
          },
          {
            type: 'input',
            name: 'description',
            message: 'Enter proof description:'
          }
        ]);
        proofData = answers;
      }

      const spinner = ora('Creating proof...').start();
      const result = await apiClient.post('/proofs', proofData);
      spinner.stop();

      logSuccess(`Proof created successfully: ${result.id}`);
    } catch (error) {
      logError(`Failed to create proof: ${error.message}`);
    }
  });

proofCommand
  .command('get <id>')
  .description('Get proof details')
  .action(async (id) => {
    try {
      const spinner = ora('Fetching proof...').start();
      const proof: Proof = await apiClient.get(`/proofs/${id}`);
      spinner.stop();

      console.log(JSON.stringify(proof, null, 2));
    } catch (error) {
      logError(`Failed to get proof: ${error.message}`);
    }
  });

proofCommand
  .command('delete <id>')
  .description('Delete a proof')
  .action(async (id) => {
    try {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete proof ${id}?`,
          default: false
        }
      ]);

      if (!confirm) {
        logInfo('Operation cancelled');
        return;
      }

      const spinner = ora('Deleting proof...').start();
      await apiClient.delete(`/proofs/${id}`);
      spinner.stop();

      logSuccess('Proof deleted successfully');
    } catch (error) {
      logError(`Failed to delete proof: ${error.message}`);
    }
  });

proofCommand
  .command('batch <file>')
  .description('Process multiple proofs from JSON file')
  .action(async (file) => {
    try {
      const batchData = await readJsonFile(file);
      const operations = batchData.operations || [];

      const spinner = ora('Processing batch operations...').start();

      for (const op of operations) {
        try {
          switch (op.type) {
            case 'create':
              await apiClient.post('/proofs', op.data);
              break;
            case 'update':
              await apiClient.put(`/proofs/${op.id}`, op.data);
              break;
            case 'delete':
              await apiClient.delete(`/proofs/${op.id}`);
              break;
          }
        } catch (error) {
          logError(`Batch operation failed for ${op.type}: ${error.message}`);
        }
      }

      spinner.stop();
      logSuccess('Batch operations completed');
    } catch (error) {
      logError(`Failed to process batch: ${error.message}`);
    }
  });