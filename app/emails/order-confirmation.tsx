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

export function OrderConfirmationEmail({
  customerName,
  orderNumber,
  orderDate,
  items,
  total,
  payer,
  deliveryAddress,
  notes,
  isHebrew = false,
}: OrderConfirmationEmailProps) {
  const t = {
    title: isHebrew ? 'אישור הזמנה' : 'Order Confirmation',
    greeting: isHebrew ? `שלום ${customerName},` : `Hello ${customerName},`,
    thankYou: isHebrew 
      ? 'תודה רבה על הרכישה שלך! הזמנתך התקבלה בהצלחה.' 
      : 'Thank you for your purchase! Your order has been received successfully.',
    orderNumber: isHebrew ? 'מספר הזמנה' : 'Order Number',
    orderDate: isHebrew ? 'תאריך הזמנה' : 'Order Date',
    items: isHebrew ? 'פריטים' : 'Items',
    quantity: isHebrew ? 'כמות' : 'Quantity',
    price: isHebrew ? 'מחיר' : 'Price',
    total: isHebrew ? 'סה"כ' : 'Total',
    customerDetails: isHebrew ? 'פרטי לקוח' : 'Customer Details',
    firstName: isHebrew ? 'שם פרטי' : 'First Name',
    lastName: isHebrew ? 'שם משפחה' : 'Last Name',
    email: isHebrew ? 'אימייל' : 'Email',
    mobile: isHebrew ? 'טלפון נייד' : 'Mobile Phone',
    idNumber: isHebrew ? 'מספר זהות' : 'ID Number',
    deliveryAddress: isHebrew ? 'כתובת משלוח' : 'Delivery Address',
    city: isHebrew ? 'עיר' : 'City',
    street: isHebrew ? 'רחוב' : 'Street',
    streetNumber: isHebrew ? 'מספר בית' : 'House Number',
    floor: isHebrew ? 'קומה' : 'Floor',
    apartment: isHebrew ? 'דירה' : 'Apartment',
    zipCode: isHebrew ? 'מיקוד' : 'ZIP Code',
    notes: isHebrew ? 'הערות' : 'Notes',
    footer: isHebrew 
      ? 'אם יש לך שאלות, אנא צור איתנו קשר.' 
      : 'If you have any questions, please contact us.',
    contact: isHebrew ? 'צור קשר' : 'Contact Us',
  };

  return (
    <Html dir={isHebrew ? 'rtl' : 'ltr'}>
      <Head />
      <Preview>{t.title} - {orderNumber}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>{t.title}</Heading>
          </Section>
          
          <Section style={content}>
            <Text style={text}>{t.greeting}</Text>
            <Text style={text}>{t.thankYou}</Text>
            
            <Section style={orderInfo}>
              <Row>
                <Column style={orderLabel}>{t.orderNumber}:</Column>
                <Column style={orderValue}>{orderNumber}</Column>
              </Row>
              <Row>
                <Column style={orderLabel}>{t.orderDate}:</Column>
                <Column style={orderValue}>{orderDate}</Column>
              </Row>
            </Section>

            <Hr style={hr} />

            <Section style={detailsSection}>
              <Heading style={h2}>{t.customerDetails}</Heading>
              <Section style={detailsInfo}>
                <Row>
                  <Column style={orderLabel}>{t.firstName}:</Column>
                  <Column style={orderValue}>{payer.firstName}</Column>
                </Row>
                <Row>
                  <Column style={orderLabel}>{t.lastName}:</Column>
                  <Column style={orderValue}>{payer.lastName}</Column>
                </Row>
                <Row>
                  <Column style={orderLabel}>{t.email}:</Column>
                  <Column style={orderValue}>{payer.email}</Column>
                </Row>
                <Row>
                  <Column style={orderLabel}>{t.mobile}:</Column>
                  <Column style={orderValue}>{payer.mobile}</Column>
                </Row>
                <Row>
                  <Column style={orderLabel}>{t.idNumber}:</Column>
                  <Column style={orderValue}>{payer.idNumber}</Column>
                </Row>
              </Section>
            </Section>

            <Hr style={hr} />

            <Section style={detailsSection}>
              <Heading style={h2}>{t.deliveryAddress}</Heading>
              <Section style={detailsInfo}>
                <Row>
                  <Column style={orderLabel}>{t.city}:</Column>
                  <Column style={orderValue}>{deliveryAddress.city}</Column>
                </Row>
                <Row>
                  <Column style={orderLabel}>{t.street}:</Column>
                  <Column style={orderValue}>{deliveryAddress.streetName} {deliveryAddress.streetNumber}</Column>
                </Row>
                {(deliveryAddress.floor || deliveryAddress.apartmentNumber) && (
                  <Row>
                    <Column style={orderLabel}>{t.floor}/{t.apartment}:</Column>
                    <Column style={orderValue}>
                      {deliveryAddress.floor && `${t.floor}: ${deliveryAddress.floor}`}
                      {deliveryAddress.floor && deliveryAddress.apartmentNumber && ', '}
                      {deliveryAddress.apartmentNumber && `${t.apartment}: ${deliveryAddress.apartmentNumber}`}
                    </Column>
                  </Row>
                )}
                <Row>
                  <Column style={orderLabel}>{t.zipCode}:</Column>
                  <Column style={orderValue}>{deliveryAddress.zipCode}</Column>
                </Row>
              </Section>
            </Section>

            {notes && (
              <>
                <Hr style={hr} />
                <Section style={detailsSection}>
                  <Heading style={h2}>{t.notes}</Heading>
                  <Text style={text}>{notes}</Text>
                </Section>
              </>
            )}

            <Hr style={hr} />

            <Section style={itemsSection}>
              <Heading style={h2}>{t.items}</Heading>
              {items.map((item, index) => (
                <Row key={index} style={itemRow}>
                  <Column style={itemName}>{item.name}</Column>
                  <Column style={itemQuantity}>{item.quantity}</Column>
                  <Column style={itemPrice}>₪{item.price.toFixed(2)}</Column>
                </Row>
              ))}
            </Section>

            <Hr style={hr} />

            <Section style={totalSection}>
              <Row>
                <Column style={totalLabel}>{t.total}:</Column>
                <Column style={totalValue}>₪{total.toFixed(2)}</Column>
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
OrderConfirmationEmail.PreviewProps = {
  customerName: 'John Doe',
  orderNumber: 'ORD-2024-001',
  orderDate: 'January 15, 2024',
  items: [
    { name: 'Premium Leather Shoes', quantity: 1, price: 299.99 },
    { name: 'Cotton Socks', quantity: 2, price: 15.50 },
  ],
  total: 330.99,
  payer: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    mobile: '+972-50-123-4567',
    idNumber: '123456789'
  },
  deliveryAddress: {
    city: 'Tel Aviv',
    streetName: 'Rothschild Boulevard',
    streetNumber: '15',
    floor: '3',
    apartmentNumber: '12',
    zipCode: '66881'
  },
  notes: 'Please deliver after 5 PM',
  isHebrew: false,
} as OrderConfirmationEmailProps;

export default OrderConfirmationEmail;

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

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
  padding: '0',
};

