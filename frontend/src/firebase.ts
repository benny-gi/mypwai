// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth"; // Add this import
import { getFirestore } from "firebase/firestore"; // Add this import
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAhBtpyS13QJAuEVIlvY8zXgCL41BeWsI4",
  authDomain: "exams-system-7c00f.firebaseapp.com",
  projectId: "exams-system-7c00f",
  storageBucket: "exams-system-7c00f.firebasestorage.app",
  messagingSenderId: "612918290595",
  appId: "1:612918290595:web:5aebddce91677880743716",
  measurementId: "G-X7TYKQL7QG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase services and export them
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;