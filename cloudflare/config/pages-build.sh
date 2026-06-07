#!/bin/bash
# Cloudflare Pages build script

echo "Building Nexus Platform for Cloudflare Pages..."

# Install dependencies
npm ci

# Build web client
cd web-client
npm ci
npx vite build --outDir ../dist/web-client

# Build admin dashboard
cd ../admin-dashboard
npm ci
npx vite build --outDir ../dist/admin-dashboard

echo "Build complete!"