// sendCampaign.js
import { Resend } from 'resend';
const resend = new Resend('re_gy2QLLjm_MVfbTXEYW6SYPXAogH5VLzLo');

async function sendTemplateToAudience() {
  try {
    // 1️⃣  Get audience members
    const audienceId = 'b03631e4-4e2a-4ab0-9067-a46819a5f6c5';
    const members = await resend.segments.get(audienceId);

    const { data, error } = await resend.broadcasts.create({
        segmentId: 'b03631e4-4e2a-4ab0-9067-a46819a5f6c5',
        from: 'Sako Or <info@sako-or.com>',
        subject: '✨ New Sale — 10% OFF on Outlet ✨',
        template: {id: '77bdf504-21f7-4878-896a-8f997069ea22'} // the template ID or slug from Resend
    });


    console.log('Campaign sent!');
  } catch (err) {
    console.error(err);
  }
}

sendTemplateToAudience();
