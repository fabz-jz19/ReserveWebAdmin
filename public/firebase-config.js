import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const FIREBASE_CONFIGS = {
  dev: {
    apiKey: "AIzaSyDU8QAHaSo04L0j6ZNt_PFiR6YKuh0sxJU",
    authDomain: "reserve-dev-a297a.firebaseapp.com",
    projectId: "reserve-dev-a297a",
    storageBucket: "reserve-dev-a297a.firebasestorage.app",
    messagingSenderId: "851971023438",
    appId: "1:851971023438:web:b1e24f8ee8013a39a9d91f",
    measurementId: "G-5V5B0XZDJP"
  },
  prod: {
    apiKey: "AIzaSyCfF5HvJZoLQJWtCX17LpPZwnNlcMixYQs",
    authDomain: "reserva-b3312.firebaseapp.com",
    projectId: "reserva-b3312",
    storageBucket: "reserva-b3312.firebasestorage.app",
    messagingSenderId: "482735599992",
    appId: "1:482735599992:web:a7a9c6f2060516bb33588d",
    measurementId: "G-TPVHX48X13"
  }
};

const PROD_HOSTS = new Set([
  "reserva-b3312.web.app",
  "reserva-b3312.firebaseapp.com",
]);

const DEV_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "reserve-dev-a297a.web.app",
  "reserve-dev-a297a.firebaseapp.com",
]);

const PROD_DOMAIN_SUFFIXES = [
  "reservemu.com",
  "reservamu.info",
];

const envOverride = new URLSearchParams(window.location.search).get("env");
const hostname = window.location.hostname;

const resolveFirebaseEnv = () => {
  if (envOverride === "dev" || envOverride === "prod") {
    return envOverride;
  }

  const isProdDomain =
    PROD_HOSTS.has(hostname) ||
    PROD_DOMAIN_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));

  if (isProdDomain) {
    return "prod";
  }

  if (DEV_HOSTS.has(hostname) || hostname.endsWith(".local") || hostname.includes("reserve-dev-a297a")) {
    return "dev";
  }

  // For unknown public domains, default to prod configuration.
  return "prod";
};

export const firebaseEnv = resolveFirebaseEnv();
export const firebaseConfig = FIREBASE_CONFIGS[firebaseEnv];
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);
