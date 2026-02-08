// Shared OTP store for email OTP verification
// In production, consider using Redis or a database

interface OtpEntry {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var otpStore: Map<string, OtpEntry> | undefined;
}

const otpStore =
  globalThis.otpStore ?? new Map<string, OtpEntry>();
if (process.env.NODE_ENV !== 'production') {
  globalThis.otpStore = otpStore;
}

// Cleanup expired entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of otpStore.entries()) {
      if (entry.expiresAt < now) {
        otpStore.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

export function getOtpStore() {
  return otpStore;
}

export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function safeLowerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type { OtpEntry };

