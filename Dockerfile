FROM node:18-alpine

WORKDIR /app

# Install git and build tools required for git dependencies
RUN apk add --no-cache git python3 make g++

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build assets
RUN npm run build

EXPOSE 8000

CMD ["npm", "start"]
