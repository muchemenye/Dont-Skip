import * as crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

export class EncryptionService {
  private static key: Buffer;
  private static salt: Buffer;

  static initialize(): void {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("ENCRYPTION_KEY environment variable is required");
    }

    // Generate or load salt (in production, store this securely)
    const saltEnv = process.env.ENCRYPTION_SALT;
    if (saltEnv) {
      this.salt = Buffer.from(saltEnv, "hex");
    } else {
      this.salt = crypto.randomBytes(32);
      console.warn(
        "Generated new encryption salt. Set ENCRYPTION_SALT environment variable for production."
      );
    }

    // Derive key using dynamic salt
    this.key = crypto.scryptSync(encryptionKey, this.salt, KEY_LENGTH);
  }

  static encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Combine iv + encrypted data
    return iv.toString("hex") + encrypted;
  }

  static decrypt(encryptedData: string): string {
    const ivHex = encryptedData.slice(0, IV_LENGTH * 2);
    const encrypted = encryptedData.slice(IV_LENGTH * 2);

    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  static hash(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }
}
