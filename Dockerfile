FROM node:16

ENV HABIDAT_DOMAIN example.com
ENV HABIDAT_TITLE habi*DAT
ENV HABIDAT_ADMIN_EMAIL admin@example.com
ENV HABIDAT_USER_SUBDOMAIN auth
ENV HABIDAT_USER_SMTP_EMAILFROM noreply@example.com
ENV HABIDAT_USER_SMTP_HOST mail.example.com
ENV HABIDAT_USER_SMTP_PORT 25
ENV HABIDAT_USER_SMTP_USER none
ENV HABIDAT_USER_SMTP_PASSWORD none
ENV HABIDAT_USER_SMTP_TLS false
ENV HABIDAT_USER_SMTP_AUTHMETHOD PLAIN
ENV HABIDAT_USER_LDAP_HOST ldap.example.com
ENV HABIDAT_USER_LDAP_PORT 389
ENV HABIDAT_USER_LDAP_BINDDN cn=admin,dc=example,dc=com
ENV HABIDAT_USER_LDAP_BASE dc=example,dc=com
ENV HABIDAT_USER_LDAP_PASSWORD passme
ENV HABIDAT_DISCOURSE_API_URL discourse.example.com
ENV HABIDAT_DISCOURSE_API_KEY iamasecretkey
ENV HABIDAT_DISCOURSE_API_USERNAME admin
ENV HABIDAT_DISCOURSE_SSO_SECRET secret
ENV HABIDAT_USER_NEXTCLOUD_DB_HOST db.example.com
ENV HABIDAT_USER_NEXTCLOUD_DB_PORT 3306
ENV HABIDAT_USER_NEXTCLOUD_DB_DATABASE nextcloud
ENV HABIDAT_USER_NEXTCLOUD_DB_USER nextcloud
ENV HABIDAT_USER_NEXTCLOUD_DB_PASSWORD passme
ENV HABIDAT_USER_NEXTCLOUD_API_URL https://user:secret@cloud.example.org/ocs/v1.php
ENV HABIDAT_USER_NEXTCLOUD_DEFAULTQUOTA "1 GB"
ENV HABIDAT_USER_SAML true
ENV HABIDAT_USER_NEXTCLOUD_SUBDOMAIN cloud
ENV HABIDAT_USER_DISCOURSE_SUBDOMAIN discourse
ENV HABIDAT_USER_DOKUWIKI_SUBDOMAIN dokuwiki
ENV HABIDAT_USER_MEDIAWIKI_SUBDOMAIN mediawiki
ENV HABIDAT_USER_DIREKTKREDIT_SUBDOMAIN direktkredit
ENV HABIDAT_USER_MAILTRAIN_SUBDOMAIN news
ENV HABIDAT_USER_INSTALLED_MODULES nextcloud,discourse,

RUN \
  apt-get update \
  && apt-get -y install gettext-base \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir /app

ADD server /app
ADD client /app/client

WORKDIR /app/client

RUN yarn install && yarn build

RUN mv /app/client/dist /app && mkdir -p /app/public && mv /app/client/src/assets/img /app/public/ && mv /app/client/src/assets/css /app/public/ && rm -rf /app/client

WORKDIR /app

RUN npm install && npm install pm2 -g

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
RUN ln -s usr/local/bin/docker-entrypoint.sh / # backwards compat
ENTRYPOINT ["docker-entrypoint.sh"]

CMD pm2-docker start index.js
