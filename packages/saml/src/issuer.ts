import { inflateRawSync, inflateSync } from 'node:zlib'

const ISSUER_RE = /<(?:[\w.-]+:)?Issuer\b[^>]*>([^<]+)<\/(?:[\w.-]+:)?Issuer>/i

function decodeBase64Saml(encoded: string): Buffer {
  const normalized = encoded.replace(/ /g, '+')
  return Buffer.from(normalized, 'base64')
}

/** Decode a SAMLRequest/SAMLResponse payload (HTTP-Redirect deflate or HTTP-POST base64). */
export function decodeSamlMessage(
  encoded: string,
  binding: 'redirect' | 'post' = 'redirect'
): string {
  const buf = decodeBase64Saml(encoded)
  if (binding === 'post') {
    return buf.toString('utf8')
  }
  try {
    return inflateRawSync(buf).toString('utf8')
  } catch {
    try {
      return inflateSync(buf).toString('utf8')
    } catch {
      return buf.toString('utf8')
    }
  }
}

/** Issuer from a SAML AuthnRequest or LogoutRequest XML string. */
export function extractSamlIssuerFromXml(xml: string): string | null {
  const match = xml.match(ISSUER_RE)
  const issuer = match?.[1]?.trim()
  return issuer || null
}

export function extractSamlIssuer(
  encoded: string,
  binding: 'redirect' | 'post' = 'redirect'
): string | null {
  try {
    return extractSamlIssuerFromXml(decodeSamlMessage(encoded, binding))
  } catch {
    return null
  }
}
