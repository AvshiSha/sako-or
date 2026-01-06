import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';

export interface EmailOtpProps {
  /** Optional. Used only in the greeting line. */
  userFirstname?: string;
  /** Required. The 6-digit OTP code. */
  otpCode: string;
  /** Optional. If true, renders Hebrew copy + RTL direction. */
  isHebrew?: boolean;
  /** Optional. Brand name shown in the email. */
  brandName?: string;
}

export function EmailOtp({
  userFirstname,
  otpCode,
  isHebrew = false,
  brandName = 'Sako Or',
}: EmailOtpProps) {
  const t = {
    preview: isHebrew ? 'קוד אימות' : 'Verification code',
    title: isHebrew ? 'קוד אימות' : 'Verification code',
    greeting: isHebrew
      ? `שלום${userFirstname ? ` ${userFirstname}` : ''},`
      : `Hi${userFirstname ? ` ${userFirstname}` : ''},`,
    intro: isHebrew
      ? `קיבלנו בקשה להתחברות לחשבון שלך ב-${brandName}.`
      : `We received a request to sign in to your ${brandName} account.`,
    codeLabel: isHebrew ? 'קוד האימות שלך:' : 'Your verification code:',
    codeExpires: isHebrew
      ? 'קוד זה תקף למשך 5 דקות.'
      : 'This code expires in 5 minutes.',
    ignore: isHebrew
      ? 'אם לא ביקשת להתחבר, אפשר להתעלם מהמייל הזה בבטחה.'
      : `If you didn't request to sign in, you can safely ignore this email.`,
    help: isHebrew ? 'צריך עזרה? כתבו לנו' : 'Need help? Contact us',
  };

  return (
    <Html dir={isHebrew ? 'rtl' : 'ltr'} lang={isHebrew ? 'he' : 'en'}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={{ ...main, direction: isHebrew ? 'rtl' : 'ltr' }}>
        <Container style={{ ...container, direction: isHebrew ? 'rtl' : 'ltr' }}>
          <Section style={header}>
            <Heading style={h1(isHebrew)}>{brandName}</Heading>
          </Section>

          <Section style={content}>
            <Heading style={h2(isHebrew)}>{t.title}</Heading>
            <Text style={text(isHebrew)}>{t.greeting}</Text>
            <Text style={text(isHebrew)}>{t.intro}</Text>

            <Section style={codeSection}>
              <Text style={codeLabel(isHebrew)}>{t.codeLabel}</Text>
              <Text style={codeValue}>{otpCode}</Text>
            </Section>

            <Text style={textMuted(isHebrew)}>{t.codeExpires}</Text>
            <Text style={textMuted(isHebrew)}>{t.ignore}</Text>

            <Hr style={hr} />

            <Text style={footer(isHebrew)}>
              {t.help}:{' '}
              <Link href="mailto:info@sako-or.com" style={link}>
                info@sako-or.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

EmailOtp.PreviewProps = {
  userFirstname: 'Alan',
  otpCode: '123456',
  isHebrew: false,
  brandName: 'Sako Or',
} as EmailOtpProps;

export default EmailOtp;

const main: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"',
  padding: '24px 12px',
};

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  borderRadius: '12px',
  border: '1px solid #eef2f7',
  maxWidth: '520px',
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  padding: '18px 20px',
  backgroundColor: '#0b0b0b',
};

const content: React.CSSProperties = {
  padding: '22px 20px 18px',
};

const h1 = (isHebrew: boolean): React.CSSProperties => ({
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 700,
  letterSpacing: '0.6px',
  margin: 0,
  textAlign: isHebrew ? 'right' : 'left',
});

const h2 = (isHebrew: boolean): React.CSSProperties => ({
  color: '#111827',
  fontSize: '20px',
  fontWeight: 700,
  margin: '0 0 10px 0',
  textAlign: isHebrew ? 'right' : 'left',
});

const text = (isHebrew: boolean): React.CSSProperties => ({
  color: '#111827',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 12px 0',
  textAlign: isHebrew ? 'right' : 'left',
});

const textMuted = (isHebrew: boolean): React.CSSProperties => ({
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '14px 0 0 0',
  textAlign: isHebrew ? 'right' : 'left',
});

const codeSection: React.CSSProperties = {
  backgroundColor: '#f9fafb',
  border: '2px solid #e5e7eb',
  borderRadius: '8px',
  padding: '20px',
  margin: '20px 0',
  textAlign: 'center',
};

const codeLabel = (isHebrew: boolean): React.CSSProperties => ({
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 8px 0',
  textAlign: 'center',
});

const codeValue: React.CSSProperties = {
  color: '#111827',
  fontSize: '32px',
  fontWeight: 700,
  letterSpacing: '8px',
  margin: 0,
  textAlign: 'center',
  fontFamily: 'monospace',
};

const hr: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '18px 0',
};

const link: React.CSSProperties = {
  color: '#856D55',
  textDecoration: 'underline',
};

const footer = (isHebrew: boolean): React.CSSProperties => ({
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '18px',
  margin: 0,
  textAlign: isHebrew ? 'right' : 'left',
});

