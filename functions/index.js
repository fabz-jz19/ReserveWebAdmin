/* eslint-disable */

const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { defineSecret } = require("firebase-functions/params");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const MAIL_USER = defineSecret("MAIL_USER");
const MAIL_APP_PASSWORD = defineSecret("MAIL_APP_PASSWORD");

const buildTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: MAIL_USER.value(),
      pass: MAIL_APP_PASSWORD.value(),
    },
  });

exports.sendPartnerOnboardingMail = onDocumentCreated(
  {
    document: "partner_leads/{leadId}",
    secrets: [MAIL_USER, MAIL_APP_PASSWORD],
  },
  async (event) => {
    const snapshot = event.data;
    const data = snapshot?.data();

    if (!data?.email) {
      console.log("No email provided. Skipping email.");
      return;
    }

    const transporter = buildTransporter();

    const mailOptions = {
      from: `Reserve <${MAIL_USER.value()}>`,
      to: data.email,
      subject: "Reserve – Partner Onboarding",
      text: `Dear partner,

I hope you’re doing well.

Thank you for registering ${data.businessName} on the Reserve platform.

We are excited to start working together and support your business through our booking platform.

----------------------------------

Information required to complete your onboarding

To set up your business profile in the Reserve app, please reply with the following details:

1. Photos
Up to 5 photos maximum.
These can include your logo, workspace, services, or any visuals representing your business.

2. Business description
A short description of your services (2–5 lines is perfect).

3. Location
Latitude & longitude or a Google Maps pin.

4. Address
Full business address as you want it displayed in the app.

5. Working hours
Opening hours from Monday to Sunday.
Please specify closed days if applicable.

6. Reserve platform email
The email address you would like to use for:
- Booking notifications
- Partner dashboard access
- Reserve business communications

----------------------------------

Once this information is received, we will immediately add your business to the Reserve app and make your profile live.

If you have any questions or need assistance, feel free to reply to this email.

Looking forward to working together and building this step by step.

Best regards,

Fabien Noellette Jeremie
(On behalf of the Direction – Mrs Mirella Noellette)
Schedura Technologies Ltd

Phone: +230 58264867
Website: reservemu.com

Reserve
Enn klik… la vie vinn fasil.`,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("Email sent to:", data.email);
    } catch (error) {
      console.error("Email sending failed:", error);
    }
  }
);
