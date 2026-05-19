/* eslint-disable */

const admin = require("firebase-admin");
const twilio = require("twilio");
const { defineSecret, defineString } = require("firebase-functions/params");
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");

admin.initializeApp();

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = defineSecret("TWILIO_WHATSAPP_FROM");
const TWILIO_SUBMISSION_RECEIVED_TEMPLATE_SID = defineString("TWILIO_SUBMISSION_RECEIVED_TEMPLATE_SID", {
  default: "",
});
const TWILIO_PARTNER_APPROVAL_TEMPLATE_SID = defineString("TWILIO_PARTNER_APPROVAL_TEMPLATE_SID", {
  default: "",
});
const TWILIO_BOOKING_CREATED_PARTNER_TEMPLATE_SID = defineString("TWILIO_BOOKING_CREATED_PARTNER_TEMPLATE_SID", {
  default: "",
});
const TWILIO_BOOKING_APPROVED_CLIENT_TEMPLATE_SID = defineString("TWILIO_BOOKING_APPROVED_CLIENT_TEMPLATE_SID", {
  default: "",
});
const TWILIO_BOOKING_REJECTED_CLIENT_TEMPLATE_SID = defineString("TWILIO_BOOKING_REJECTED_CLIENT_TEMPLATE_SID", {
  default: "",
});

