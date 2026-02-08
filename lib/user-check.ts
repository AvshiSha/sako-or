import { prisma } from './prisma';
import { normalizeIsraelE164 } from './phone';

/**
 * Checks if a user exists by email in the database.
 * Returns true if user exists, false otherwise.
 */
export async function userExistsByEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;
  
  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true }
    });
    
    return !!user;
  } catch (error) {
    console.error('[USER CHECK] Error checking user by email:', error);
    return false;
  }
}

/**
 * Converts E.164 format (+972...) to local Israeli format (05...)
 * Used for backward compatibility with old records.
 */
function e164ToLocal(e164: string): string | null {
  if (!e164.startsWith('+972')) return null;
  const digits = e164.slice(4); // Remove +972
  if (digits.length < 8 || digits.length > 9) return null;
  return `0${digits}`;
}

/**
 * Checks if a user exists by phone number in the database.
 * Returns true if user exists, false otherwise.
 * 
 * Accepts phone in various formats and normalizes to E.164 before checking.
 * For backward compatibility, also checks local format (05...) if E.164 lookup fails.
 */
export async function userExistsByPhone(phone: string | null | undefined): Promise<boolean> {
  if (!phone) return false;
  
  const normalizedPhone = normalizeIsraelE164(phone);
  if (!normalizedPhone) return false;
  
  try {
    // First, try E.164 format (the correct format)
    const userE164 = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true }
    });
    
    if (userE164) return true;
    
    // For backward compatibility: try local format (05...) if E.164 not found
    // This handles old records that might still be in local format
    const localFormat = e164ToLocal(normalizedPhone);
    if (localFormat) {
      const userLocal = await prisma.user.findUnique({
        where: { phone: localFormat },
        select: { id: true }
      });
      
      if (userLocal) {
        // If found in local format, update it to E.164 for consistency
        // This gradually migrates old records
        try {
          await prisma.user.update({
            where: { phone: localFormat },
            data: { phone: normalizedPhone }
          });
        } catch (updateError) {
          // Ignore update errors (e.g., if phone already exists in E.164 format)
          // The lookup still succeeded, so return true
        }
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('[USER CHECK] Error checking user by phone:', error);
    return false;
  }
}

