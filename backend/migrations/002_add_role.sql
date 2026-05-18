-- Migration 002: Add role column to users table
-- Run this if the users table already exists from 001_init_schema.sql

ALTER TABLE users
  ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'invigilator'
  AFTER password_hash;

-- Update any existing users to have the default role
UPDATE users SET role = 'invigilator' WHERE role IS NULL OR role = '';
