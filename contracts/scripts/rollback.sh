#!/bin/bash
set -e

ENV=$1
if [ -z "$ENV" ]; then
  echo "Usage: ./rollback.sh <environment>"
  exit 1
fi

echo "Rolling back $ENV..."

# Restore backup tag
docker tag ${DOCKERHUB_USERNAME}/verinode:$ENV-backup ${DOCKERHUB_USERNAME}/verinode:$ENV

# Redeploy previous version
docker-compose -f docker-compose.$ENV.yml up -d
echo "Rollback completed."