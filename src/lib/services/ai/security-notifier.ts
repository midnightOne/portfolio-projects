/**
 * Security notification service for AI assistant
 * Handles notifications to portfolio owner about security violations
 */

import { ContentAnalysisResult } from './abuse-detector';
import { IPBlacklistEntry } from '@/lib/types/rate-limiting';

export interface SecurityNotification {
  id: string;
  type: 'violation' | 'blacklist' | 'warning' | 'reinstatement';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  ipAddress?: string;
  endpoint?: string;
  userAgent?: string;
  violationCount?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface NotificationConfig {
  enableEmailNotifications: boolean;
  enableInAppNotifications: boolean;
  emailAddress?: string;
  notificationThreshold: 'all' | 'medium' | 'high';
  batchNotifications: boolean;
  batchIntervalMinutes: number;
  maxNotificationsPerHour: number;
}

export class SecurityNotifier {
  private config: NotificationConfig;
  private pendingNotifications: SecurityNotification[] = [];
  private notificationCounts: Map<string, number> = new Map(); // IP -> count in current hour
  private lastBatchSent: Date = new Date();

  constructor(config?: Partial<NotificationConfig>) {
    this.config = {
      enableEmailNotifications: false, // Disabled by default until email service is configured
      enableInAppNotifications: true,
      notificationThreshold: 'medium',
      batchNotifications: true,
      batchIntervalMinutes: 15,
      maxNotificationsPerHour: 10,
      ...config,
    };

    // Set up batch notification timer if enabled
    if (this.config.batchNotifications) {
      this.setupBatchTimer();
    }
  }

  /**
   * Notify about a content violation
   */
  async notifyViolation(
    ipAddress: string,
    analysisResult: ContentAnalysisResult,
    context: {
      endpoint?: string;
      userAgent?: string;
      violationCount?: number;
      content?: string;
    }
  ): Promise<void> {
    try {
      // Check if we should send this notification based on threshold
      if (!this.shouldNotify(analysisResult.severity)) {
        return;
      }

      // Check rate limiting
      if (!this.checkRateLimit(ipAddress)) {
        console.log(`Rate limiting notifications for IP: ${ipAddress}`);
        return;
      }

      const notification: SecurityNotification = {
        id: this.generateId(),
        type: 'violation',
        severity: analysisResult.severity,
        title: `Security Violation Detected`,
        message: this.formatViolationMessage(ipAddress, analysisResult, context),
        ipAddress,
        endpoint: context.endpoint,
        userAgent: context.userAgent,
        violationCount: context.violationCount,
        timestamp: new Date(),
        metadata: {
          confidence: analysisResult.confidence,
          reasons: analysisResult.reasons,
          suggestedAction: analysisResult.suggestedAction,
          contentLength: context.content?.length || 0,
        },
      };

      await this.sendNotification(notification);
    } catch (error) {
      console.error('Failed to send violation notification:', error);
    }
  }

  /**
   * Notify about IP blacklisting
   */
  async notifyBlacklist(
    ipAddress: string,
    entry: IPBlacklistEntry,
    context?: {
      endpoint?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      const notification: SecurityNotification = {
        id: this.generateId(),
        type: 'blacklist',
        severity: 'high',
        title: `IP Address Blacklisted`,
        message: this.formatBlacklistMessage(ipAddress, entry),
        ipAddress,
        endpoint: context?.endpoint,
        userAgent: context?.userAgent,
        violationCount: entry.violationCount,
        timestamp: new Date(),
        metadata: {
          reason: entry.reason,
          firstViolationAt: entry.firstViolationAt,
          lastViolationAt: entry.lastViolationAt,
        },
      };

      // Always send blacklist notifications immediately (don't batch)
      await this.sendNotificationImmediate(notification);
    } catch (error) {
      console.error('Failed to send blacklist notification:', error);
    }
  }

  /**
   * Notify about IP reinstatement
   */
  async notifyReinstatement(
    ipAddress: string,
    entry: IPBlacklistEntry,
    reinstatedBy: string,
    reason?: string
  ): Promise<void> {
    try {
      const notification: SecurityNotification = {
        id: this.generateId(),
        type: 'reinstatement',
        severity: 'low',
        title: `IP Address Reinstated`,
        message: `IP address ${ipAddress} has been reinstated by ${reinstatedBy}.${reason ? ` Reason: ${reason}` : ''}`,
        ipAddress,
        timestamp: new Date(),
        metadata: {
          reinstatedBy,
          reason,
          originalReason: entry.reason,
          violationCount: entry.violationCount,
        },
      };

      await this.sendNotification(notification);
    } catch (error) {
      console.error('Failed to send reinstatement notification:', error);
    }
  }

