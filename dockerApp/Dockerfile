FROM mhart/alpine-node

WORKDIR /usr/scr/app

COPY package.json .

RUN yarn

COPY . .

CMD ["yarn", "start"]
