import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthProvider';
import type { Route } from '@/types';

export function useSplitwise() {
	const { user } = useAuth();
	const [debts, setDebts] = useState<any[]>([]);
	const [payments, setPayments] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

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
		const nets: Record<string, number> = {};
		const addNet = (id: string, amt: number) => { nets[id] = (nets[id] || 0) + amt; };
		debts.forEach(d => { addNet(d.toId, d.amount); addNet(d.fromId, -d.amount); });
		payments.forEach(p => { addNet(p.fromId, p.amount); addNet(p.toId, -p.amount); });
		let debtors = Object.entries(nets).filter(([_, amt]) => amt < -0.01).map(([id, amt]) => ({ id, amount: Math.abs(amt) })).sort((a, b) => b.amount - a.amount);
		let creditors = Object.entries(nets).filter(([_, amt]) => amt > 0.01).map(([id, amt]) => ({ id, amount: amt })).sort((a, b) => b.amount - a.amount);
		const routes: Route[] = [];
		let d = 0, c = 0;
		while (d < debtors.length && c < creditors.length) {
			const debtor = debtors[d], creditor = creditors[c];
			const amountToSettle = Math.min(debtor.amount, creditor.amount);
			routes.push({ fromId: debtor.id, toId: creditor.id, amount: amountToSettle });
			debtor.amount -= amountToSettle; creditor.amount -= amountToSettle;
			if (debtor.amount < 0.01) d++;
			if (creditor.amount < 0.01) c++;
		}
		const myRoutes = routes.filter(r => r.fromId === user.uid || r.toId === user.uid);
		return {
			optimizedRoutes: myRoutes,
			myTotalOwed: myRoutes.filter(r => r.toId === user.uid).reduce((a, b) => a + b.amount, 0),
			myTotalDebt: myRoutes.filter(r => r.fromId === user.uid).reduce((a, b) => a + b.amount, 0),
		};
	}, [debts, payments, user]);

	return { optimizedRoutes, myTotalOwed, myTotalDebt, loading };
}
