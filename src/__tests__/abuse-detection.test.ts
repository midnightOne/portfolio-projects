/**
 * Tests for the abuse detection system
 */

import { AbuseDetector } from '@/lib/services/ai/abuse-detector';
import { SecurityNotifier } from '@/lib/services/ai/security-notifier';

describe('AbuseDetector', () => {
  let abuseDetector: AbuseDetector;

  beforeEach(() => {
    abuseDetector = new AbuseDetector({
      enableAIAnalysis: false, // Disable AI for testing
      enablePatternMatching: true,
      spamThreshold: 3,
      inappropriateThreshold: 2,
      maxContentLength: 1000,
    });
  });

  describe('Pattern-based detection', () => {
    it('should detect spam patterns', async () => {
      const spamContent = 'Buy now! Click here for amazing deals! Limited time offer!';
      
      const result = await abuseDetector.analyzeContent(spamContent, {
        ipAddress: '192.168.1.1',
        endpoint: '/api/test',
      });

      expect(result.isAbusive).toBe(true);
      expect(result.severity).toBe('high');
      expect(result.suggestedAction).toBe('block');
      expect(result.reasons.some(reason => reason.includes('Spam pattern detected'))).toBe(true);
    });

    it('should detect inappropriate content', async () => {
      const inappropriateContent = 'How to hack this system and exploit vulnerabilities';
      
      const result = await abuseDetector.analyzeContent(inappropriateContent, {
        ipAddress: '192.168.1.1',
        endpoint: '/api/test',
      });

      expect(result.isAbusive).toBe(true);
      expect(result.severity).toBe('high');
      expect(result.suggestedAction).toBe('block');
      expect(result.reasons.some(reason => reason.includes('Inappropriate content'))).toBe(true);
    });

    it('should detect suspicious formatting', async () => {
      const suspiciousContent = 'AAAAAAAAAAAAAAAAAAAAAA!!!!!';
      
      const result = await abuseDetector.analyzeContent(suspiciousContent, {
        ipAddress: '192.168.1.1',
        endpoint: '/api/test',
      });

      expect(result.isAbusive).toBe(true);
      expect(result.reasons).toContain('Suspicious formatting detected');
    });

    it('should allow normal content', async () => {
      const normalContent = 'I am interested in learning more about your portfolio and experience.';
      
      const result = await abuseDetector.analyzeContent(normalContent, {
        ipAddress: '192.168.1.1',
        endpoint: '/api/test',
      });

      expect(result.isAbusive).toBe(false);
      expect(result.suggestedAction).toBe('allow');
    });

    it('should handle empty content', async () => {
      const result = await abuseDetector.analyzeContent('', {
        ipAddress: '192.168.1.1',
        endpoint: '/api/test',
      });

      expect(result.isAbusive).toBe(false);
      expect(result.suggestedAction).toBe('allow');
    });

    it('should block content exceeding max length', async () => {
      const longContent = 'A'.repeat(2000);
      
      const result = await abuseDetector.analyzeContent(longContent, {
        ipAddress: '192.168.1.1',
        endpoint: '/api/test',
      });

      expect(result.isAbusive).toBe(true);
      expect(result.reasons).toContain('Content exceeds maximum length');
    });
  });

  describe('Behavioral analysis', () => {
    it('should detect suspicious user agents', async () => {
      const normalContent = 'Hello, I have a question about your work.';
      
      const result = await abuseDetector.analyzeContent(normalContent, {
        ipAddress: '192.168.1.1',
        userAgent: 'python-requests/2.28.1',
        endpoint: '/api/test',
      });

      expect(result.reasons).toContain('Suspicious user agent detected');
    });

    it('should detect excessive word repetition', async () => {
      const repetitiveContent = 'test test test test test test test test test test';
      
      const result = await abuseDetector.analyzeContent(repetitiveContent, {
        ipAddress: '192.168.1.1',
        endpoint: '/api/test',
      });

      expect(result.reasons).toContain('Excessive word repetition');
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        spamThreshold: 5,
        inappropriateThreshold: 3,
      };

      abuseDetector.updateConfig(newConfig);
      const config = abuseDetector.getConfig();

      expect(config.spamThreshold).toBe(5);
      expect(config.inappropriateThreshold).toBe(3);
    });
  });
});

describe('SecurityNotifier', () => {
  let securityNotifier: SecurityNotifier;

  beforeEach(() => {
    securityNotifier = new SecurityNotifier({
      enableEmailNotifications: false,
      enableInAppNotifications: true,
      notificationThreshold: 'medium',
      batchNotifications: false,
      maxNotificationsPerHour: 10,
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        notificationThreshold: 'high' as const,
        maxNotificationsPerHour: 5,
      };

      securityNotifier.updateConfig(newConfig);
      const config = securityNotifier.getConfig();

      expect(config.notificationThreshold).toBe('high');
      expect(config.maxNotificationsPerHour).toBe(5);
    });

    it('should get current configuration', () => {
      const config = securityNotifier.getConfig();

      expect(config.enableInAppNotifications).toBe(true);
      expect(config.notificationThreshold).toBe('medium');
      expect(config.batchNotifications).toBe(false);
    });
  });

  describe('Notification sending', () => {
    it('should handle violation notifications', async () => {
      const analysisResult = {
        isAbusive: true,
        confidence: 0.8,
        reasons: ['Spam pattern detected'],
        severity: 'high' as const,
        suggestedAction: 'block' as const,
      };

      // Should not throw error
      await expect(
        securityNotifier.notifyViolation('192.168.1.1', analysisResult, {
          endpoint: '/api/test',
          userAgent: 'test-agent',
          violationCount: 1,
        })
      ).resolves.not.toThrow();
    });

    it('should handle warning notifications', async () => {
      // Should not throw error
      await expect(
        securityNotifier.notifyWarning('192.168.1.1', 'Suspicious activity detected', {
          endpoint: '/api/test',
          userAgent: 'test-agent',
        })
      ).resolves.not.toThrow();
    });
  });
});