const PLAY_STORE_LINK = defineString("PLAY_STORE_LINK", {
  default: "https://play.google.com/store/apps/details?id=com.reserveapp.mu",
});
const APP_STORE_LINK = defineString("APP_STORE_LINK", {
  default: "https://apps.apple.com/us/app/reserve-mauritius/id6766951524",
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

const db = admin.firestore();

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

const normalizeTemplateSid = (value) => {
  if (!value) return null;
  const sid = String(value).trim();
  return sid ? sid : null;
};

const sendTwilioWhatsAppMessage = async ({
  twilioClient,
  fromNumber,
  toNumber,
  body,
  templateSid,
  templateVariables,
}) => {
  const payload = {
    from: fromNumber,
    to: `whatsapp:${toNumber}`,
  };

  if (templateSid) {
    payload.contentSid = templateSid;
    payload.contentVariables = JSON.stringify(templateVariables || {});
  } else {
    payload.body = body;
  }

  return twilioClient.messages.create(payload);
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

const buildSubmissionReceivedWhatsAppBody = ({ clientName, businessName }) => `Dear ${clientName},

Thank you for registering ${businessName} on Reserve.

We confirm that we have received your onboarding application.
Our team is currently reviewing your submission and working on your profile setup.

You will receive a confirmation message once your business is ready on the Reserve app.

Need help in the meantime?
WhatsApp: ${SUPPORT_WHATSAPP_NUMBER.value()}
Email: ${SUPPORT_EMAIL.value()}

Reserve Team`;

const buildSubmissionReceivedTemplateVariables = ({ clientName, businessName }) => ({
  "1": clientName,
  "2": businessName,
  "3": SUPPORT_WHATSAPP_NUMBER.value(),
  "4": SUPPORT_EMAIL.value(),
});

const buildApprovalTemplateVariables = ({
  clientName,
  businessName,
  partnerEmail,
  setPasswordLinkOrPassword,
}) => ({
  "1": clientName,
  "2": businessName,
  "3": partnerEmail,
  "4": setPasswordLinkOrPassword,
  "5": PLAY_STORE_LINK.value(),
  "6": APP_STORE_LINK.value(),
  "7": HUAWEI_APP_GALLERY_LINK.value(),
  "8": BUSINESS_TUTORIAL_LINK.value(),
  "9": SUPPORT_WHATSAPP_NUMBER.value(),
  "10": SUPPORT_EMAIL.value(),
});

const toDateObject = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value?.toDate === "function") {
    const converted = value.toDate();
    if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
      return converted;
    }
  }

  if (typeof value === "object") {
    if (typeof value.seconds === "number") {
      return new Date(value.seconds * 1000);
    }
    if (typeof value._seconds === "number") {
      return new Date(value._seconds * 1000);
    }
    if (value.date) {
      return toDateObject(value.date);
    }
    if (value.start) {
      return toDateObject(value.start);
    }
    if (value.startDate) {
      return toDateObject(value.startDate);
    }
    if (value.startDateTime) {
      return toDateObject(value.startDateTime);
    }
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

const formatDateLabel = (value) => {
  const date = toDateObject(value);
  if (date) {
    return date.toLocaleDateString("en-MU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return null;
};

const formatTimeLabel = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string" && value.trim()) {
    const raw = value.trim();
    if (/^\d{1,2}:\d{2}(\s?[APMapm]{2})?$/.test(raw)) {
      return raw;
    }
    if (raw.includes("T")) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleTimeString("en-MU", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }
    }
    return null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  const date = toDateObject(value);
  if (date) {
    const hasMeaningfulTime = date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
    if (!hasMeaningfulTime) {
      return null;
    }
    return date.toLocaleTimeString("en-MU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  if (typeof value === "object") {
    const directCandidates = [
      value.time,
      value.label,
      value.value,
      value.slot,
      value.startTime,
      value.endTime,
    ].filter(Boolean);
    if (directCandidates.length) {
      return formatTimeLabel(directCandidates[0]);
    }

    const hour = value.hour ?? value.hours;
    const minute = value.minute ?? value.minutes;
    if (hour !== undefined || minute !== undefined) {
      const hh = String(hour ?? 0).padStart(2, "0");
      const mm = String(minute ?? 0).padStart(2, "0");
      return `${hh}:${mm}`;
    }

    if (value.from || value.to) {
      const from = formatTimeLabel(value.from);
      const to = formatTimeLabel(value.to);
      if (from && to) {
        return `${from} - ${to}`;
      }
      return from || to;
    }
  }

  return null;
};

const getBookingServices = (booking) => (
  Array.isArray(booking?.service)
    ? booking.service
    : Array.isArray(booking?.services)
      ? booking.services
      : []
);

const getBookedDateText = (booking) => {
  const dateCandidates = [
    booking?.slot?.date,
    booking?.bookingDate,
    booking?.date,
    booking?.selectedDate,
    booking?.appointmentDate,
    booking?.slotDate,
    booking?.bookingStartDateTime,
    booking?.startDateTime,
    booking?.startAt,
  ].filter(Boolean);

  for (const candidate of dateCandidates) {
    const formatted = formatDateLabel(candidate);
    if (formatted) {
      return formatted;
    }
  }

  return "your selected date";
};

const getBookedTimeText = (booking) => {
  const timeCandidates = [
    booking?.slot?.startTime,
    booking?.slot?.time,
    booking?.bookingTime,
    booking?.time,
    booking?.selectedTime,
    booking?.appointmentTime,
    booking?.slotTime,
    booking?.bookingStartDateTime,
    booking?.startDateTime,
    booking?.startAt,
  ].filter(Boolean);

  for (const candidate of timeCandidates) {
    const formatted = formatTimeLabel(candidate);
    if (formatted) {
      return formatted;
    }
  }

  return "your selected time";
};

const formatScheduleText = (booking) => {
  const dateValue = getBookedDateText(booking);
  const timeValue = getBookedTimeText(booking);

  if (dateValue && timeValue) {
    return `${dateValue} at ${timeValue}`;
  }
  if (dateValue) {
    return String(dateValue);
  }
  if (timeValue) {
    return String(timeValue);
  }
  return "your selected schedule";
};

const computeBookingTotal = (booking) => {
  const services = getBookingServices(booking);

  if (services.length) {
    return services.reduce((sum, service) => {
      const price = Number(service?.price) || 0;
      const quantity = Number(service?.quantity) || 1;
      return sum + (price * quantity);
    }, 0);
  }

  return Number(booking?.totalPrice || booking?.price || booking?.amount || 0);
};

const buildServiceSummary = (booking) => {
  const services = getBookingServices(booking);

  const names = services
    .map((service) => {
      const description = `${service?.description || ""}`.trim();
      const safeDescription = description && !/^no description/i.test(description) ? description : "";
      return (
        service?.title ||
        service?.productName ||
        service?.name ||
        safeDescription ||
        service?.productCategory
      );
    })
    .filter(Boolean);

  const baseSummary = names.length ? names.join(", ") : "your selected service";
  const total = computeBookingTotal(booking);

  if (!Number.isFinite(total) || total <= 0) {
    return baseSummary;
  }

  return `${baseSummary} - MUR ${total.toFixed(2)}`;
};

const buildBookedServiceLabel = (booking) => {
  const services = getBookingServices(booking);

  const names = services
    .map((service) => {
      const description = `${service?.description || ""}`.trim();
      const safeDescription = description && !/^no description/i.test(description) ? description : "";
      return (
        service?.title ||
        service?.productName ||
        service?.name ||
        safeDescription ||
        service?.productCategory
      );
    })
    .filter(Boolean);

  const baseSummary = names.length ? names.join(", ") : "your selected service";
  const total = computeBookingTotal(booking);

  if (!Number.isFinite(total) || total <= 0) {
    return baseSummary;
  }

  return `${baseSummary} - MUR ${total.toFixed(2)}`;
};

const formatLocationText = (booking, partnerAddress, partnerPhone) => {
  const locationCandidates = [
    partnerAddress,
    booking?.partnerAddress,
    booking?.businessAddress,
  ].filter(Boolean);

  const baseLocation = locationCandidates[0] || "the partner location";
  const normalizedPhone = normalizePhoneForWhatsApp(partnerPhone);

  if (normalizedPhone) {
    return `${baseLocation} (${normalizedPhone})`;
  }

  return baseLocation;
};

const buildClientLabel = (clientName, clientPhoneRaw) => {
  const safeName = clientName || "customer";
  const normalizedPhone = normalizePhoneForWhatsApp(clientPhoneRaw);
  return normalizedPhone ? `${safeName} (${normalizedPhone})` : safeName;
};

const fetchPartnerBookingContact = async (partnerId) => {
  if (!partnerId) {
    return {};
  }

  try {
    const snap = await db.doc(`partners/${partnerId}`).get();
    if (!snap.exists) {
      return {};
    }

    const data = snap.data() || {};
    return {
      partnerName: data.partnerName || data.name || "your business",
      partnerPhone:
        data.phoneNumber ||
        data.contactPersonPhone ||
        data.mobileNumber ||
        data.mobile ||
        null,
      partnerJuiceNumber:
        data.juiceMobileNumber ||
        data.juiceNumber ||
        null,
      partnerAccountNumber:
        data.accountNumber ||
        data.mcbAccountNumber ||
        null,
      partnerAddress:
        data.address ||
        data.businessAddress ||
        (Array.isArray(data.branchLocations) && data.branchLocations[0]?.address) ||
        null,
      partnerEmail:
        data.email ||
        data.contactPersonEmail ||
        data.authenticationMail ||
        null,
    };
  } catch (error) {
    console.error("Failed to fetch partner contact for booking WhatsApp:", error);
    return {};
  }
};

const formatMoney = (amount) => `MUR ${Number(amount || 0).toFixed(2)}`;

const buildPaymentInstruction = (booking, { partnerJuiceNumber, partnerAccountNumber } = {}) => {
  const total = computeBookingTotal(booking);
  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }

  const normalizedJuice = normalizePhoneForWhatsApp(partnerJuiceNumber);
  const cleanAccount = partnerAccountNumber ? String(partnerAccountNumber).trim() : "";

  const paymentLines = [];
  if (normalizedJuice) {
    paymentLines.push(`Juice: ${normalizedJuice}`);
  }
  if (cleanAccount) {
    paymentLines.push(`Account number: ${cleanAccount}`);
  }

  if (!paymentLines.length) {
    return null;
  }

  return `Please do payment of ${formatMoney(total)} to: ${paymentLines.join(" or ")}`;
};

const buildBookingCreatedClientBody = ({
  clientName,
  businessName,
  serviceSummary,
  scheduleText,
  locationText,
  bookingReference,
}) => `Dear ${clientName},

Your booking with ${businessName} has been created successfully.

Service: ${serviceSummary}
Schedule: ${scheduleText}
Location: ${locationText}
Booking reference: ${bookingReference}

You will receive another update once the business approves your booking.

Need help?
WhatsApp: ${SUPPORT_WHATSAPP_NUMBER.value()}
Email: ${SUPPORT_EMAIL.value()}

Reserve Team`;

const buildBookingCreatedPartnerBody = ({
  partnerName,
  clientName,
  clientLabel,
  serviceSummary,
  scheduleText,
  locationText,
  bookingReference,
}) => `Dear ${partnerName},

You have received a new booking on Reserve.

Client: ${clientLabel || clientName}
Service: ${serviceSummary}
Schedule: ${scheduleText}
Location: ${locationText}
Booking reference: ${bookingReference}

Please review it in the Reserve app.

Need help?
WhatsApp: ${SUPPORT_WHATSAPP_NUMBER.value()}
Email: ${SUPPORT_EMAIL.value()}

Reserve Team`;

const buildBookingApprovedClientBody = ({
  clientName,
  businessName,
  serviceSummary,
  scheduleText,
  locationText,
  bookingReference,
}) => `Dear ${clientName},

Good news - your booking with ${businessName} has been approved.

Service: ${serviceSummary}
Schedule: ${scheduleText}
Location: ${locationText}
Booking reference: ${bookingReference}

Thank you for booking with Reserve.

Need help?
WhatsApp: ${SUPPORT_WHATSAPP_NUMBER.value()}
Email: ${SUPPORT_EMAIL.value()}

Reserve Team`;

const buildBookingRejectedClientBody = ({
  clientName,
  businessName,
  serviceSummary,
  scheduleText,
  locationText,
  bookingReference,
}) => `Dear ${clientName},

Your booking with ${businessName} has been rejected.

Service: ${serviceSummary}
Schedule: ${scheduleText}
Location: ${locationText}
Booking reference: ${bookingReference}

Need help?
WhatsApp: ${SUPPORT_WHATSAPP_NUMBER.value()}
Email: ${SUPPORT_EMAIL.value()}

Reserve Team`;

const buildBookingCreatedPartnerTemplateVariables = ({
  clientLabel,
  serviceSummary,
  bookingDateText,
  bookingTimeText,
  locationText,
  bookingReference,
  partnerName,
}) => ({
  "1": clientLabel,
  "2": serviceSummary,
  "3": bookingDateText,
  "4": bookingTimeText,
  "5": locationText,
  "6": bookingReference,
  "7": partnerName,
  "8": SUPPORT_WHATSAPP_NUMBER.value(),
  "9": SUPPORT_EMAIL.value(),
});

const buildBookingApprovedClientTemplateAdapter = ({
  businessName,
  serviceSummary,
  bookingDateText,
  bookingTimeText,
  locationText,
  bookingReference,
}) => ({
  // Adapter for the current Twilio confirmed-booking template:
  // Hi, your booking with {{2}} has been confirmed.
  // Service: {{1}}
  // Date: {{3}}
  // Time: {{4}}
  // Location: {{5}}
  "1": serviceSummary,
  "2": businessName,
  "3": bookingDateText,
  "4": bookingTimeText,
  "5": locationText,
  "6": bookingReference,
  "7": SUPPORT_WHATSAPP_NUMBER.value(),
  "8": SUPPORT_EMAIL.value(),
});

const buildBookingRejectedClientTemplateAdapter = ({
  businessName,
  serviceSummary,
  bookingDateText,
  bookingTimeText,
  locationText,
  bookingReference,
}) => ({
  // Adapter for the current Twilio rejected-booking template:
  // Hi , your booking with {{2}} has been rejected.
  // Service: {{1}}
  // Date: {{3}}
  // Time: {{4}}
  // Location: {{5}}
  "1": serviceSummary,
  "2": businessName,
  "3": bookingDateText,
  "4": bookingTimeText,
  "5": locationText,
  "6": bookingReference,
  "7": SUPPORT_WHATSAPP_NUMBER.value(),
  "8": SUPPORT_EMAIL.value(),
});

const sendBookingWhatsApp = async ({
  bookingRef,
  statusField,
  errorField,
  errorCodeField,
  sentAtField,
  sidField,
  toNumber,
  body,
  templateSid,
  templateVariables,
  logSuccessLabel,
  logErrorLabel,
}) => {
  const fromNumber = normalizeTwilioWhatsAppFrom(TWILIO_WHATSAPP_FROM.value());

  if (!toNumber || !fromNumber) {
    await bookingRef.update({
      [statusField]: "failed",
      [errorField]: "Missing or invalid WhatsApp numbers.",
      updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  try {
    const twilioClient = twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());
    const message = await sendTwilioWhatsAppMessage({
      twilioClient,
      fromNumber,
      toNumber,
      body,
      templateSid,
      templateVariables,
    });

    await bookingRef.update({
      [statusField]: "sent",
      [sentAtField]: new Date().toISOString(),
      [sidField]: message.sid,
      [errorCodeField]: null,
      updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(logSuccessLabel, message.sid);
  } catch (error) {
    console.error(logErrorLabel, error);
    const hint = Number(error?.code) === 63016
      ? " | Twilio 63016: use an approved WhatsApp template for this message."
      : "";
    await bookingRef.update({
      [statusField]: "failed",
      [errorField]: `${error?.message || "Unknown Twilio error"}${hint}`,
      [errorCodeField]: error?.code || null,
      updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
};

exports.sendPartnerSubmissionReceivedWhatsApp = onDocumentWritten(
  {
    document: "partner_onboarding_submissions/{submissionId}",
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM],
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!after) {
      return;
    }

    const afterStatus = (after.status || "").toLowerCase();
    const beforeStatus = (before?.status || "").toLowerCase();
    const becameSubmitted = afterStatus === "submitted" && beforeStatus !== "submitted";
    if (!becameSubmitted) {
      return;
    }

    const latestSnap = await event.data.after.ref.get();
    const latestData = latestSnap.data() || {};
    const latestWhatsAppStatus = (latestData.submissionReceivedWhatsAppStatus || "").toLowerCase();
    if (["sending", "sent", "failed"].includes(latestWhatsAppStatus) || latestData.submissionReceivedWhatsAppSentAtIso) {
      return;
    }

    await event.data.after.ref.update({
      submissionReceivedWhatsAppStatus: "sending",
      submissionReceivedWhatsAppError: admin.firestore.FieldValue.delete(),
      updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
    });

    const clientName = after?.basicInfo?.contactPersonName || after?.partnerDraft?.contactPersonName || "partner";
    const businessName = after?.basicInfo?.businessName || after?.partnerDraft?.partnerName || "your business";
    const partnerMobile =
      after?.basicInfo?.mobileE164 ||
      after?.basicInfo?.mobile ||
      after?.partnerDraft?.contactPersonPhone ||
      after?.partnerDraft?.phoneNumber;
    const toNumber = normalizePhoneForWhatsApp(partnerMobile);
    const fromNumber = normalizeTwilioWhatsAppFrom(TWILIO_WHATSAPP_FROM.value());

    if (!toNumber || !fromNumber) {
      await event.data.after.ref.update({
        submissionReceivedWhatsAppStatus: "failed",
        submissionReceivedWhatsAppError: "Missing or invalid WhatsApp numbers.",
        updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    try {
      const twilioClient = twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());
      const templateSid = normalizeTemplateSid(TWILIO_SUBMISSION_RECEIVED_TEMPLATE_SID.value());
      const message = await sendTwilioWhatsAppMessage({
        twilioClient,
        fromNumber,
        toNumber,
        body: buildSubmissionReceivedWhatsAppBody({
          clientName,
          businessName,
        }),
        templateSid,
        templateVariables: buildSubmissionReceivedTemplateVariables({
          clientName,
          businessName,
        }),
      });

      await event.data.after.ref.update({
        submissionReceivedWhatsAppStatus: "sent",
        submissionReceivedWhatsAppSentAtIso: new Date().toISOString(),
        submissionReceivedWhatsAppMessageSid: message.sid,
        submissionReceivedWhatsAppErrorCode: null,
        updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("Submission receipt WhatsApp sent:", message.sid);
    } catch (error) {
      console.error("Submission receipt WhatsApp send failed:", error);
      const hint = Number(error?.code) === 63016
        ? " | Twilio 63016: use an approved WhatsApp template and set TWILIO_SUBMISSION_RECEIVED_TEMPLATE_SID."
        : "";
      await event.data.after.ref.update({
        submissionReceivedWhatsAppStatus: "failed",
        submissionReceivedWhatsAppError: `${error?.message || "Unknown Twilio error"}${hint}`,
        submissionReceivedWhatsAppErrorCode: error?.code || null,
        updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

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
      const templateSid = normalizeTemplateSid(TWILIO_PARTNER_APPROVAL_TEMPLATE_SID.value());
      const message = await sendTwilioWhatsAppMessage({
        twilioClient,
        fromNumber,
        toNumber,
        body: buildApprovalWhatsAppBody({
          clientName,
          businessName,
          partnerEmail: partnerEmail || "Not provided",
          setPasswordLinkOrPassword,
        }),
        templateSid,
        templateVariables: buildApprovalTemplateVariables({
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
        approvalWhatsAppErrorCode: null,
        updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("Approval WhatsApp sent:", message.sid);
    } catch (error) {
      console.error("Twilio WhatsApp send failed:", error);
      const hint = Number(error?.code) === 63016
        ? " | Twilio 63016: use an approved WhatsApp template and set TWILIO_PARTNER_APPROVAL_TEMPLATE_SID."
        : "";
      await event.data.after.ref.update({
        approvalWhatsAppStatus: "failed",
        approvalWhatsAppError: `${error?.message || "Unknown Twilio error"}${hint}`,
        approvalWhatsAppErrorCode: error?.code || null,
        updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

exports.sendBookingCreatedWhatsApp = onDocumentCreated(
  {
    document: "bookings/{bookingId}",
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM],
  },
  async (event) => {
    const booking = event.data?.data();
    if (!booking) {
      return;
    }

    const bookingRef = event.data.ref;
    const bookingReference = booking.bookingId || event.params.bookingId;
    const serviceSummary = buildServiceSummary(booking);
    const bookingDateText = getBookedDateText(booking);
    const bookingTimeText = getBookedTimeText(booking);
    const scheduleText = formatScheduleText(booking);
    const clientName = booking.clientName || "customer";
    const clientLabel = buildClientLabel(
      clientName,
      booking.clientPhone || booking.clientMobile || booking.mobile || booking.phoneNumber
    );
    const clientPhone = normalizePhoneForWhatsApp(
      booking.clientPhone || booking.clientMobile || booking.mobile || booking.phoneNumber
    );
    const { partnerName, partnerPhone, partnerAddress } = await fetchPartnerBookingContact(booking.partnerId);
    const locationText = formatLocationText(booking, partnerAddress, partnerPhone);

    if (!booking.bookingCreatedClientWhatsAppStatus) {
      await bookingRef.update({
        bookingCreatedClientWhatsAppStatus: "sending",
        bookingCreatedClientWhatsAppError: admin.firestore.FieldValue.delete(),
        updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
      });

      await sendBookingWhatsApp({
        bookingRef,
        statusField: "bookingCreatedClientWhatsAppStatus",
        errorField: "bookingCreatedClientWhatsAppError",
        errorCodeField: "bookingCreatedClientWhatsAppErrorCode",
        sentAtField: "bookingCreatedClientWhatsAppSentAtIso",
        sidField: "bookingCreatedClientWhatsAppMessageSid",
        toNumber: clientPhone,
        body: buildBookingCreatedClientBody({
          clientName,
          businessName: partnerName || booking.partnerName || "the business",
          serviceSummary,
          scheduleText,
          locationText,
          bookingReference,
        }),
        templateSid: null,
        templateVariables: null,
        logSuccessLabel: "Booking created client WhatsApp sent:",
        logErrorLabel: "Booking created client WhatsApp send failed:",
      });
    }

    if (!booking.bookingCreatedPartnerWhatsAppStatus) {
      await bookingRef.update({
        bookingCreatedPartnerWhatsAppStatus: "sending",
        bookingCreatedPartnerWhatsAppError: admin.firestore.FieldValue.delete(),
        updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
      });

      await sendBookingWhatsApp({
        bookingRef,
        statusField: "bookingCreatedPartnerWhatsAppStatus",
        errorField: "bookingCreatedPartnerWhatsAppError",
        errorCodeField: "bookingCreatedPartnerWhatsAppErrorCode",
        sentAtField: "bookingCreatedPartnerWhatsAppSentAtIso",
        sidField: "bookingCreatedPartnerWhatsAppMessageSid",
        toNumber: normalizePhoneForWhatsApp(partnerPhone),
        body: buildBookingCreatedPartnerBody({
          partnerName: partnerName || "partner",
          clientName,
          clientLabel,
          serviceSummary,
          scheduleText,
          locationText,
          bookingReference,
        }),
        templateSid: normalizeTemplateSid(TWILIO_BOOKING_CREATED_PARTNER_TEMPLATE_SID.value()),
        templateVariables: buildBookingCreatedPartnerTemplateVariables({
          clientLabel,
          serviceSummary,
          bookingDateText,
          bookingTimeText,
          locationText,
          bookingReference,
          partnerName: partnerName || "partner",
        }),
        logSuccessLabel: "Booking created partner WhatsApp sent:",
        logErrorLabel: "Booking created partner WhatsApp send failed:",
      });
    }
  }
);

exports.sendBookingApprovedClientWhatsApp = onDocumentUpdated(
  {
    document: "bookings/{bookingId}",
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM],
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) {
      return;
    }

    const beforeStatus = String(before.status || "").trim().toLowerCase();
    const afterStatus = String(after.status || "").trim().toLowerCase();
    if (beforeStatus === afterStatus || afterStatus !== "approved") {
      return;
    }

    if (after.bookingApprovedClientWhatsAppSentAtIso || after.bookingApprovedClientWhatsAppStatus === "sent") {
      return;
    }

    const bookingRef = event.data.after.ref;
    const bookingReference = after.bookingId || event.params.bookingId;
    const serviceSummary = buildBookedServiceLabel(after);
    const bookingDateText = getBookedDateText(after);
    const bookingTimeText = getBookedTimeText(after);
    const scheduleText = formatScheduleText(after);
    const clientName = after.clientName || "customer";
    const clientPhone = normalizePhoneForWhatsApp(
      after.clientPhone || after.clientMobile || after.mobile || after.phoneNumber
    );
    const {
      partnerName,
      partnerAddress,
      partnerPhone,
      partnerJuiceNumber,
      partnerAccountNumber,
    } = await fetchPartnerBookingContact(after.partnerId);
    const locationText = formatLocationText(after, partnerAddress, partnerPhone);
    const paymentInstruction = buildPaymentInstruction(after, {
      partnerJuiceNumber,
      partnerAccountNumber,
    });
    const confirmedServiceSummary = paymentInstruction
      ? `${serviceSummary}. ${paymentInstruction}`
      : serviceSummary;

    await bookingRef.update({
      bookingApprovedClientWhatsAppStatus: "sending",
      bookingApprovedClientWhatsAppError: admin.firestore.FieldValue.delete(),
      updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
    });

    await sendBookingWhatsApp({
      bookingRef,
      statusField: "bookingApprovedClientWhatsAppStatus",
      errorField: "bookingApprovedClientWhatsAppError",
      errorCodeField: "bookingApprovedClientWhatsAppErrorCode",
      sentAtField: "bookingApprovedClientWhatsAppSentAtIso",
      sidField: "bookingApprovedClientWhatsAppMessageSid",
      toNumber: clientPhone,
      body: buildBookingApprovedClientBody({
        clientName,
        businessName: partnerName || after.partnerName || "the business",
        serviceSummary: confirmedServiceSummary,
        scheduleText,
        locationText,
        bookingReference,
      }),
      templateSid: normalizeTemplateSid(TWILIO_BOOKING_APPROVED_CLIENT_TEMPLATE_SID.value()),
      templateVariables: buildBookingApprovedClientTemplateAdapter({
        clientName,
        businessName: partnerName || after.partnerName || "the business",
        serviceSummary: confirmedServiceSummary,
        bookingDateText,
        bookingTimeText,
        locationText,
        bookingReference,
      }),
      logSuccessLabel: "Booking approved client WhatsApp sent:",
      logErrorLabel: "Booking approved client WhatsApp send failed:",
    });
  }
);

exports.sendBookingRejectedClientWhatsApp = onDocumentUpdated(
  {
    document: "bookings/{bookingId}",
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM],
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) {
      return;
    }

    const beforeStatus = String(before.status || "").trim().toLowerCase();
    const afterStatus = String(after.status || "").trim().toLowerCase();
    if (beforeStatus === afterStatus || afterStatus !== "rejected") {
      return;
    }

    if (after.bookingRejectedClientWhatsAppSentAtIso || after.bookingRejectedClientWhatsAppStatus === "sent") {
      return;
    }

    const bookingRef = event.data.after.ref;
    const bookingReference = after.bookingId || event.params.bookingId;
    const serviceSummary = buildBookedServiceLabel(after);
    const bookingDateText = getBookedDateText(after);
    const bookingTimeText = getBookedTimeText(after);
    const scheduleText = formatScheduleText(after);
    const clientName = after.clientName || "customer";
    const clientPhone = normalizePhoneForWhatsApp(
      after.clientPhone || after.clientMobile || after.mobile || after.phoneNumber
    );
    const { partnerName, partnerAddress, partnerPhone } = await fetchPartnerBookingContact(after.partnerId);
    const locationText = formatLocationText(after, partnerAddress, partnerPhone);

    await bookingRef.update({
      bookingRejectedClientWhatsAppStatus: "sending",
      bookingRejectedClientWhatsAppError: admin.firestore.FieldValue.delete(),
      updatedAtServer: admin.firestore.FieldValue.serverTimestamp(),
    });

    await sendBookingWhatsApp({
      bookingRef,
      statusField: "bookingRejectedClientWhatsAppStatus",
      errorField: "bookingRejectedClientWhatsAppError",
      errorCodeField: "bookingRejectedClientWhatsAppErrorCode",
      sentAtField: "bookingRejectedClientWhatsAppSentAtIso",
      sidField: "bookingRejectedClientWhatsAppMessageSid",
      toNumber: clientPhone,
      body: buildBookingRejectedClientBody({
        clientName,
        businessName: partnerName || after.partnerName || "the business",
        serviceSummary,
        scheduleText,
        locationText,
        bookingReference,
      }),
      templateSid: normalizeTemplateSid(TWILIO_BOOKING_REJECTED_CLIENT_TEMPLATE_SID.value()),
      templateVariables: buildBookingRejectedClientTemplateAdapter({
        businessName: partnerName || after.partnerName || "the business",
        serviceSummary,
        bookingDateText,
        bookingTimeText,
        locationText,
        bookingReference,
      }),
      logSuccessLabel: "Booking rejected client WhatsApp sent:",
      logErrorLabel: "Booking rejected client WhatsApp send failed:",
    });
  }
);
