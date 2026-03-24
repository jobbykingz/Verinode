#!/bin/bash
set -e

ENV=$1
if [ -z "$ENV" ]; then
  echo "Usage: ./deploy.sh <environment>"
  exit 1
fi

STRATEGY=${DEPLOY_STRATEGY:-docker-compose}
TAG=${DOCKER_TAG:-latest}

echo "Deploying to $ENV..."
echo "Strategy: $STRATEGY"
echo "Tag: $TAG"

if [ "$STRATEGY" == "k8s" ]; then
  # Kubernetes Deployment
  echo "Applying Kubernetes manifests..."
  
  # Update image tag in deployment manifest (assuming standard kustomize or sed)
  if [ -f "kubernetes/overlays/$ENV/deployment.yaml" ]; then
    sed -i "s|image: .*/verinode:.*|image: ${DOCKERHUB_USERNAME}/verinode:${TAG}|" kubernetes/overlays/$ENV/deployment.yaml
    kubectl apply -k kubernetes/overlays/$ENV/
    kubectl rollout status deployment/verinode -n $ENV --timeout=300s
  else
    echo "Kubernetes configuration not found for $ENV"
    exit 1
  fi

else
  # Docker Compose Deployment (Default)
  # Tag current running image as backup (if exists)
  docker tag ${DOCKERHUB_USERNAME}/verinode:$ENV ${DOCKERHUB_USERNAME}/verinode:$ENV-backup || echo "No existing image to backup"

  # Export tag for compose to use
  export VERINODE_IMAGE_TAG=$TAG

  # Pull and Update
  docker-compose -f docker-compose.$ENV.yml pull
  docker-compose -f docker-compose.$ENV.yml up -d
fi

# Wait for health check
echo "Waiting for service to be healthy..."
set +e
./scripts/health-check.sh http://localhost:4000/health 12 10
HEALTH_CHECK_STATUS=$?
set -e

if [ $HEALTH_CHECK_STATUS -eq 0 ]; then
  echo "Deployment successful!"
else
  echo "Deployment failed! Rolling back..."
  ./scripts/rollback.sh $ENV
  exit 1
fi