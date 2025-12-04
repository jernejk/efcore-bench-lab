#!/bin/bash

# EF Core Performance Lab - Seed Database

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🗃️ Seeding database..."

# Run the SQL scripts
docker exec -i efcore-perf-sqlserver /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P 'YourStrong@Passw0rd' -C \
    -i /docker-entrypoint-initdb.d/01-create-database.sql

docker exec -i efcore-perf-sqlserver /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P 'YourStrong@Passw0rd' -C \
    -i /docker-entrypoint-initdb.d/02-seed-data.sql

echo "✅ Database seeded successfully!"

