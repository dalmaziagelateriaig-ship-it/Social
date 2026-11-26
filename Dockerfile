FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    TZ=Europe/Rome \
    NODE_NO_WARNINGS=1 \
    DATABASE_PATH=/data/pglite \
    MEDIA_PATH=/data/media
COPY --from=build /app ./
VOLUME /data
EXPOSE 3000
CMD ["sh", "-c", "npx next start -p ${PORT:-3000}"]
