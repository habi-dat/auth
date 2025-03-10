#!/bin/bash
set -e

yarn install
yarn db:generate
yarn db:push

if [ -f templates/config.json ]
then

  mkdir -p data/saml
  mkdir -p data/sessions
  mkdir -p config

  if [ ! -f config/MANUAL_CONFIG ]
  then
    echo "Generating config.json"
    envsubst < templates/config.json > config/config.json
  fi

  if [ ! -f data/emailTemplateStore.json ]
  then
    cp templates/emailTemplateStore.json data/emailTemplateStore.json
  fi

  if [ ! -f data/appStore.json ]
  then
    envsubst < templates/appStore.json > data/appStore.json
  fi

fi

exec "$@"