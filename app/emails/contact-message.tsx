import * as React from 'react';
import 'web-streams-polyfill/polyfill';
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from '@react-email/components';

interface ContactMessageEmailProps {
  fullName: string;
  email: string;
  subject: string;
  message: string;
  timestamp: string;
  isHebrew?: boolean;
  isCustomerConfirmation?: boolean;
}

export function ContactMessageEmail({
  fullName,
  email,
  subject,
  message,
  timestamp,
  isHebrew = false,
  isCustomerConfirmation = false,
}: ContactMessageEmailProps) {
  const t = isCustomerConfirmation ? {
    // Customer confirmation email
    title: isHebrew ? 'תודה על פנייתך - Sako Or' : 'Thank you for contacting Sako Or',
    greeting: isHebrew ? `שלום ${fullName}` : `Dear ${fullName}`,
    message: isHebrew 
      ? 'תודה רבה על פנייתך אלינו! קיבלנו את הודעתך ונחזור אליך בהקדם האפשרי.' 
      : 'Thank you for reaching out to us! We have received your message and will get back to you as soon as possible.',
    details: isHebrew ? 'פרטי ההודעה שלך:' : 'Your message details:',
    subjectLabel: isHebrew ? 'נושא:' : 'Subject:',
    messageLabel: isHebrew ? 'הודעה:' : 'Message:',
    footer: isHebrew 
      ? 'בברכה, הצוות של Sako Or' 
      : 'Best regards, The Sako Or Team',
  } : {
    // Team notification email
    title: isHebrew ? 'הודעת צור קשר חדשה' : 'New Contact Message',
    from: isHebrew ? 'מאת' : 'From',
    emailLabel: isHebrew ? 'אימייל' : 'Email',
    subjectLabel: isHebrew ? 'נושא' : 'Subject',
    messageLabel: isHebrew ? 'הודעה' : 'Message',
    timeLabel: isHebrew ? 'זמן' : 'Time',
    footer: isHebrew 
      ? 'הודעה זו נשלחה דרך טופס יצירת הקשר באתר Sako Or' 
      : 'This message was sent via the Sako Or website contact form',
  };

  return (
    <Html dir={isHebrew ? 'rtl' : 'ltr'} lang={isHebrew ? 'he' : 'en'}>
      <Head />
      <Preview>{t.title} - {fullName}</Preview>
      <Body
        dir={isHebrew ? 'rtl' : 'ltr'}
        style={{ ...main, direction: isHebrew ? 'rtl' : 'ltr' }}
      >
        <Container
          dir={isHebrew ? 'rtl' : 'ltr'}
          style={{ ...container, direction: isHebrew ? 'rtl' : 'ltr' }}
        >
          <Section style={header}>
            <Heading style={h1(isHebrew)}>{t.title}</Heading>
          </Section>
          
          <Section style={content}>
            {isCustomerConfirmation ? (
              // Customer confirmation email content
              <>
                <Text style={messageText(isHebrew)}>{t.greeting},</Text>
                <Text style={messageText(isHebrew)}>{t.message}</Text>
                
                <Hr style={hr} />
                
                <Heading style={h2(isHebrew)}>{t.details}</Heading>
                <Section dir={isHebrew ? 'rtl' : 'ltr'} style={infoBox}>
                  <Row>
                    <Column align={isHebrew ? 'right' : 'left'} style={label(isHebrew)}>{t.subjectLabel}</Column>
                    <Column align={isHebrew ? 'left' : 'right'} style={value(isHebrew)}>{subject}</Column>
                  </Row>
                  <Row>
                    <Column align={isHebrew ? 'right' : 'left'} style={label(isHebrew)}>{t.messageLabel}</Column>
                    <Column align={isHebrew ? 'left' : 'right'} style={value(isHebrew)}>{message}</Column>
                  </Row>
                </Section>
              </>
            ) : (
              // Team notification email content
              <>
                <Section dir={isHebrew ? 'rtl' : 'ltr'} style={infoBox}>
                  <Row>
                    <Column align={isHebrew ? 'right' : 'left'} style={label(isHebrew)}>{t.from}:</Column>
                    <Column align={isHebrew ? 'left' : 'right'} style={value(isHebrew)}>{fullName}</Column>
                  </Row>
                  <Row>
                    <Column align={isHebrew ? 'right' : 'left'} style={label(isHebrew)}>{t.emailLabel}:</Column>
                    <Column align={isHebrew ? 'left' : 'right'} style={value(isHebrew)}>
                      <span dir="ltr">{email}</span>
                    </Column>
                  </Row>
                  <Row>
                    <Column align={isHebrew ? 'right' : 'left'} style={label(isHebrew)}>{t.subjectLabel}:</Column>
                    <Column align={isHebrew ? 'left' : 'right'} style={value(isHebrew)}>{subject}</Column>
                  </Row>
                  <Row>
                    <Column align={isHebrew ? 'right' : 'left'} style={label(isHebrew)}>{t.timeLabel}:</Column>
                    <Column align={isHebrew ? 'left' : 'right'} style={value(isHebrew)}>{timestamp}</Column>
                  </Row>
                </Section>

                <Hr style={hr} />

                <Section style={messageSection}>
                  <Heading style={h2(isHebrew)}>{t.messageLabel}</Heading>
                  <Text style={messageText(isHebrew)}>{message}</Text>
                </Section>
              </>
            )}
          </Section>

          <Section style={footer}>
            <Text style={footerText}>{t.footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Preview props for React Email dashboard
ContactMessageEmail.PreviewProps = {
  fullName: 'John Doe',
  email: 'john.doe@example.com',
  subject: 'Product Inquiry',
  message: 'I would like to know more about your leather shoes collection. Do you ship internationally?',
  timestamp: 'January 15, 2024 at 10:30 AM',
  isHebrew: false,
} as ContactMessageEmailProps;

export default ContactMessageEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '32px 24px 0',
  textAlign: 'center' as const,
};

const h1 = (isHebrew: boolean) => ({
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
  padding: '0',
  textAlign: (isHebrew ? 'right' : 'left') as 'left' | 'right',
});

const content = {
  padding: '24px',
};

const infoBox = {
  backgroundColor: '#f8f9fa',
  padding: '16px',
  borderRadius: '8px',
  margin: '16px 0',
};

const label = (isHebrew: boolean) => ({
  color: '#666',
  fontSize: '14px',
  fontWeight: 'bold',
  width: '30%',
  paddingBottom: '8px',
  textAlign: (isHebrew ? 'right' : 'left') as 'left' | 'right',
});

const value = (isHebrew: boolean) => ({
  color: '#333',
  fontSize: '14px',
  width: '70%',
  paddingBottom: '8px',
  textAlign: (isHebrew ? 'left' : 'right') as 'left' | 'right',
});

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const messageSection = {
  margin: '24px 0',
};

const h2 = (isHebrew: boolean) => ({
  color: '#333',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 16px 0',
  textAlign: (isHebrew ? 'right' : 'left') as 'left' | 'right',
});

const messageText = (isHebrew: boolean) => ({
  color: '#333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
  padding: '16px',
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  whiteSpace: 'pre-wrap' as const,
  textAlign: (isHebrew ? 'right' : 'left') as 'left' | 'right',
});

const footer = {
  padding: '24px',
  textAlign: 'center' as const,
  borderTop: '1px solid #e6ebf1',
};

const footerText = {
  color: '#666',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0',
};

