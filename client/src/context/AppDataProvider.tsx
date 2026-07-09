import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { collection, doc, onSnapshot, query, orderBy, where, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthProvider';
import { filterHouseMembers, isSystemAdmin } from '@/lib/admin';
import type { UserProfile, Roommate, Market, Chore, Transaction, InboxEvent } from '@/types';

// ─── Context Shapes ─────────────────────────────────────────────────

interface UserCtx {
	profile: UserProfile | null;
	loading: boolean;
}

interface RoommatesCtx {
	roommates: Roommate[];
	loading: boolean;
}

interface MarketsCtx {
	markets: Market[];
	loading: boolean;
}

interface ChoresCtx {
	chores: Chore[];
	loading: boolean;
}

interface TransactionsCtx {
	transactions: Transaction[];
	loading: boolean;
}

interface InboxCtx {
	events: InboxEvent[];
	loading: boolean;
	unreadCount: number;
}

// ─── Contexts ───────────────────────────────────────────────────────

const UserContext = createContext<UserCtx>({ profile: null, loading: true });
const RoommatesContext = createContext<RoommatesCtx>({ roommates: [], loading: true });
const MarketsContext = createContext<MarketsCtx>({ markets: [], loading: true });
const ChoresContext = createContext<ChoresCtx>({ chores: [], loading: true });
const TransactionsContext = createContext<TransactionsCtx>({ transactions: [], loading: true });
const InboxContext = createContext<InboxCtx>({ events: [], loading: true, unreadCount: 0 });

// ─── Provider ───────────────────────────────────────────────────────

export const AppDataProvider = ({ children }: { children: ReactNode }) => {
	const { user } = useAuth();

	// User profile — single listener for the logged-in user
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [profileLoading, setProfileLoading] = useState(true);

	useEffect(() => {
		if (!user) { setProfile(null); setProfileLoading(false); return; }
		const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
			if (snap.exists()) setProfile(snap.data() as UserProfile);
			setProfileLoading(false);
		}, (err) => {
			console.error('User listener error:', err);
			setProfileLoading(false);
		});
		return unsub;
	}, [user]);

	// Roommates — single listener for all house members
	const [allUsers, setAllUsers] = useState<Roommate[]>([]);
	const [roommatesLoading, setRoommatesLoading] = useState(true);

	useEffect(() => {
		const unsub = onSnapshot(collection(db, 'users'), (snap) => {
			const users = snap.docs.map(d => ({ id: d.id, ...d.data() } as Roommate));
			setAllUsers(filterHouseMembers(users));
			setRoommatesLoading(false);
		}, (err) => {
			console.error('Roommates listener error:', err);
			setRoommatesLoading(false);
		});
		return unsub;
	}, []);

	// Markets — single listener for the full collection
	const [markets, setMarkets] = useState<Market[]>([]);
	const [marketsLoading, setMarketsLoading] = useState(true);

	useEffect(() => {
		const q = query(collection(db, 'markets'), orderBy('createdAt', 'desc'));
		const unsub = onSnapshot(q, (snap) => {
			setMarkets(snap.docs.map((d) => {
				const data = d.data();
				const options = data.options || ['YES', 'NO'];
				const pools = data.pools || { 'YES': data.yesPool || 0, 'NO': data.noPool || 0 };
				return { id: d.id, ...data, options, pools } as Market;
			}));
			setMarketsLoading(false);
		}, (err) => {
			console.error('Markets listener error:', err);
			setMarketsLoading(false);
		});
		return unsub;
	}, []);

	// Chores — single listener for the full collection
	const [chores, setChores] = useState<Chore[]>([]);
	const [choresLoading, setChoresLoading] = useState(true);

	useEffect(() => {
		const q = query(collection(db, 'chores'), orderBy('createdAt', 'desc'));
		const unsub = onSnapshot(q, (snap) => {
			setChores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Chore)));
			setChoresLoading(false);
		}, (err) => {
			console.error('Chores listener error:', err);
			setChoresLoading(false);
		});
		return unsub;
	}, []);

	// Global transactions — single listener, shared by TopNav + Ledger
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [txLoading, setTxLoading] = useState(true);

	useEffect(() => {
		if (!user) { setTransactions([]); setTxLoading(false); return; }
		const q = query(collection(db, 'transactions'), limit(150));
		const unsub = onSnapshot(q,
			(snap) => {
				const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
				txs.sort((a, b) => {
					const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
					const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
					return tB - tA;
				});
				setTransactions(txs.slice(0, 50));
				setTxLoading(false);
			},
			(err) => { console.error('Transactions listener error:', err); setTxLoading(false); }
		);
		return unsub;
	}, [user]);

	// Inbox — single listener for activity feed
	const [events, setEvents] = useState<InboxEvent[]>([]);
	const [inboxLoading, setInboxLoading] = useState(true);

	useEffect(() => {
		if (!user || !profile) { setEvents([]); setInboxLoading(false); return; }
		const q = query(collection(db, 'activity_feed'), orderBy('createdAt', 'desc'), limit(50));
		const unsub = onSnapshot(q, (snap) => {
			const allEvents = snap.docs.map(d => ({ id: d.id, ...d.data() } as InboxEvent));
			const prefs = profile.notificationPrefs || { bounties: true, chores: true, markets: true, usd: true };
			const filtered = allEvents.filter(ev => {
				if (ev.targetId !== 'global' && ev.targetId !== user.uid) return false;
				if (ev.category === 'bounties' && !prefs.bounties) return false;
				if (ev.category === 'chores' && !prefs.chores) return false;
				if (ev.category === 'markets' && !prefs.markets) return false;
				if (ev.category === 'usd' && !prefs.usd) return false;
				return true;
			});
			setEvents(filtered);
			setInboxLoading(false);
		}, (err) => {
			console.error('Inbox listener error:', err);
			setInboxLoading(false);
		});
		return unsub;
	}, [user, profile?.notificationPrefs]);

	const inboxValue = useMemo(() => ({
		events, loading: inboxLoading, unreadCount: events.filter(e => !e.read).length
	}), [events, inboxLoading]);

	return (
		<UserContext.Provider value={{ profile, loading: profileLoading }}>
		<RoommatesContext.Provider value={{ roommates: allUsers, loading: roommatesLoading }}>
		<MarketsContext.Provider value={{ markets, loading: marketsLoading }}>
		<ChoresContext.Provider value={{ chores, loading: choresLoading }}>
		<TransactionsContext.Provider value={{ transactions, loading: txLoading }}>
		<InboxContext.Provider value={inboxValue}>
			{children}
		</InboxContext.Provider>
		</TransactionsContext.Provider>
		</ChoresContext.Provider>
		</MarketsContext.Provider>
		</RoommatesContext.Provider>
		</UserContext.Provider>
	);
};

// ─── Consumer Hooks ─────────────────────────────────────────────────

export const useUser = () => useContext(UserContext);
export const useRoommates = () => useContext(RoommatesContext);
export const useMarkets = () => useContext(MarketsContext);
export const useChores = () => useContext(ChoresContext);
export const useTransactions = () => useContext(TransactionsContext);
export const useInbox = () => useContext(InboxContext);
