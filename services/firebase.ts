
// Fix: Use a type cast for import.meta to bypass missing vite/client type definitions and fix property 'env' errors
const meta = import.meta as any;

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ⚠️ IMPORTANT: 
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (or use existing Google Cloud project)
// 3. Register a web app and copy the config object below
// 4. Create a .env.local file in your project root and add your keys (VITE_FIREBASE_API_KEY=...)

const firebaseConfig = {
  apiKey: meta.env.VITE_FIREBASE_API_KEY,
  authDomain: meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
// We wrap this in a try-catch so the app doesn't crash during development if keys are missing
let app;
let auth;
let db;
let storage;

try {
    // Only initialize if config is present (simple check)
    if (firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        console.log("Firebase initialized successfully");
    } else {
        console.warn("Firebase config missing. Running in Mock/Demo mode.");
    }
} catch (error) {
    console.error("Firebase initialization error:", error);
}

export { auth, db, storage };