  /**
   * Send a warning notification for suspicious activity
   */
  async notifyWarning(
    ipAddress: string,
    reason: string,
    context?: {
      endpoint?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      if (!this.shouldNotify('medium')) {
        return;
      }

      const notification: SecurityNotification = {
        id: this.generateId(),
        type: 'warning',
        severity: 'medium',
        title: `Security Warning`,
        message: `Suspicious activity detected from IP ${ipAddress}: ${reason}`,
        ipAddress,
        endpoint: context?.endpoint,
        userAgent: context?.userAgent,
        timestamp: new Date(),
        metadata: context?.metadata,
      };

      await this.sendNotification(notification);
    } catch (error) {
      console.error('Failed to send warning notification:', error);
    }
  }

  /**
   * Get recent notifications for admin dashboard
   */
  async getRecentNotifications(limit: number = 50): Promise<SecurityNotification[]> {
    try {
      // In a real implementation, this would fetch from a database
      // For now, return empty array as notifications are sent immediately
      return [];
    } catch (error) {
      console.error('Failed to get recent notifications:', error);
      return [];
    }
  }

  /**
   * Send notification (batched or immediate based on config)
   */
  private async sendNotification(notification: SecurityNotification): Promise<void> {
    if (this.config.batchNotifications && notification.severity !== 'high') {
      this.pendingNotifications.push(notification);
    } else {
      await this.sendNotificationImmediate(notification);
    }
  }

