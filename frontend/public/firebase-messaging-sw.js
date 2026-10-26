importScripts(
  'https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js'
)

importScripts(
  'https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js'
)

firebase.initializeApp({
  apiKey: 'AIzaSyAsRozChLvzvIBd0aza19th-HJCwHB17EQ',
  authDomain: 'sentinel-47526.firebaseapp.com',
  projectId: 'sentinel-47526',
  storageBucket: 'sentinel-47526.firebasestorage.app',
  messagingSenderId: '646966759744',
  appId: '1:646966759744:web:5b2f1fcc87a92737afaaa5',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Background message received:',
    payload
  )

  const notificationTitle =
    payload.notification?.title ||
    'Sentinel — Change Detected'

  const notificationOptions = {
    body:
      payload.notification?.body ||
      'Sentinel detected an important change.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'sentinel-change-alert',
    renotify: true,
    data: {
      url: '/',
    },
  }

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus()
        }
      }

      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    })
  )
})