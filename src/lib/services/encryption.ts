import crypto from 'crypto';

/**
 * Encryption service for securing sensitive data like API keys
 */
export class EncryptionService {
  private static algorithm = 'aes-256-cbc';
  private static key = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'default-key-change-in-production';

  /**
   * Encrypt a string value
   */
  static encrypt(text: string): string {
    if (!text) return '';
    
    try {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(this.key, 'salt', 32);
      const cipher = crypto.createCipher(this.algorithm, key);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a string value
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText) return '';
    
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const key = crypto.scryptSync(this.key, 'salt', 32);
      const decipher = crypto.createDecipher(this.algorithm, key);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Check if a string appears to be encrypted
   */
  static isEncrypted(text: string): boolean {
    if (!text) return false;
    const parts = text.split(':');
    return parts.length === 2 && parts.every(part => /^[0-9a-f]+$/i.test(part));
  }
}