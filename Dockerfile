# ---- Base ----
FROM node:22-alpine AS base
WORKDIR /usr/src/app
COPY package.json .npmrc ./

# ---- Dependencies ----
FROM base AS dependencies
RUN npm install --omit=dev

# ---- Build ----
FROM base AS build
COPY . .
RUN npm install
RUN npm run build

# ---- Release ----
FROM dependencies AS release
COPY --from=build /usr/src/app/dist ./dist
COPY vision_key.json ./
EXPOSE 3002
CMD ["node", "dist/main"]
