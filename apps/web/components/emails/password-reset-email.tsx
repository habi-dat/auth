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
import type { PasswordResetEmailConfig } from '@/lib/email/types'

const DEFAULT_BUTTON_COLOR = '#2563eb'

export interface PasswordResetEmailProps extends PasswordResetEmailConfig {
  subject: string
  resetLink: string
  platformName: string
  appUrl: string
  logoUrl?: string
  /** Optional primary/brand color (hex) for the CTA button. From platform theme settings. */
  primaryColor?: string
}

const defaults: Required<
  Pick<
    PasswordResetEmailProps,
    'greeting' | 'mainText' | 'ctaText' | 'footer' | 'footerHelp' | 'disclaimer'
  >
> = {
  greeting: 'Hello,',
  mainText:
    'We received a request to reset your password. Click the button below to set a new password.',
  ctaText: 'Reset password',
  footer: 'If you did not request a password reset, you can ignore this email.',
  footerHelp: '',
  disclaimer: '',
}

export function PasswordResetEmail({
  subject,
  resetLink,
  platformName,
  appUrl,
  logoUrl,
  greeting = defaults.greeting,
  mainText = defaults.mainText,
  ctaText = defaults.ctaText,
  footer = defaults.footer,
  footerHelp = defaults.footerHelp,
  disclaimer = defaults.disclaimer,
  primaryColor,
}: PasswordResetEmailProps) {
  const buttonStyle = {
    ...button,
    backgroundColor: primaryColor ?? DEFAULT_BUTTON_COLOR,
  }
  const replacePlaceholders = (s: string) =>
    s
      .replace(/\{\{?\s*platformName\s*\}\}?/gi, platformName)
      .replace(/\{\{?\s*appUrl\s*\}\}?/gi, appUrl)

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
              <Button style={buttonStyle} href={resetLink}>
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
