FROM mcr.microsoft.com/playwright:v1.61.0-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV SCRAPER_WORKER_ROLE=worker

EXPOSE 3000
CMD ["npm", "run", "start:worker"]
