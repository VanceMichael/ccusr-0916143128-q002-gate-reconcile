FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV EXHIBIT_DB_PATH=/app/data/exhibits.sqlite3
CMD ["sh", "-c", "npm run db:migrate && npm start"]
