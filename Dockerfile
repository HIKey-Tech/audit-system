# syntax=docker/dockerfile:1
# IAMS backend (Express + Prisma). Multi-stage:
#   deps      — full npm install (dev deps included; needed by build + db tools)
#   build     — prisma generate + tsc. Also serves as the "db tools" image:
#               it keeps prisma CLI, ts-node, and prisma/ so `migrate deploy`
#               and `db seed` run from this target (see docker-compose.prod.yml).
#   prod-deps — production-only node_modules
#   runtime   — slim final image: dist + prod deps + generated Prisma client

# Full (non-slim) node image in every stage: Prisma detects the OpenSSL version
# when generating its client, and the slim image (no openssl) makes it guess
# 1.1.x — which then can't initialize on the OpenSSL-3 runtime image. Keeping
# all stages on the same base removes the guesswork. (apt is blocked on the
# GBB network, so openssl can't simply be installed into slim.)
FROM node:20-bookworm AS deps
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

FROM node:20-bookworm AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
# prisma CLI + typescript survive --omit=dev as optional peers of
# @prisma/client; the runtime needs only the generated client (overlaid from
# the build stage below), so drop ~120MB of build tooling.
RUN npm ci --omit=dev \
    && rm -rf node_modules/prisma node_modules/typescript node_modules/@prisma/engines \
              node_modules/.bin/prisma node_modules/.bin/tsc node_modules/.bin/tsserver

# Full (non-slim) image: it already ships openssl (Prisma engine) and
# ca-certificates (outbound TLS). GBB egress blocks apt entirely — plain http
# gets 403 and the slim image lacks the CA roots to bootstrap https — so the
# runtime stage must not need apt at all.
FROM node:20-bookworm AS runtime
ENV NODE_ENV=production
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
