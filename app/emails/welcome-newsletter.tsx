import * as React from 'react';
import 'web-streams-polyfill/polyfill';
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
  Hr,
} from '@react-email/components';

interface WelcomeNewsletterProps {
  customerName?: string;
  isHebrew?: boolean;
}

export function WelcomeNewsletter({
  customerName = 'Valued Customer',
  isHebrew = false,
}: WelcomeNewsletterProps) {
  const translations = {
    preview: isHebrew ? 'ברוכים הבאים ל-SAKO OR' : 'Welcome to SAKO OR',
    welcome: isHebrew ? 'ברוכים הבאים ל-SAKO OR' : 'WELCOME TO SAKO OR',
    headline: isHebrew ? 'וואו. הגיע הזמן לפנק את עצמכם.' : 'Wow. It\'s time to treat yourself.',
    discountText: isHebrew ? 'בדקו את ה-**15% הנחה** לשימוש בהזמנה הראשונה שלכם' : 'Check this **15% OFF** to use on your first order',
    promoCode: isHebrew ? 'השתמשו בקוד: WOW150FF' : 'Use code: WOW150FF',
    brandTitle: isHebrew ? 'המותג שלנו' : 'Our Brand',
    brandStory: isHebrew 
      ? 'ב-SAKO OR, אנחנו מאמינים באיכות, סטייל ונוחות. כל פריט בקולקציה שלנו נבחר בקפידה כדי להעניק לכם חוויה ייחודית ומעודדת. אנחנו מתמחים ביצירת בגדים שמתאימים לכל אירוע ומשקפים את האישיות שלכם.'
      : 'At SAKO OR, we believe in quality, style, and comfort. Every piece in our collection is carefully curated to provide you with a unique and empowering experience. We specialize in creating clothing that fits every occasion and reflects your personality.',
    learnMore: isHebrew ? 'למדו עוד' : 'Learn More',
    shopNow: isHebrew ? 'התחל לקנות עכשיו' : 'Start Shopping Now',
    ctaText: isHebrew ? 'התחל לקנות עכשיו' : 'Start Shopping Now',
    followUs: isHebrew ? 'עקבו אחרינו' : 'Follow Us',
    stayConnected: isHebrew ? 'הישארו מחוברים לעדכונים, השראה ועוד.' : 'Stay connected for updates, inspiration, and more.',
    footer: isHebrew 
      ? 'קיבלתם מייל זה כי נרשמתם לניוזלטר שלנו.' 
      : 'You received this email because you signed up for our newsletter.',
    unsubscribe: isHebrew ? 'ביטול מנוי' : 'Unsubscribe',
    contact: isHebrew ? 'צור קשר' : 'Contact Us',
  };

  return (
    <Html dir={isHebrew ? 'rtl' : 'ltr'} lang={isHebrew ? 'he' : 'en'}>
      <Head />
      <Preview>{translations.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo and Navigation */}
          <Section style={header}>
            <Img
              src="https://via.placeholder.com/120x40/8B4513/FFFFFF?text=SAKO+OR"
              width="120"
              height="40"
              alt="SAKO OR"
              style={logo}
            />
            <Row style={navRow}>
              <Column style={navColumn}>
                <Link href="https://sako-or.com/about" style={navLink}>ABOUT US</Link>
              </Column>
              <Column style={navColumn}>
                <Link href="https://sako-or.com/{lng}/men" style={navLink}>SHOP MEN</Link>
              </Column>
              <Column style={navColumn}>
                <Link href="https://sako-or.com/{lng}/women" style={navLink}>SHOP WOMEN</Link>
              </Column>
              <Column style={navColumn}>
                <Link href="https://sako-or.com/{lng}/bags" style={navLink}>SHOP BAGS</Link>
              </Column>
            </Row>
          </Section>

          {/* Main Hero Section */}
          <Section style={heroSection}>
            <Text style={welcomeText(isHebrew)}>{translations.welcome}</Text>
            <Heading style={mainHeadline(isHebrew)}>{translations.headline}</Heading>
            <Img
              src="https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2FDSCF8179.jpg?alt=media&token=e489ae46-9ab8-479a-b7ec-0d296c5"
              width="600"
              height="400"
              alt="Lifestyle image"
              style={heroImage}
            />
          </Section>

          {/* Discount Section */}
          <Section style={discountSection}>
            <Container style={discountCard}>
              <Img
                src="https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/images%2Foffer.png?alt=media&token=0aafde06-0228-4a57-8ca2-c2ef98ff60e7"
                width="40"
                height="40"
                alt="Discount"
                style={discountIcon}
              />
              <Text style={discountText(isHebrew)}>{translations.discountText}</Text>
              <Text style={promoCode(isHebrew)}>{translations.promoCode}</Text>
            </Container>
          </Section>

          {/* CTA Button Section */}
          <Section style={ctaButtonSection}>
            <Button style={ctaButton} href="https://sako-or.com">
              {translations.shopNow}
            </Button>
          </Section>

          {/* Brand Story Section */}
          <Section style={brandSection}>
            <Heading style={brandTitle(isHebrew)}>{translations.brandTitle}</Heading>
            <div style={separatorLine}></div>
            <Text style={brandStoryText(isHebrew)}>{translations.brandStory}</Text>
            <Section style={learnMoreContainer}>
              <Button style={learnMoreButton} href="https://sako-or.com/about">
                {translations.learnMore}
              </Button>
            </Section>
          </Section>

          <Hr style={hr} />

          <Section style={socialSection}>
            <Heading style={h3(isHebrew)}>{translations.followUs}</Heading>
            <Text style={socialText(isHebrew)}>{translations.stayConnected}</Text>
            <Row style={socialIcons}>
              <Column align="center" style={socialIconColumn}>
                <Link href="https://facebook.com/sako-or">
                  <Img
                    src="https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-black/facebook@2x.png"
                    width="32"
                    height="32"
                    alt="Facebook"
                  />
                </Link>
              </Column>
              <Column align="center" style={socialIconColumn}>
                <Link href="https://instagram.com/sako-or">
                  <Img
                    src="https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-black/instagram@2x.png"
                    width="32"
                    height="32"
                    alt="Instagram"
                  />
                </Link>
              </Column>
              <Column align="center" style={socialIconColumn}>
                <Link href="https://twitter.com/sako-or">
                  <Img
                    src="https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-black/twitter@2x.png"
                    width="32"
                    height="32"
                    alt="Twitter"
                  />
                </Link>
              </Column>
            </Row>
          </Section>

          <Section style={footer}>
            <Text style={footerText(isHebrew)}>{translations.footer}</Text>
            <Row>
              <Column align="center">
                <Link href="mailto:info@sako-or.com" style={footerLink}>
                  {translations.contact}
                </Link>
                <Text style={separator}>|</Text>
                <Link href="https://sako-or.com/unsubscribe" style={footerLink}>
                  {translations.unsubscribe}
                </Link>
              </Column>
            </Row>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

WelcomeNewsletter.PreviewProps = {
  customerName: 'Sarah',
  isHebrew: false,
} as WelcomeNewsletterProps;

export default WelcomeNewsletter;

const main = {
  backgroundColor: '#f5f5f0',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif,Assistant',
};

const container = {
  backgroundColor: '#faf8f5',
  margin: '0 auto',
  padding: '0',
  marginTop: '20px',
  marginBottom: '20px',
  maxWidth: '600px',
  borderRadius: '0',
  overflow: 'hidden',
  boxShadow: 'none',
};

const header = {
  backgroundColor: '#faf8f5',
  padding: '30px 24px 20px',
  textAlign: 'center' as const,
};

const logo = {
  margin: '0 auto 20px',
};

const navRow = {
  marginTop: '20px',
};

const navColumn = {
  padding: '0 8px',
};

const navLink = {
  color: '#8B4513',
  fontSize: '12px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textTransform: 'uppercase' as const,
};

const heroSection = {
  backgroundColor: '#faf8f5',
  padding: '40px 24px',
  textAlign: 'center' as const,
};

const welcomeText = (isHebrew: boolean) => ({
  color: '#8B4513',
  fontSize: '12px',
  fontWeight: 'bold',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  margin: '0 0 10px 0',
  textAlign: 'center' as const,
});

const mainHeadline = (isHebrew: boolean) => ({
  color: '#2C1810',
  fontSize: '36px',
  fontWeight: 'bold',
  fontFamily: 'serif',
  margin: '0 0 20px 0',
  textAlign: 'center' as const,
  lineHeight: '1.2',
});

const heroImage = {
  width: '100vw',
  maxWidth: '100%',
  borderRadius: '80px',
  margin: '0 auto',
  marginLeft: 'calc(-50vw + 50%)',
  marginRight: 'calc(-50vw + 50%)',
};

const discountSection = {
  backgroundColor: '#faf8f5',
  padding: '40px 24px',
  textAlign: 'center' as const,
};

const discountCard = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '30px',
  margin: '0 auto',
  maxWidth: '400px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
};

const discountIcon = {
  margin: '0 auto 16px',
  display: 'block',
};

const discountText = (isHebrew: boolean) => ({
  color: '#8B4513',
  fontSize: '16px',
  margin: '0 0 12px 0',
  textAlign: 'center' as const,
});

const promoCode = (isHebrew: boolean) => ({
  color: '#2C1810',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0',
  textAlign: 'center' as const,
});

const ctaButtonSection = {
  backgroundColor: '#faf8f5',
  padding: '40px 24px',
  textAlign: 'center' as const,
};

const ctaButton = {
  backgroundColor: '#8B4513',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 40px',
  cursor: 'pointer',
  border: 'none',
};

const brandSection = {
  backgroundColor: '#faf8f5',
  padding: '60px 40px',
  textAlign: 'center' as const,
};

const brandTitle = (isHebrew: boolean) => ({
  color: '#2C1810',
  fontSize: '32px',
  fontWeight: 'bold',
  fontFamily: 'serif',
  margin: '0 0 16px 0',
  textAlign: 'center' as const,
});

const separatorLine = {
  width: '80px',
  height: '2px',
  backgroundColor: '#2C1810',
  margin: '0 auto 24px',
  borderRadius: '1px',
};

const brandStoryText = (isHebrew: boolean) => ({
  color: '#666666',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 auto 32px',
  textAlign: 'center' as const,
  maxWidth: '500px',
});

const learnMoreContainer = {
  textAlign: 'center' as const,
};

const learnMoreButton = {
  backgroundColor: 'transparent',
  border: '2px solid #2C1810',
  borderRadius: '6px',
  color: '#2C1810',
  fontSize: '16px',
  fontWeight: 'normal',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
  cursor: 'pointer',
};

const h3 = (isHebrew: boolean) => ({
  color: '#000000',
  fontSize: '20px',
  fontWeight: '600',
  margin: '0 0 16px 0',
  textAlign: (isHebrew ? 'right' : 'center') as 'left' | 'right' | 'center',
});

const hr = {
  borderColor: '#e6e6e6',
  margin: '24px 32px',
};

const socialSection = {
  padding: '24px 32px',
  textAlign: 'center' as const,
};

const socialText = (isHebrew: boolean) => ({
  color: '#666666',
  fontSize: '14px',
  margin: '0 0 24px 0',
  textAlign: (isHebrew ? 'right' : 'center') as 'left' | 'right' | 'center',
});

const socialIcons = {
  marginTop: '16px',
};

const socialIconColumn = {
  padding: '0 12px',
};

const footer = {
  padding: '32px',
  textAlign: 'center' as const,
  backgroundColor: '#f9f9f9',
};

const footerText = (isHebrew: boolean) => ({
  color: '#999999',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0 0 16px 0',
  textAlign: 'center' as const,
});

const footerLink = {
  color: '#666666',
  fontSize: '12px',
  textDecoration: 'underline',
  marginLeft: '8px',
  marginRight: '8px',
};

const separator = {
  color: '#cccccc',
  fontSize: '12px',
  margin: '0 4px',
  display: 'inline',
};
