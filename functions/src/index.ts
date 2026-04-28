import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();

// Helper to get all FCM tokens EXCEPT the sender's
async function getHouseTokens(excludeUserId?: string) {
	const usersSnap = await admin.firestore().collection('users').get();
	const tokens: string[] = [];
	usersSnap.forEach(doc => {
		const data = doc.data();
		if (data.fcmToken && doc.id !== excludeUserId) {
			tokens.push(data.fcmToken);
		}
	});
	return tokens;
}

// 1. Notify on new market
export const notifyNewMarket = onDocumentCreated("markets/{marketId}", async (event) => {
	const market = event.data?.data();
	if (!market) return;

	const tokens = await getHouseTokens(market.creatorId);
	if (tokens.length === 0) return;

	await admin.messaging().sendEachForMulticast({
		tokens,
		notification: {
			title: "New Market Opened! 🎲",
			body: `Question: ${market.question}`,
		},
		webpush: { fcmOptions: { link: '/casino' } }
	});
});

// 2. Notify on market resolution
export const notifyMarketResolved = onDocumentUpdated("markets/{marketId}", async (event) => {
	const before = event.data?.before.data();
	const after = event.data?.after.data();
	if (!before || !after) return;
	
	// Only trigger if status changed to resolved
	if (before.status !== 'resolved' && after.status === 'resolved') {
		const tokens = await getHouseTokens();
		if (tokens.length === 0) return;

		await admin.messaging().sendEachForMulticast({
			tokens,
			notification: {
				title: "Market Finalized! ⚖️",
				body: `"${after.question}" resolved to ${after.outcome.toUpperCase()}.`,
			},
			webpush: { fcmOptions: { link: `/casino/${event.params.marketId}` } }
		});
	}
});

// 3. Notify when chore is completed
export const notifyChoreCompleted = onDocumentUpdated("chores/{choreId}", async (event) => {
	const before = event.data?.before.data();
	const after = event.data?.after.data();
	if (!before || !after) return;
	
	// Only trigger if status changed from open/claimed to completed
	if (before.status !== 'completed' && after.status === 'completed') {
		const tokens = await getHouseTokens(after.assigneeId);
		if (tokens.length === 0) return;

		// Fetch the user's name
		const userSnap = await admin.firestore().collection('users').doc(after.assigneeId).get();
		const name = userSnap.data()?.displayName || 'Someone';

		await admin.messaging().sendEachForMulticast({
			tokens,
			notification: {
				title: "Chore Completed! 🧹",
				body: `${name} finished "${after.name}" for ${after.reward} BT.`,
			},
			webpush: { fcmOptions: { link: '/chores' } }
		});
	}
});
