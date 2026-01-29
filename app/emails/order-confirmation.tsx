import * as React from 'react';
// import 'web-streams-polyfill/polyfill';
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
import { getColorName } from '../../lib/colors';

interface OrderConfirmationEmailProps {
  customerName: string;
  orderNumber: string;
  orderDate: string;
  items: Array<{
    name: string;
    sku?: string;
    size?: string;
    colorName?: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  subtotal?: number;
  deliveryFee?: number;
  discountTotal?: number;
  coupons?: Array<{
    code: string;
    discountAmount: number;
    discountLabel?: string;
  }>;
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
  shippingMethod?: 'delivery' | 'pickup';
  pickupLocation?: string;
  /** Points the customer spent on this order */
  pointsSpent?: number;
}

const getTotalPrice = (
  subtotal: number | undefined,
  deliveryFee: number | undefined,
  discountTotal: number | undefined,
  fallbackTotal: number,
  pointsSpent?: number
) => {
  if (
    typeof subtotal !== 'number' ||
    typeof deliveryFee !== 'number' ||
    typeof discountTotal !== 'number'
  ) {
    return fallbackTotal;
  }
  // 1 point = 1 ILS
  const pointsValue = typeof pointsSpent === 'number' && pointsSpent > 0 ? pointsSpent : 0;
  return subtotal + deliveryFee - discountTotal - pointsValue;
};

export function OrderConfirmationEmail({
  customerName,
  orderNumber,
  orderDate,
  items,
  total,
  subtotal,
  deliveryFee,
  discountTotal,
  coupons,
  payer,
  deliveryAddress,
  notes,
  isHebrew = false,
  shippingMethod = 'delivery',
  pickupLocation,
  pointsSpent,
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
    subtotal: isHebrew ? 'סכום ביניים' : 'Subtotal',
    delivery: isHebrew ? 'עלות משלוח' : 'Delivery',
    discountTotalLabel: isHebrew ? 'סה"כ הנחות' : 'Total Discount',
    couponsApplied: isHebrew ? 'קופונים שהופעלו' : 'Applied Coupons',
    noCoupons: isHebrew ? 'לא הופעלו קופונים' : 'No coupons applied',
    customerDetails: isHebrew ? 'פרטי לקוח' : 'Customer Details',
    firstName: isHebrew ? 'שם פרטי' : 'First Name',
    lastName: isHebrew ? 'שם משפחה' : 'Last Name',
    email: isHebrew ? 'אימייל' : 'Email',
    mobile: isHebrew ? 'טלפון נייד' : 'Mobile Phone',
    idNumber: isHebrew ? 'מספר זהות' : 'ID Number',
    deliveryAddress: isHebrew ? 'כתובת משלוח' : 'Delivery Address',
    deliveryMethod: isHebrew ? 'קבלת ההזמנה' : 'Delivery Method',
    deliveryMethodDelivery: isHebrew ? 'משלוח עד הבית' : 'Home Delivery',
    deliveryMethodPickup: isHebrew
      ? 'איסוף עצמי – רוטשילד 51, ראשון לציון'
      : 'Self Pickup – Rothschild 51, Rishon Lezion',
    city: isHebrew ? 'עיר' : 'City',
    street: isHebrew ? 'רחוב' : 'Street',
    streetNumber: isHebrew ? 'מספר בית' : 'House Number',
    floor: isHebrew ? 'קומה' : 'Floor',
    apartment: isHebrew ? 'דירה' : 'Apartment',
    zipCode: isHebrew ? 'מיקוד' : 'ZIP Code',
    sizeLabel: isHebrew ? 'מידה' : 'Size',
    skuLabel: isHebrew ? 'מק"ט' : 'SKU',
    colorLabel: isHebrew ? 'צבע' : 'Color',
    notes: isHebrew ? 'הערות' : 'Notes',
    pointsUsed: isHebrew ? 'נקודות שהופעלו' : 'Points used',
    footer: isHebrew 
      ? 'אם יש לך שאלות, אנא צור איתנו קשר.' 
      : 'If you have any questions, please contact us.',
    contact: isHebrew ? 'צור קשר' : 'Contact Us',
  };

  return (
    <Html dir={isHebrew ? 'rtl' : 'ltr'} lang={isHebrew ? 'he' : 'en'}>
      <Head />
      <Preview>{t.title} - {orderNumber}</Preview>
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
            <Text style={text(isHebrew)}>{t.greeting}</Text>
            <Text style={text(isHebrew)}>{t.thankYou}</Text>
            
            <Section dir={isHebrew ? 'rtl' : 'ltr'} style={orderInfo}>
              <Row>
                <Column align={isHebrew ? 'right' : 'left'} style={orderLabel(isHebrew)}>{t.orderNumber}:</Column>
                <Column align={isHebrew ? 'left' : 'right'} style={orderValue(isHebrew)}><span dir="ltr">{orderNumber}</span></Column>
              </Row>
              <Row>
                <Column align={isHebrew ? 'right' : 'left'} style={orderLabel(isHebrew)}>{t.orderDate}:</Column>
                <Column align={isHebrew ? 'left' : 'right'} style={orderValue(isHebrew)}>{orderDate}</Column>
              </Row>
              <Row>
                <Column align={isHebrew ? 'right' : 'left'} style={orderLabel(isHebrew)}>{t.deliveryMethod}:</Column>
                <Column align={isHebrew ? 'left' : 'right'} style={orderValue(isHebrew)}>
                  {shippingMethod === 'pickup'
                    ? t.deliveryMethodPickup
                    : t.deliveryMethodDelivery}
                </Column>
              </Row>
            </Section>

            <Hr style={hr} />

            <Section style={detailsSection}>
              <Heading style={h2(isHebrew)}>{t.customerDetails}</Heading>
              <Section dir={isHebrew ? 'rtl' : 'ltr'} style={detailsInfo}>
                <Row>
                  <Column align={isHebrew ? 'right' : 'left'} style={orderLabel(isHebrew)}>{t.firstName}:</Column>
                  <Column align={isHebrew ? 'left' : 'right'} style={orderValue(isHebrew)}>{payer.firstName}</Column>
                </Row>
                <Row>
                  <Column align={isHebrew ? 'right' : 'left'} style={orderLabel(isHebrew)}>{t.lastName}:</Column>
                  <Column align={isHebrew ? 'left' : 'right'} style={orderValue(isHebrew)}>{payer.lastName}</Column>
                </Row>
                <Row>
                  <Column align={isHebrew ? 'right' : 'left'} style={orderLabel(isHebrew)}>{t.email}:</Column>
                  <Column align={isHebrew ? 'left' : 'right'} style={orderValue(isHebrew)}><span dir="ltr">{payer.email}</span></Column>
                </Row>
                <Row>
                  <Column align={isHebrew ? 'right' : 'left'} style={orderLabel(isHebrew)}>{t.mobile}:</Column>
                  <Column align={isHebrew ? 'left' : 'right'} style={orderValue(isHebrew)}><span dir="ltr">{payer.mobile}</span></Column>
                </Row>
              </Section>
            </Section>

            <Hr style={hr} />

            <Section style={detailsSection}>
              <Heading style={h2(isHebrew)}>{t.deliveryAddress}</Heading>
              <Section dir={isHebrew ? 'rtl' : 'ltr'} style={detailsInfo}>
                {shippingMethod === 'pickup' ? (
                  <>
                    <Row>
                      <Column align={isHebrew ? 'right' : 'left'} style={orderLabel(isHebrew)}>{t.city}:</Column>
                      <Column align={isHebrew ? 'left' : 'right'} style={orderValue(isHebrew)}>
                        {isHebrew ? 'ראשון לציון' : 'Rishon Lezion'}
                      </Column>
                    </Row>
                    <Row>
                      <Column align={isHebrew ? 'right' : 'left'} style={orderLabel(isHebrew)}>{t.street}:</Column>
                      <Column align={isHebrew ? 'left' : 'right'} style={orderValue(isHebrew)}>
                        {pickupLocation || isHebrew ? 'רוטשילד 51' : 'Rothschild 51'}
                      </Column>
                    </Row>
                  </>
                ) : (
                  <>
                    <Row>
                      <Column align={isHebrew ? 'right' : 'left'} style={orderLabel(isHebrew)}>{t.city}:</Column>
                      <Column align={isHebrew ? 'left' : 'right'} style={orderValue(isHebrew)}>{deliveryAddress.city}</Column>
                    </Row>
                    <Row>
                      <Column align={isHebrew ? 'right' : 'left'} style={orderLabel(isHebrew)}>{t.street}:</Column>
                      <Column align={isHebrew ? 'left' : 'right'} style={orderValue(isHebrew)}>{deliveryAddress.streetName} {deliveryAddress.streetNumber}</Column>
                    </Row>
                    {(deliveryAddress.floor || deliveryAddress.apartmentNumber) && (
                      <Row>
                        <Column align={isHebrew ? 'right' : 'left'} style={orderLabel(isHebrew)}>{t.floor}/{t.apartment}:</Column>
                        <Column align={isHebrew ? 'left' : 'right'} style={orderValue(isHebrew)}>
                          {deliveryAddress.floor && `${t.floor}: ${deliveryAddress.floor}`}
                          {deliveryAddress.floor && deliveryAddress.apartmentNumber && ', '}
                          {deliveryAddress.apartmentNumber && `${t.apartment}: ${deliveryAddress.apartmentNumber}`}
                        </Column>
                      </Row>
                    )}
                  </>
                )}
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

            <Section dir={isHebrew ? 'rtl' : 'ltr'} style={itemsSection}>
              <Heading style={h2(isHebrew)}>{t.items}</Heading>
              {items.map((item, index) => (
                <Row key={index} style={itemRow}>
                  <Column align={isHebrew ? 'right' : 'left'} style={itemName(isHebrew)}>
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{item.name}</div>
                      {(item.size || item.sku || item.colorName) && (
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                          {item.size && (
                            <>
                              <span>{t.sizeLabel}: {item.size}</span>
                              {(item.sku || item.colorName) && <br />}
                            </>
                          )}
                          {item.sku && (
                            <>
                              <span>{t.skuLabel}: {item.sku}</span>
                              {item.colorName && <br />}
                            </>
                          )}
                          {item.colorName && (
                            <span>{t.colorLabel}: {getColorName(item.colorName, isHebrew ? 'he' : 'en')}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </Column>
                  <Column align="center" style={itemQuantity}>{item.quantity}</Column>
                  <Column align={isHebrew ? 'left' : 'right'} style={itemPrice(isHebrew)}><span dir="ltr">₪{item.price.toFixed(2)}</span></Column>
                </Row>
              ))}
            </Section>

            <Hr style={hr} />

            <Section dir={isHebrew ? 'rtl' : 'ltr'} style={totalSection}>
              {typeof subtotal === 'number' && (
                <Row>
                  <Column align={isHebrew ? 'right' : 'left'} style={summaryLabel(isHebrew)}>{t.subtotal}:</Column>
                  <Column align={isHebrew ? 'left' : 'right'} style={summaryValue(isHebrew)}>
                    <span dir="ltr">₪{subtotal.toFixed(2)}</span>
                  </Column>
                </Row>
              )}

              {typeof deliveryFee === 'number' && (
                <Row>
                  <Column align={isHebrew ? 'right' : 'left'} style={summaryLabel(isHebrew)}>{t.delivery}:</Column>
                  <Column align={isHebrew ? 'left' : 'right'} style={summaryValue(isHebrew)}>
                    <span dir="ltr">{deliveryFee > 0 ? `₪${deliveryFee.toFixed(2)}` : isHebrew ? 'חינם' : 'Free'}</span>
                  </Column>
                </Row>
              )}

              {typeof discountTotal === 'number' && discountTotal > 0 && (
                <Row>
                  <Column align={isHebrew ? 'right' : 'left'} style={summaryLabel(isHebrew)}>{t.discountTotalLabel}:</Column>
                  <Column align={isHebrew ? 'left' : 'right'} style={summaryValue(isHebrew)}>
                    <span dir="ltr">-₪{discountTotal.toFixed(2)}</span>
                  </Column>
                </Row>
              )}

              {coupons && coupons.length > 0 && (
                <Row>
                  <Column align={isHebrew ? 'right' : 'left'} style={{ ...summaryLabel(isHebrew), verticalAlign: 'top' }}>
                    {t.couponsApplied}:
                  </Column>
                  <Column align={isHebrew ? 'left' : 'right'} style={{ ...summaryValue(isHebrew), whiteSpace: 'pre-line' }}>
                    {coupons
                      .map(coupon => {
                        const label = coupon.discountLabel ? ` (${coupon.discountLabel})` : '';
                        return `${coupon.code}${label} - ₪${coupon.discountAmount.toFixed(2)}`;
                      })
                      .join('\n')}
                  </Column>
                </Row>
              )}

              {typeof pointsSpent === 'number' && pointsSpent > 0 && (
                <Row>
                  <Column align={isHebrew ? 'right' : 'left'} style={summaryLabel(isHebrew)}>{t.pointsUsed}:</Column>
                  <Column align={isHebrew ? 'left' : 'right'} style={summaryValue(isHebrew)}>
                    <span dir="ltr">-{pointsSpent} {isHebrew ? 'נקודות' : 'points'}</span>
                  </Column>
                </Row>
              )}

              <Row>
                <Column align={isHebrew ? 'right' : 'left'} style={totalLabel(isHebrew)}>{t.total}:</Column>
                <Column align={isHebrew ? 'left' : 'right'} style={totalValue(isHebrew)}>
                  <span dir="ltr">₪{getTotalPrice(subtotal, deliveryFee, discountTotal, total, pointsSpent).toFixed(2)}</span>
                </Column>
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
    { name: 'Premium Leather Shoes', quantity: 1, price: 299.99, size: '36', sku: '0000-0000', colorName: 'Black' },
    { name: 'Cotton Socks', quantity: 2, price: 15.50, size: '35', sku: '0000-0001', colorName: 'White' },
  ],
  total: 330.99,
  subtotal: 350.99,
  deliveryFee: 0,
  discountTotal: 20,
  coupons: [
    { code: 'SUMMER20', discountAmount: 15, discountLabel: '20% off selected items' },
    { code: 'FREESHIP', discountAmount: 5 }
  ],
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
  lineHeight: '14px',
  margin: '0 0 16px 0',
  textAlign: (isHebrew ? 'right' : 'left') as 'left' | 'right',
});

const orderInfo = {
  backgroundColor: '#f8f9fa',
  padding: '16px',
  borderRadius: '4px',
  margin: '16px 0',
};

const detailsSection = {
  margin: '16px 0',
};

const detailsInfo = {
  backgroundColor: '#f8f9fa',
  padding: '16px',
  borderRadius: '4px',
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

const summaryLabel = (isHebrew: boolean) => ({
  color: '#555',
  fontSize: '14px',
  width: '60%',
  textAlign: (isHebrew ? 'right' : 'left') as 'left' | 'right',
});

const summaryValue = (isHebrew: boolean) => ({
  color: '#333',
  fontSize: '14px',
  width: '40%',
  textAlign: (isHebrew ? 'left' : 'right') as 'left' | 'right',
});

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
