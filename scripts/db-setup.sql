-- One-time local database setup. Run as the postgres superuser:
--   sudo -u postgres psql -f scripts/db-setup.sql
-- Creates a dedicated role and databases for development and tests.
CREATE ROLE xcel WITH LOGIN PASSWORD 'xcel';
CREATE DATABASE xcel OWNER xcel;
CREATE DATABASE xcel_test OWNER xcel;
