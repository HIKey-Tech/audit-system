# syntax=docker/dockerfile:1
# IAMS backend (Express + Prisma). Multi-stage:
#   deps      — full npm install (dev deps included; needed by build + db tools)
#   build     — prisma generate + tsc. Also serves as the "db tools" image:
#               it keeps prisma CLI, ts-node, and prisma/ so `migrate deploy`
#               and `db seed` run from this target (see docker-compose.prod.yml).
#   prod-deps — production-only node_modules
#   runtime   — slim final image: dist + prod deps + generated Prisma client

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
# prisma.config.ts loads DATABASE_URL at config-parse time; generate needs no
# real DB, so give it a syntactically valid placeholder for this stage only.
ENV DATABASE_URL="sqlserver://localhost:1433;database=build;user=build;password=build;encrypt=true;trustServerCertificate=true"
COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
# prisma CLI + typescript survive --omit=dev as optional peers of
# @prisma/client; the runtime needs only the generated client (overlaid from
# the build stage below), so drop ~120MB of build tooling.
RUN npm ci --omit=dev \
    && rm -rf node_modules/prisma node_modules/typescript node_modules/@prisma/engines \
              node_modules/.bin/prisma node_modules/.bin/tsc node_modules/.bin/tsserver

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
# openssl: required by Prisma's query engine. ca-certificates: outbound TLS
# (Azure SQL, Entra ID, Microsoft Graph, SMTP).
# apt over https: GBB egress returns 403 on plain-http repo traffic.
RUN sed -i 's|http://|https://|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
# Overlay the Prisma client generated in the build stage (prod-deps has only the stub)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/dist ./dist
COPY package.json ./
# Writable paths: uploads volume target + winston file logs (cwd-relative logs/)
RUN mkdir -p /data/uploads /app/logs && chown -R node:node /data /app/logs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/server.js"]
