// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA6M1iGDwf4iesgujOxqqLlkLddigFonL4",
  authDomain: "sako-or.firebaseapp.com",
  projectId: "sako-or",
  storageBucket: "sako-or.firebasestorage.app",
  messagingSenderId: "492015346123",
  appId: "1:492015346123:web:2da31215f1b7f3212f164e",
  measurementId: "G-WK1B8GCMT0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);