// Simple security logger - no external dependencies
class SimpleSecurityLogger {
  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    return `[${timestamp}] [SECURITY] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  error(message: string, data?: any): void {
    console.error(this.formatMessage("error", message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage("warn", message, data));
  }

  info(message: string, data?: any): void {
    console.log(this.formatMessage("info", message, data));
  }
}

const securityLogger = new SimpleSecurityLogger();

export interface SecurityEvent {
  event: string;
  userId?: string;
  email?: string;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  details?: any;
  riskLevel: "low" | "medium" | "high" | "critical";
}

export class SecurityMonitor {
  static logEvent(event: SecurityEvent): void {
    const logData = {
      ...event,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    };

    switch (event.riskLevel) {
      case "critical":
        securityLogger.error("CRITICAL SECURITY EVENT", logData);
        break;
      case "high":
        securityLogger.error("HIGH RISK SECURITY EVENT", logData);
        break;
      case "medium":
        securityLogger.warn("MEDIUM RISK SECURITY EVENT", logData);
        break;
      case "low":
      default:
        securityLogger.info("SECURITY EVENT", logData);
        break;
    }

    // In production, you might want to send alerts for high/critical events
    if (
      event.riskLevel === "critical" &&
      process.env.NODE_ENV === "production"
    ) {
      // Send alert to monitoring system
      this.sendSecurityAlert(event);
    }
  }

  private static sendSecurityAlert(event: SecurityEvent): void {
    // Implement alerting (email, Slack, PagerDuty, etc.)
    console.error("CRITICAL SECURITY ALERT:", event);
  }

  // Common security events
  static logAuthAttempt(
    success: boolean,
    email: string,
    ip: string,
    deviceId: string,
    details?: any
  ): void {
    this.logEvent({
      event: "authentication_attempt",
      email,
      deviceId,
      ip,
      success,
      details,
      riskLevel: success ? "low" : "medium",
    });
  }

  static logMFAEvent(
    event: string,
    userId: string,
    success: boolean,
    details?: any
  ): void {
    this.logEvent({
      event: `mfa_${event}`,
      userId,
      success,
      details,
      riskLevel: success ? "low" : "high",
    });
  }

  static logPasswordChange(userId: string, success: boolean): void {
    this.logEvent({
      event: "password_change",
      userId,
      success,
      riskLevel: success ? "low" : "medium",
    });
  }

  static logSuspiciousActivity(
    event: string,
    userId?: string,
    ip?: string,
    details?: any
  ): void {
    this.logEvent({
      event: `suspicious_${event}`,
      userId,
      ip,
      success: false,
      details,
      riskLevel: "high",
    });
  }

  static logDataAccess(
    userId: string,
    resource: string,
    action: string,
    success: boolean
  ): void {
    this.logEvent({
      event: "data_access",
      userId,
      success,
      details: { resource, action },
      riskLevel: "low",
    });
  }

  static logRateLimitExceeded(ip: string, endpoint: string): void {
    this.logEvent({
      event: "rate_limit_exceeded",
      ip,
      success: false,
      details: { endpoint },
      riskLevel: "medium",
    });
  }
}
