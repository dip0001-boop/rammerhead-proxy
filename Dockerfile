FROM node:18

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the Rammerhead source
COPY . .

# Build Rammerhead
RUN npm run build

# Expose Rammerhead's port
EXPOSE 8080

# Start the Rammerhead server
CMD ["node", "src/server.js"]
