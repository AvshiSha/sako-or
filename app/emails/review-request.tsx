import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface ReviewRequestEmailProps {
  greeting: string;
  /** Paragraphs between the greeting and the call to action. */
  body: string[];
  ctaLabel: string;
  reviewUrl: string;
  /** Non-members only: shown above the review CTA. */
  signupLabel?: string | null;
  signupUrl?: string | null;
  closing: string;
  previewText: string;
  isHebrew: boolean;
}

/**
 * Post-delivery review request.
 *
 * Direction is driven by `isHebrew` rather than the locale string so the same
 * component serves both languages; RTL is applied at the Body and re-asserted on the
 * Container, because several email clients drop `dir` inherited across table
 * boundaries.
 */
export const ReviewRequestEmail = ({
  greeting,
  body,
  ctaLabel,
  reviewUrl,
  signupLabel,
  signupUrl,
  closing,
  previewText,
  isHebrew,
}: ReviewRequestEmailProps) => {
  const dir = isHebrew ? 'rtl' : 'ltr';
  const align = isHebrew ? 'right' : 'left';

  return (
    <Html lang={isHebrew ? 'he' : 'en'} dir={dir}>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ ...styles.body, direction: dir }}>
        <Container style={{ ...styles.container, direction: dir, textAlign: align }}>
          <Heading style={{ ...styles.brand, textAlign: 'center' as const }}>
            SAKO OR
          </Heading>

          <Hr style={styles.hr} />

          <Text style={{ ...styles.greeting, textAlign: align }}>{greeting}</Text>

          {body.map((paragraph, index) => (
            <Text key={index} style={{ ...styles.paragraph, textAlign: align }}>
              {paragraph}
            </Text>
          ))}

          {signupUrl && signupLabel ? (
            <Section style={styles.section}>
              <Button href={signupUrl} style={styles.secondaryButton}>
                {signupLabel}
              </Button>
            </Section>
          ) : null}

          <Section style={styles.section}>
            <Button href={reviewUrl} style={styles.primaryButton}>
              {ctaLabel}
            </Button>
          </Section>

          {/* Some clients strip buttons; a plain link keeps the message usable. */}
          <Text style={{ ...styles.fallback, textAlign: align }}>
            <Link href={reviewUrl} style={styles.link}>
              {reviewUrl}
            </Link>
          </Text>

          <Hr style={styles.hr} />

          <Text style={{ ...styles.closing, textAlign: align }}>{closing}</Text>
        </Container>
      </Body>
    </Html>
  );
};

export default ReviewRequestEmail;

const styles = {
  body: {
    backgroundColor: '#f6f6f6',
    fontFamily:
      "'Helvetica Neue', Helvetica, Arial, 'Segoe UI', 'Noto Sans Hebrew', sans-serif",
    margin: 0,
    padding: '24px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    margin: '0 auto',
    maxWidth: '560px',
    padding: '32px',
  },
  brand: {
    color: '#111111',
    fontSize: '24px',
    fontWeight: 700,
    letterSpacing: '4px',
    margin: '0 0 8px',
  },
  hr: {
    borderColor: '#e6e6e6',
    margin: '20px 0',
  },
  greeting: {
    color: '#111111',
    fontSize: '18px',
    fontWeight: 600,
    margin: '0 0 12px',
  },
  paragraph: {
    color: '#444444',
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 12px',
  },
  section: {
    margin: '20px 0',
    textAlign: 'center' as const,
  },
  primaryButton: {
    backgroundColor: '#111111',
    borderRadius: '6px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 600,
    padding: '13px 28px',
    textDecoration: 'none',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    border: '1px solid #111111',
    borderRadius: '6px',
    color: '#111111',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 600,
    padding: '12px 28px',
    textDecoration: 'none',
  },
  fallback: {
    color: '#888888',
    fontSize: '12px',
    lineHeight: '18px',
    margin: '0 0 8px',
    wordBreak: 'break-all' as const,
  },
  link: {
    color: '#888888',
    textDecoration: 'underline',
  },
  closing: {
    color: '#444444',
    fontSize: '15px',
    margin: 0,
  },
};
