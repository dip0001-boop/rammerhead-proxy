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

# Expose the port Rammerhead uses
EXPOSE 8080

# Start Rammerhead
CMD ["npm", "start"]
