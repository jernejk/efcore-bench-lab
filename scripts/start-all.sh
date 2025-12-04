#!/bin/bash

# EF Core Bench Lab - Start All Services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting EF Core Bench Lab..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start SQL Server
echo "📦 Starting SQL Server..."
cd "$PROJECT_ROOT/db"
docker-compose up -d

# Wait for SQL Server to be ready
echo "⏳ Waiting for SQL Server to be ready..."
sleep 10

# Check if database exists, if not run seed scripts
echo "🗃️ Checking database..."
# Note: You may need to run the seed scripts manually the first time

# Start WebAPI
echo "🔧 Starting WebAPI on port 5847..."
cd "$PROJECT_ROOT/webapi/EFCorePerf.Api"
dotnet run &
WEBAPI_PID=$!

# Wait for WebAPI to start
sleep 5

# Start Dashboard
echo "🎨 Starting Dashboard on port 3847..."
cd "$PROJECT_ROOT/dashboard"
npm run dev &
DASHBOARD_PID=$!

echo ""
echo "✅ All services started!"
echo ""
echo "📍 Dashboard:  http://localhost:3847"
echo "📍 WebAPI:     http://localhost:5847"
echo "📍 Swagger:    http://localhost:5847/swagger"
echo "📍 SQL Server: localhost:11433"
echo ""
echo "Press Ctrl+C to stop all services..."

# Wait for interrupt
trap "kill $WEBAPI_PID $DASHBOARD_PID 2>/dev/null; docker-compose -f $PROJECT_ROOT/db/docker-compose.yml down" EXIT
wait

