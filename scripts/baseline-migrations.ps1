# Mark all existing Prisma migrations as applied (baseline after db push)
$migrations = @(
  "20241015000000_add_contact_messages_table",
  "20241016000000_add_order_email_fields",
  "20250107180000_rename_gender_to_interested_in",
  "20250115000000_add_search_vector",
  "20250116000000_add_sizes_to_search_vector",
  "20250117000000_add_categories_to_search_vector",
  "20250118000000_add_hebrew_category_fields",
  "20250118000001_update_search_vector_with_hebrew_categories",
  "20250925115438_init",
  "20250925121852_fix_category_relation",
  "20250925124727_update_product_schema",
  "20250930105906_add_checkout_table",
  "20250930110000_add_order_email_fields",
  "20251109000000_add_coupons_system",
  "20251109000100_add_coupons_system",
  "20251110000100_add_bogo_groups",
  "20251215120208_users_firebase_uid_uuid",
  "20251221125345_add_last_login_at",
  "20251225130000_add_orders_user_id",
  "20251225131000_add_points_table",
  "20260105131500_users_phone_unique",
  "20260105131600_convert_phones_to_e164",
  "20260107120000_drop_user_password_fields",
  "20260107173114_jordancheck",
  "20260107180000_add_address_city",
  "20260114100316_add_sms_tracking_to_orders",
  "20260115154434_add_order_item_fields",
  "20260120000000_normalize_all_phones_to_e164",
  "20260121123000_add_verifone_customer_no",
  "20260126000000_add_verifone_invoice_fields",
  "20260126000001_change_points_to_decimal",
  "add_phone_verified_and_signup_completed_fields"
)
foreach ($m in $migrations) {
  Write-Host "Resolving --applied: $m"
  npx prisma migrate resolve --applied $m
  if ($LASTEXITCODE -ne 0) { Write-Warning "Failed: $m" }
}
