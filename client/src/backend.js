// Hello Doctor "API" running in the browser, directly on Firebase.
// Same routes as a REST server so the pages stay simple: api('/appointments', { method: 'POST', body }).
// Data is protected by Firestore security rules (firestore.rules): every write below is
// re-checked by Firebase (owner, allowed status change, price matches the doctor's fee, ...).
import {
  collection, doc, getDoc, getDocs, increment, query, runTransaction, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { auth, db } from './firebase.js';
import {
  PLANS, quote, distanceKm, etaMinutes, isGozo, priorityScore, chargeCard, checkIdFormat, newRoom,
} from '../../shared/logic.js';
import { LOCALITIES, findLocality } from '../../shared/localities.js';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new ApiError(status, message); };
const now = () => new Date().toISOString();
const str = (v, max = 2000) => (v == null ? '' : String(v).trim().slice(0, max));
const VALLETTA = { lat: 35.8989, lng: 14.5146 };

// ---------- Firestore helpers ----------

const ref = (c, id) => doc(db, c, String(id));
const newRef = (c) => doc(collection(db, c));
const eq = (field, value) => where(field, '==', value);

async function get1(c, id) {
  if (!id) return null;
  const s = await getDoc(ref(c, id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

async function list(c, ...conds) {
  const target = conds.length ? query(collection(db, c), ...conds) : collection(db, c);
  return (await getDocs(target)).docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- Serialisers ----------

function publicUser(u, identity) {
  const out = {
    id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone,
    idType: u.idType, idMasked: identity?.idNumber ? '•••' + String(identity.idNumber).slice(-3) : null,
    idStatus: u.idStatus, blocked: !!u.blocked, age: u.age, reducedMobility: !!u.reducedMobility,
    isTourist: !!u.isTourist, locality: u.locality, address: u.address, lat: u.lat, lng: u.lng,
    createdAt: u.createdAt,
  };
  if (u.role === 'doctor' && u.doctor) {
    const d = u.doctor;
    out.profile = {
      specialty: d.specialty, licenseNumber: d.licenseNumber, yearsExperience: d.yearsExperience, bio: d.bio,
      languages: d.languages || [], homeFee: d.homeFee, videoFee: d.videoFee,
      offersHome: !!d.offersHome, offersVideo: !!d.offersVideo, online: !!d.online,
    };
  }
  return out;
}

function serializeDoctor(u, origin) {
  const d = u.doctor;
  const km = origin && u.lat != null ? distanceKm(origin, u) : null;
  return {
    id: u.id, name: u.name, locality: u.locality, lat: u.lat, lng: u.lng, specialty: d.specialty,
    yearsExperience: d.yearsExperience, bio: d.bio, languages: d.languages || [],
    homeFee: d.homeFee, videoFee: d.videoFee, offersHome: !!d.offersHome, offersVideo: !!d.offersVideo,
    online: !!d.online, busy: !!d.busy,
    rating: d.ratingCount ? Math.round((d.ratingSum / d.ratingCount) * 10) / 10 : null,
    reviewCount: d.ratingCount || 0,
    consultations: (d.pastConsultations || 0) + (d.completedCount || 0),
    distanceKm: km == null ? null : Math.round(km * 10) / 10,
    etaMinutes: km == null ? null : etaMinutes(km, isGozo(origin) !== isGozo(u)),
  };
}

async function listedDoctors() {
  return (await list('users', eq('role', 'doctor'))).filter((u) => !u.blocked && u.idStatus === 'verified' && u.doctor);
}

function serializeAppt(a) {
  const { report, review, videoRoom, patientId, doctorId, ...rest } = a;
  return {
    ...rest,
    videoUrl: videoRoom ? `https://meet.jit.si/${videoRoom}` : null,
    reviewed: !!review,
    patient: { id: patientId, ...a.patient },
    doctor: { id: doctorId, ...a.doctor },
  };
}

async function getAppt(id, user) {
  const a = await get1('appointments', id);
  if (!a) fail(404, 'This visit does not exist.');
  if (user.role !== 'admin' && a.patientId !== user.id && a.doctorId !== user.id) fail(403, 'You can only see your own visits.');
  return a;
}

async function activePlan(userId) {
  const s = (await list('subscriptions', eq('userId', userId)))
    .filter((x) => x.endsAt > now())
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  return s ? { id: s.id, plan: s.plan, info: PLANS[s.plan], price: s.price, startedAt: s.startedAt, endsAt: s.endsAt, status: s.status } : null;
}

function originFor(q, user) {
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  if (user?.lat != null) return { lat: user.lat, lng: user.lng };
  return VALLETTA;
}

async function current(...roles) {
  const fu = auth?.currentUser;
  if (!fu) fail(401, 'Log in to continue.');
  const u = await get1('users', fu.uid);
  if (!u) fail(401, 'No Hello Doctor profile for this account. Create an account first.');
  if (u.blocked) fail(403, 'This account has been blocked by an administrator.');
  if (roles.length && !roles.includes(u.role)) fail(403, 'You do not have access to this page.');
  return u;
}

// ---------- Router ----------

const routes = [];
const on = (method, pattern, fn) =>
  routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

export async function handle(method, path, body) {
  const [p, qs] = path.split('?');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = p.match(r.re);
    if (!m) continue;
    try {
      return await r.fn({ params: m.groups || {}, body: body || {}, query: q });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err?.code === 'permission-denied') throw new ApiError(403, 'You are not allowed to do this.');
      if (err?.code === 'unavailable') throw new ApiError(503, 'Can\'t reach Hello Doctor. Check your connection and try again.');
      console.error(err);
      throw new ApiError(500, 'Something went wrong. Try again in a moment.');
    }
  }
  throw new ApiError(404, 'Unknown route.');
}

// ---------- Account ----------

on('POST', '/auth/signup', async ({ body: b }) => {
  const roleName = b.role === 'doctor' ? 'doctor' : 'patient';
  const name = str(b.name, 100);
  const email = str(b.email, 200).toLowerCase();
  const password = String(b.password || '');
  if (name.length < 2) fail(400, 'Enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
  if (password.length < 8) fail(400, 'Your password needs at least 8 characters.');
  const idType = b.idType === 'passport' ? 'passport' : 'maltese_id';
  const idNumber = str(b.idNumber, 20).toUpperCase();
  if (!checkIdFormat(idType, idNumber)) {
    fail(400, idType === 'passport'
      ? 'Enter your passport number (6 to 9 letters and digits).'
      : 'A Maltese ID card number is up to 7 digits followed by a letter, for example 123456M.');
  }
  const loc = findLocality(b.locality);
  if (!loc) fail(400, 'Choose your locality from the list.');
  const license = str(b.licenseNumber, 30);
  if (roleName === 'doctor' && !license) fail(400, 'Enter your Medical Council registration number.');

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') fail(409, 'An account with this email already exists. Log in instead.');
    if (err.code === 'auth/weak-password') fail(400, 'Your password needs at least 8 characters.');
    if (err.code === 'auth/invalid-email') fail(400, 'Enter a valid email address.');
    throw err;
  }
  const uid = cred.user.uid;
  // Maltese ID format is checked instantly; passports and all doctors are reviewed by an administrator.
  const data = {
    role: roleName, name, email, phone: str(b.phone, 30) || null, idType,
    idStatus: roleName === 'patient' && idType === 'maltese_id' ? 'verified' : 'pending',
    blocked: false, age: roleName === 'patient' && Number(b.age) > 0 ? Math.min(120, Number(b.age)) : null,
    reducedMobility: !!b.reducedMobility, isTourist: !!b.isTourist,
    locality: loc.name, address: str(b.address, 200) || null, lat: loc.lat, lng: loc.lng, createdAt: now(),
  };
  if (roleName === 'doctor') {
    const specialty = b.specialty === 'physio' ? 'physio' : 'gp';
    data.doctor = {
      specialty, licenseNumber: license, yearsExperience: Math.max(0, Number(b.yearsExperience) || 0),
      bio: str(b.bio, 600) || null, languages: ['English', 'Maltese'],
      homeFee: specialty === 'physio' ? 55 : 60, videoFee: specialty === 'physio' ? 25 : 30,
      offersHome: true, offersVideo: true, online: false, busy: false,
      pastConsultations: 0, completedCount: 0, ratingSum: 0, ratingCount: 0,
    };
  }
  try {
    const batch = writeBatch(db);
    batch.set(ref('users', uid), data);
    batch.set(doc(db, 'users', uid, 'private', 'identity'), { idType, idNumber });
    await batch.commit();
  } catch (err) {
    await deleteUser(cred.user).catch(() => {});
    throw err;
  }
  return { ok: true };
});

on('GET', '/me', async () => {
  const u = await current();
  const identity = (await getDoc(doc(db, 'users', u.id, 'private', 'identity'))).data();
  return { user: publicUser(u, identity), plan: u.role === 'patient' ? await activePlan(u.id) : null };
});

on('PATCH', '/me', async ({ body: b }) => {
  const u = await current();
  const patch = {};
  if (b.name !== undefined) {
    patch.name = str(b.name, 100);
    if (patch.name.length < 2) fail(400, 'Enter your full name.');
  }
  if (b.phone !== undefined) patch.phone = str(b.phone, 30) || null;
  if (u.role === 'patient') {
    if (b.age !== undefined) patch.age = Number(b.age) > 0 ? Math.min(120, Number(b.age)) : null;
    if (b.reducedMobility !== undefined) patch.reducedMobility = !!b.reducedMobility;
    if (b.isTourist !== undefined) patch.isTourist = !!b.isTourist;
    if (b.address !== undefined) patch.address = str(b.address, 200) || null;
    if (b.locality !== undefined) {
      const loc = findLocality(b.locality);
      if (!loc) fail(400, 'Choose your locality from the list.');
      Object.assign(patch, { locality: loc.name, lat: loc.lat, lng: loc.lng });
    }
  }
  if (Object.keys(patch).length) await updateDoc(ref('users', u.id), patch);
  const identity = (await getDoc(doc(db, 'users', u.id, 'private', 'identity'))).data();
  return { user: publicUser({ ...u, ...patch }, identity) };
});

// ---------- Public ----------

on('GET', '/public/map', async () => {
  const rows = await listedDoctors();
  return {
    online: rows.filter((r) => r.doctor.online).length,
    total: rows.length,
    doctors: rows.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, specialty: r.doctor.specialty, online: !!r.doctor.online, label: `${r.name}, ${r.locality}` })),
  };
});
on('GET', '/localities', async () => ({ localities: LOCALITIES }));
on('GET', '/plans', async () => ({ plans: Object.values(PLANS) }));

