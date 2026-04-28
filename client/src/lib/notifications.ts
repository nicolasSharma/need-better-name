import { getToken } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db, messaging } from '@/config/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function requestNotificationPermission(userId: string) {
	try {
		const permission = await Notification.requestPermission();
		if (permission === 'granted') {
			const m = messaging();
			if (!m) throw new Error('Messaging not supported on this browser.');
			
			// We pass the config variables as URL params to the SW so it can initialize
			const swUrl = `/firebase-messaging-sw.js?apiKey=${import.meta.env.VITE_FIREBASE_API_KEY}&projectId=${import.meta.env.VITE_FIREBASE_PROJECT_ID}&messagingSenderId=${import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID}&appId=${import.meta.env.VITE_FIREBASE_APP_ID}`;
			const registration = await navigator.serviceWorker.register(swUrl);
			
			const token = await getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
			if (token) {
				await updateDoc(doc(db, 'users', userId), { fcmToken: token });
				return true;
			}
		}
		return false;
	} catch (error) {
		console.error('Error getting notification permission:', error);
		return false;
	}
}
