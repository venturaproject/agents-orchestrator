FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3001
RUN apk add --no-cache git
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY app.js ./app.js
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts ./scripts
USER node
EXPOSE 3001
CMD ["npm", "start"]
