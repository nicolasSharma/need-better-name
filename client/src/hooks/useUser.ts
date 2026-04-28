import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';

export interface UserProfile {
	displayName: string;
	email: string;
	balance: number;
	color: string;
	isAdmin?: boolean;
	createdAt: any;
	notificationPrefs?: {
		bounties: boolean;
		chores: boolean;
		markets: boolean;
		usd: boolean;
	};
	setupComplete?: boolean;
	viewedTutorials?: string[];
}

export const useUser = () => {
	const { user } = useAuth();
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user) { setProfile(null); setLoading(false); return; }
		const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
			if (snap.exists()) setProfile(snap.data() as UserProfile);
			setLoading(false);
		});
		return unsub;
	}, [user]);

	return { profile, loading };
};
