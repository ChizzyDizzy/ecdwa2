-- Creates all 5 databases inside a single PostgreSQL instance.
-- Placed in /docker-entrypoint-initdb.d/ so it runs on first container start.
-- The default database (cloudretail_users) is already created via POSTGRES_DB env var.

SELECT 'CREATE DATABASE cloudretail_products' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cloudretail_products')\gexec
SELECT 'CREATE DATABASE cloudretail_orders' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cloudretail_orders')\gexec
SELECT 'CREATE DATABASE cloudretail_inventory' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cloudretail_inventory')\gexec
SELECT 'CREATE DATABASE cloudretail_payments' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cloudretail_payments')\gexec
