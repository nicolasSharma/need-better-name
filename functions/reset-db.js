const admin = require('firebase-admin');
admin.initializeApp({
	projectId: 'the-hub-edf20'
});
const db = admin.firestore();

async function run() {
	console.log('Resetting DB...');

	// 1. Delete all chores
	const choresSnap = await db.collection('chores').get();
	console.log(`Deleting ${choresSnap.size} chores...`);
	let batch = db.batch();
	let count = 0;
	for (const doc of choresSnap.docs) {
		batch.delete(doc.ref);
		count++;
		if (count % 400 === 0) {
			await batch.commit();
			batch = db.batch();
		}
	}
	if (count % 400 !== 0) {
		await batch.commit();
	}

	// 2. Close all open markets, just null them (outcome = null, status = 'resolved')
	const marketsSnap = await db.collection('markets').where('status', '==', 'open').get();
	console.log(`Nulling/resolving ${marketsSnap.size} open markets...`);
	batch = db.batch();
	count = 0;
	for (const doc of marketsSnap.docs) {
		batch.update(doc.ref, {
			status: 'resolved',
			outcome: null,
			resolvedAt: admin.firestore.FieldValue.serverTimestamp()
		});
		count++;
		if (count % 400 === 0) {
			await batch.commit();
			batch = db.batch();
		}
	}
	if (count % 400 !== 0) {
		await batch.commit();
	}

	// 3. Reset all users balance to 500
	const usersSnap = await db.collection('users').get();
	console.log(`Resetting balance to 500 for ${usersSnap.size} users...`);
	batch = db.batch();
	count = 0;
	for (const doc of usersSnap.docs) {
		batch.update(doc.ref, {
			balance: 500
		});
		count++;
		if (count % 400 === 0) {
			await batch.commit();
			batch = db.batch();
		}
	}
	if (count % 400 !== 0) {
		await batch.commit();
	}

	console.log('Database reset complete successfully!');
}

run().catch(console.error);
