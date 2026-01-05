import * as React from 'react';
import {
  Body,
  Button,
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

export interface ResetPasswordEmailProps {
  /** Optional. Used only in the greeting line. */
  userFirstname?: string;
  /** Required. The link the user should click to reset their password. */
  resetPasswordLink: string;
  /** Optional. If true, renders Hebrew copy + RTL direction. */
  isHebrew?: boolean;
  /** Optional. Brand name shown in the email. */
  brandName?: string;
}

export function ResetPasswordEmail({
  userFirstname,
  resetPasswordLink,
  isHebrew = false,
  brandName = 'Sako Or',
}: ResetPasswordEmailProps) {
  const t = {
    preview: isHebrew ? 'איפוס סיסמה' : 'Reset your password',
    title: isHebrew ? 'איפוס סיסמה' : 'Reset your password',
    greeting: isHebrew
      ? `שלום${userFirstname ? ` ${userFirstname}` : ''},`
      : `Hi${userFirstname ? ` ${userFirstname}` : ''},`,
    intro: isHebrew
      ? `קיבלנו בקשה לאיפוס הסיסמה עבור החשבון שלך ב-${brandName}.`
      : `We received a request to reset the password for your ${brandName} account.`,
    action: isHebrew ? 'איפוס סיסמה' : 'Reset password',
    ignore: isHebrew
      ? 'אם לא ביקשת לאפס סיסמה, אפשר להתעלם מהמייל הזה בבטחה.'
      : `If you didn’t request a password reset, you can safely ignore this email.`,
    fallback: isHebrew
      ? 'אם הכפתור לא עובד, העתק/י והדבק/י את הקישור הבא בדפדפן:'
      : 'If the button doesn’t work, copy and paste this link into your browser:',
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

            <Section style={buttonWrap}>
              <Button href={resetPasswordLink} style={button}>
                {t.action}
              </Button>
            </Section>

            <Text style={textMuted(isHebrew)}>{t.ignore}</Text>

            <Hr style={hr} />

            <Text style={textSmall(isHebrew)}>{t.fallback}</Text>
            <Text style={linkBlock}>
              <Link href={resetPasswordLink} style={link}>
                {resetPasswordLink}
              </Link>
            </Text>

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

ResetPasswordEmail.PreviewProps = {
  userFirstname: 'Alan',
  resetPasswordLink: 'https://sako-or.com/en/reset-password?mode=resetPassword&oobCode=EXAMPLE',
  isHebrew: false,
  brandName: 'Sako Or',
} as ResetPasswordEmailProps;

export default ResetPasswordEmail;

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

const textSmall = (isHebrew: boolean): React.CSSProperties => ({
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 0 8px 0',
  textAlign: isHebrew ? 'right' : 'left',
});

const buttonWrap: React.CSSProperties = {
  margin: '16px 0 8px',
};

const button: React.CSSProperties = {
  backgroundColor: '#856D55',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: 700,
  textDecoration: 'none',
  padding: '12px 16px',
};

const hr: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '18px 0',
};

const linkBlock: React.CSSProperties = {
  margin: '0 0 16px 0',
  wordBreak: 'break-word',
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