// ---------- Doctors ----------

on('GET', '/doctors', async ({ query: q }) => {
  const u = await current();
  const origin = originFor(q, u);
  let rows = (await listedDoctors()).map((d) => serializeDoctor(d, origin));
  if (q.specialty === 'gp' || q.specialty === 'physio') rows = rows.filter((d) => d.specialty === q.specialty);
  if (q.type === 'home') rows = rows.filter((d) => d.offersHome);
  if (q.type === 'video') rows = rows.filter((d) => d.offersVideo);
  if (q.online === '1') rows = rows.filter((d) => d.online);
  if (q.q) rows = rows.filter((d) => d.name.toLowerCase().includes(q.q.toLowerCase()));
  const sorters = {
    rating: (a, b) => (b.rating || 0) - (a.rating || 0),
    eta: (a, b) => (a.etaMinutes ?? 999) - (b.etaMinutes ?? 999),
    experience: (a, b) => b.yearsExperience - a.yearsExperience,
    price: (a, b) => a.homeFee - b.homeFee,
    recommended: (a, b) => (b.online - a.online) || ((b.rating || 0) - (a.rating || 0)) || ((a.etaMinutes ?? 999) - (b.etaMinutes ?? 999)),
  };
  rows.sort(sorters[q.sort] || sorters.recommended);
  return { doctors: rows };
});

