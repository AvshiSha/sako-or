/**
 * Phone number utilities for Israel E.164 format
 * 
 * E.164 format for Israel: +972 followed by 8-9 digits
 * Examples:
 *   +972501234567 (mobile)
 *   +97236001234 (landline)
 */

/**
 * Normalizes an Israeli phone number to canonical E.164 format.
 * 
 * Accepts:
 * - E.164 format: +972501234567
 * - Local format: 0501234567
 * - With spaces/hyphens: +972 50-123-4567 or 050-123-4567
 * 
 * Returns canonical E.164 (digits only after +): +972501234567
 * Returns null if input is invalid or empty.
 */
export function normalizeIsraelE164(input: string | null | undefined): string | null {
  if (!input) return null
  
  const trimmed = input.trim()
  if (!trimmed) return null
  
  // Extract all digits
  const digits = trimmed.replace(/\D/g, '')
  
  // Handle different input formats
  let e164: string
  
  if (trimmed.startsWith('+972')) {
    // Already E.164 format: +972XXXXXXXXX
    // Validate digit count before constructing
    const afterCode = digits.slice(3)
    if (afterCode.length < 8 || afterCode.length > 9) return null
    e164 = `+972${afterCode}`
  } else if (digits.startsWith('972')) {
    // International without +: 972XXXXXXXXX
    // Validate digit count before constructing
    const afterCode = digits.slice(3)
    if (afterCode.length < 8 || afterCode.length > 9) return null
    e164 = `+972${afterCode}`
  } else if (digits.startsWith('0')) {
    // Israeli local format: 0XXXXXXXXX -> +972XXXXXXXXX
    // Validate digit count: should be 9-10 digits total (0 + 8-9 digits)
    if (digits.length < 9 || digits.length > 10) return null
    e164 = `+972${digits.slice(1)}`
  } else {
    // Invalid format
    return null
  }
  
  // Double-check validation
  if (!isValidIsraelE164(e164)) {
    return null
  }
  
  return e164
}

/**
 * Validates that a phone number is in valid Israel E.164 format.
 * 
 * Requirements:
 * - Starts with +972
 * - Followed by 8-9 digits (Israeli numbers after country code)
 * - No spaces or other characters
 * 
 * Examples of valid numbers:
 *   +972501234567 (9 digits - mobile)
 *   +97236001234 (8 digits - landline)
 */
export function isValidIsraelE164(input: string | null | undefined): boolean {
  if (!input) return false
  
  const trimmed = input.trim()
  
  // Must start with +972
  if (!trimmed.startsWith('+972')) return false
  
  // Extract digits after +972
  const afterCountryCode = trimmed.slice(4)
  
  // Must contain only digits
  if (!/^\d+$/.test(afterCountryCode)) return false
  
  // Must be 8-9 digits (Israeli phone numbers)
  const digitCount = afterCountryCode.length
  return digitCount === 8 || digitCount === 9
}

/**
 * Formats an E.164 phone number for display.
 * 
 * Examples:
 *   +972501234567 -> +972 50-123-4567
 *   +97236001234 -> +972 3-600-1234
 */
export function formatIsraelE164ForDisplay(e164: string | null | undefined): string {
  if (!e164 || !isValidIsraelE164(e164)) return e164 || ''
  
  const afterCountryCode = e164.slice(4)
  
  if (afterCountryCode.length === 9) {
    // Mobile: +972 50-123-4567
    return `+972 ${afterCountryCode.slice(0, 2)}-${afterCountryCode.slice(2, 5)}-${afterCountryCode.slice(5)}`
  } else {
    // Landline: +972 3-600-1234
    return `+972 ${afterCountryCode.slice(0, 1)}-${afterCountryCode.slice(1, 4)}-${afterCountryCode.slice(4)}`
  }
}

