// Shared by the website and the admin scripts.
// Business rules: pricing, matching distance/ETA, triage priority, payments, ID checks.

export const PLANS = {
  payg: {
    id: 'payg', name: 'Pay as you go', price: 0, months: 0, feeRate: 0.1, discountRate: 0,
    perks: ['No commitment', '10% booking fee on each visit', 'Pay only when you need a doctor'],
  },
  monthly: {
    id: 'monthly', name: 'Care Monthly', price: 9.99, months: 1, feeRate: 0, discountRate: 0.1,
    perks: ['No booking fees', '10% off every consultation', 'Cancel any time'],
  },
  annual: {
    id: 'annual', name: 'Care Annual', price: 99, months: 12, feeRate: 0, discountRate: 0.15,
    perks: ['No booking fees', '15% off every consultation', 'About two months free compared to monthly'],
  },
};

const r2 = (n) => Math.round(n * 100) / 100;

export function quote(base, planId = 'payg') {
  const plan = PLANS[planId] || PLANS.payg;
  const serviceFee = r2(base * plan.feeRate);
  const discount = r2(base * plan.discountRate);
  return { base: r2(base), serviceFee, discount, total: r2(base + serviceFee - discount), plan: plan.id };
}

export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough driving time in Malta traffic: 6 min to leave + ~32 km/h average. Gozo adds the ferry. */
export function etaMinutes(km, crossesChannel = false) {
  return Math.max(5, Math.round(6 + (km / 32) * 60 + (crossesChannel ? 35 : 0)));
}

export const isGozo = (p) => p && p.lat > 36.0;

/** Triage priority used to sort doctor requests: elderly and reduced mobility first. */
export function priorityScore({ age, reducedMobility, asap }) {
  let s = 0;
  if (age >= 75) s += 3;
  else if (age >= 65) s += 2;
  if (reducedMobility) s += 3;
  if (asap) s += 1;
  return s;
}

function luhn(num) {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function cardBrand(n) {
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  return 'Card';
}

/**
 * Simulated payment gateway (test mode). Never stores the full card number:
 * only brand + last 4 digits are kept.
 */
export function chargeCard(card) {
  if (!card) return { error: 'Enter your card details to pay.' };
  const number = String(card.number || '').replace(/\D/g, '');
  const name = String(card.name || '').trim();
  const cvc = String(card.cvc || '').trim();
  const m = String(card.expiry || '').match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!name) return { error: 'Enter the name shown on the card.' };
  if (number.length < 13 || number.length > 19 || !luhn(number)) return { error: 'This card number is not valid. Check the digits and try again.' };
  if (!m) return { error: 'Enter the expiry date as MM/YY.' };
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return { error: 'The expiry month must be between 01 and 12.' };
  if (new Date(year, month, 1) <= new Date()) return { error: 'This card has expired. Use another card.' };
  if (!/^\d{3,4}$/.test(cvc)) return { error: 'The security code is the 3 or 4 digits on the back of the card.' };
  if (number === '4000000000000002') return { error: 'Your bank declined this card. Try another card.', declined: true };
  return { brand: cardBrand(number), last4: number.slice(-4) };
}

/** ID check at sign-up: Maltese ID card format is checked instantly, passports go to manual review. */
export function checkIdFormat(type, number) {
  const v = String(number || '').trim();
  if (type === 'maltese_id') return /^\d{1,7}[MGAPLHBZ]$/i.test(v);
  if (type === 'passport') return /^[A-Z0-9]{6,9}$/i.test(v);
  return false;
}

const randomHex = (bytes) => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
export const newRoom = () => 'HelloDoctor-' + randomHex(6);
