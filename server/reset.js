// Deletes all Hello Doctor data from Firestore and the demo Auth accounts, then re-creates the demo data.
// WARNING: on a Firebase project shared with other teams, this empties the users/appointments/... collections.
import { col, fauth, writeAll } from './firebase.js';
import { DEMO_DOMAIN, ensureSeed } from './seed.js';

if (!process.argv.includes('--yes')) {
  console.log('This deletes every document in: users, slots, appointments, payments, subscriptions, flags, reviews.');
  console.log('Run again with --yes to confirm:  npm run reset-db -- --yes');
  process.exit(0);
}

const userDocs = await col.users.get();
for (const u of userDocs.docs) {
  const priv = await u.ref.collection('private').get();
  await writeAll(priv.docs.map((d) => [d.ref, null, 'delete']));
}
for (const c of Object.values(col)) {
  const snap = await c.get();
  await writeAll(snap.docs.map((d) => [d.ref, null, 'delete']));
}

let pageToken;
do {
  const page = await fauth.listUsers(1000, pageToken);
  const ids = page.users.filter((u) => u.email?.endsWith(DEMO_DOMAIN)).map((u) => u.uid);
  if (ids.length) await fauth.deleteUsers(ids);
  pageToken = page.pageToken;
} while (pageToken);

await ensureSeed();
console.log('Firebase reset with demo data.');
process.exit(0);
