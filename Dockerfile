FROM node:24-alpine

# The port that your application listens to.
EXPOSE 3021

ENV PORT=3021

WORKDIR /app

# Install system dependencies (ugoira pipeline needs unzip + ffmpeg)
RUN apk add --no-cache unzip ffmpeg

# Install pnpm and production dependencies first (better layer caching)
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@10 && pnpm install --frozen-lockfile --prod

# Prefer not to run as root.
RUN mkdir -p /app/.cache && chown -R node:node /app
USER node

# Persistent HTTP file cache (CACHE_DIR defaults to ./.cache/http).
# NOTE: do NOT declare VOLUME here — Railway rejects Dockerfile VOLUME
# during validation. Attach a Railway Volume at /app/.cache via the
# dashboard instead (locally: `docker run -v pxve-cache:/app/.cache ...`).

# These steps will be re-run upon each file change in your working directory:
COPY --chown=node:node . .

# NOTE: pass env at run time, e.g. `docker run --env-file .env ...`
# (bake no .env into the image).
CMD ["node", "src/server.ts"]
