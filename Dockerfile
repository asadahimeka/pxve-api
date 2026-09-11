FROM denoland/deno:alpine

# The port that your application listens to.
EXPOSE 3021

ENV PORT=3021

WORKDIR /app

RUN chown -R deno:deno /app

# Install system dependencies
RUN apk add --no-cache unzip ffmpeg

# Prefer not to run as root.
USER deno

# These steps will be re-run upon each file change in your working directory:
COPY . .

CMD ["run", "--allow-all", "./src/app.ts"]