const content = {
  padding: '24px',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px 0',
};

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

const orderLabel = {
  color: '#666',
  fontSize: '14px',
  fontWeight: 'bold',
  width: '40%',
};

const orderValue = {
  color: '#333',
  fontSize: '14px',
  width: '60%',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const itemsSection = {
  margin: '24px 0',
};

const h2 = {
  color: '#333',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 16px 0',
};

const itemRow = {
  padding: '8px 0',
  borderBottom: '1px solid #f0f0f0',
};

const itemName = {
  color: '#333',
  fontSize: '14px',
  width: '50%',
};

const itemQuantity = {
  color: '#666',
  fontSize: '14px',
  width: '25%',
  textAlign: 'center' as const,
};

const itemPrice = {
  color: '#333',
  fontSize: '14px',
  width: '25%',
  textAlign: 'right' as const,
};

const totalSection = {
  backgroundColor: '#f8f9fa',
  padding: '16px',
  borderRadius: '8px',
  margin: '16px 0',
};

const totalLabel = {
  color: '#333',
  fontSize: '16px',
  fontWeight: 'bold',
  width: '50%',
};

const totalValue = {
  color: '#333',
  fontSize: '18px',
  fontWeight: 'bold',
  width: '50%',
  textAlign: 'right' as const,
};

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
