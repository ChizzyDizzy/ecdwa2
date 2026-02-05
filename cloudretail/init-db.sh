#!/bin/bash
# Creates all 5 databases inside a single PostgreSQL instance.
# Mounted into /docker-entrypoint-initdb.d/ so it runs automatically
# on first container start. Mirrors the AWS RDS single-instance setup.

set -e

for db in cloudretail_users cloudretail_products cloudretail_orders cloudretail_inventory cloudretail_payments; do
  echo "Creating database: $db"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE $db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
EOSQL
done

echo "All databases created successfully."
