/* eslint-disable */

const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const { defineSecret, defineString } = require("firebase-functions/params");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");

admin.initializeApp();

const db = admin.firestore();

const MAIL_USER = defineSecret("MAIL_USER");
const MAIL_APP_PASSWORD = defineSecret("MAIL_APP_PASSWORD");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = defineSecret("TWILIO_WHATSAPP_FROM");

const PLAY_STORE_LINK = defineString("PLAY_STORE_LINK", {
  default: "https://play.google.com/store",
});
const APP_STORE_LINK = defineString("APP_STORE_LINK", {
  default: "https://apps.apple.com/",
});
const HUAWEI_APP_GALLERY_LINK = defineString("HUAWEI_APP_GALLERY_LINK", {
  default: "https://appgallery.huawei.com/",
});
const BUSINESS_TUTORIAL_LINK = defineString("BUSINESS_TUTORIAL_LINK", {
  default: "https://reservemu.com/",
});
const SUPPORT_WHATSAPP_NUMBER = defineString("SUPPORT_WHATSAPP_NUMBER", {
  default: "+23058264867",
});
const SUPPORT_EMAIL = defineString("SUPPORT_EMAIL", {
  default: "support@reservemu.com",
});

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
    document: "partner_onboarding_submissions/{submissionId}",
    secrets: [MAIL_USER, MAIL_APP_PASSWORD],
  },
  async (event) => {
    const snapshot = event.data;
    const data = snapshot?.data();
    const recipientEmail = data?.basicInfo?.email;

    if (!recipientEmail) {
      console.log("No email provided. Skipping email.");
      return;
    }

    const transporter = buildTransporter();

    const mailOptions = {
      from: `Reserve <${MAIL_USER.value()}>`,
      to: recipientEmail,
      subject: "Reserve – Onboarding received",
      text: `Dear partner,

Thank you for submitting ${data.basicInfo?.businessName || "your business"} on the Reserve platform.

We have received your full onboarding submission and our team will now review it internally.

There is no need to send the same information again by email. We will work directly from the profile you submitted.

If we need anything critical, we will contact you using the details you provided.

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

const normalizePhoneForWhatsApp = (value) => {
  if (!value) return null;

  const raw = String(value).trim().replace(/^whatsapp:/i, "");
  const plusAndDigits = raw.replace(/[^\d+]/g, "");
  const digits = plusAndDigits.replace(/\D/g, "");

  if (!digits) return null;

  if (plusAndDigits.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.startsWith("00")) {
    return `+${digits.slice(2)}`;
  }

  if (digits.startsWith("230") && digits.length === 11) {
    return `+${digits}`;
  }

  if (digits.length === 8) {
    return `+230${digits}`;
  }

  return `+${digits}`;
};

const normalizeTwilioWhatsAppFrom = (value) => {
  if (!value) return null;
  const cleaned = String(value).trim();
  if (cleaned.toLowerCase().startsWith("whatsapp:")) {
    return cleaned;
  }
  return `whatsapp:${cleaned}`;
};

const buildApprovalWhatsAppBody = ({
  clientName,
  businessName,
  partnerEmail,
  setPasswordLinkOrPassword,
}) => `Dear ${clientName},

Great news - your business ${businessName} has been approved on Reserve.

Please sign in using the provided credentials:
Email / Username: ${partnerEmail}
Password / Setup Link: ${setPasswordLinkOrPassword}

Once signed in, go to the PRO section of the app, where you can start adding your services and prices.

Download the app:

Android: ${PLAY_STORE_LINK.value()}
iPhone: ${APP_STORE_LINK.value()}
Huawei: ${HUAWEI_APP_GALLERY_LINK.value()}

Business tutorial:
${BUSINESS_TUTORIAL_LINK.value()}

Need help?
WhatsApp: ${SUPPORT_WHATSAPP_NUMBER.value()}
Email: ${SUPPORT_EMAIL.value()}

Welcome to Reserve.`;

exports.sendPartnerApprovalWhatsApp = onDocumentUpdated(
  {
    document: "partner_onboarding_submissions/{submissionId}",
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM],
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) {
      return;
    }

    const beforeStatus = (before.partnerStatus || "").toLowerCase();
    const afterStatus = (after.partnerStatus || "").toLowerCase();

    if (beforeStatus === afterStatus) {
      return;
    }

    if (afterStatus !== "approved") {
      return;
    }

    if (after.approvalWhatsAppSentAtIso) {
      console.log("Approval WhatsApp already sent for this submission.");
      return;
    }

    const partnerEmail = after?.basicInfo?.bookingEmail || after?.basicInfo?.email || after?.partnerDraft?.email;
    const clientName = after?.basicInfo?.contactPersonName || after?.partnerDraft?.contactPersonName || "partner";
    const businessName = after?.basicInfo?.businessName || after?.partnerDraft?.partnerName || "your business";
    const setPasswordLinkOrPassword =
      after?.partnerAccess?.setPasswordLink ||
      after?.setPasswordLink ||
      "You will receive your setup link shortly from the Reserve team.";

    const partnerMobile = after?.basicInfo?.mobile || after?.partnerDraft?.contactPersonPhone || after?.partnerDraft?.phoneNumber;
    const toNumber = normalizePhoneForWhatsApp(partnerMobile);
    const fromNumber = normalizeTwilioWhatsAppFrom(TWILIO_WHATSAPP_FROM.value());

    if (!toNumber || !fromNumber) {
      await event.data.after.ref.update({
        approvalWhatsAppStatus: "failed",
        approvalWhatsAppError: "Missing or invalid WhatsApp numbers.",
        updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    try {
      const twilioClient = twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());
      const message = await twilioClient.messages.create({
        from: fromNumber,
        to: `whatsapp:${toNumber}`,
        body: buildApprovalWhatsAppBody({
          clientName,
          businessName,
          partnerEmail: partnerEmail || "Not provided",
          setPasswordLinkOrPassword,
        }),
      });

      await event.data.after.ref.update({
        approvalWhatsAppStatus: "sent",
        approvalWhatsAppSentAtIso: new Date().toISOString(),
        approvalWhatsAppMessageSid: message.sid,
        updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("Approval WhatsApp sent:", message.sid);
    } catch (error) {
      console.error("Twilio WhatsApp send failed:", error);
      await event.data.after.ref.update({
        approvalWhatsAppStatus: "failed",
        approvalWhatsAppError: error?.message || "Unknown Twilio error",
        updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);
