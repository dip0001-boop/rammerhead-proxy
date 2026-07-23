FROM node:18-alpine

WORKDIR /app

COPY package.json ./

# Install all dependencies without skipping devDependencies during build
RUN npm install --production=false

COPY . .

RUN npm run build

EXPOSE 8000

CMD ["npm", "start"]
