FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=80 \
    DATA_DIR=/data \
    ALLOW_SIGNUPS=false

WORKDIR /app
COPY server/ ./server/
COPY public/ ./public/
RUN mkdir -p /data

VOLUME /data
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/api/health >/dev/null || exit 1

CMD ["node", "server/server.js"]
