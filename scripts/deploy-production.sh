#!/bin/bash
set -euo pipefail

ENV=${1:-production}
echo "Deploying Nexus Platform to $ENV..."

# Build all Docker images
for svc in auth-service chat-service media-service search-service ai-service notification-service payment-service; do
  echo "Building $svc..."
  docker build -t ghcr.io/nexus-platform/$svc:latest backend/services/$svc
  docker push ghcr.io/nexus-platform/$svc:latest
done

# Apply Terraform
cd infrastructure/terraform/aws
terraform init
terraform plan -var="environment=$ENV" -out=tfplan
terraform apply tfplan

# Apply Kubernetes
kubectl apply -f infrastructure/kubernetes/base/
kubectl rollout status deployment/auth-service -n nexus-platform --timeout=5m
kubectl rollout status deployment/chat-service -n nexus-platform --timeout=5m

# Verify
kubectl get pods -n nexus-platform
kubectl get svc -n nexus-platform
echo "Deployment complete!"