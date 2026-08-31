FROM denoland/deno:alpine

# The port that your application listens to.
EXPOSE 3021

ENV PORT=3021

WORKDIR /app

RUN chown -R deno:deno /app

# Install system dependencies
RUN apk add --no-cache zip unzip ffmpeg python3

# Prefer not to run as root.
USER deno

# Cache the dependencies as a layer (the following two steps are re-run only when deps.ts is modified).
# Ideally cache deps.ts will download and compile _all_ external files used in app.ts.
# COPY deps.ts .
# RUN deno cache deps.ts

# These steps will be re-run upon each file change in your working directory:
COPY . .
# Compile the main app so that it doesn't need to be compiled each startup/entry.
# RUN deno cache main.js

CMD ["run","--env","--allow-net","--allow-env","--allow-read","--allow-write","--allow-run=zipinfo,unzip,ffmpeg,python","./src/app.ts"]
