-- ============================================================
-- Migration: Add is_restricted column to profiles table
-- Purpose: Allows admins to freeze/unfreeze customer accounts
--
-- Run this in your Supabase SQL editor (Project > SQL Editor)
-- ============================================================

-- 1. Add the column (safe to run multiple times — IF NOT EXISTS)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_restricted boolean NOT NULL DEFAULT false;

-- 2. Add a comment for documentation
COMMENT ON COLUMN profiles.is_restricted IS
  'When true, the customer account is frozen. They cannot log in or place new shipments.';

-- 3. (Optional) Add an index for fast admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_restricted ON profiles(is_restricted);

-- 4. Verify: view restricted vs active counts
SELECT
  is_restricted,
  COUNT(*) AS count
FROM profiles
WHERE role = 'customer'
GROUP BY is_restricted;
