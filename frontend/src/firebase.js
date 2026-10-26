import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
} from 'firebase/auth'
import { getMessaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: 'AIzaSyAsRozChLvzvIBd0aza19th-HJCwHB17EQ',
  authDomain: 'sentinel-47526.firebaseapp.com',
  projectId: 'sentinel-47526',
  storageBucket: 'sentinel-47526.firebasestorage.app',
  messagingSenderId: '646966759744',
  appId: '1:646966759744:web:5b2f1fcc87a92737afaaa5',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

export const googleProvider = new GoogleAuthProvider()

googleProvider.setCustomParameters({
  prompt: 'select_account',
})

export const messaging = getMessaging(app)

export const VAPID_KEY =
  'BLiJiprE-t93DpjvEE7fde6jcy40uGkj0Y-M_3V40Q0FAhbS_Vqh69lJt9z5Sxo2-SdUNGvYZlodm3eelyx1tEk'

export default app