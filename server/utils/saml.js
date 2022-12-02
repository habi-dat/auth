const fs = require('fs');
const samlify = require('samlify');
const apps = require('./apps');
const auth = require('./auth');
const config    = require('../config/config.json');

samlify.setSchemaValidator({
  validate: response => {
    /* implment your own or always returns a resolved promise to skip */
    return Promise.resolve('skipped');
  }
});

const buildLoginResponseTemplate = () => {
  var attributes = '';
  ['username', 'uid', 'place', 'email', 'title', 'groups']
    .forEach(attribute => {
      attributes += `<saml:Attribute Name="${attribute}" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="xs:string">{attr_${attribute}}</saml:AttributeValue></saml:Attribute>`
    })
  return `<?xml version="1.0" encoding="utf-8"?><samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="{ID}" Version="2.0" IssueInstant="{IssueInstant}" Destination="{Destination}" InResponseTo="{InResponseTo}"><saml:Issuer>{Issuer}</saml:Issuer><samlp:Status><samlp:StatusCode Value="{StatusCode}" /></samlp:Status><saml:Assertion xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="{AssertionID}" Version="2.0" IssueInstant="{IssueInstant}"><saml:Issuer>{Issuer}</saml:Issuer><saml:Subject><saml:NameID Format="{NameIDFormat}">{NameID}</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="{SubjectConfirmationDataNotOnOrAfter}" Recipient="{SubjectRecipient}" InResponseTo="{InResponseTo}" /></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="{ConditionsNotBefore}" NotOnOrAfter="{ConditionsNotOnOrAfter}"><saml:AudienceRestriction><saml:Audience>{Audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="{ConditionsNotOnOrAfter}" SessionNotOnOrAfter="{ConditionsNotOnOrAfter}" SessionIndex="{AssertionID}"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement><saml:AttributeStatement>${attributes}</saml:AttributeStatement></saml:Assertion></samlp:Response>`
}

const baseConfig = {
  privateKey: fs.readFileSync('data/saml/key.pem'), // in .pem format
  entityID: config.saml.idp.entityID,
  signingCert: fs.readFileSync('data/saml/cert.cer'),
  singleSignOnService: ['HTTP-Redirect', 'HTTP-POST', 'HTTP-POST-SimpleSign'].map(method => {
    return {
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:' + method,
      Location: config.saml.idp.baseURL + '/sso/SingleSignOnService'
    }
  }),
  singleLogoutService: ['HTTP-Redirect', 'HTTP-POST'].map(method => {
    return {
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:' + method,
      Location: config.saml.idp.baseURL + '/sso/SingleLogoutService'
    }
  }),
  nameIDFormat: [
    'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
    'urn:oasis:names:tc:SAML:2.0:nameid-format:entity',
    'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
    'urn:oasis:names:tc:SAML:1.1:nameid-format:X509SubjectName'
  ],
  loginResponseTemplate: { context: buildLoginResponseTemplate(), attributes: []}
};

const idp = new samlify.IdentityProvider(baseConfig);

const createSp = app => {
  return new samlify.ServiceProvider({
    entityID: app.saml.entityId,
    assertionConsumerService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
      Location: app.saml.acs
    },
    {
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      Location: app.saml.acs
    }],
    singleLogoutService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
      Location: app.saml.slo
    },
    {
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      Location: app.saml.slo
    }],
    nameIDFormat: [
      'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified'
    ],
    signingCert: app.saml.certificate,
    authnRequestsSigned: true,
    wantMessageSigned: app.saml.certificate?true:false
  })
}

const buildUser = user => {
  return {
    uid: user.uid,
    name: user.cn,
    email: user.mail,
    cn: user.cn,
    mail: user.mail,
  }
}

exports.postHtml = (app, response) => {
  var body = exports.postHtmlBody(app, response);
  return `<!DOCTYPE html>
<html><head><meta http-equiv="content-type" content="text/html; charset=utf-8"></head>
  <body onload="document.forms[0].submit()">
    ${body}
  </body>
</html>
`
}

exports.postHtmlBody = (app, response) => {
  var relayStateInput = '';
  if (response.relayState) {
    relayStateInput = `<input type="hidden" name="RelayState" value="${response.relayState}" />`
  }
  return `<form id="sso" method="post" action="${app.saml.acs}" autocomplete="off">
      <input type="hidden" name="SAMLResponse" id="resp" value="${response.context}" />
      ${relayStateInput}
    </form>`
}


