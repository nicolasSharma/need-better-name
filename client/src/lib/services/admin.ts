import { doc, updateDoc, increment, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

export async function grantAdmin(userId: string) {
	return updateDoc(doc(db, 'users', userId), { isAdmin: true });
}

export async function adjustUserBalance(adminId: string, targetUserId: string, amount: number, reason: string) {
	return runTransaction(db, async (tx) => {
		const adminRef = doc(db, 'users', adminId);
		const adminSnap = await tx.get(adminRef);
		if (!adminSnap.data()?.isAdmin) throw new Error('Unauthorized');
		const targetRef = doc(db, 'users', targetUserId);
		tx.update(targetRef, { balance: increment(amount) });
		tx.set(doc(collection(db, 'transactions')), {
			type: 'admin_adjustment', userId: targetUserId, amount,
			description: `Admin adjustment: ${reason}`,
			relatedId: adminId, createdAt: serverTimestamp(),
		});
	});
}
