#!/bin/sh
set -eu

echo "Applying database migrations..."
npm exec --workspace @nimto/api prisma migrate deploy

echo "Starting Nimto API..."
exec "$@"
