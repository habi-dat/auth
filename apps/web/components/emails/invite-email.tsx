import type { InviteEmailConfig } from '@/lib/email/types'
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'

export interface InviteEmailProps extends InviteEmailConfig {
  subject: string
  inviterName: string
  inviteLink: string
  platformName: string
  appUrl: string
  /** Optional logo URL (e.g. `${appUrl}/logo.svg`). Omit to hide logo. */
  logoUrl?: string
}

const defaults: Required<
  Pick<
    InviteEmailProps,
    'greeting' | 'mainText' | 'ctaText' | 'footer' | 'footerHelp' | 'disclaimer'
  >
> = {
  greeting: 'Welcome',
  mainText: 'You have been invited to create an account. Click the button below to accept.',
  ctaText: 'Create account',
  footer: 'If you did not expect this invitation, you can ignore this email.',
  footerHelp: '',
  disclaimer: '',
}

export function InviteEmail({
  subject,
  inviterName,
  inviteLink,
  platformName,
  appUrl,
  greeting = defaults.greeting,
  mainText = defaults.mainText,
  ctaText = defaults.ctaText,
  footer = defaults.footer,
  footerHelp = defaults.footerHelp,
  disclaimer = defaults.disclaimer,
  logoUrl,
}: InviteEmailProps) {
  const replacePlaceholders = (s: string) =>
    s
      .replace(/\{\{?\s*platformName\s*\}\}?/gi, platformName)
      .replace(/\{\{?\s*appUrl\s*\}\}?/gi, appUrl)
      .replace(/\{\{?\s*inviterName\s*\}\}?/gi, inviterName)

  const greetingR = replacePlaceholders(greeting)
  const mainTextR = replacePlaceholders(mainText)
  const ctaTextR = replacePlaceholders(ctaText)
  const footerR = replacePlaceholders(footer)
  const footerHelpR = replacePlaceholders(footerHelp)
  const disclaimerR = replacePlaceholders(disclaimer)

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Row style={logoRow}>
              <Column style={logoRow}>
                {logoUrl ? <Img src={logoUrl} alt="" width={40} height={40} style={logo} /> : null}
                <Text style={greetingHeading}>{greetingR}</Text>
              </Column>
            </Row>
          </Section>

          <Section style={bodySection}>
            <Text style={text}>{mainTextR}</Text>
            <Section style={buttonContainer}>
              <Button style={button} href={inviteLink}>
                {ctaTextR}
              </Button>
            </Section>
          </Section>

          {(footerR || footerHelpR) && (
            <Section style={footerSection}>
              {footerHelpR && <Text style={footerHelpText}>{footerHelpR}</Text>}
              {footerR && <Text style={footerText}>{footerR}</Text>}
            </Section>
          )}

          {disclaimerR && (
            <Section style={disclaimerSection}>
              <Text style={disclaimerText}>{disclaimerR}</Text>
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f4f4f5',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0 24px 32px',
  maxWidth: '560px',
  borderRadius: '8px',
}

const headerSection = {
  paddingTop: '32px',
  paddingBottom: '24px',
  borderBottom: '1px solid #e4e4e7',
}

const logoRow = {
  display: 'flex' as const,
  alignItems: 'center' as const,
  gap: '12px',
}

const logo = {
  display: 'block' as const,
  objectFit: 'contain' as const,
}

const greetingHeading = {
  margin: 0,
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#18181b',
  flex: 1,
}

const bodySection = {
  paddingTop: '24px',
  paddingBottom: '24px',
}

const text = {
  color: '#3f3f46',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '28px 0 0',
}

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  padding: '12px 24px',
  display: 'inline-block',
}

const footerSection = {
  paddingTop: '24px',
  borderTop: '1px solid #e4e4e7',
}

const footerText = {
  color: '#71717a',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px',
}

const footerHelpText = {
  color: '#71717a',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 12px',
}

const disclaimerSection = {
  paddingTop: '16px',
}

const disclaimerText = {
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: 0,
}