on('GET', '/doctors/:id', async ({ params, query: q }) => {
  const me = await current();
  const u = await get1('users', params.id);
  if (!u || u.role !== 'doctor' || u.blocked || (u.idStatus !== 'verified' && me.role !== 'admin')) fail(404, 'This doctor is not available on Hello Doctor.');
  const reviews = (await list('reviews', eq('doctorId', u.id)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20)
    .map((r) => ({ rating: r.rating, comment: r.comment, createdAt: r.createdAt, author: r.author }));
  const slots = (await list('slots', eq('doctorId', u.id)))
    .filter((s) => !s.booked && s.startAt > now())
    .sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 40)
    .map((s) => ({ id: s.id, startAt: s.startAt }));
  const seenBefore = me.role === 'patient'
    ? (await list('appointments', eq('patientId', me.id))).filter((a) => a.doctorId === u.id && a.status === 'completed').length
    : 0;
  return { doctor: serializeDoctor(u, originFor(q, me)), reviews, slots, seenBefore };
});

/** "Nearest available" mode: nearest free online doctor for home visits, any free online doctor for video. */
on('GET', '/match', async ({ query: q }) => {
  const me = await current('patient');
  const specialty = q.specialty === 'physio' ? 'physio' : 'gp';
  const type = q.type === 'video' ? 'video' : 'home';
  const rows = (await listedDoctors())
    .filter((u) => u.doctor.online && !u.doctor.busy && u.doctor.specialty === specialty)
    .map((u) => serializeDoctor(u, originFor(q, me)))
    .filter((d) => (type === 'home' ? d.offersHome : d.offersVideo));
  if (!rows.length) fail(404, `No ${specialty === 'gp' ? 'GP' : 'physiotherapist'} is free for a ${type === 'home' ? 'home visit' : 'video call'} right now. Try a video consultation, or choose a doctor and book a time slot.`);
  const doctor = type === 'home' ? rows.sort((a, b) => a.etaMinutes - b.etaMinutes)[0] : rows[Math.floor(Math.random() * rows.length)];
  return { doctor };
});

