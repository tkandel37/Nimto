#!/bin/sh
set -eu

echo "Applying database migrations..."
MIGRATION_URL="${MIGRATION_DATABASE_URL:-${DIRECT_URL:-}}"
if [ -n "$MIGRATION_URL" ]; then
  DATABASE_URL="$MIGRATION_URL" \
    DIRECT_URL="$MIGRATION_URL" \
    npm exec --workspace @nimto/api prisma migrate deploy
elif [ "${NODE_ENV:-}" = "production" ]; then
  echo "MIGRATION_DATABASE_URL or DIRECT_URL is required in production." >&2
  exit 1
else
  npm exec --workspace @nimto/api prisma migrate deploy
fi
unset MIGRATION_URL MIGRATION_DATABASE_URL

if [ "${RUN_DATABASE_SEED:-false}" = "true" ]; then
  echo "Running explicitly enabled database seed..."
  npm exec --workspace @nimto/api prisma db seed
fi
unset SUPER_ADMIN_PASSWORD SUPER_ADMIN_EMAIL SUPER_ADMIN_NAME RUN_DATABASE_SEED

echo "Starting Nimto API..."
exec "$@"