const createTemplateCallback = (_idp, _sp, user, requestId) => template => {
  const _id =  _idp.entitySetting.generateID();
  const now = new Date();
  const spEntityID = _sp.entityMeta.getEntityID();
  const assertionID = _idp.entitySetting.generateID()
  const acs = _sp.entityMeta.getAssertionConsumerService('post');
  const idpSetting = _idp.entitySetting;
  const fiveMinutesLater = new Date(now.getTime());
  fiveMinutesLater.setMinutes(fiveMinutesLater.getMinutes() + 5);

  const tvalue = {
   ID: _id,
   AssertionID: assertionID,
   Destination: acs,
   Audience: spEntityID,
   SubjectRecipient: acs,
   NameIDFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:unspecified',
   NameID: user.uid,
   Issuer: _idp.entityMeta.getEntityID(),
   IssueInstant: now.toISOString(),
   ConditionsNotBefore: now.toISOString(),
   ConditionsNotOnOrAfter: fiveMinutesLater.toISOString(),
   SubjectConfirmationDataNotOnOrAfter: fiveMinutesLater.toISOString(),
   AssertionConsumerServiceURL: acs,
   EntityID: spEntityID,
   InResponseTo: requestId,
   StatusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
   attr_username: user.cn,
   attr_uid: user.uid,
   attr_place: user.l,
   attr_email: user.mail,
   attr_title: user.title,
   attr_groups: user.memberGroups.map(group => group.cn).join(',')
  };
  return {
   id: _id,
   context: samlify.SamlLib.replaceTagsByValue(template, tvalue),
  };
};

const sessionAddLoggedInApp = (req, appId) => {
  if (!req.session.samlLoggedInApps) {
    req.session.samlLoggedInApps = [];
  }
  if (!req.session.samlLoggedInApps.includes(appId)) {
    req.session.samlLoggedInApps.push(appId);
  }
}

const sessionGetLoggedInApps = (req) => {
  return req.session.samlLoggedInApps || [];
}

const sessionRemoveLoggedInApp = (req, appId) => {
  if (req.session.samlLoggedInApps && req.session.samlLoggedInApps.includes(appId)) {
    req.session.samlLoggedInApps = req.session.samlLoggedInApps.splice(req.session.samlLoggedInApps.indexOf(appId), 1);
  }

}

exports.parseLoginRequest = (req, app, type) => {
  return idp.parseLoginRequest(createSp(app), type, req);
}

exports.createLoginResponse = (req, app, request, type, user) => {
  const sp = createSp(app);
  return idp.createLoginResponse(sp, request, type, buildUser(user), createTemplateCallback(idp, sp, user, request.extract.request.id))
    .then(response => {
      sessionAddLoggedInApp(req, app.id)
      if (type === 'redirect') {
        return response.context;
      } else {
        return response;
      }
    })
}

exports.loginRedirect = (req, app, request) => {
  return Promise.resolve()
    .then(() => {
      return '/#/login?requestId=' + request.extract.request.id + '&appId=' + app.id;
    })
}

exports.unauthorizedRedirect = (req, app, request) => {
  return Promise.resolve()
    .then(() => {
      return '/#/error?type=unauthorized&appName=' + app.label;
    })
}

exports.buildRequest = (requestId) => {
  return {  extract: { request: { id: requestId }}};
}

exports.initiateLogoutFlow = (req, initiatorId = undefined, initiatorRequest = undefined) => {
  return Promise.resolve()
    .then(() => {
      req.session.samlLogoutFlow = {
        initiatorId: initiatorId,
        initiatorRequest: initiatorRequest,
        queue: sessionGetLoggedInApps(req).filter(appId => appId !== initiatorId)
      }
      return req.session.samlLogoutFlow
    })
}


exports.getLogoutFlow = (req) => {
  return req.session.samlLogoutFlow;
}

exports.createLogoutRequest = (req, app, type) => {
  return Promise.resolve()
    .then(() => {
      const sp = createSp(app);
      const request = idp.createLogoutRequest(sp, 'redirect', { logoutNameID: req.user.uid })
      return request.context;
    })
}

exports.createLogoutResponse = (req, app, request, type) => {
  return Promise.resolve()
    .then(() => {
      const sp = createSp(app);
      const response = idp.createLogoutResponse(sp, request, 'redirect', req.query.RelayState)
      delete req.session.samlLogoutFlow;
      sessionRemoveLoggedInApp(req, app.id);
      return auth.logout(req)
        .then(() => { return response.context; })

    })
}

exports.parseLogoutRequest = (req, app, type) => {
  return idp.parseLogoutRequest(createSp(app), type, req)
    .then(request => {
      return exports.initiateLogoutFlow(req, app.id, request)
        .then(sloFlow => {
          if (sloFlow.queue.length === 0) {
            return exports.createLogoutResponse(req, app, request, 'redirect')
          } else {
            return apps.getApp(sloFlow.queue[0])
              .then(nextApp => {
                return exports.createLogoutRequest(req, nextApp, 'redirect')
              })
          }
        })
    })
}

exports.parseLogoutResponse = (req, app, type) => {
  return idp.parseLogoutResponse(createSp(app), type, req)
    .then(response => {
      var sloFlow = exports.getLogoutFlow(req);
      if (app.id !== sloFlow.queue[0]) {
        throw "SSO logout flow is messed up, here be dragons"
      }
      sloFlow.queue.shift();
      sessionRemoveLoggedInApp(req, app.id);
      if (sloFlow.queue.length === 0) {
        if (sloFlow.initiatorId) {
          return apps.getApp(sloFlow.initiatorId)
            .then(initiatorApp => exports.createLogoutResponse(req, initiatorApp, sloFlow.initiatorRequest, 'redirect'))
        } else {
          delete req.session.samlLogoutFlow;
          return auth.logout(req);
        }
      } else {
        return apps.getApp(sloFlow.queue[0])
          .then(nextApp => {
            return exports.createLogoutRequest(req, nextApp, 'redirect')
          })
      }
    })
}