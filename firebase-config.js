import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCGGRIciF-neRpYGuYaeu94WNj-mB8wQXE",
  authDomain: "trayday-b1907.firebaseapp.com",
  projectId: "trayday-b1907",
  storageBucket: "trayday-b1907.firebasestorage.app",
  messagingSenderId: "856917257082",
  appId: "1:856917257082:web:2db68a16a68ca4a20f04c3",
  measurementId: "G-HPW4W4CMG0"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

export { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail };
