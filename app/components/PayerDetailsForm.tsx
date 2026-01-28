'use client';

import { useState, useEffect } from 'react';
import { CheckoutFormData, PayerDetails, DeliveryAddress } from '../types/checkout';

interface PayerDetailsFormProps {
  formData: CheckoutFormData;
  onFormChange: (newFormData: CheckoutFormData) => void;
  onValidationChange: (isValid: boolean) => void;
  language: 'he' | 'en';
}

export default function PayerDetailsForm({
  formData,
  onFormChange,
  onValidationChange,
  language,
}: PayerDetailsFormProps) {
  const isHebrew = language === 'he';
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const isPickup = formData.shippingMethod === 'pickup';

  const t = {
    // Personal Details
    personalDetails: isHebrew ? 'פרטים אישיים' : 'Personal Details',
    firstName: isHebrew ? 'שם פרטי' : 'First Name',
    lastName: isHebrew ? 'שם משפחה' : 'Last Name',
    email: isHebrew ? 'אימייל' : 'Email',
    mobile: isHebrew ? 'טלפון נייד' : 'Mobile Number',
    idNumber: isHebrew ? 'תעודת זהות (אופציונלי)' : 'ID Number (Optional)',
    
    // Delivery Address
    deliveryAddress: isHebrew ? 'כתובת משלוח' : 'Delivery Address',
    city: isHebrew ? 'עיר' : 'City',
    streetName: isHebrew ? 'שם רחוב' : 'Street Name',
    streetNumber: isHebrew ? 'מספר בית' : 'House Number',
    floor: isHebrew ? 'קומה (אופציונלי)' : 'Floor (Optional)',
    apartmentNumber: isHebrew ? 'מספר דירה (אופציונלי)' : 'Apartment Number (Optional)',
    zipCode: isHebrew ? 'מיקוד (אופציונלי)' : 'ZIP Code (Optional)',
    notes: isHebrew ? 'הערות למשלוח (אופציונלי)' : 'Delivery Notes (Optional)',
    pickupNotes: isHebrew ? 'הערות להזמנה (אופציונלי)' : 'Order Notes (Optional)',
    
    
    // Validation
    required: isHebrew ? 'שדה חובה' : 'Required field',
    invalidEmail: isHebrew ? 'פורמט אימייל לא תקין' : 'Invalid email format',
    invalidPhone: isHebrew ? 'פורמט טלפון לא תקין' : 'Invalid phone format',
    invalidId: isHebrew ? 'פורמט תעודת זהות לא תקין' : 'Invalid ID format',
    emailRequired: isHebrew ? 'אימייל הוא שדה חובה' : 'Email is required',
    mobileRequired: isHebrew ? 'מספר טלפון הוא שדה חובה' : 'Mobile number is required',
    emailInvalid: isHebrew ? 'אנא הזן כתובת אימייל תקינה' : 'Please enter a valid email address',
    mobileInvalid: isHebrew ? 'אנא הזן מספר טלפון ישראלי תקין (050-1234567)' : 'Please enter a valid Israeli mobile number (050-1234567)',
    firstNameRequired: isHebrew ? 'שם פרטי הוא שדה חובה' : 'First name is required',
    lastNameRequired: isHebrew ? 'שם משפחה הוא שדה חובה' : 'Last name is required',
  };

  // Individual field validation functions
  const validateEmail = (email: string): string | null => {
    if (!email.trim()) {
      return t.emailRequired;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return t.emailInvalid;
    }
    return null;
  };

  const validateMobile = (mobile: string): string | null => {
    if (!mobile.trim()) {
      return t.mobileRequired;
    }
    // Israeli mobile number validation (supports various formats)
    const cleanMobile = mobile.replace(/\s|-/g, '');
    const mobileRegex = /^(\+972|0)([23489]|5[012345689]|77)[0-9]{7}$/;
    if (!mobileRegex.test(cleanMobile)) {
      return t.mobileInvalid;
    }
    return null;
  };

  const validateFirstName = (firstName: string): string | null => {
    if (!firstName.trim()) {
      return t.firstNameRequired;
    }
    return null;
  };

  const validateLastName = (lastName: string): string | null => {
    if (!lastName.trim()) {
      return t.lastNameRequired;
    }
    return null;
  };

  // Validate individual field and update errors
  const validateField = (fieldName: string, value: string) => {
    let error: string | null = null;
    
    switch (fieldName) {
      case 'firstName':
        error = validateFirstName(value);
        break;
      case 'lastName':
        error = validateLastName(value);
        break;
      case 'email':
        error = validateEmail(value);
        break;
      case 'mobile':
        error = validateMobile(value);
        break;
    }

    setFieldErrors(prev => ({
      ...prev,
      [fieldName]: error || ''
    }));
  };

  useEffect(() => {
    // Validate form whenever formData changes
    const isValid = validateForm(formData);
    onValidationChange(isValid);
  }, [formData, onValidationChange]);

  const validateForm = (data: CheckoutFormData): boolean => {
    const { payer, deliveryAddress, shippingMethod } = data;

    // Personal details validation
    if (!payer.firstName || !payer.lastName || !payer.email || !payer.mobile) {
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer.email)) {
      return false;
    }
    if (!/^(\+972|0)([23489]|5[012345689]|77)[0-9]{7}$/.test(payer.mobile.replace(/\s/g, ''))) {
      return false;
    }

    // Delivery address validation (only for home delivery)
    if (shippingMethod !== 'pickup') {
      if (!deliveryAddress.city || !deliveryAddress.streetName || !deliveryAddress.streetNumber) {
        return false;
      }
    }

    return true;
  };

  const handlePayerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Update form data
    onFormChange({
      ...formData,
      payer: {
        ...formData.payer,
        [name]: value,
      },
    });

    // Validate the field in real-time
    validateField(name, value);
  };

  const handleDeliveryAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onFormChange({
      ...formData,
      deliveryAddress: {
        ...formData.deliveryAddress,
        [name]: value,
      },
    });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onFormChange({
      ...formData,
      notes: e.target.value,
    });
  };


  return (
    <div className="space-y-8">
      {/* Personal Details Section */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
          {t.personalDetails}
        </h3>
        
        <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-6">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
              {t.firstName} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="firstName"
              id="firstName"
              value={formData.payer.firstName}
              onChange={handlePayerChange}
              className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none sm:text-sm ${
                fieldErrors.firstName 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
              required
            />
            {fieldErrors.firstName && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.firstName}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
              {t.lastName} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="lastName"
              id="lastName"
              value={formData.payer.lastName}
              onChange={handlePayerChange}
              className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none sm:text-sm ${
                fieldErrors.lastName 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
              required
            />
            {fieldErrors.lastName && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.lastName}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t.email} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              id="email"
              value={formData.payer.email}
              onChange={handlePayerChange}
              className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none sm:text-sm ${
                fieldErrors.email 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
              required
            />
            {fieldErrors.email && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="mobile" className="block text-sm font-medium text-gray-700">
              {t.mobile} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="mobile"
              id="mobile"
              value={formData.payer.mobile}
              onChange={handlePayerChange}
              className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none sm:text-sm ${
                fieldErrors.mobile 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
              placeholder={isHebrew ? '050-1234567' : '050-1234567'}
              required
            />
            {fieldErrors.mobile && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.mobile}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="idNumber" className="block text-sm font-medium text-gray-700">
              {t.idNumber}
            </label>
            <input
              type="text"
              name="idNumber"
              id="idNumber"
              value={formData.payer.idNumber || ''}
              onChange={handlePayerChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder={isHebrew ? '123456789' : '123456789'}
            />
          </div>
        </div>
      </div>

      {/* Delivery Address / Pickup Section */}
      <div className="space-y-6">
        {isPickup ? (
          <>
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              {isHebrew ? 'איסוף עצמי מהחנות' : 'Self Pickup from Store'}
            </h3>
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
              <p>
                {isHebrew
                  ? 'האיסוף יתבצע מהחנות ברחוב רוטשילד 51, ראשון לציון בשעות הפעילות: '
                  : 'Pickup will be from our store at Rothschild 51, Rishon Lezion during opening hours.'}
              </p>
              <p>
                {isHebrew
                  ? 'יום ראשון - יום חמישי: 09:30 - 19:30'
                  : 'Monday - Friday: 09:30 - 19:30'}
              </p>
              <p>
                {isHebrew
                  ? 'יום שישי: 09:30 - 15:00'
                  : 'Friday: 09:30 - 15:00'}
              </p>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              {t.deliveryAddress}
            </h3>
            
            <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-6">
              <div className="sm:col-span-2">
                <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                  {t.city} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="city"
                  id="city"
                  value={formData.deliveryAddress.city}
                  onChange={handleDeliveryAddressChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="streetName" className="block text-sm font-medium text-gray-700">
                  {t.streetName} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="streetName"
                  id="streetName"
                  value={formData.deliveryAddress.streetName}
                  onChange={handleDeliveryAddressChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="streetNumber" className="block text-sm font-medium text-gray-700">
                  {t.streetNumber} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="streetNumber"
                  id="streetNumber"
                  value={formData.deliveryAddress.streetNumber}
                  onChange={handleDeliveryAddressChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="floor" className="block text-sm font-medium text-gray-700">
                  {t.floor}
                </label>
                <input
                  type="text"
                  name="floor"
                  id="floor"
                  value={formData.deliveryAddress.floor || ''}
                  onChange={handleDeliveryAddressChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label htmlFor="apartmentNumber" className="block text-sm font-medium text-gray-700">
                  {t.apartmentNumber}
                </label>
                <input
                  type="text"
                  name="apartmentNumber"
                  id="apartmentNumber"
                  value={formData.deliveryAddress.apartmentNumber || ''}
                  onChange={handleDeliveryAddressChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700">
                  {t.zipCode}
                </label>
                <input
                  type="text"
                  name="zipCode"
                  id="zipCode"
                  value={formData.deliveryAddress.zipCode || ''}
                  onChange={handleDeliveryAddressChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </>
        )}
        
        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            {isPickup ? t.pickupNotes : t.notes}
          </label>
          <textarea
            name="notes"
            id="notes"
            rows={3}
            value={formData.notes || ''}
            onChange={handleNotesChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder={
              isPickup
                ? (isHebrew ? 'הערות נוספות להזמנה...' : 'Additional notes for your order...')
                : (isHebrew ? 'הערות נוספות למשלוח...' : 'Additional delivery notes...')
            }
          />
        </div>
      </div>

    </div>
  );
}