FROM docker.io/node:24-alpine AS builder

WORKDIR /build

RUN npm install --global pnpm@11.20.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM docker.io/nginx:alpine

EXPOSE 80

COPY --from=builder /build/dist/ /usr/share/nginx/html/
