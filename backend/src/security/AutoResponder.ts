import { ThreatEvent, ThreatSeverity } from '../models/ThreatEvent';

export class AutoResponder {
  public async handleThreat(event: ThreatEvent): Promise<boolean> {
    console.log(`[AutoResponder] Processing threat ${event.id} of severity ${event.severity}`);
    
    if (event.severity === ThreatSeverity.CRITICAL) {
      if (event.sourceIp) {
        await this.blockIp(event.sourceIp);
        event.actionTaken = true;
      }
      if (event.userId) {
        await this.disableUser(event.userId);
        event.actionTaken = true;
      }
    } else if (event.severity === ThreatSeverity.HIGH) {
      if (event.userId) {
        await this.requireMfa(event.userId);
        event.actionTaken = true;
      }
    }
    
    return event.actionTaken;
  }

  private async blockIp(ip: string): Promise<void> {
    // In a real system, this would interact with a WAF or firewall (e.g., AWS WAF, iptables)
    console.log(`[AutoResponder] IP ${ip} has been blocked.`);
  }

  private async disableUser(userId: string): Promise<void> {
    // In a real system, this would update the user record in the DB to set isActive = false
    console.log(`[AutoResponder] User ${userId} has been suspended.`);
  }

  private async requireMfa(userId: string): Promise<void> {
     // In a real system, this flag forces the user to re-authenticate with MFA
    console.log(`[AutoResponder] User ${userId} forced to use MFA on next action.`);
  }
}
