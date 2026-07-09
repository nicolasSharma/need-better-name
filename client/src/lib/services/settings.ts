import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export async function updateNotificationPrefs(userId: string, prefs: any) {
	return updateDoc(doc(db, 'users', userId), { notificationPrefs: prefs });
}

export async function completeSetup(userId: string) {
	return updateDoc(doc(db, 'users', userId), { setupComplete: true });
}

export async function markTutorialViewed(userId: string, pageKey: string) {
	const userRef = doc(db, 'users', userId);
	const userSnap = await getDoc(userRef);
	const viewed = userSnap.data()?.viewedTutorials || [];
	if (!viewed.includes(pageKey)) {
		return updateDoc(userRef, { viewedTutorials: [...viewed, pageKey] });
	}
}
