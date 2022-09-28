# SAML key generation

> mkdir -p data/saml
> openssl genrsa -out data/saml/key.pem 4096
> openssl req -new -x509 -key data/saml/key.pem -out data/saml/cert.cer -days 3650

