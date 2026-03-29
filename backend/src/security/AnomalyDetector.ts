import { spawn } from 'child_process';
import path from 'path';
import { ThreatEvent, ThreatSeverity, ThreatType } from '../models/ThreatEvent';
import { v4 as uuidv4 } from 'uuid';

export class AnomalyDetector {
  private pythonScriptPath: string;

  constructor() {
    this.pythonScriptPath = path.resolve(__dirname, '../ml/anomaly_detection.py');
  }

  public async detectAnomaly(userData: any): Promise<ThreatEvent | null> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [this.pythonScriptPath]);
      let outputData = '';

      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        console.error(`AnomalyDetector Error: ${data}`);
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.warn(`Python process exited with code ${code}`);
          resolve(null);
          return;
        }

        try {
          const result = JSON.parse(outputData);
          if (result.isAnomaly) {
            resolve({
              id: uuidv4(),
              timestamp: new Date(),
              type: ThreatType.ANOMALY,
              severity: result.confidence > 0.9 ? ThreatSeverity.HIGH : ThreatSeverity.MEDIUM,
              userId: userData.userId,
              description: `AI Anomaly detected with confidence ${result.confidence}`,
              actionTaken: false,
              metadata: result.details
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          console.error('Failed to parse Python ML script output', e);
          resolve(null);
        }
      });

      pythonProcess.stdin.write(JSON.stringify(userData));
      pythonProcess.stdin.end();
    });
  }
}