on('POST', '/quote', async ({ body: b }) => {
  const me = await current('patient');
  const u = await get1('users', b.doctorId);
  if (!u?.doctor) fail(404, 'Choose a doctor first.');
  const plan = await activePlan(me.id);
  return { quote: quote(b.visitType === 'video' ? u.doctor.videoFee : u.doctor.homeFee, plan?.plan || 'payg') };
});

// ---------- Appointments ----------

on('POST', '/appointments', async ({ body: b }) => {
  const u = await current('patient');
  const visitType = b.visitType === 'video' ? 'video' : 'home';
  const matchMode = b.matchMode === 'nearest' ? 'nearest' : 'chosen';
  const symptoms = str(b.symptoms, 1000);
  if (symptoms.length < 5) fail(400, 'Describe your symptoms in a few words so the doctor can prepare.');

  const docUser = await get1('users', b.doctorId);
  if (!docUser?.doctor || docUser.blocked || docUser.idStatus !== 'verified') fail(404, 'This doctor is not available. Choose another doctor.');
  const doctor = serializeDoctor(docUser, u.lat != null ? u : VALLETTA);
  if (visitType === 'home' && !doctor.offersHome) fail(400, `${doctor.name} does not do home visits.`);
  if (visitType === 'video' && !doctor.offersVideo) fail(400, `${doctor.name} does not do video consultations.`);

  let address = null; let lat = u.lat; let lng = u.lng;
  if (visitType === 'home') {
    const loc = findLocality(b.locality);
    address = str(b.address, 200);
    if (!loc) fail(400, 'Choose the locality where the doctor should come.');
    if (address.length < 3) fail(400, 'Enter the street address where the doctor should come.');
    address = `${address}, ${loc.name}`;
    lat = loc.lat; lng = loc.lng;
  }
  const useSlot = !!b.slotId && matchMode === 'chosen';
  if (!useSlot && !doctor.online) fail(409, `${doctor.name} is offline right now. Choose a time slot or another doctor.`);

  const plan = await activePlan(u.id);
  const q = quote(visitType === 'home' ? doctor.homeFee : doctor.videoFee, plan?.plan || 'payg');
  const charge = chargeCard(b.card);
  if (charge.error) fail(402, charge.error);

  const id = await runTransaction(db, async (t) => {
    let slot = null;
    const slotRef = useSlot ? ref('slots', b.slotId) : null;
    if (slotRef) {
      const s = await t.get(slotRef);
      if (!s.exists() || s.data().doctorId !== doctor.id || s.data().booked) fail(409, 'This time slot was just taken. Choose another time.');
      if (s.data().startAt <= now()) fail(409, 'This time slot has passed. Choose another time.');
      slot = { id: s.id, ...s.data() };
    }
    const payRef = newRef('payments');
    const apRef = newRef('appointments');
    t.set(payRef, {
      userId: u.id, amount: q.total, kind: 'consultation', status: 'paid', createdAt: now(),
      description: `${visitType === 'home' ? 'Home visit' : 'Video consultation'} with ${doctor.name}`,
      cardBrand: charge.brand, cardLast4: charge.last4,
    });
    if (slotRef) t.update(slotRef, { booked: true });
    t.set(apRef, {
      patientId: u.id, doctorId: doctor.id, specialty: doctor.specialty, matchMode, visitType, status: 'pending',
      asap: !slot, scheduledAt: slot ? slot.startAt : now(), slotId: slot ? slot.id : null,
      symptoms, address, lat, lng, priority: priorityScore({ age: u.age, reducedMobility: u.reducedMobility, asap: !slot }),
      price: { base: q.base, serviceFee: q.serviceFee, discount: q.discount, total: q.total }, paymentId: payRef.id,
      etaMinutes: visitType === 'home' ? etaMinutes(distanceKm(doctor, { lat, lng }), isGozo(doctor) !== isGozo({ lat })) : null,
      enRouteAt: null, completedAt: null, videoRoom: visitType === 'video' ? newRoom() : null,
      createdAt: now(), updatedAt: now(),
      patient: { name: u.name, age: u.age ?? null, reducedMobility: !!u.reducedMobility, idStatus: u.idStatus, isTourist: !!u.isTourist, phone: u.phone ?? null },
      doctor: { name: doctor.name, lat: doctor.lat, lng: doctor.lng, phone: docUser.phone ?? null, locality: doctor.locality, specialty: doctor.specialty },
      report: null, review: null,
    });
    return apRef.id;
  });
  return { appointment: serializeAppt(await getAppt(id, u)) };
});

