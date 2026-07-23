FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache git python3 make g++

COPY package.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 10000

CMD ["npm", "start"]
