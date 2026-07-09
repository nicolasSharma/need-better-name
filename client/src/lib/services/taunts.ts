import { doc, runTransaction, collection, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export async function sendTaunt(senderId: string, targetId: string, soundId: string, cost: number = 20) {
	await runTransaction(db, async (tx) => {
		const senderRef = doc(db, 'users', senderId);
		const senderSnap = await tx.get(senderRef);
		if (!senderSnap.exists()) throw new Error('Sender not found');
		
		const senderData = senderSnap.data();
		if (senderData.balance < cost) throw new Error('Insufficient balance to send taunt');

		const houseRef = doc(db, 'house', 'main');
		
		// Deduct from sender
		tx.update(senderRef, { balance: senderData.balance - cost });
		
		// Add to house fund
		const houseSnap = await tx.get(houseRef);
		if (houseSnap.exists()) {
			tx.update(houseRef, { fundBalance: houseSnap.data().fundBalance + cost });
		}

		// Create the taunt document
		tx.set(doc(collection(db, 'taunts')), {
			senderId,
			targetId,
			soundId,
			played: false,
			createdAt: serverTimestamp(),
		});

		// Create a transaction record
		tx.set(doc(collection(db, 'transactions')), {
			type: 'taunt_sent',
			userId: senderId,
			amount: -cost,
			description: `Sent Taunt (${soundId})`,
			relatedId: targetId,
			createdAt: serverTimestamp(),
		});
	});
}

export async function markTauntPlayed(tauntId: string) {
	const tauntRef = doc(db, 'taunts', tauntId);
	await updateDoc(tauntRef, { played: true });
}
