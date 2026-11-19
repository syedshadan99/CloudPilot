FROM node:24-bookworm-slim AS dependencies
WORKDIR /workspace
RUN chown node:node /workspace
USER node

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps/web/package.json apps/web/
COPY --chown=node:node apps/api/package.json apps/api/
RUN npm ci

FROM dependencies AS api
COPY --chown=node:node apps/api/ apps/api/
RUN npm run build --workspace @cloudpilot/api
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]

FROM dependencies AS web
COPY --chown=node:node apps/web/ apps/web/
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "@cloudpilot/web", "--", "--host", "0.0.0.0"]
