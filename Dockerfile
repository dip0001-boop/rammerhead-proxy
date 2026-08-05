FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 10000

ENV PORT=10000
ENV NODE_ENV=production

# Health check to help Render detect the service
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:10000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["npm", "start"]
