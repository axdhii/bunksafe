-- Run once on an existing database created from an older supabase_schema.sql
ALTER TABLE "Student"
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT,
  ADD COLUMN IF NOT EXISTS "batch" TEXT DEFAULT 'B1';
