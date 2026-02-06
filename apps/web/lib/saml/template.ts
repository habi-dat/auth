import { type IdentityProvider, SamlLib, type ServiceProvider } from 'samlify'
import type { SamlUser } from './config'

export const buildLoginResponseTemplate = () => {
  let attributes = `${['username', 'uid', 'place', 'email', 'title'].map((attribute) => `<saml:Attribute Name="${attribute}" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="xs:string">{attr_${attribute}}</saml:AttributeValue></saml:Attribute>`).join('')}`
  attributes += `<saml:Attribute Name="groups" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">{attr_groups}</saml:Attribute>`
  return `<?xml version="1.0" encoding="utf-8"?><samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="{ID}" Version="2.0" IssueInstant="{IssueInstant}" Destination="{Destination}" InResponseTo="{InResponseTo}"><saml:Issuer>{Issuer}</saml:Issuer><samlp:Status><samlp:StatusCode Value="{StatusCode}" /></samlp:Status><saml:Assertion xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="{AssertionID}" Version="2.0" IssueInstant="{IssueInstant}"><saml:Issuer>{Issuer}</saml:Issuer><saml:Subject><saml:NameID Format="{NameIDFormat}">{NameID}</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="{SubjectConfirmationDataNotOnOrAfter}" Recipient="{SubjectRecipient}" InResponseTo="{InResponseTo}" /></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="{ConditionsNotBefore}" NotOnOrAfter="{ConditionsNotOnOrAfter}"><saml:AudienceRestriction><saml:Audience>{Audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="{ConditionsNotOnOrAfter}" SessionNotOnOrAfter="{ConditionsNotOnOrAfter}" SessionIndex="{AssertionID}"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement><saml:AttributeStatement>${attributes}</saml:AttributeStatement></saml:Assertion></samlp:Response>`
}

export const createTemplateCallback =
  (
    _idp: ReturnType<typeof IdentityProvider>,
    _sp: ReturnType<typeof ServiceProvider>,
    user: SamlUser,
    requestId: string
  ) =>
  (template: string) => {
    if (!_idp.entitySetting.generateID) {
      throw new Error('Cannot generate IDs for SAML response')
    }

    const _id = _idp.entitySetting.generateID()
    const now = new Date()

    const spEntityID = _sp.entityMeta.getEntityID() as string

    const assertionID = _idp.entitySetting.generateID()

    const acs = _sp.entityMeta.getAssertionConsumerService('post') as string
    const fiveMinutesLater = new Date(now.getTime())
    fiveMinutesLater.setMinutes(fiveMinutesLater.getMinutes() + 5)

    const tvalue: Record<string, string | null | undefined> = {
      ID: _id,
      AssertionID: assertionID,
      Destination: acs,
      Audience: spEntityID,
      SubjectRecipient: acs,
      NameIDFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:unspecified',
      NameID: user.uid,
      Issuer: _idp.entityMeta.getEntityID() as string,
      IssueInstant: now.toISOString(),
      ConditionsNotBefore: now.toISOString(),
      ConditionsNotOnOrAfter: fiveMinutesLater.toISOString(),
      SubjectConfirmationDataNotOnOrAfter: fiveMinutesLater.toISOString(),
      AssertionConsumerServiceURL: acs,
      EntityID: spEntityID,
      InResponseTo: requestId,
      StatusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
      attr_username: user.username,
      attr_uid: user.uid,
      attr_place: user.location,
      attr_email: user.email,
      attr_title: user.title,
      attr_groups: (user.groups || [])
        .map((group) => `<saml:AttributeValue xsi:type="xs:string">${group}</saml:AttributeValue>`)
        .join(''),
    }

    const result = {
      id: _id,
      context: SamlLib.replaceTagsByValue(template, tvalue),
    }

    console.log('createTemplateCallback returning:', {
      id: result.id,
      contextType: typeof result.context,
      contextLength: result.context?.length,
    })

    return result
  }
