FROM node:8-alpine

ENV PORT_EXTERNAL 8080
EXPOSE $PORT_EXTERNAL

RUN mkdir -p /app
WORKDIR /app

# Copy package.json
COPY package.json ./
COPY yarn.lock ./

# Install dependecies
RUN yarn install

# Copy files
COPY . ./

CMD ["npm", "start"]
