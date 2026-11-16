// Creates the demo accounts and data in Firebase if they don't exist yet (uses serviceAccount.json).
import { ensureSeed } from './seed.js';

await ensureSeed();
console.log('Demo data is ready.');
process.exit(0);
