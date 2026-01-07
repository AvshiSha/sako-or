-- Normalize all phone numbers to E.164 format (+972...)
-- This migration handles any remaining local format numbers and edge cases
-- It complements the previous migration (20260105131600_convert_phones_to_e164)

-- Step 1: Convert local format (0XXXXXXXXX) to E.164 (+972XXXXXXXXX)
-- Handles 9-10 digit numbers starting with 0 that weren't caught by previous migration
UPDATE users
SET phone = '+972' || substring(phone from 2)
WHERE phone IS NOT NULL
  AND phone ~ '^0\d{8,9}$'
  AND phone NOT LIKE '+%';

-- Step 2: Handle numbers that might have spaces, dashes, or other formatting
-- Extract digits and convert if it's a valid Israeli number in local format
UPDATE users
SET phone = '+972' || substring(regexp_replace(phone, '\D', '', 'g') from 2)
WHERE phone IS NOT NULL
  AND phone NOT LIKE '+%'
  AND regexp_replace(phone, '\D', '', 'g') ~ '^0\d{8,9}$';

-- Step 3: Handle numbers that start with 972 (without +)
UPDATE users
SET phone = '+' || phone
WHERE phone IS NOT NULL
  AND phone ~ '^972\d{8,9}$'
  AND phone NOT LIKE '+%';

-- Step 4: Clean up any remaining invalid phone numbers
-- Set to NULL if the phone doesn't match E.164 format after normalization attempts
-- This ensures data integrity
UPDATE users
SET phone = NULL
WHERE phone IS NOT NULL
  AND phone !~ '^\+972\d{8,9}$';

-- Note: This migration ensures all phone numbers are in E.164 format (+972XXXXXXXXX)
-- Any phone number that cannot be normalized will be set to NULL for data integrity