on('GET', '/appointments', async () => {
  const u = await current();
  const rows = u.role === 'doctor' ? await list('appointments', eq('doctorId', u.id))
    : u.role === 'patient' ? await list('appointments', eq('patientId', u.id)) : await list('appointments');
  return { appointments: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200).map(serializeAppt) };
});

on('GET', '/appointments/:id', async ({ params }) => {
  const u = await current();
  const a = await getAppt(params.id, u);
  const payment = u.id === a.patientId || u.role === 'admin' ? await get1('payments', a.paymentId) : null;
  const myFlag = u.role === 'admin' ? null
    : (await list('flags', eq('appointmentId', a.id), eq('reporterId', u.id)))[0];
  return {
    appointment: serializeAppt(a),
    doctorSpecialty: a.doctor.specialty,
    report: a.report,
    review: a.review,
    payment: payment ? { brand: payment.cardBrand, last4: payment.cardLast4, status: payment.status, createdAt: payment.createdAt } : null,
    myFlag: myFlag ? { reason: myFlag.reason, status: myFlag.status } : null,
  };
});

const TRANSITIONS = {
  doctor: {
    pending: ['accepted', 'declined'],
    accepted: { home: ['en_route', 'cancelled'], video: ['in_progress', 'cancelled'] },
    en_route: ['in_progress'],
  },
  patient: { pending: ['cancelled'], accepted: ['cancelled'] },
};

on('POST', '/appointments/:id/status', async ({ params, body }) => {
  const u = await current('doctor', 'patient');
  const a = await getAppt(params.id, u);
  const next = String(body.status || '');
  let allowed = TRANSITIONS[u.role][a.status] || [];
  if (!Array.isArray(allowed)) allowed = allowed[a.visitType] || [];
  if (u.role === 'doctor' && a.doctorId !== u.id) fail(403, 'This visit belongs to another doctor.');
  if (!allowed.includes(next)) fail(409, `This visit is ${a.status.replace('_', ' ')} and can't be changed to ${next.replace('_', ' ')}.`);

  const batch = writeBatch(db);
  const patch = { status: next, updatedAt: now() };
  if (next === 'en_route') {
    // Snapshot where the doctor leaves from: the patient's page animates the trip from there.
    const from = { lat: u.lat, lng: u.lng };
    Object.assign(patch, {
      enRouteAt: now(),
      etaMinutes: etaMinutes(distanceKm(from, a), isGozo(from) !== isGozo(a)),
      'doctor.lat': from.lat, 'doctor.lng': from.lng,
    });
  }
  batch.update(ref('appointments', a.id), patch);
  if (u.role === 'doctor' && (next === 'en_route' || next === 'in_progress')) batch.update(ref('users', u.id), { 'doctor.busy': true });
  if (next === 'declined' || next === 'cancelled') {
    if (a.paymentId) batch.update(ref('payments', a.paymentId), { status: 'refunded' });
    if (a.slotId) batch.update(ref('slots', a.slotId), { booked: false });
  }
  await batch.commit();
  return { appointment: serializeAppt(await getAppt(a.id, u)) };
});

