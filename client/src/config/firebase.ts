import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'PLACEHOLDER',
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'PLACEHOLDER',
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'PLACEHOLDER',
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'PLACEHOLDER',
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'PLACEHOLDER',
	appId: import.meta.env.VITE_FIREBASE_APP_ID || 'PLACEHOLDER',
	measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'PLACEHOLDER'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Messaging might not be supported in some browsers (e.g. mobile Safari non-PWA)
let messagingInstance: any = null;
isSupported().then((supported) => {
	if (supported) {
		messagingInstance = getMessaging(app);
	}
});

// Analytics (Requires measuring enabled)
isAnalyticsSupported().then((supported) => {
	if (supported && firebaseConfig.measurementId !== 'PLACEHOLDER') {
		getAnalytics(app);
	}
});

export const messaging = () => messagingInstance;
export default app;
