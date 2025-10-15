import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Resend } from 'resend';
import { ContactMessageEmail } from '@/app/emails/contact-message';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { fullName, email, subject, message, language } = await request.json();
    
    // Validate required fields
    if (!fullName || !email || !subject || !message) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const timestamp = new Date();
    const isHebrew = language === 'he';

    // Format timestamp for email
    const formattedTimestamp = timestamp.toLocaleString(isHebrew ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // 1. Store in Neon (PostgreSQL) database
    let neonContactMessage;
    try {
      neonContactMessage = await prisma.contactMessage.create({
        data: {
          fullName,
          email,
          subject,
          message,
          createdAt: timestamp,
        },
      });
      console.log(`Contact message stored in Neon DB with ID: ${neonContactMessage.id}`);
    } catch (prismaError) {
      console.error('Failed to store contact message in Neon DB:', prismaError);
      // Continue anyway - we'll try to store in Firebase
    }

    // 2. Store in Firebase (Firestore) database
    let firebaseId;
    try {
      const docRef = await addDoc(collection(db, 'contact_messages'), {
        fullName,
        email,
        subject,
        message,
        createdAt: timestamp,
      });
      firebaseId = docRef.id;
      console.log(`Contact message stored in Firebase with ID: ${firebaseId}`);
    } catch (firebaseError) {
      console.error('Failed to store contact message in Firebase:', firebaseError);
      // Continue anyway - we'll try to send the email
    }

    // 3. Send email notifications to all recipients
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY environment variable is not set');
      return NextResponse.json(
        { 
          success: true, 
          message: 'Contact message saved but email could not be sent (missing API key)',
          id: neonContactMessage?.id || firebaseId 
        },
        { status: 200 }
      );
    }

    try {
      const emailSubject = isHebrew 
        ? `הודעת צור קשר חדשה - ${subject}`
        : `New Contact Message - ${subject}`;

      // Send email to all recipients (admins and the customer)
      const recipients = [
        'avshi@sako-or.com',
        'moshe@sako-or.com',
        'info@sako-or.com',
        email, // Send a copy to the customer
      ];

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: 'Sako Or <info@sako-or.com>',
        to: recipients,
        subject: emailSubject,
        react: ContactMessageEmail({
          fullName,
          email,
          subject,
          message,
          timestamp: formattedTimestamp,
          isHebrew,
        }),
      });

      if (emailError) {
        console.error('Failed to send contact message email:', emailError);
        return NextResponse.json(
          { 
            success: true, 
            message: 'Contact message saved but email failed to send',
            id: neonContactMessage?.id || firebaseId,
            emailError: emailError 
          },
          { status: 200 }
        );
      }

      console.log(`Contact message email sent successfully. Message ID: ${emailData?.id}`);
      
      return NextResponse.json({
        success: true,
        message: 'Contact message sent successfully',
        id: neonContactMessage?.id || firebaseId,
        emailMessageId: emailData?.id,
      });

    } catch (emailException) {
      console.error('Exception while sending contact message email:', emailException);
      return NextResponse.json(
        { 
          success: true, 
          message: 'Contact message saved but email encountered an error',
          id: neonContactMessage?.id || firebaseId,
          emailError: emailException instanceof Error ? emailException.message : 'Unknown error'
        },
        { status: 200 }
      );
    }
    
  } catch (error) {
    console.error('Contact form submission error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process contact message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

