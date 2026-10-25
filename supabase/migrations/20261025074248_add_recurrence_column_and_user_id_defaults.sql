/*
# Add recurrence column and fix user_id defaults for PocketPath

## Purpose
PocketPath now supports recurring transactions (monthly/weekly). The
pocketpath_transactions table needs a JSONB column to store recurrence rules.
Additionally, all four PocketPath tables need `DEFAULT auth.uid()` on their
`user_id` columns so that inserts from the authenticated client (which omit
`user_id`) succeed against the RLS `WITH CHECK (auth.uid() = user_id)` policy.

## Changes

### 1. New column: pocketpath_transactions.recurring (jsonb, nullable)
- Stores a `RecurrenceRule` object: `{ interval: 'monthly'|'weekly', dayOfMonth?, dayOfWeek?, endDate? }`
- NULL means the transaction is non-recurring (the default)
- Does NOT affect existing rows — they remain non-recurring

### 2. Fix user_id defaults (all four tables)
- `pocketpath_transactions.user_id` — add `DEFAULT auth.uid()`
- `pocketpath_settings.user_id` — add `DEFAULT auth.uid()`
- `pocketpath_savings_goals.user_id` — add `DEFAULT auth.uid()`
- `pocketpath_budget_targets.user_id` — add `DEFAULT auth.uid()`

Without this default, an `INSERT` that omits `user_id` (as the Supabase JS
client does) produces `user_id = NULL`, which fails the RLS check
`auth.uid() = user_id` and throws a row-level security error.

## Security
- No changes to existing RLS policies or grants
- No new tables
- No data is deleted or modified — only a nullable column is added and
  defaults are set on existing columns

## Important notes
1. The `recurring` column is nullable so existing rows are unaffected
2. The `user_id` default uses `auth.uid()` which resolves per-request from
   the authenticated session — it is NOT a static value
3. Existing rows with non-null `user_id` are not changed by adding a default
*/
