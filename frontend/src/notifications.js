import { getToken, onMessage } from 'firebase/messaging'
import { messaging, VAPID_KEY } from './firebase'

export async function enablePushNotifications() {
  try {
    // Check browser support
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications.')
    }

    if (!('serviceWorker' in navigator)) {
      throw new Error('This browser does not support service workers.')
    }

    // Ask user for notification permission
    const permission = await Notification.requestPermission()

    if (permission !== 'granted') {
      throw new Error('Notification permission was not granted.')
    }

    // Register Firebase messaging service worker
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js'
    )

    console.log(
      'Sentinel service worker registered:',
      registration
    )

    // Get unique FCM token for this browser/device
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    if (!token) {
      throw new Error('Firebase did not return an FCM token.')
    }

    console.log('SENTINEL FCM TOKEN:')
    console.log(token)

    // Temporary storage.
    // Later we will send this token to Sentinel backend
    // and associate it with the logged-in Firebase user.
    localStorage.setItem('sentinel-fcm-token', token)

    return token
  } catch (error) {
    console.error(
      'Unable to enable Sentinel notifications:',
      error
    )

    throw error
  }
}

// Handles a push while Sentinel is currently open
export function listenForForegroundNotifications(callback) {
  return onMessage(messaging, (payload) => {
    console.log(
      'Sentinel foreground notification:',
      payload
    )

    if (callback) {
      callback(payload)
    }
  })
}