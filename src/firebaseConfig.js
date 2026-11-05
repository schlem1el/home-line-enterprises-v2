// src/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDa0TqRawjoshWQAL6BM2NlosOzoS8iOfA",
  authDomain: "home-line-enterprises.firebaseapp.com",
  projectId: "home-line-enterprises",
  storageBucket: "home-line-enterprises.firebasestorage.app",
  messagingSenderId: "46356023690",
  appId: "1:46356023690:web:e4fb64b22724ebb0a1a073",
  measurementId: "G-RDKV2ZGGS0"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  signInWithPopup,
};