on('POST', '/appointments/:id/report', async ({ params, body: b }) => {
  const u = await current('doctor');
  const a = await getAppt(params.id, u);
  if (a.doctorId !== u.id) fail(403, 'This visit belongs to another doctor.');
  if (a.status !== 'in_progress') fail(409, 'Start the consultation before writing the report.');
  const diagnosis = str(b.diagnosis, 300);
  if (diagnosis.length < 3) fail(400, 'Enter a diagnosis or reason for the visit.');
  const batch = writeBatch(db);
  batch.update(ref('appointments', a.id), {
    status: 'completed', completedAt: now(), updatedAt: now(),
    report: { diagnosis, notes: str(b.notes) || null, prescription: str(b.prescription) || null, followUp: str(b.followUp, 300) || null, createdAt: now() },
  });
  const docPatch = { 'doctor.completedCount': increment(1), 'doctor.busy': false };
  // After a home visit the doctor is at the patient's place: use it for the next arrival times.
  if (a.visitType === 'home' && a.lat != null) Object.assign(docPatch, { lat: a.lat, lng: a.lng });
  batch.update(ref('users', u.id), docPatch);
  await batch.commit();
  return { ok: true };
});

on('POST', '/appointments/:id/review', async ({ params, body }) => {
  const u = await current('patient');
  const a = await getAppt(params.id, u);
  if (a.status !== 'completed') fail(409, 'You can rate the doctor once the visit is completed.');
  if (a.review) fail(409, 'You already rated this visit.');
  const rating = Math.round(Number(body.rating));
  if (!(rating >= 1 && rating <= 5)) fail(400, 'Choose a rating from 1 to 5 stars.');
  const review = { rating, comment: str(body.comment, 600) || null, createdAt: now() };
  const batch = writeBatch(db);
  batch.update(ref('appointments', a.id), { review });
  batch.set(ref('reviews', a.id), { ...review, doctorId: a.doctorId, patientId: u.id, author: u.name.split(' ')[0] });
  batch.update(ref('users', a.doctorId), { 'doctor.ratingSum': increment(rating), 'doctor.ratingCount': increment(1) });
  await batch.commit();
  return { ok: true };
});

on('POST', '/flags', async ({ body }) => {
  const u = await current('doctor', 'patient');
  const a = await getAppt(body.appointmentId, u);
  const reason = str(body.reason, 80);
  if (!reason) fail(400, 'Choose what went wrong.');
  const existing = await list('flags', eq('appointmentId', a.id), eq('reporterId', u.id));
  if (existing.length) fail(409, 'You already reported this visit. An administrator will review it.');
  const isPatient = u.id === a.patientId;
  await setDoc(newRef('flags'), {
    reporterId: u.id, reporterName: u.name, reporterRole: u.role,
    targetId: isPatient ? a.doctorId : a.patientId, targetName: isPatient ? a.doctor.name : a.patient.name, targetRole: isPatient ? 'doctor' : 'patient',
    appointmentId: a.id, reason, details: str(body.details, 1000) || null, status: 'open', resolution: null, createdAt: now(),
  });
  return { ok: true };
});

// ---------- Doctor workspace ----------

