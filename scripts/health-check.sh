#!/bin/bash
URL=$1
RETRIES=$2
WAIT=$3

if [ -z "$URL" ]; then
  echo "Usage: ./health-check.sh <url> [retries] [wait_time]"
  exit 1
fi

RETRIES=${RETRIES:-5}
WAIT=${WAIT:-5}

echo "Checking health of $URL..."

for i in $(seq 1 $RETRIES); do
  if curl -s -f "$URL" > /dev/null; then
    echo "Health check passed!"
    exit 0
  fi
  echo "Attempt $i/$RETRIES failed. Retrying in $WAIT seconds..."
  sleep $WAIT
done

echo "Health check failed after $RETRIES attempts."
exit 1