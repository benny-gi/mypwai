-- Migration 003: Add active/deleted state to invigilator accounts
-- This keeps deleted accounts in the database so access can be revoked immediately
-- and later restored by reissuing a fresh password.

ALTER TABLE users
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role,
  ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER is_active;

UPDATE users
SET is_active = 1,
    deleted_at = NULL
WHERE is_active IS NULL;