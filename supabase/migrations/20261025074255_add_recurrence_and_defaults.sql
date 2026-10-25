/*
# Add recurrence JSONB column and user_id defaults for PocketPath

## Purpose
PocketPath now supports recurring transactions. The pocketpath_transactions
table needs a JSONB column to store recurrence rules. All four tables also
need DEFAULT auth.uid() on user_id so client inserts succeed.

## Changes
1. Add pocketpath_transactions.recurring (jsonb, nullable, default null)
2. Set DEFAULT auth.uid() on user_id for all four pocketpath tables

## Security
- No changes to RLS policies or grants
- No data deleted or modified
*/

-- 1. Add recurring column to transactions (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pocketpath_transactions'
    AND column_name = 'recurring'
  ) THEN
    ALTER TABLE pocketpath_transactions
      ADD COLUMN recurring jsonb DEFAULT null;
  END IF;
END $$;

-- 2. Set DEFAULT auth.uid() on user_id for all four tables
--    (idempotent: ALTER ... SET DEFAULT is safe to re-run)
ALTER TABLE pocketpath_transactions
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE pocketpath_settings
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE pocketpath_savings_goals
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE pocketpath_budget_targets
  ALTER COLUMN user_id SET DEFAULT auth.uid();
