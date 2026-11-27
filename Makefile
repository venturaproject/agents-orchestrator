.PHONY: dev dev-backend lint architecture-check test build build-backend db-up db-migrate docker-up docker-down docker-logs docker-ps deploy

dev:
	docker compose --env-file .env.local -f infrastructure/compose.db.yml up -d
	npm --prefix backend run db:migrate
	npm --prefix frontend run dev

dev-backend:
	npm --prefix backend run dev

lint:
	npm --prefix frontend run lint
	npm --prefix backend run lint
	$(MAKE) architecture-check

architecture-check:
	npm --prefix frontend run architecture:check
	npm --prefix backend run architecture:check

test:
	npm --prefix frontend test
	npm --prefix backend test

build:
	npm --prefix frontend run build

build-backend:
	npm --prefix backend run build

db-up:
	docker compose --env-file .env.local -f infrastructure/compose.db.yml up -d

db-migrate:
	npm --prefix backend run db:migrate

docker-up:
	./scripts/docker-up.sh

docker-down:
	docker compose --env-file .env.docker -f compose.yml down

docker-logs:
	docker compose --env-file .env.docker -f compose.yml logs -f nginx frontend backend

docker-ps:
	docker compose --env-file .env.docker -f compose.yml ps

deploy:
	./scripts/deploy-serv00.sh
