const token = process.argv[2];
if (!token) {
	console.error('Please provide access token');
	process.exit(1);
}

const projectId = 'the-hub-edf20';
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

const headers = {
	'Authorization': `Bearer ${token}`,
	'Content-Type': 'application/json'
};

async function run() {
	console.log('Starting system database reset via REST API...');

	// 1. Delete all chores
	console.log('Fetching chores...');
	const choresRes = await fetch(`${baseUrl}/chores?pageSize=1000`, { headers });
	const choresData = await choresRes.json();
	if (choresData.documents) {
		console.log(`Deleting ${choresData.documents.length} chores...`);
		for (const doc of choresData.documents) {
			const name = doc.name; // e.g. "projects/the-hub-edf20/databases/(default)/documents/chores/xxxx"
			await fetch(`https://firestore.googleapis.com/v1/${name}`, {
				method: 'DELETE',
				headers
			});
		}
	} else {
		console.log('No chores found to delete.');
	}

	// 2. Resolve open markets as null
	console.log('Fetching markets...');
	const marketsRes = await fetch(`${baseUrl}/markets?pageSize=1000`, { headers });
	const marketsData = await marketsRes.json();
	if (marketsData.documents) {
		let count = 0;
		for (const doc of marketsData.documents) {
			const fields = doc.fields || {};
			const status = fields.status?.stringValue;
			if (status === 'open') {
				const name = doc.name;
				// Patch the document
				const patchBody = {
					fields: {
						status: { stringValue: 'resolved' },
						outcome: { nullValue: null },
						resolvedAt: { timestampValue: new Date().toISOString() }
					}
				};
				const res = await fetch(`https://firestore.googleapis.com/v1/${name}?updateMask.fieldPaths=status&updateMask.fieldPaths=outcome&updateMask.fieldPaths=resolvedAt`, {
					method: 'PATCH',
					headers,
					body: JSON.stringify(patchBody)
				});
				if (!res.ok) {
					console.error(`Failed to patch market ${name}:`, await res.text());
				}
				count++;
			}
		}
		console.log(`Resolved ${count} open markets.`);
	} else {
		console.log('No markets found.');
	}

	// 3. Reset all users balance to 500
	console.log('Fetching users...');
	const usersRes = await fetch(`${baseUrl}/users?pageSize=1000`, { headers });
	const usersData = await usersRes.json();
	if (usersData.documents) {
		console.log(`Resetting balance to 500 for ${usersData.documents.length} users...`);
		for (const doc of usersData.documents) {
			const name = doc.name;
			const patchBody = {
				fields: {
					balance: { integerValue: 500 }
				}
			};
			const res = await fetch(`https://firestore.googleapis.com/v1/${name}?updateMask.fieldPaths=balance`, {
				method: 'PATCH',
				headers,
				body: JSON.stringify(patchBody)
			});
			if (!res.ok) {
				console.error(`Failed to patch user ${name}:`, await res.text());
			}
		}
	} else {
		console.log('No users found.');
	}

	console.log('Database reset completed successfully via REST API!');
}

run().catch(console.error);
