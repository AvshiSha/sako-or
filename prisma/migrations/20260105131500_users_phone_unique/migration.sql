/*
  Add uniqueness for users.phone.

  Note: This will fail if there are existing duplicate non-null phone values.
  You can identify duplicates with:
    SELECT phone, COUNT(*) FROM public.users WHERE phone IS NOT NULL GROUP BY phone HAVING COUNT(*) > 1;
*/

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "public"."users"("phone");