on('PATCH', '/doctor/profile', async ({ body: b }) => {
  const u = await current('doctor');
  const d = u.doctor;
  if (b.online && u.idStatus !== 'verified') fail(403, 'Your account must be approved by an administrator before you can go online.');
  const money = (v, cur) => (v === undefined ? cur : Math.max(0, Math.min(500, Number(v) || 0)));
  const next = {
    online: b.online !== undefined ? !!b.online : d.online,
    bio: b.bio !== undefined ? str(b.bio, 600) : d.bio,
    languages: b.languages !== undefined ? (Array.isArray(b.languages) ? b.languages : String(b.languages).split(',')).map((s) => str(s, 30)).filter(Boolean) : d.languages,
    homeFee: money(b.homeFee, d.homeFee),
    videoFee: money(b.videoFee, d.videoFee),
    offersHome: b.offersHome !== undefined ? !!b.offersHome : d.offersHome,
    offersVideo: b.offersVideo !== undefined ? !!b.offersVideo : d.offersVideo,
    yearsExperience: b.yearsExperience !== undefined ? Math.max(0, Number(b.yearsExperience) || 0) : d.yearsExperience,
  };
  if (!next.offersHome && !next.offersVideo) fail(400, 'Offer at least home visits or video consultations.');
  const patch = {};
  for (const [k, v] of Object.entries(next)) patch[`doctor.${k}`] = v;
  let locPatch = {};
  if (b.locality !== undefined && b.locality !== u.locality) {
    const loc = findLocality(b.locality);
    if (!loc) fail(400, 'Choose a locality from the list.');
    locPatch = { locality: loc.name, lat: loc.lat, lng: loc.lng };
  }
  await updateDoc(ref('users', u.id), { ...patch, ...locPatch });
  return { user: publicUser({ ...u, ...locPatch, doctor: { ...d, ...next } }) };
});

const slotId = (doctorId, startAt) => `${doctorId}_${startAt.replace(/[^0-9]/g, '').slice(0, 12)}`;

on('GET', '/doctor/slots', async () => {
  const u = await current('doctor');
  return {
    slots: (await list('slots', eq('doctorId', u.id)))
      .filter((s) => s.startAt > now()).sort((a, b) => a.startAt.localeCompare(b.startAt))
      .map((s) => ({ id: s.id, startAt: s.startAt, booked: !!s.booked })),
  };
});

on('POST', '/doctor/slots', async ({ body }) => {
  const u = await current('doctor');
  const t = new Date(body.startAt);
  if (Number.isNaN(t.getTime())) fail(400, 'Choose a date and time.');
  if (t <= new Date()) fail(400, 'Choose a time in the future.');
  const startAt = t.toISOString();
  const id = slotId(u.id, startAt);
  if (await get1('slots', id)) fail(409, 'You already have a slot at this time.');
  await setDoc(ref('slots', id), { doctorId: u.id, startAt, booked: false });
  return { ok: true };
});

on('DELETE', '/doctor/slots/:id', async ({ params }) => {
  const u = await current('doctor');
  const s = await get1('slots', params.id);
  if (!s || s.doctorId !== u.id) fail(404, 'This slot does not exist.');
  if (s.booked) fail(409, 'A patient has booked this slot. Cancel the visit instead.');
  const batch = writeBatch(db);
  batch.delete(ref('slots', s.id));
  await batch.commit();
  return { ok: true };
});

// ---------- Subscriptions & payments (m-commerce) ----------

on('GET', '/subscription', async () => {
  const u = await current();
  return { subscription: await activePlan(u.id) };
});

on('POST', '/subscription', async ({ body }) => {
  const u = await current('patient');
  const plan = PLANS[body.plan];
  if (!plan || plan.id === 'payg') fail(400, 'Choose the monthly or annual plan.');
  const cur = await activePlan(u.id);
  if (cur && cur.plan === plan.id && cur.status === 'active') fail(409, `You already have ${plan.name}.`);
  const charge = chargeCard(body.card);
  if (charge.error) fail(402, charge.error);
  const batch = writeBatch(db);
  const payRef = newRef('payments');
  batch.set(payRef, {
    userId: u.id, amount: plan.price, kind: 'subscription', description: `${plan.name} subscription`,
    cardBrand: charge.brand, cardLast4: charge.last4, status: 'paid', createdAt: now(),
  });
  const old = (await list('subscriptions', eq('userId', u.id))).filter((s) => s.endsAt > now());
  for (const s of old) batch.update(ref('subscriptions', s.id), { status: 'cancelled', endsAt: now() });
  const end = new Date();
  end.setMonth(end.getMonth() + plan.months);
  batch.set(newRef('subscriptions'), {
    userId: u.id, plan: plan.id, price: plan.price, startedAt: now(), endsAt: end.toISOString(), status: 'active', paymentId: payRef.id,
  });
  await batch.commit();
  return { ok: true };
});

