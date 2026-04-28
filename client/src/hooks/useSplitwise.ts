import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from './useAuth';

export interface Route {
	fromId: string;
	toId: string;
	amount: number;
}

export function useSplitwise() {
	const { user } = useAuth();
	
	const [debts, setDebts] = useState<any[]>([]);
	const [payments, setPayments] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	// Fetch EVERYTHING in the house. (In a massive app this would run on Cloud Functions, 
	// but for an 8 person house, pulling all docs is extremely fast and free).
	useEffect(() => {
		const unsubDebts = onSnapshot(query(collection(db, 'debts')), (snap) => {
			setDebts(snap.docs.map(d => d.data()));
		});

		const unsubPayments = onSnapshot(query(collection(db, 'payments')), (snap) => {
			setPayments(snap.docs.map(d => d.data()));
			setLoading(false); 
		});

		return () => { unsubDebts(); unsubPayments(); };
	}, []);

	const { optimizedRoutes, myTotalOwed, myTotalDebt } = useMemo(() => {
		if (!user) return { optimizedRoutes: [], myTotalOwed: 0, myTotalDebt: 0 };

		// 1. Calculate Global Net Balances
		const nets: Record<string, number> = {};
		
		const addNet = (id: string, amt: number) => { nets[id] = (nets[id] || 0) + amt; };

		debts.forEach(d => {
			addNet(d.toId, d.amount);    // Gets owed money
			addNet(d.fromId, -d.amount); // Owes money
		});

		payments.forEach(p => {
			addNet(p.fromId, p.amount);  // Paid money, so net goes up (less debt)
			addNet(p.toId, -p.amount);   // Received money, so net goes down (less credit)
		});

		// 2. Separate into Debtors and Creditors
		let debtors = Object.entries(nets)
			.filter(([_, amt]) => amt < -0.01)
			.map(([id, amt]) => ({ id, amount: Math.abs(amt) }))
			.sort((a, b) => b.amount - a.amount); // Highest debt first

		let creditors = Object.entries(nets)
			.filter(([_, amt]) => amt > 0.01)
			.map(([id, amt]) => ({ id, amount: amt }))
			.sort((a, b) => b.amount - a.amount); // Highest credit first

		// 3. Greedy Simplification Algorithm
		const routes: Route[] = [];
		let d = 0;
		let c = 0;

		while (d < debtors.length && c < creditors.length) {
			const debtor = debtors[d];
			const creditor = creditors[c];

			const amountToSettle = Math.min(debtor.amount, creditor.amount);

			routes.push({
				fromId: debtor.id,
				toId: creditor.id,
				amount: amountToSettle
			});

			debtor.amount -= amountToSettle;
			creditor.amount -= amountToSettle;

			if (debtor.amount < 0.01) d++;
			if (creditor.amount < 0.01) c++;
		}

		// 4. Filter my specific actionable routes
		const myRoutes = routes.filter(r => r.fromId === user.uid || r.toId === user.uid);
		
		// 5. Calculate personal summaries based on simplifications
		const myTotalOwed = myRoutes.filter(r => r.toId === user.uid).reduce((a, b) => a + b.amount, 0);
		const myTotalDebt = myRoutes.filter(r => r.fromId === user.uid).reduce((a, b) => a + b.amount, 0);

		return { optimizedRoutes: myRoutes, myTotalOwed, myTotalDebt };
	}, [debts, payments, user]);

	return { optimizedRoutes, myTotalOwed, myTotalDebt, loading };
}
