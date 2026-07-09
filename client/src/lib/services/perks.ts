import { doc, runTransaction, increment, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

export async function buyPerk(perkId: string, userId: string) {
	return runTransaction(db, async (tx) => {
		const perkRef = doc(db, 'perks', perkId);
		const perkSnap = await tx.get(perkRef);
		if (!perkSnap.exists()) throw new Error('Perk not found');
		const perk = perkSnap.data();
		const userRef = doc(db, 'users', userId);
		const userSnap = await tx.get(userRef);
		if (!userSnap.exists()) throw new Error('User not found');
		if (userSnap.data().balance < perk.cost) throw new Error('Insufficient BT');
		tx.update(userRef, { balance: increment(-perk.cost) });
		tx.update(doc(db, 'house', 'main'), { fundBalance: increment(perk.cost) });
		tx.set(doc(collection(db, 'transactions')), {
			type: 'perk_purchase', userId, amount: -perk.cost,
			description: `Purchased perk: ${perk.name}`,
			relatedId: perkId, createdAt: serverTimestamp(),
		});
	});
}
