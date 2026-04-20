import nodemailer from 'nodemailer';

// Configure your email transport
// For development: uses Ethereal (fake SMTP)
// For production: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    // Production email
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development: log to console
    transporter = {
      sendMail: async (options) => {
        console.log('📧 EMAIL (dev mode - not actually sent):');
        console.log(`  To: ${options.to}`);
        console.log(`  Subject: ${options.subject}`);
        console.log(`  Body: ${options.text || options.html}`);
        return { messageId: 'dev-' + Date.now() };
      },
    };
  }

  return transporter;
}

const COORDINATOR_EMAIL = process.env.COORDINATOR_EMAIL || 'coordinator@lbfoodcoalition.org';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@lbfoodcoalition.org';

export async function sendShiftConfirmation(volunteer, shift) {
  const transport = await getTransporter();
  const gcalUrl = generateGoogleCalendarUrl(shift);

  // Email to volunteer
  await transport.sendMail({
    from: FROM_EMAIL,
    to: volunteer.email,
    subject: `Shift Confirmed: ${shift.title} on ${formatDate(shift.date)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">You're signed up! 🎉</h2>
        <p>Hi ${volunteer.name},</p>
        <p>You've been confirmed for the following shift:</p>
        <div style="background: #f0f7e6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #2d5016;">${shift.title}</h3>
          <p><strong>Date:</strong> ${formatDate(shift.date)}</p>
          <p><strong>Time:</strong> ${shift.start_time} - ${shift.end_time}</p>
          <p><strong>Location:</strong> ${shift.location}</p>
          ${shift.location_address ? `<p><strong>Address:</strong> ${shift.location_address}</p>` : ''}
          ${shift.notes ? `<p><strong>Notes:</strong> ${shift.notes}</p>` : ''}
        </div>
        <p>
          <a href="${gcalUrl}" style="background: #2d5016; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Add to Google Calendar
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">Thank you for volunteering with the Long Beach Food Coalition!</p>
      </div>
    `,
  });

  // Email to coordinator
  await transport.sendMail({
    from: FROM_EMAIL,
    to: COORDINATOR_EMAIL,
    subject: `New Signup: ${volunteer.name} → ${shift.title} on ${formatDate(shift.date)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">New Shift Signup</h2>
        <p><strong>${volunteer.name}</strong> (${volunteer.email}) has signed up for:</p>
        <div style="background: #f0f7e6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #2d5016;">${shift.title}</h3>
          <p><strong>Date:</strong> ${formatDate(shift.date)}</p>
          <p><strong>Time:</strong> ${shift.start_time} - ${shift.end_time}</p>
          <p><strong>Location:</strong> ${shift.location}</p>
        </div>
        <p><strong>Volunteer Contact:</strong></p>
        <ul>
          <li>Email: ${volunteer.email}</li>
          <li>Phone: ${volunteer.phone || 'Not provided'}</li>
        </ul>
      </div>
    `,
  });
}

export async function sendCancellationNotice(volunteer, shift) {
  const transport = await getTransporter();

  await transport.sendMail({
    from: FROM_EMAIL,
    to: COORDINATOR_EMAIL,
    subject: `Cancellation: ${volunteer.name} → ${shift.title} on ${formatDate(shift.date)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #b91c1c;">Shift Cancellation</h2>
        <p><strong>${volunteer.name}</strong> has cancelled their signup for:</p>
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${shift.title}</h3>
          <p><strong>Date:</strong> ${formatDate(shift.date)}</p>
          <p><strong>Time:</strong> ${shift.start_time} - ${shift.end_time}</p>
        </div>
      </div>
    `,
  });
}

export function generateGoogleCalendarUrl(shift) {
  const startDate = shift.date.replace(/-/g, '');
  const startTime = shift.start_time.replace(/:/g, '') + '00';
  const endTime = shift.end_time.replace(/:/g, '') + '00';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: shift.title,
    dates: `${startDate}T${startTime}/${startDate}T${endTime}`,
    location: shift.location_address || shift.location,
    details: `${shift.notes || ''}\n\nLong Beach Food Coalition Volunteer Shift`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
