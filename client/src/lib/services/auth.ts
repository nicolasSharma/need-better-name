import { doc, updateDoc, getDoc, writeBatch, serverTimestamp, increment, runTransaction, collection } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, auth } from '@/config/firebase';

const nameToEmail = (name: string) => `${name.toLowerCase().replace(/\s+/g, '.')}@hub.app`;

export async function signUp(name: string, password: string) {
	const email = nameToEmail(name);
	const cred = await createUserWithEmailAndPassword(auth, email, password);
	const colors = ['red', 'blue', 'purple', 'yellow', 'green', 'orange', 'teal', 'pink'];
	await updateDoc(doc(db, 'users', cred.user.uid), {}).catch(() => null);
	const batch = writeBatch(db);
	batch.set(doc(db, 'users', cred.user.uid), {
		displayName: name, email, balance: 500,
		color: colors[Math.floor(Math.random() * colors.length)],
		createdAt: serverTimestamp(), setupComplete: false, viewedTutorials: [],
	});
	await batch.commit();
	const houseSnap = await getDoc(doc(db, 'house', 'main'));
	if (!houseSnap.exists()) {
		await import('../engine').then((m) => m.initHubFund());
	}
	return cred.user;
}

export async function logIn(name: string, password: string) {
	const email = nameToEmail(name);
	return signInWithEmailAndPassword(auth, email, password);
}

export async function logOut() {
	return signOut(auth);
}
