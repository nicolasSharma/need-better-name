import { doc, collection, writeBatch, serverTimestamp, runTransaction, increment } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { pushAlert } from './helpers';

export async function createExpense(payerId: string, title: string, amountUSD: number, splitWithIds: string[]) {
	if (splitWithIds.length === 0) throw new Error('No roommates selected for split.');
	if (amountUSD <= 0) throw new Error('Invalid amount.');
	return runTransaction(db, async (tx) => {
		const expenseRef = doc(collection(db, 'expenses'));
		tx.set(expenseRef, { title, payerId, amountUSD, splitWith: splitWithIds, createdAt: serverTimestamp() });
		const splitAmount = amountUSD / splitWithIds.length;
		for (const debtorId of splitWithIds) {
			if (debtorId === payerId) continue;
			tx.set(doc(collection(db, 'debts')), {
				expenseId: expenseRef.id, title, fromId: debtorId, toId: payerId,
				amount: splitAmount, settled: false, createdAt: serverTimestamp(),
			});
			pushAlert(tx, debtorId, 'usd', 'Splitwise Expense Logged', `You owe a cut for: ${title}`);
		}
	});
}

export async function settleDebt(fromId: string, toId: string, amount: number) {
	const batch = writeBatch(db);
	batch.set(doc(collection(db, 'payments')), { fromId, toId, amount, createdAt: serverTimestamp() });
	batch.set(doc(collection(db, 'transactions')), {
		type: 'usd_payment', userId: fromId, amount: -amount,
		description: 'Physical payment settled to peer', relatedId: toId, createdAt: serverTimestamp(),
	});
	await batch.commit();
}
