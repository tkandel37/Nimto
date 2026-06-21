#!/bin/sh
set -eu

echo "Applying database migrations and local seed data..."
npm run prisma:migrate:deploy --workspace @nimto/api

echo "Starting Nimto API..."
exec "$@"
