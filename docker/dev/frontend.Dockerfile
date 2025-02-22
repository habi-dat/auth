FROM node:18
RUN \
  apt-get update \
  && apt-get -y install gettext-base \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
WORKDIR /app
