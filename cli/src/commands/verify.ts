import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { apiClient } from '../utils/api';
import { logSuccess, logError, logInfo, readJsonFile } from '../utils/helpers';

interface VerificationResult {
  id: string;
  proofId: string;
  status: 'valid' | 'invalid' | 'pending';
  verifiedAt: string;
  details?: any;
}

export const verifyCommand = new Command('verify')
  .description('Proof verification commands');

verifyCommand
  .command('proof <id>')
  .description('Verify a specific proof')
  .option('-d, --detailed', 'Show detailed verification results')
  .action(async (id, options) => {
    try {
      const spinner = ora('Verifying proof...').start();
      const result: VerificationResult = await apiClient.post(`/verify/proof/${id}`);
      spinner.stop();

      if (result.status === 'valid') {
        logSuccess('Proof verification successful!');
      } else if (result.status === 'invalid') {
        logError('Proof verification failed!');
      } else {
        logInfo('Proof verification is pending...');
      }

      if (options.detailed && result.details) {
        console.log('\nDetailed Results:');
        console.log(JSON.stringify(result.details, null, 2));
      }
    } catch (error) {
      logError(`Verification failed: ${error.message}`);
    }
  });

verifyCommand
  .command('batch <file>')
  .description('Verify multiple proofs from file')
  .action(async (file) => {
    try {
      const batchData = await readJsonFile(file);
      const proofIds = batchData.proofIds || [];

      if (proofIds.length === 0) {
        logError('No proof IDs found in file');
        return;
      }

      const spinner = ora(`Verifying ${proofIds.length} proofs...`).start();
      const results = await apiClient.post('/verify/batch', { proofIds });
      spinner.stop();

      const valid = results.filter((r: VerificationResult) => r.status === 'valid').length;
      const invalid = results.filter((r: VerificationResult) => r.status === 'invalid').length;
      const pending = results.filter((r: VerificationResult) => r.status === 'pending').length;

      logInfo(`Batch verification completed:`);
      logSuccess(`Valid: ${valid}`);
      logError(`Invalid: ${invalid}`);
      if (pending > 0) {
        logInfo(`Pending: ${pending}`);
      }
    } catch (error) {
      logError(`Batch verification failed: ${error.message}`);
    }
  });

verifyCommand
  .command('status <id>')
  .description('Check verification status')
  .action(async (id) => {
    try {
      const result: VerificationResult = await apiClient.get(`/verify/status/${id}`);

      logInfo(`Verification Status: ${result.status}`);
      if (result.verifiedAt) {
        logInfo(`Verified At: ${new Date(result.verifiedAt).toLocaleString()}`);
      }
    } catch (error) {
      logError(`Failed to check status: ${error.message}`);
    }
  });

verifyCommand
  .command('history <proofId>')
  .description('Show verification history for a proof')
  .action(async (proofId) => {
    try {
      const spinner = ora('Fetching verification history...').start();
      const history: VerificationResult[] = await apiClient.get(`/verify/history/${proofId}`);
      spinner.stop();

      if (history.length === 0) {
        logInfo('No verification history found');
        return;
      }

      console.table(history.map(h => ({
        ID: h.id,
        Status: h.status,
        Verified: new Date(h.verifiedAt).toLocaleString()
      })));
    } catch (error) {
      logError(`Failed to fetch history: ${error.message}`);
    }
  });

verifyCommand
  .command('interactive')
  .description('Interactive verification mode')
  .action(async () => {
    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'proofId',
          message: 'Enter proof ID to verify:'
        },
        {
          type: 'confirm',
          name: 'detailed',
          message: 'Show detailed results?',
          default: false
        }
      ]);

      await verifyCommand.commands
        .find(cmd => cmd.name() === 'proof')!
        .action(answers.proofId, { detailed: answers.detailed });
    } catch (error) {
      logError(`Interactive verification failed: ${error.message}`);
    }
  });