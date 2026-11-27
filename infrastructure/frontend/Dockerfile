FROM node:26.12.1-alpine AS dependencies
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:26.12.1-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
COPY --from=dependencies /app/frontend/node_modules ./frontend/node_modules
COPY . .
RUN npm --prefix frontend run build

FROM node:26.12.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

RUN apk add --no-cache git \
    && mkdir -p /app/.agent-workspaces \
    && chown -R node:node /app

COPY --from=builder --chown=node:node /app/frontend/package.json ./frontend/package.json
COPY --from=builder --chown=node:node /app/frontend/package-lock.json ./frontend/package-lock.json
COPY --from=builder --chown=node:node /app/frontend/node_modules ./frontend/node_modules
COPY --from=builder --chown=node:node /app/frontend/.next ./frontend/.next
COPY --from=builder --chown=node:node /app/frontend/app ./frontend/app
COPY --from=builder --chown=node:node /app/frontend/components ./frontend/components
COPY --from=builder --chown=node:node /app/frontend/features ./frontend/features
COPY --from=builder --chown=node:node /app/frontend/lib ./frontend/lib
COPY --from=builder --chown=node:node /app/frontend/app.js ./frontend/app.js
COPY --from=builder --chown=node:node /app/frontend/next.config.js ./frontend/next.config.js
COPY --from=builder --chown=node:node /app/frontend/next-env.d.ts ./frontend/next-env.d.ts
COPY --from=builder --chown=node:node /app/frontend/tsconfig.json ./frontend/tsconfig.json
COPY --from=builder --chown=node:node /app/scripts ./scripts

USER node
EXPOSE 3000
CMD ["node", "frontend/app.js"]
