import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCcOIROcopmugfW0RW2fzi-c_dmrUpMy3I",
  authDomain: "banktracker-3b12a.firebaseapp.com",
  projectId: "banktracker-3b12a",
  storageBucket: "banktracker-3b12a.firebasestorage.app",
  messagingSenderId: "76596635447",
  appId: "1:76596635447:web:b2e036fdb34d04f4a59cb2"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});