  /**
   * Send notification immediately
   */
  private async sendNotificationImmediate(notification: SecurityNotification): Promise<void> {
    const promises: Promise<void>[] = [];

    // Send in-app notification
    if (this.config.enableInAppNotifications) {
      promises.push(this.sendInAppNotification(notification));
    }

    // Send email notification
    if (this.config.enableEmailNotifications && this.config.emailAddress) {
      promises.push(this.sendEmailNotification(notification));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send in-app notification (log to console for now)
   */
  private async sendInAppNotification(notification: SecurityNotification): Promise<void> {
    // In a real implementation, this would store in database for admin dashboard
    console.log(`[SECURITY NOTIFICATION] ${notification.title}: ${notification.message}`);
    
    // Could also integrate with a real-time notification system like WebSockets
    // or Server-Sent Events to push to admin dashboard
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: SecurityNotification): Promise<void> {
    // In a real implementation, this would integrate with an email service
    // like SendGrid, AWS SES, or similar
    console.log(`[EMAIL NOTIFICATION] Would send email to ${this.config.emailAddress}:`);
    console.log(`Subject: ${notification.title}`);
    console.log(`Body: ${notification.message}`);
    
    // Example integration:
    // await emailService.send({
    //   to: this.config.emailAddress,
    //   subject: notification.title,
    //   html: this.formatEmailTemplate(notification),
    // });
  }

  /**
   * Setup batch notification timer
   */
  private setupBatchTimer(): void {
    setInterval(() => {
      this.processBatchNotifications();
    }, this.config.batchIntervalMinutes * 60 * 1000);
  }

  /**
   * Process and send batched notifications
   */
  private async processBatchNotifications(): Promise<void> {
    if (this.pendingNotifications.length === 0) {
      return;
    }

    try {
      const notifications = [...this.pendingNotifications];
      this.pendingNotifications = [];

      // Group notifications by type and severity
      const grouped = this.groupNotifications(notifications);
      
      for (const group of grouped) {
        await this.sendBatchNotification(group);
      }

      this.lastBatchSent = new Date();
    } catch (error) {
      console.error('Failed to process batch notifications:', error);
    }
  }

  /**
   * Group notifications for batching
   */
  private groupNotifications(notifications: SecurityNotification[]): SecurityNotification[][] {
    const groups: Map<string, SecurityNotification[]> = new Map();

    for (const notification of notifications) {
      const key = `${notification.type}-${notification.severity}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(notification);
    }

    return Array.from(groups.values());
  }

  /**
   * Send a batch notification
   */
  private async sendBatchNotification(notifications: SecurityNotification[]): Promise<void> {
    if (notifications.length === 0) return;

    const first = notifications[0];
    const count = notifications.length;
    
    const batchNotification: SecurityNotification = {
      id: this.generateId(),
      type: first.type,
      severity: first.severity,
      title: `${count} Security ${first.type === 'violation' ? 'Violations' : 'Events'} Detected`,
      message: this.formatBatchMessage(notifications),
      timestamp: new Date(),
      metadata: {
        batchCount: count,
        timeRange: {
          start: Math.min(...notifications.map(n => n.timestamp.getTime())),
          end: Math.max(...notifications.map(n => n.timestamp.getTime())),
        },
        notifications: notifications.map(n => ({
          id: n.id,
          ipAddress: n.ipAddress,
          endpoint: n.endpoint,
          timestamp: n.timestamp,
        })),
      },
    };

    await this.sendNotificationImmediate(batchNotification);
  }

  /**
   * Check if we should send notification based on severity threshold
   */
  private shouldNotify(severity: 'low' | 'medium' | 'high'): boolean {
    const severityLevels = { low: 1, medium: 2, high: 3 };
    const thresholdLevels = { all: 1, medium: 2, high: 3 };
    
    const threshold = thresholdLevels[this.config.notificationThreshold];
    const current = severityLevels[severity];
    
    return current >= threshold;
  }

  /**
   * Check rate limiting for notifications
   */
  private checkRateLimit(ipAddress: string): boolean {
    const now = new Date();
    const hourKey = `${ipAddress}-${now.getHours()}`;
    
    const currentCount = this.notificationCounts.get(hourKey) || 0;
    if (currentCount >= this.config.maxNotificationsPerHour) {
      return false;
    }

    this.notificationCounts.set(hourKey, currentCount + 1);
    
    // Clean up old entries
    this.cleanupRateLimitCounts();
    
    return true;
  }

  /**
   * Clean up old rate limit counts
   */
  private cleanupRateLimitCounts(): void {
    const now = new Date();
    const currentHour = now.getHours();
    
    for (const [key] of this.notificationCounts) {
      const [, hourStr] = key.split('-');
      const hour = parseInt(hourStr);
      
      // Remove entries older than 2 hours
      if (Math.abs(currentHour - hour) > 2) {
        this.notificationCounts.delete(key);
      }
    }
  }

  /**
   * Format violation message
   */
  private formatViolationMessage(
    ipAddress: string,
    analysisResult: ContentAnalysisResult,
    context: {
      endpoint?: string;
      userAgent?: string;
      violationCount?: number;
    }
  ): string {
    const parts = [
      `IP Address: ${ipAddress}`,
      `Severity: ${analysisResult.severity.toUpperCase()}`,
      `Confidence: ${Math.round(analysisResult.confidence * 100)}%`,
    ];

    if (context.endpoint) {
      parts.push(`Endpoint: ${context.endpoint}`);
    }

    if (context.violationCount) {
      parts.push(`Total Violations: ${context.violationCount}`);
    }

    if (analysisResult.reasons.length > 0) {
      parts.push(`Reasons: ${analysisResult.reasons.join(', ')}`);
    }

    if (context.userAgent) {
      parts.push(`User Agent: ${context.userAgent.substring(0, 100)}${context.userAgent.length > 100 ? '...' : ''}`);
    }

    return parts.join('\n');
  }

  /**
   * Format blacklist message
   */
  private formatBlacklistMessage(ipAddress: string, entry: IPBlacklistEntry): string {
    return [
      `IP Address ${ipAddress} has been automatically blacklisted due to repeated violations.`,
      ``,
      `Violation Count: ${entry.violationCount}`,
      `Reason: ${entry.reason}`,
      `First Violation: ${entry.firstViolationAt.toLocaleString()}`,
      `Last Violation: ${entry.lastViolationAt.toLocaleString()}`,
      ``,
      `The IP address is now blocked from accessing AI features.`,
      `You can review and manage blacklisted IPs in the admin security dashboard.`,
    ].join('\n');
  }

  /**
   * Format batch message
   */
  private formatBatchMessage(notifications: SecurityNotification[]): string {
    const ipCounts: Record<string, number> = {};
    const endpointCounts: Record<string, number> = {};

    for (const notification of notifications) {
      if (notification.ipAddress) {
        ipCounts[notification.ipAddress] = (ipCounts[notification.ipAddress] || 0) + 1;
      }
      if (notification.endpoint) {
        endpointCounts[notification.endpoint] = (endpointCounts[notification.endpoint] || 0) + 1;
      }
    }

    const parts = [
      `${notifications.length} security events detected in the last ${this.config.batchIntervalMinutes} minutes.`,
      ``,
    ];

    if (Object.keys(ipCounts).length > 0) {
      parts.push(`Top IP Addresses:`);
      Object.entries(ipCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([ip, count]) => {
          parts.push(`  ${ip}: ${count} events`);
        });
      parts.push(``);
    }

    if (Object.keys(endpointCounts).length > 0) {
      parts.push(`Top Endpoints:`);
      Object.entries(endpointCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([endpoint, count]) => {
          parts.push(`  ${endpoint}: ${count} events`);
        });
    }

    return parts.join('\n');
  }

  /**
   * Generate unique notification ID
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): NotificationConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const securityNotifier = new SecurityNotifier();