export enum ThreatSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum ThreatType {
  MALWARE = 'MALWARE',
  PHISHING = 'PHISHING',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  DDOS = 'DDOS',
  DATA_EXFILTRATION = 'DATA_EXFILTRATION',
  ANOMALY = 'ANOMALY',
  OTHER = 'OTHER'
}

export interface ThreatEvent {
  id: string;
  timestamp: Date;
  type: ThreatType;
  severity: ThreatSeverity;
  sourceIp?: string;
  userId?: string;
  description: string;
  actionTaken: boolean;
  metadata?: Record<string, any>;
}
