-- Convert existing Israeli local phone numbers (0XXXXXXXXX) to E.164 format (+972XXXXXXXXX)
-- This ensures consistency with Firebase phone authentication and prevents duplicates

-- Update phones that start with '0' and are 9-10 digits (Israeli local format)
UPDATE users
SET phone = '+972' || substring(phone from 2)
WHERE phone IS NOT NULL
  AND phone ~ '^0\d{8,9}$'
  AND phone NOT LIKE '+%';

-- Leave phones that already start with '+972' unchanged
-- Leave NULL phones unchanged

