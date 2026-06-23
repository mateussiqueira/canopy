FROM oven/bun:1.3.3

WORKDIR /app

COPY package.json bunfig.toml ./
COPY patches/ ./patches/
COPY packages/ ./packages/

# Lockfile generated on macOS may have platform-specific cache entries.
# Remove it so bun resolves deps fresh for Linux.
RUN rm -f bun.lock && bun install 2>&1 | tail -5

EXPOSE 3000
ENV OPENCODE_SERVER_PASSWORD=canopy

WORKDIR /app/packages/opencode
CMD ["bun", "run", "src/index.ts", "serve", "--port", "3000", "--hostname", "0.0.0.0"]
