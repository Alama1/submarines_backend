#!/bin/sh
set -e

envsubst '${FIREBASE_API_KEY} ${FIREBASE_AUTH_DOMAIN} ${FIREBASE_PROJECT_ID} ${FIREBASE_STORAGE_BUCKET} ${FIREBASE_MESSAGING_SENDER_ID} ${FIREBASE_APP_ID}' \
  < /etc/nginx/admin-config.js.template \
  > /usr/share/nginx/html/config.js