on('DELETE', '/subscription', async () => {
  const u = await current('patient');
  const s = await activePlan(u.id);
  if (!s || s.status !== 'active') fail(404, 'You have no plan to cancel.');
  await updateDoc(ref('subscriptions', s.id), { status: 'cancelled' });
  return { ok: true };
});

on('GET', '/payments', async () => {
  const u = await current();
  return {
    payments: (await list('payments', eq('userId', u.id)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => ({ id: p.id, amount: p.amount, kind: p.kind, description: p.description, brand: p.cardBrand, last4: p.cardLast4, status: p.status, createdAt: p.createdAt })),
  };
});

// ---------- Admin ----------

on('GET', '/admin/overview', async () => {
  await current('admin');
  const [users, appts, pays, subs, flags] = await Promise.all(['users', 'appointments', 'payments', 'subscriptions', 'flags'].map((c) => list(c)));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return {
    patients: users.filter((u) => u.role === 'patient').length,
    doctors: users.filter((u) => u.role === 'doctor' && u.idStatus === 'verified').length,
    doctorsOnline: users.filter((u) => u.role === 'doctor' && u.doctor?.online && !u.blocked).length,
    pendingVerifications: users.filter((u) => u.idStatus === 'pending' && u.role !== 'admin').length,
    openFlags: flags.filter((f) => f.status === 'open').length,
    activeVisits: appts.filter((a) => ['pending', 'accepted', 'en_route', 'in_progress'].includes(a.status)).length,
    visitsToday: appts.filter((a) => a.createdAt >= today.toISOString()).length,
    revenue: Math.round(pays.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0) * 100) / 100,
    subscribers: subs.filter((s) => s.endsAt > now()).length,
  };
});

on('GET', '/admin/users', async () => {
  await current('admin');
  const [users, flags] = await Promise.all([list('users'), list('flags')]);
  const rows = users.filter((u) => ['patient', 'doctor'].includes(u.role))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  // Identity numbers are private: only loaded for accounts waiting for a check.
  const ids = await Promise.all(rows.map((u) => (u.idStatus === 'pending'
    ? getDoc(doc(db, 'users', u.id, 'private', 'identity')).then((s) => s.data()?.idNumber ?? null)
    : null)));
  return {
    users: rows.map((u, i) => ({
      ...publicUser(u), profile: undefined, idNumber: ids[i],
      flagCount: flags.filter((f) => f.targetId === u.id).length,
      specialty: u.doctor?.specialty, licenseNumber: u.doctor?.licenseNumber,
    })),
  };
});

on('POST', '/admin/users/:id', async ({ params, body }) => {
  await current('admin');
  const u = await get1('users', params.id);
  if (!u || u.role === 'admin') fail(404, 'This user does not exist.');
  const patches = {
    verify: { idStatus: 'verified' },
    reject: { idStatus: 'rejected' },
    block: { blocked: true, ...(u.doctor ? { 'doctor.online': false } : {}) },
    unblock: { blocked: false },
  };
  if (!patches[body.action]) fail(400, 'Unknown action.');
  await updateDoc(ref('users', u.id), patches[body.action]);
  return { ok: true };
});

on('GET', '/admin/flags', async () => {
  await current('admin');
  const [flags, users] = await Promise.all([list('flags'), list('users')]);
  const blocked = new Set(users.filter((u) => u.blocked).map((u) => u.id));
  return {
    flags: flags.sort((a, b) => (a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : a.status === 'open' ? -1 : 1))
      .map((f) => ({
        id: f.id, reason: f.reason, details: f.details, status: f.status, resolution: f.resolution, createdAt: f.createdAt, appointmentId: f.appointmentId,
        reporter: { id: f.reporterId, name: f.reporterName, role: f.reporterRole },
        target: { id: f.targetId, name: f.targetName, role: f.targetRole, blocked: blocked.has(f.targetId) },
      })),
  };
});

on('POST', '/admin/flags/:id/resolve', async ({ params, body }) => {
  await current('admin');
  if (!(await get1('flags', params.id))) fail(404, 'This report does not exist.');
  await updateDoc(ref('flags', params.id), { status: 'resolved', resolution: str(body.resolution, 300) || 'Reviewed' });
  return { ok: true };
});
