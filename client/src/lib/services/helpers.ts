import { doc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

/** Internal standard alert push — used by all domain services */
export function pushAlert(tx: any, targetId: string, category: string, title: string, body: string) {
	tx.set(doc(collection(db, 'activity_feed')), {
		targetId, category, title, body, read: false, createdAt: serverTimestamp(),
	});
}
