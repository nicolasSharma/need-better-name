import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

export async function sendPing(senderId: string, targetId: string, cost: number = 100) {
	await runTransaction(db, async (tx) => {
		const senderRef = doc(db, 'users', senderId);
		const senderSnap = await tx.get(senderRef);
		if (!senderSnap.exists()) throw new Error('Sender not found');
		
		const senderData = senderSnap.data();
		if (senderData.balance < cost) throw new Error('Insufficient balance to send ping');

		const houseRef = doc(db, 'house', 'main');
		
		// Deduct from sender
		tx.update(senderRef, { balance: senderData.balance - cost });
		
		// Add to house fund
		const houseSnap = await tx.get(houseRef);
		if (houseSnap.exists()) {
			tx.update(houseRef, { fundBalance: houseSnap.data().fundBalance + cost });
		}

		// Create the ping document
		tx.set(doc(collection(db, 'pings')), {
			senderId,
			targetId,
			cost,
			createdAt: serverTimestamp(),
		});

		// Create a transaction record
		tx.set(doc(collection(db, 'transactions')), {
			type: 'ping_sent',
			userId: senderId,
			amount: -cost,
			description: 'Sent a Ping',
			relatedId: targetId,
			createdAt: serverTimestamp(),
		});
	});
}
