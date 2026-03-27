#!/bin/bash
set -e

ENV=$1
if [ -z "$ENV" ]; then
  echo "Usage: ./deploy.sh <environment>"
  exit 1
fi

echo "Deploying to $ENV..."

# Tag current running image as backup (if exists)
docker tag ${DOCKERHUB_USERNAME}/verinode:$ENV ${DOCKERHUB_USERNAME}/verinode:$ENV-backup || echo "No existing image to backup"

# Pull latest image
docker-compose -f docker-compose.$ENV.yml pull

# Update deployment
docker-compose -f docker-compose.$ENV.yml up -d

# Wait for health check
echo "Waiting for service to be healthy..."
set +e
./scripts/health-check.sh http://localhost:4000/health 10 5
HEALTH_CHECK_STATUS=$?
set -e

if [ $HEALTH_CHECK_STATUS -eq 0 ]; then
  echo "Deployment successful!"
else
  echo "Deployment failed! Rolling back..."
  ./scripts/rollback.sh $ENV
  exit 1
fi