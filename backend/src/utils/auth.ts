import * as crypto from "crypto";
import * as speakeasy from "speakeasy";
import * as qrcode from "qrcode";

export class AuthService {
  // Hash password with salt
  static async hashPassword(
    password: string
  ): Promise<{ hash: string; salt: string }> {
    const salt = crypto.randomBytes(32).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return { hash, salt };
  }

  // Verify password
  static async verifyPassword(
    password: string,
    hash: string,
    salt: string
  ): Promise<boolean> {
    const hashBuffer = crypto.scryptSync(password, salt, 64);
    const storedHashBuffer = Buffer.from(hash, "hex");
    return crypto.timingSafeEqual(hashBuffer, storedHashBuffer);
  }

  // Generate MFA secret
  static generateMFASecret(email: string): {
    secret: string;
    qrCode: string;
    backupCodes: string[];
  } {
    const secret = speakeasy.generateSecret({
      name: `Don't Skip (${email})`,
      issuer: "Don't Skip",
      length: 32,
    });

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase()
    );

    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url || "",
      backupCodes,
    };
  }

  // Verify MFA token
  static verifyMFAToken(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      token,
      window: 2, // Allow 2 time steps (60 seconds) of drift
      encoding: "base32",
    });
  }

  // Verify backup code
  static verifyBackupCode(
    code: string,
    backupCodes: string[]
  ): { valid: boolean; remainingCodes: string[] } {
    const upperCode = code.toUpperCase();
    const index = backupCodes.indexOf(upperCode);

    if (index === -1) {
      return { valid: false, remainingCodes: backupCodes };
    }

    // Remove used backup code
    const remainingCodes = backupCodes.filter((_, i) => i !== index);
    return { valid: true, remainingCodes };
  }

  // Generate secure session token
  static generateSessionToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // Rate limiting for auth attempts
  private static authAttempts = new Map<
    string,
    { count: number; lastAttempt: Date }
  >();

  static checkAuthRateLimit(identifier: string): {
    allowed: boolean;
    remainingAttempts: number;
  } {
    const now = new Date();
    const key = identifier.toLowerCase();
    const attempt = this.authAttempts.get(key);

    // Reset if more than 15 minutes passed
    if (
      !attempt ||
      now.getTime() - attempt.lastAttempt.getTime() > 15 * 60 * 1000
    ) {
      this.authAttempts.set(key, { count: 1, lastAttempt: now });
      return { allowed: true, remainingAttempts: 4 };
    }

    // Check if exceeded limit
    if (attempt.count >= 5) {
      return { allowed: false, remainingAttempts: 0 };
    }

    // Increment attempt
    attempt.count++;
    attempt.lastAttempt = now;
    this.authAttempts.set(key, attempt);

    return { allowed: true, remainingAttempts: 5 - attempt.count };
  }

  static resetAuthRateLimit(identifier: string): void {
    this.authAttempts.delete(identifier.toLowerCase());
  }
}
