// Publishes firestore.rules to the Firebase project (uses serviceAccount.json).
import fs from 'node:fs';
import { getSecurityRules } from 'firebase-admin/security-rules';
import './firebase.js';

const source = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
await getSecurityRules().releaseFirestoreRulesetFromSource(source);
console.log('Firestore security rules published.');
process.exit(0);
