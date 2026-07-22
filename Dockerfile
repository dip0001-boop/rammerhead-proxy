FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

# Rammerhead default port
EXPOSE 8081

# Start Rammerhead server
CMD ["node", "src/server.js"]
