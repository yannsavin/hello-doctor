// Firebase Admin: Firestore database + Firebase Authentication (server side).
// Credentials: serviceAccount.json at the project root, or GOOGLE_APPLICATION_CREDENTIALS.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || fileURLToPath(new URL('../serviceAccount.json', import.meta.url));

if (process.env.FIRESTORE_EMULATOR_HOST) {
  // Local Firebase emulators (optional, needs Java 21 + firebase-tools).
  initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'hello-doctor-dev' });
} else {
  if (!fs.existsSync(keyPath)) {
    console.error(`\n  Missing Firebase service account key.\n  Download it from Firebase console > Project settings > Service accounts > Generate new private key,\n  and save it as: ${keyPath}\n`);
    process.exit(1);
  }
  const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  initializeApp({ credential: cert(key), projectId: key.project_id });
}

export const fdb = getFirestore();
fdb.settings({ ignoreUndefinedProperties: true });
export const fauth = getAuth();
export { FieldValue };

// Collections (same names as in our pitch, plus the m-commerce ones).
export const col = {
  users: fdb.collection('users'),
  slots: fdb.collection('slots'),
  appointments: fdb.collection('appointments'),
  payments: fdb.collection('payments'),
  subscriptions: fdb.collection('subscriptions'),
  flags: fdb.collection('flags'),
  reviews: fdb.collection('reviews'),
  meta: fdb.collection('meta'),
};

export async function getDoc(collection, id) {
  if (!id) return null;
  const snap = await collection.doc(String(id)).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** Write many documents in chunks (Firestore batches hold 500 operations max). */
export async function writeAll(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = fdb.batch();
    for (const [ref, data, kind] of ops.slice(i, i + 400)) {
      if (kind === 'delete') batch.delete(ref);
      else batch.set(ref, data);
    }
    await batch.commit();
  }
}
