import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from './useAuth';

export interface Transaction {
	id: string;
	type: string;
	userId: string;
	amount: number;
	relatedId: string;
	createdAt: any;
	photoUrl?: string | null;
	resolvedBy?: string | null;
}

export function useTransactions(isGlobal = false) {
	const { user } = useAuth();
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user) {
			setTransactions([]);
			setLoading(false);
			return;
		}
		
		const q = isGlobal 
			? query(collection(db, 'transactions'), limit(150))
			: query(collection(db, 'transactions'), where('userId', '==', user.uid));

		const unsubscribe = onSnapshot(q, 
			(snapshot) => {
				const txs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Transaction));
				
				// Client-side sort to avoid index crash
				txs.sort((a, b) => {
					const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
					const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
					return tB - tA;
				});

				setTransactions(txs.slice(0, 50));
				setLoading(false);
			},
			(err) => {
				console.error("useTransactions Error:", err);
				setLoading(false); // Make sure it stops loading even on failure
			}
		);

		return unsubscribe;
	}, [user]);

	return { transactions, loading };
}
