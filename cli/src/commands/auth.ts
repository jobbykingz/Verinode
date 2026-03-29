import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { apiClient } from '../utils/api';
import { configManager } from '../utils/config';
import { logSuccess, logError, logInfo } from '../utils/helpers';

export const authCommand = new Command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('login')
      .description('Login to Verinode')
      .action(async () => {
        try {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'email',
              message: 'Enter your email:',
              validate: (input) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(input) || 'Please enter a valid email';
              }
            },
            {
              type: 'password',
              name: 'password',
              message: 'Enter your password:',
              mask: '*'
            }
          ]);

          const spinner = ora('Logging in...').start();

          const response = await apiClient.post('/auth/login', {
            email: answers.email,
            password: answers.password
          });

          spinner.stop();

          if (response.token) {
            apiClient.setAuthToken(response.token);
            logSuccess('Login successful!');
          } else {
            logError('Login failed: Invalid credentials');
          }
        } catch (error) {
          logError(`Login failed: ${error.message}`);
        }
      })
  )
  .addCommand(
    new Command('logout')
      .description('Logout from Verinode')
      .action(() => {
        apiClient.clearAuthToken();
        logSuccess('Logged out successfully');
      })
  )
  .addCommand(
    new Command('status')
      .description('Check authentication status')
      .action(async () => {
        const apiKey = configManager.getApiKey();
        if (apiKey) {
          logSuccess('Authenticated');
          logInfo(`API Key: ${apiKey.substring(0, 10)}...`);
        } else {
          logInfo('Not authenticated');
        }
      })
  );