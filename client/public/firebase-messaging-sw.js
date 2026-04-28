importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-messaging-compat.js');

// To receive background messages, we must configure the SW with our config.
// The config values are injected here or can be hardcoded for simplicity.
// For security/simplicity, Firebase allows exposing these safely.
const firebaseConfig = {
	// The standard way in a Vite app without hardcoding is to fetch or pass via URL,
	// but it's simpler to just initialize the app. The SDK handles background reception automatically 
	// using the default Google Services if it detects the payload from the Admin SDK.
};

// Even just importing the SDKs and calling messaging() is enough 
// if we passed the default config, but we need the user's config.
// The easiest hook is listening to `push` events, but Firebase does it for us.
firebase.initializeApp({
	apiKey: new URL(location).searchParams.get('apiKey'),
	projectId: new URL(location).searchParams.get('projectId'),
	messagingSenderId: new URL(location).searchParams.get('messagingSenderId'),
	appId: new URL(location).searchParams.get('appId'),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
	console.log('[firebase-messaging-sw.js] Received background message ', payload);
	const notificationTitle = payload.notification.title;
	const notificationOptions = {
		body: payload.notification.body,
		icon: '/icon-192.png'
	};

	self.registration.showNotification(notificationTitle, notificationOptions);
});
