import * as React from 'react';
import 'web-streams-polyfill/polyfill';
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from '@react-email/components';

interface OrderConfirmationEmailProps {
  customerName: string;
  orderNumber: string;
  orderDate: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  payer: {
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    idNumber: string;
  };
  deliveryAddress: {
    city: string;
    streetName: string;
    streetNumber: string;
    floor: string;
    apartmentNumber: string;
    zipCode: string;
  };
  notes?: string;
  isHebrew?: boolean;
}

export function OrderConfirmationEmailHebrew({
  customerName,
  orderNumber,
  orderDate,
  items,
  total,
  payer,
  deliveryAddress,
  notes,
  isHebrew = true,
}: OrderConfirmationEmailProps) {
  const t = {
    title: 'אישור הזמנה',
    greeting: `שלום ${customerName},`,
    thankYou: 'תודה רבה על הרכישה שלך! הזמנתך התקבלה בהצלחה.',
    orderNumber: 'מספר הזמנה',
    orderDate: 'תאריך הזמנה',
    items: 'פריטים',
    quantity: 'כמות',
    price: 'מחיר',
    total: 'סה"כ',
    customerDetails: 'פרטי לקוח',
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    email: 'אימייל',
    mobile: 'טלפון נייד',
    idNumber: 'מספר זהות',
    deliveryAddress: 'כתובת משלוח',
    city: 'עיר',
    street: 'רחוב',
    streetNumber: 'מספר בית',
    floor: 'קומה',
    apartment: 'דירה',
    zipCode: 'מיקוד',
    notes: 'הערות',
    footer: 'אם יש לך שאלות, אנא צור איתנו קשר.',
    contact: 'צור קשר',
  };

  return (
    <Html dir="rtl" lang="he">
      <Head />
      <Preview>{t.title} - {orderNumber}</Preview>
      <Body
        dir="rtl"
        style={{ ...main, direction: 'rtl' }}
      >
        <Container
          dir="rtl"
          style={{ ...container, direction: 'rtl' }}
        >
          <Section style={header}>
            <Heading style={h1(isHebrew)}>{t.title}</Heading>
          </Section>
          
          <Section style={content}>
            <Text style={text(isHebrew)}>{t.greeting}</Text>
            <Text style={text(isHebrew)}>{t.thankYou}</Text>
            
            <Section dir="rtl" style={orderInfo}>
              <Row>
                <Column align="right" style={orderLabel(isHebrew)}>{t.orderNumber}:</Column>
                <Column align="left" style={orderValue(isHebrew)}><span dir="ltr">{orderNumber}</span></Column>
              </Row>
              <Row>
                <Column align="right" style={orderLabel(isHebrew)}>{t.orderDate}:</Column>
                <Column align="left" style={orderValue(isHebrew)}>{orderDate}</Column>
              </Row>
            </Section>

            <Hr style={hr} />

            <Section style={detailsSection}>
              <Heading style={h2(isHebrew)}>{t.customerDetails}</Heading>
              <Section dir="rtl" style={detailsInfo}>
                <Row>
                  <Column align="right" style={orderLabel(isHebrew)}>{t.firstName}:</Column>
                  <Column align="left" style={orderValue(isHebrew)}>{payer.firstName}</Column>
                </Row>
                <Row>
                  <Column align="right" style={orderLabel(isHebrew)}>{t.lastName}:</Column>
                  <Column align="left" style={orderValue(isHebrew)}>{payer.lastName}</Column>
                </Row>
                <Row>
                  <Column align="right" style={orderLabel(isHebrew)}>{t.email}:</Column>
                  <Column align="left" style={orderValue(isHebrew)}><span dir="ltr">{payer.email}</span></Column>
                </Row>
                <Row>
                  <Column align="right" style={orderLabel(isHebrew)}>{t.mobile}:</Column>
                  <Column align="left" style={orderValue(isHebrew)}><span dir="ltr">{payer.mobile}</span></Column>
                </Row>
                <Row>
                  <Column align="right" style={orderLabel(isHebrew)}>{t.idNumber}:</Column>
                  <Column align="left" style={orderValue(isHebrew)}><span dir="ltr">{payer.idNumber}</span></Column>
                </Row>
              </Section>
            </Section>

            <Hr style={hr} />

            <Section style={detailsSection}>
              <Heading style={h2(isHebrew)}>{t.deliveryAddress}</Heading>
              <Section dir="rtl" style={detailsInfo}>
                <Row>
                  <Column align="right" style={orderLabel(isHebrew)}>{t.city}:</Column>
                  <Column align="left" style={orderValue(isHebrew)}>{deliveryAddress.city}</Column>
                </Row>
                <Row>
                  <Column align="right" style={orderLabel(isHebrew)}>{t.street}:</Column>
                  <Column align="left" style={orderValue(isHebrew)}>{deliveryAddress.streetName} {deliveryAddress.streetNumber}</Column>
                </Row>
                {(deliveryAddress.floor || deliveryAddress.apartmentNumber) && (
                  <Row>
                    <Column align="right" style={orderLabel(isHebrew)}>{t.floor}/{t.apartment}:</Column>
                    <Column align="left" style={orderValue(isHebrew)}>
                      {deliveryAddress.floor && `${t.floor}: ${deliveryAddress.floor}`}
                      {deliveryAddress.floor && deliveryAddress.apartmentNumber && ', '}
                      {deliveryAddress.apartmentNumber && `${t.apartment}: ${deliveryAddress.apartmentNumber}`}
                    </Column>
                  </Row>
                )}
                <Row>
                  <Column align="right" style={orderLabel(isHebrew)}>{t.zipCode}:</Column>
                  <Column align="left" style={orderValue(isHebrew)}><span dir="ltr">{deliveryAddress.zipCode}</span></Column>
                </Row>
              </Section>
            </Section>

            {notes && (
              <>
                <Hr style={hr} />
                <Section style={detailsSection}>
                  <Heading style={h2(isHebrew)}>{t.notes}</Heading>
                  <Text style={text(isHebrew)}>{notes}</Text>
                </Section>
              </>
            )}

            <Hr style={hr} />

            <Section dir="rtl" style={itemsSection}>
              <Heading style={h2(isHebrew)}>{t.items}</Heading>
              {items.map((item, index) => (
                <Row key={index} style={itemRow}>
                  <Column align="right" style={itemName(isHebrew)}>{item.name}</Column>
                  <Column align="center" style={itemQuantity}>{item.quantity}</Column>
                  <Column align="left" style={itemPrice(isHebrew)}><span dir="ltr">₪{item.price.toFixed(2)}</span></Column>
                </Row>
              ))}
            </Section>

            <Hr style={hr} />

            <Section dir="rtl" style={totalSection}>
              <Row>
                <Column align="right" style={totalLabel(isHebrew)}>{t.total}:</Column>
                <Column align="left" style={totalValue(isHebrew)}><span dir="ltr">₪{total.toFixed(2)}</span></Column>
              </Row>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>{t.footer}</Text>
            <Link href="mailto:info@sako-or.com" style={link}>
              {t.contact}
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Preview props for React Email dashboard
OrderConfirmationEmailHebrew.PreviewProps = {
  customerName: 'אבשלום שהרבני',
  orderNumber: 'ORDER-2024-001',
  orderDate: '15 בינואר 2024',
  items: [
    { name: 'נעליים מעור איכותיות', quantity: 1, price: 299.99 },
    { name: 'גרבי כותנה', quantity: 2, price: 15.50 },
  ],
  total: 330.99,
  payer: {
    firstName: 'אבשלום',
    lastName: 'שהרבני',
    email: 'avshi@sako-or.com',
    mobile: '+972-50-123-4567',
    idNumber: '123456789'
  },
  deliveryAddress: {
    city: 'תל אביב',
    streetName: 'שדרות רוטשילד',
    streetNumber: '15',
    floor: '3',
    apartmentNumber: '12',
    zipCode: '66881'
  },
  notes: 'אנא משלוח אחרי השעה 17:00',
  isHebrew: true,
} as OrderConfirmationEmailProps;

export default OrderConfirmationEmailHebrew;

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

const text = (isHebrew: boolean) => ({
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px 0',
  textAlign: (isHebrew ? 'right' : 'left') as 'left' | 'right',
});

const orderInfo = {
  backgroundColor: '#f8f9fa',
  padding: '16px',
  borderRadius: '8px',
  margin: '16px 0',
};

const detailsSection = {
  margin: '24px 0',
};

const detailsInfo = {
  backgroundColor: '#f8f9fa',
  padding: '16px',
  borderRadius: '8px',
  margin: '16px 0',
};

const orderLabel = (isHebrew: boolean) => ({
  color: '#666',
  fontSize: '14px',
  fontWeight: 'bold',
  width: '40%',
  textAlign: (isHebrew ? 'right' : 'left') as 'left' | 'right',
});

const orderValue = (isHebrew: boolean) => ({
  color: '#333',
  fontSize: '14px',
  width: '60%',
  textAlign: (isHebrew ? 'left' : 'right') as 'left' | 'right',
});

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const itemsSection = {
  margin: '24px 0',
};

const h2 = (isHebrew: boolean) => ({
  color: '#333',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 16px 0',
  textAlign: (isHebrew ? 'right' : 'left') as 'left' | 'right',
});

const itemRow = {
  padding: '8px 0',
  borderBottom: '1px solid #f0f0f0',
};

const itemName = (isHebrew: boolean) => ({
  color: '#333',
  fontSize: '14px',
  width: '50%',
  textAlign: (isHebrew ? 'right' : 'left') as 'left' | 'right',
});

const itemQuantity = {
  color: '#666',
  fontSize: '14px',
  width: '25%',
  textAlign: 'center' as const,
};

const itemPrice = (isHebrew: boolean) => ({
  color: '#333',
  fontSize: '14px',
  width: '25%',
  textAlign: (isHebrew ? 'left' : 'right') as 'left' | 'right',
});

const totalSection = {
  backgroundColor: '#f8f9fa',
  padding: '16px',
  borderRadius: '8px',
  margin: '16px 0',
};

const totalLabel = (isHebrew: boolean) => ({
  color: '#333',
  fontSize: '16px',
  fontWeight: 'bold',
  width: '50%',
  textAlign: (isHebrew ? 'right' : 'left') as 'left' | 'right',
});

const totalValue = (isHebrew: boolean) => ({
  color: '#333',
  fontSize: '18px',
  fontWeight: 'bold',
  width: '50%',
  textAlign: (isHebrew ? 'left' : 'right') as 'left' | 'right',
});

const footer = {
  padding: '24px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 8px 0',
};

const link = {
  color: '#2754C5',
  fontSize: '14px',
  textDecoration: 'underline',
};