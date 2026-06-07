.PHONY: all dev build deploy test clean

all: build

dev:
	cd backend/services/auth-service && npm run dev &
	cd backend/services/chat-service && npm run dev &
	cd backend/services/media-service && npm run dev &
	cd admin-dashboard && npm run dev &
	cd web-client && npm run dev

build:
	cd backend/services/auth-service && npm ci && npm run build
	cd backend/services/chat-service && npm ci && npm run build
	cd backend/services/media-service && npm ci && npm run build
	cd admin-dashboard && npm ci && npm run build
	cd web-client && npm ci && npm run build

test:
	cd backend/services/auth-service && npm test
	cd backend/services/chat-service && npm test

docker-build:
	docker build -t nexus-auth backend/services/auth-service
	docker build -t nexus-chat backend/services/chat-service
	docker build -t nexus-media backend/services/media-service

deploy:
	bash scripts/deploy-production.sh

clean:
	find backend -name node_modules -type d -exec rm -rf {} +
	find backend -name dist -type d -exec rm -rf {} +
	rm -rf admin-dashboard/node_modules web-client/node_modules
