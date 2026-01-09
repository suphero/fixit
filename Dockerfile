FROM node:18-alpine

RUN set -ex; \
  apk update; \
  apk add --no-cache \
  openssl

ENV PORT=3000

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies) for the build
RUN npm ci

COPY . .

# Run the build process
RUN npm run build

# Prune dev dependencies and clean cache for production
RUN npm prune --omit=dev && npm cache clean --force

# Remove CLI packages since we don't need them in production
RUN npm remove @shopify/cli

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/healthcheck', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

CMD ["npm", "run", "docker-start"]
