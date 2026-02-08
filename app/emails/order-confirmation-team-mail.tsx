import * as React from 'react';
// import 'web-streams-polyfill/polyfill';
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
import { getColorName } from '../../lib/colors';

interface TeamOrderEmailProps {
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
  /**
   * Shipping method: "delivery" (default) or "pickup".
   * Used to decide whether to show customer address or store pickup address.
   */
  shippingMethod?: 'delivery' | 'pickup';
  /**
   * Pickup location when shippingMethod === "pickup".
   */
  pickupLocation?: string;
  /** Points the customer spent on this order */
  pointsSpent?: number;
}

export function OrderConfirmationTeamEmail({
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
}: TeamOrderEmailProps) {
   const currency = (n: number) =>
     new Intl.NumberFormat(isHebrew ? 'he-IL' : 'en-US', { style: 'currency', currency: 'ILS' }).format(n);
 
   const t = (en: string, he: string) => (isHebrew ? he : en);

  return (
    <Html>
      <Head />
      <Preview>New order #{orderNumber} - {customerName}</Preview>
      <Body style={{ ...styles.body, direction: isHebrew ? 'rtl' as const : 'ltr' as const }}>
        <Container style={styles.container}>
          <Heading style={styles.bigHeading}>
            {t('New Order', 'הזמנה חדשה')} #{orderNumber}
          </Heading>
          <Text style={styles.subHeader}>
            {t('Customer', 'לקוח')}: {customerName} • {t('Date', 'תאריך')}: {orderDate}
          </Text>
          <Hr />

          <Section style={styles.section}>
            <Heading as="h2" style={styles.sectionHeading}>{t('Totals', 'סיכומים')}</Heading>
            <Text style={styles.lineItem}>
              {t('Subtotal', 'סכום ביניים')}: <strong>{subtotal != null ? currency(subtotal) : '-'}</strong>
            </Text>
            <Text style={styles.lineItem}>
              {t('Delivery', 'משלוח')}: <strong>{deliveryFee != null ? currency(deliveryFee) : '-'}</strong>
            </Text>
            <Text style={styles.lineItem}>
              {t('Discounts', 'הנחות')}: <strong>{discountTotal != null ? currency(discountTotal) : '-'}</strong>
            </Text>
            {typeof pointsSpent === 'number' && pointsSpent > 0 && (
              <Text style={styles.lineItem}>
                {t('Points used', 'נקודות שהופעלו')}: <strong>-{pointsSpent} {t('points', 'נקודות')}</strong>
              </Text>
            )}
            <Text style={styles.total}>
              {t('Total', 'סך הכל')}: <strong>{currency(total)}</strong>
            </Text>
          </Section>

          {coupons && coupons.length > 0 && (
            <>
              <Hr />
              <Section style={styles.section}>
                <Heading as="h2" style={styles.sectionHeading}>{t('Coupons', 'קופונים')}</Heading>
                {coupons.map((c, idx) => (
                  <Text key={idx} style={styles.lineItem}>
                    {c.code} {c.discountLabel ? `- ${c.discountLabel}` : ''} ({currency(c.discountAmount)})
                  </Text>
                ))}
              </Section>
            </>
          )}

          <Hr />
          <Section style={styles.section}>
            <Heading as="h2" style={styles.sectionHeading}>{t('Items', 'מוצרים')}</Heading>
            {items.map((item, idx) => (
              <Row key={idx} style={styles.itemRow}>
                <Column>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {item.sku ? `${t('SKU', 'מק״ט')}: ${item.sku} • ` : ''}
                    {item.size ? `${t('Size', 'מידה')}: ${item.size} • ` : ''}
                    {item.colorName
                      ? `${t('Color', 'צבע')}: ${getColorName(
                          item.colorName,
                          isHebrew ? 'he' : 'en'
                        )} • `
                      : ''}
                    {t('Qty', 'כמות')}: {item.quantity}
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>

          <Hr />
          <Section style={styles.section}>
            <Heading as="h2" style={styles.sectionHeading}>{t('Customer & Delivery', 'לקוח ומשלוח')}</Heading>
            <Text style={styles.lineItem}>
              {t('Payer', 'משלם')}: <strong>{payer.firstName} {payer.lastName}</strong> ({payer.email}, {payer.mobile})
            </Text>
            <Text style={styles.lineItem}>
              {t('ID', 'ת.ז')}: {payer.idNumber || '-'}
            </Text>
            <Text style={styles.lineItem}>
              {t('Address', 'כתובת')}: <strong>
                {shippingMethod === 'pickup'
                  ? 'רוטשילד 51, ראשון לציון'
                  : `${deliveryAddress.streetName} ${deliveryAddress.streetNumber}, ${deliveryAddress.city}`}
              </strong>
              {shippingMethod === 'pickup' ? null : (
                <>
                  {' '}
                  • {t('Floor', 'קומה')}: {deliveryAddress.floor || '-'}
                  {' '}
                  • {t('Apt', 'דירה')}: {deliveryAddress.apartmentNumber || '-'}
                  {' '}
                  • {t('ZIP', 'מיקוד')}: {deliveryAddress.zipCode || '-'}
                </>
              )}
            </Text>
            {notes ? (
              <Text style={styles.notes}>
                {t('Notes', 'הערות')}: {notes}
              </Text>
            ) : null}
          </Section>

          <Hr />
          <Text style={styles.footer}>{t('Automated team notification', 'התראה אוטומטית לצוות')}</Text>
        </Container>
      </Body>
    </Html>
  );
}

// Preview props for React Email dashboard
OrderConfirmationTeamEmail.PreviewProps = {
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
  } as TeamOrderEmailProps;

const styles = {
  body: {
    backgroundColor: '#ffffff',
    margin: 0,
    padding: 0,
  },
  container: {
    margin: '0 auto',
    padding: '24px',
    maxWidth: '720px',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  bigHeading: {
    fontSize: '32px',
    margin: '0 0 8px 0',
    lineHeight: '1.2',
  },
  subHeader: {
    fontSize: '16px',
    color: '#666',
    margin: '0 0 16px 0',
  },
  section: {
    margin: '8px 0 16px 0',
  },
  sectionHeading: {
    fontSize: '22px',
    margin: '0 0 8px 0',
  },
  lineItem: {
    fontSize: '16px',
    margin: '4px 0',
  },
  total: {
    fontSize: '18px',
    marginTop: '8px',
  },
  itemRow: {
    padding: '8px 0',
    borderBottom: '1px solid #eee',
  },
  itemName: {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: 0,
  },
  itemMeta: {
    fontSize: '14px',
    color: '#555',
    margin: '4px 0 0 0',
  },
  itemPrice: {
    fontSize: '16px',
    fontWeight: 'bold',
  },
  notes: {
    fontSize: '16px',
    backgroundColor: '#fffbe6',
    padding: '8px',
    borderRadius: '6px',
    marginTop: '6px',
  },
  footer: {
    fontSize: '12px',
    color: '#999',
    textAlign: 'center' as const,
    marginTop: '16px',
  },
};

export default OrderConfirmationTeamEmail;

