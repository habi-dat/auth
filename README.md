# habi\*DAT auth module

This app is a module for the habi\*DAT application platform. It acts as a user managment tool and supports to organize users, groups and discourse discussion categories. Also it acts as an SAML Single Sign On Identity Provider for the other apps of the habi\*DAT platform.

## Installation

Is done via the habi-dat/setup module

## Configuration

A configuration file has to be present in `config/config.json`.
See `templates/config.json` for the template configuration file.

Using the template configuration file, most values can be directly set by using the following environment variables:

- HABIDAT_DOMAIN: the domain of your application and email-account
- HABIDAT_TITLE: the name of the habi\*DAT instance
- HABIDAT_USER_SUBDOMAIN: used subdomain for web-application
- SMTP Configuration:
  - HABIDAT_USER_SMTP_HOST: SMTP host
  - HABIDAT_USER_SMTP_PORT: SMTP port
  - HABIDAT_USER_SMTP_USER
  - HABIDAT_USER_SMTP_PASSWORD
  - HABIDAT_USER_SMTP_TLS: true or false
  - HABIDAT_USER_SMTP_AUTHMETHOD: PLAIN or LOGIN
- LDAP Configuration:
  - HABIDAT_USER_LDAP_HOST: LDAP host
  - HABIDAT_USER_LDAP_PORT: LDAP port
  - HABIDAT_USER_LDAP_BINDDN: LDAP BindDN
  - HABIDAT_USER_LDAP_BASE: LDAP BaseDN
  - HABIDAT_USER_LDAP_PASSWORD: LDAP Password
- Discourse Configuration:
  - HABIDAT_DISCOURSE_API_URL: e.g. discourse.example.org
  - HABIDAT_DISCOURSE_API_KEY
  - HABIDAT_DISCOURSE_API_USERNAME
  - HABIDAT_DISCOURSE_SSO_SECRET
- Nextcloud Configuration:
  - HABIDAT_USER_NEXTCLOUD_DB_HOST
  - HABIDAT_USER_NEXTCLOUD_DB_PORT
  - HABIDAT_USER_NEXTCLOUD_DB_DATABASE
  - HABIDAT_USER_NEXTCLOUD_DB_USER
  - HABIDAT_USER_NEXTCLOUD_DB_PASSWORD
  - HABIDAT_USER_NEXTCLOUD_API_URL: e.g. https://user:secret@cloud.example.org/ocs/v1.php
  - HABIDAT_USER_NEXTCLOUD_DEFAULTQUOTA: e.g. "1 GB"
- Other configuration:
  - HABIDAT_USER_SAML: enable SAML SSO IDP (true or false)
  - HABIDAT_USER_NEXTCLOUD_SUBDOMAIN: e.g. cloud
  - HABIDAT_USER_DISCOURSE_SUBDOMAIN: e.g. discourse
  - HABIDAT_USER_DOKUWIKI_SUBDOMAIN: e.g. dokuwiki
  - HABIDAT_USER_MEDIAWIKI_SUBDOMAIN: e.g. mediawiki
  - HABIDAT_USER_DIREKTKREDIT_SUBDOMAIN: e.g. direktkredit
  - HABIDAT_USER_MAILTRAIN_SUBDOMAIN: e.g. news
  - HABIDAT_USER_INSTALLED_MODULES: e.g. nextcloud,discourse,

## Development

In order to develop the module, you need to:

1. setup a habiDAT instance (https://github.com/habi-dat/setup) with nextcloud and discourse modules and run it.
2. edit `docker/devdocker-compose.dev.yml` and set network names at the top (if they differ from the habiDAT instance)
3. copy `<habiDAT instance>/store/auth/user.env` to `docker/dev/backend.env`
4. copy `docker/dev/frontend.env.sample` to `docker/dev/frontend.env`
5. run `./dev.sh`
6. access by https://dev.user.habidat.local (set hostname to point to 127.0.0.1 in `/etc/hosts` if DNS resolution does not work)
