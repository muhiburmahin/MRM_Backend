import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';

dotenv.config();

async function main() {
  console.log('───────────────────────────────────────────────────────');
  console.log('   MRM InfoTech — Automated Email Delivery Probe');
  console.log('───────────────────────────────────────────────────────');

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER || 'contact.mrminfotech@gmail.com';
  const pass = process.env.SMTP_PASSWORD;
  const recipient = process.env.MAIL_NOTIFY_RECIPIENT || 'contact.mrminfotech@gmail.com';

  console.log(`Target Recipient : ${recipient}`);
  console.log(`SMTP Host        : ${host}:${port}`);
  console.log(`SMTP User        : ${user}`);
  console.log(
    `SMTP Password    : ${pass ? '•••••••••••••••• (Configured)' : 'NOT SET (Missing in .env)'}`,
  );
  console.log('───────────────────────────────────────────────────────');

  if (!pass) {
    console.log('\n⚠️  SMTP_PASSWORD is empty in .env.');
    console.log('To send real emails to contact.mrminfotech@gmail.com via Gmail:');
    console.log('1. Visit https://myaccount.google.com/apppasswords');
    console.log('2. Create an App Password for "MRM InfoTech Website"');
    console.log('3. Copy the 16-character code and paste it in MRMinfotech-backend/.env:');
    console.log('   SMTP_PASSWORD="xxxx xxxx xxxx xxxx"\n');
    return;
  }

  console.log('\nConnecting to SMTP server...');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.verify();
    console.log('✅ SMTP Handshake Successful! Credentials are verified.');

    console.log(`Dispatching test verification email to ${recipient}...`);
    const info = await transporter.sendMail({
      from: `"MRM InfoTech System" <${user}>`,
      to: recipient,
      subject: `[Test] MRM InfoTech Contact Pipeline Verified (${new Date().toLocaleTimeString()})`,
      text: `This is a test notification confirming that the MRM InfoTech contact email pipeline is active and delivering to ${recipient}.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; background-color: #0B1E3B; color: #FFFFFF; border-radius: 12px; max-width: 500px;">
          <h2 style="color: #20B8D5; margin-top: 0;">MRM InfoTech Email Pipeline Verified</h2>
          <p>This automated test confirms that inquiries submitted via the Contact form will be delivered to <strong>${recipient}</strong>.</p>
          <p style="font-size: 11px; color: #94A3B8;">Timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
    });

    console.log(`✅ Test email delivered successfully! Message ID: ${info.messageId}\n`);
  } catch (err) {
    console.error('❌ Failed to connect / deliver email:', (err as Error).message);
  }
}

main().catch(console.error);
