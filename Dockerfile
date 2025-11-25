# ---- builder ----
FROM node:20-bullseye AS builder
WORKDIR /app

# reduce install times by copying package manifests first
COPY package*.json pnpm-lock.yaml* yarn.lock* ./
# if you use npm (package-lock.json) the above will still work; adjust if you use pnpm/yarn
RUN npm ci --legacy-peer-deps

# copy source and build
COPY . .
# ensure environment for build (if some build requires envs)
ARG NEXT_PUBLIC_BUILD_VAR=""
ENV NEXT_PUBLIC_BUILD_VAR=${NEXT_PUBLIC_BUILD_VAR}

RUN npm run build

# ---- runner ----
FROM node:20-bullseye-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# copy only what we need for production
COPY package*.json ./
RUN npm ci --production --legacy-peer-deps

# copy build output & public & next config
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Healthcheck (optional)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start: ensure your package.json has "start" script as below
CMD ["npm", "run", "start"]
