// Demo data so the app can be tested and demoed straight away.
// Creates Firebase Auth accounts + Firestore documents. All demo accounts use DEMO_PASSWORD.
import { col, docs, fauth, writeAll } from './firebase.js';
import { quote, priorityScore } from '../shared/logic.js';
import { findLocality } from '../shared/localities.js';

export const DEMO_PASSWORD = 'hellodoctor';
export const DEMO_DOMAIN = '@hellodoctor.test';

const daysAgo = (d, hour = 10) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, 0, 0, 0);
  return t.toISOString();
};

/** Create (or reuse) the Firebase Auth account and return the user document. */
async function authUser(email, name) {
  try {
    const u = await fauth.createUser({ email, password: DEMO_PASSWORD, displayName: name });
    return u.uid;
  } catch (err) {
    if (err.code !== 'auth/email-already-exists') throw err;
    const u = await fauth.getUserByEmail(email);
    await fauth.updateUser(u.uid, { password: DEMO_PASSWORD, disabled: false });
    return u.uid;
  }
}

function userDoc(u) {
  const loc = findLocality(u.locality);
  return {
    role: u.role, name: u.name, email: u.email, phone: u.phone ?? null,
    idType: u.idType ?? null, idStatus: u.idStatus ?? 'verified',
    blocked: false, age: u.age ?? null, reducedMobility: !!u.reducedMobility, isTourist: !!u.isTourist,
    locality: u.locality ?? null, address: u.address ?? null, lat: loc?.lat ?? null, lng: loc?.lng ?? null,
    createdAt: daysAgo(u.joined ?? 90),
  };
}

const DOCTORS = [
  { name: 'Dr Maria Camilleri', email: 'doctor@hellodoctor.test', specialty: 'gp', locality: 'Sliema', years: 14, langs: ['English', 'Maltese', 'Italian'], home: 60, video: 30, online: true, past: 412, bio: 'Family GP with a focus on elderly care and chronic conditions. Happy to coordinate with your regular doctor.' },
  { name: 'Dr Joseph Borg', email: 'joseph.borg@hellodoctor.test', specialty: 'gp', locality: 'Valletta', years: 22, langs: ['English', 'Maltese'], home: 65, video: 30, online: true, past: 1310, bio: 'Over twenty years of general practice in the Harbour area. Home visits for patients who find it hard to travel.' },
  { name: 'Dr Elena Vella', email: 'elena.vella@hellodoctor.test', specialty: 'physio', locality: "St Julian's", years: 9, langs: ['English', 'Maltese', 'French'], home: 55, video: 25, online: true, past: 286, bio: 'Physiotherapist for back pain, post-surgery rehabilitation and sports injuries. Exercise plans you can follow at home.' },
  { name: 'Dr Karl Farrugia', email: 'karl.farrugia@hellodoctor.test', specialty: 'gp', locality: 'Birkirkara', years: 6, langs: ['English', 'Maltese', 'German'], home: 55, video: 28, online: false, past: 154, bio: 'GP for adults and children. Speaks German for visitors from Germany and Austria.' },
  { name: 'Dr Sophie Grech', email: 'sophie.grech@hellodoctor.test', specialty: 'gp', locality: 'Mellieħa', years: 11, langs: ['English', 'French', 'Maltese'], home: 60, video: 30, online: true, past: 377, bio: 'Covers the north of Malta, including the hotels around Mellieħa and Għadira. Often sees travellers.' },
  { name: 'Dr Luca Zammit', email: 'luca.zammit@hellodoctor.test', specialty: 'physio', locality: 'Rabat', years: 15, langs: ['English', 'Maltese', 'Italian'], home: 55, video: 25, online: true, past: 640, bio: 'Physiotherapy for older adults: mobility, balance and fall prevention, in your own home.' },
  { name: 'Dr Anna Galea', email: 'anna.galea@hellodoctor.test', specialty: 'gp', locality: 'Marsaskala', years: 18, langs: ['English', 'Maltese'], home: 60, video: 30, online: true, past: 905, bio: 'GP for the south-east. Experience with diabetes follow-up and wound care at home.' },
  { name: 'Dr Daniel Micallef', email: 'daniel.micallef@hellodoctor.test', specialty: 'gp', locality: 'Victoria (Gozo)', years: 25, langs: ['English', 'Maltese'], home: 60, video: 30, online: true, past: 1544, bio: 'Gozo-based GP. Home visits all over Gozo, so you do not need to take the ferry.' },
  { name: 'Dr Rebecca Cassar', email: 'rebecca.cassar@hellodoctor.test', specialty: 'physio', locality: 'Qawra', years: 7, langs: ['English', 'Maltese', 'Spanish'], home: 50, video: 25, online: false, past: 198, bio: 'Sports and holiday injuries: sprains, strains and back pain. Video sessions for exercise follow-up.' },
  { name: 'Dr Paul Spiteri', email: 'paul.spiteri@hellodoctor.test', specialty: 'gp', locality: 'Żejtun', years: 30, langs: ['English', 'Maltese'], home: 55, video: 30, online: true, past: 2210, noVideo: true, bio: 'Long-standing village GP. Home visits only, with plenty of time for each patient.' },
];

const PATIENTS = [
  { key: 'carmen', name: 'Carmen Pace', email: 'carmen.pace@hellodoctor.test', age: 81, reducedMobility: true, locality: 'Żabbar', address: '14, Triq il-Kunvent', phone: '+356 2167 1234', idType: 'maltese_id', idNumber: '103542M', joined: 60 },
  { key: 'liam', name: "Liam O'Connor", email: 'liam.oconnor@hellodoctor.test', age: 34, isTourist: true, locality: "St Julian's", address: 'Hotel Marina, room 412', phone: '+353 87 555 0142', idType: 'passport', idNumber: 'PX4471920', joined: 5 },
  { key: 'demo', name: 'Sara Demo', email: 'patient@hellodoctor.test', age: 68, locality: 'Mosta', address: '22, Triq il-Kostituzzjoni', phone: '+356 9944 0000', idType: 'maltese_id', idNumber: '445120M', joined: 30 },
  { key: 'mark', name: 'Mark Debono', email: 'mark.debono@hellodoctor.test', age: 29, locality: 'Paola', address: '3, Triq Ħal Luqa', idType: 'maltese_id', idNumber: '771203M', joined: 20 },
  { key: 'ingrid', name: 'Ingrid Svensson', email: 'ingrid.svensson@hellodoctor.test', age: 72, isTourist: true, locality: 'Sliema', address: 'Apartment 3B, Tower Road', idType: 'passport', idNumber: 'SE8812044', idStatus: 'pending', joined: 0 },
];

const REVIEW_TEXT = [
  [5, 'Arrived quickly and took the time to explain everything to my mother.'],
  [5, 'Very kind and patient. Exactly what we needed without going to the hospital.'],
  [4, 'Good consultation, arrived a little later than the estimate.'],
  [5, 'Clear report afterwards, which my regular doctor could read.'],
  [4, 'Helpful and professional. The video call worked well.'],
  [5, 'Saved our holiday. Easy to book even though we did not know anyone here.'],
  [3, 'Fine visit but the waiting time was longer than shown.'],
  [5, 'The exercises made a real difference after one week.'],
];

export async function seed() {
  const ops = [];
  const users = {};

  const adminId = await authUser('admin@hellodoctor.test', 'Platform Admin');
  ops.push([col.users.doc(adminId), userDoc({ role: 'admin', name: 'Platform Admin', email: 'admin@hellodoctor.test', locality: 'Valletta', joined: 200 })]);

  const doctors = [];
  for (const [i, d] of DOCTORS.entries()) {
    const id = await authUser(d.email, d.name);
    const doc = {
      ...userDoc({ role: 'doctor', name: d.name, email: d.email, locality: d.locality, phone: `+356 7900 ${String(1100 + i * 37).padStart(4, '0')}`, idType: 'maltese_id', idNumber: `${(234561 + i * 991) % 9999999}M`, joined: 150 - i * 5 }),
      doctor: {
        specialty: d.specialty, licenseNumber: `MMC-${4100 + i * 13}`, yearsExperience: d.years, bio: d.bio, languages: d.langs,
        homeFee: d.home, videoFee: d.video, offersHome: true, offersVideo: !d.noVideo, online: d.online, busy: false,
        pastConsultations: d.past, completedCount: 0, ratingSum: 0, ratingCount: 0,
      },
    };
    doctors.push({ id, ...doc });
    ops.push([col.users.doc(id).collection('private').doc('identity'), { idType: 'maltese_id', idNumber: `${(234561 + i * 991) % 9999999}M` }]);
  }

  // A doctor waiting for admin approval.
  const pendingId = await authUser('thomas.azzopardi@hellodoctor.test', 'Dr Thomas Azzopardi');
  ops.push([col.users.doc(pendingId), {
    ...userDoc({ role: 'doctor', name: 'Dr Thomas Azzopardi', email: 'thomas.azzopardi@hellodoctor.test', locality: 'Mosta', idType: 'maltese_id', idNumber: '548812M', idStatus: 'pending', joined: 1 }),
    doctor: { specialty: 'gp', licenseNumber: 'MMC-5520', yearsExperience: 3, bio: 'Recently qualified GP joining the platform.', languages: ['English', 'Maltese'], homeFee: 55, videoFee: 28, offersHome: true, offersVideo: true, online: false, busy: false, pastConsultations: 0, completedCount: 0, ratingSum: 0, ratingCount: 0 },
  }]);
  ops.push([col.users.doc(pendingId).collection('private').doc('identity'), { idType: 'maltese_id', idNumber: '548812M' }]);

  for (const p of PATIENTS) {
    const id = await authUser(p.email, p.name);
    users[p.key] = { id, ...userDoc({ ...p, role: 'patient' }) };
    ops.push([col.users.doc(id), userDoc({ ...p, role: 'patient' })]);
    ops.push([col.users.doc(id).collection('private').doc('identity'), { idType: p.idType, idNumber: p.idNumber }]);
  }
  const patients = ['carmen', 'liam', 'demo', 'mark'].map((k) => users[k]);

  function addAppointment({ patient, doctor, type = 'home', status, when, mode = 'chosen', symptoms, report, review }) {
    const base = type === 'home' ? doctor.doctor.homeFee : doctor.doctor.videoFee;
    const q = quote(base, 'payg');
    const payRef = col.payments.doc();
    const apRef = col.appointments.doc();
    ops.push([payRef, {
      userId: patient.id, amount: q.total, kind: 'consultation', description: `${type === 'home' ? 'Home visit' : 'Video consultation'} with ${doctor.name}`,
      cardBrand: 'Visa', cardLast4: '4242', status: status === 'cancelled' ? 'refunded' : 'paid', createdAt: when,
    }]);
    ops.push([apRef, {
      patientId: patient.id, doctorId: doctor.id, specialty: doctor.doctor.specialty, matchMode: mode, visitType: type, status,
      asap: true, scheduledAt: when, slotId: null, symptoms,
      address: type === 'home' ? `${patient.address}, ${patient.locality}` : null, lat: patient.lat, lng: patient.lng,
      priority: priorityScore({ age: patient.age, reducedMobility: patient.reducedMobility, asap: true }),
      price: { base: q.base, serviceFee: q.serviceFee, discount: q.discount, total: q.total }, paymentId: payRef.id,
      etaMinutes: type === 'home' ? 15 : null, enRouteAt: null, completedAt: status === 'completed' ? when : null,
      videoRoom: type === 'video' ? `HelloDoctor-seed${apRef.id.slice(0, 8)}` : null, createdAt: when, updatedAt: when,
      patient: { name: patient.name, age: patient.age, reducedMobility: patient.reducedMobility, idStatus: patient.idStatus, isTourist: patient.isTourist, phone: patient.phone },
      doctor: { name: doctor.name, lat: doctor.lat, lng: doctor.lng, phone: doctor.phone, locality: doctor.locality, specialty: doctor.doctor.specialty },
      report: report ? { ...report, createdAt: when } : null,
      review: review ? { rating: review[0], comment: review[1], createdAt: when } : null,
    }]);
    if (review) ops.push([col.reviews.doc(apRef.id), { rating: review[0], comment: review[1], createdAt: when, doctorId: doctor.id, patientId: patient.id, author: patient.name.split(' ')[0] }]);
    if (status === 'completed') doctor.doctor.completedCount += 1;
    if (review) { doctor.doctor.ratingSum += review[0]; doctor.doctor.ratingCount += 1; }
    return apRef.id;
  }

  // History: completed visits with reviews so every doctor has ratings.
  let k = 0;
  let markVisitWithJoseph = null;
  doctors.forEach((d, i) => {
    const n = 2 + (i % 3);
    for (let j = 0; j < n; j++) {
      const type = d.doctor.offersVideo && j % 2 ? 'video' : 'home';
      const patient = patients[(i + j) % patients.length];
      const id = addAppointment({
        patient, doctor: d, type, status: 'completed', when: daysAgo(5 + i * 3 + j * 7, 9 + j),
        symptoms: d.doctor.specialty === 'physio' ? 'Lower back pain after lifting, hard to bend.' : 'Fever and sore throat for three days.',
        report: d.doctor.specialty === 'physio'
          ? { diagnosis: 'Lumbar muscle strain', notes: 'Reduced range of motion, no neurological signs.', prescription: 'Heat pack 15 min twice daily. Exercise sheet given.', followUp: 'Video check in 1 week.' }
          : { diagnosis: 'Acute pharyngitis', notes: 'Temperature 38.2°C, red throat, no breathing difficulty.', prescription: 'Paracetamol 1 g up to 3 times a day for 5 days. Drink plenty of fluids.', followUp: 'Contact again if fever lasts more than 3 days.' },
        review: REVIEW_TEXT[k++ % REVIEW_TEXT.length],
      });
      if (i === 1 && patient === users.mark) markVisitWithJoseph = id;
    }
  });

  // Live requests for the demo doctor (Dr Maria Camilleri) so the queue isn't empty.
  addAppointment({ patient: users.carmen, doctor: doctors[0], type: 'home', status: 'pending', mode: 'nearest', when: new Date(Date.now() - 6 * 60000).toISOString(), symptoms: 'Swollen ankle since yesterday, can\'t walk to the clinic. Takes blood pressure medication.' });
  addAppointment({ patient: users.liam, doctor: doctors[0], type: 'video', status: 'pending', when: new Date(Date.now() - 3 * 60000).toISOString(), symptoms: 'Stomach upset and nausea since last night, staying at a hotel.' });

  // Open report for the admin to moderate.
  ops.push([col.flags.doc(), {
    reporterId: doctors[1].id, reporterName: doctors[1].name, reporterRole: 'doctor',
    targetId: users.mark.id, targetName: users.mark.name, targetRole: 'patient',
    appointmentId: markVisitWithJoseph, reason: 'No-show', details: 'Nobody answered the door or the phone. Second time this month.',
    status: 'open', resolution: null, createdAt: daysAgo(2),
  }]);

  for (const d of doctors) {
    const { id, ...data } = d;
    ops.push([col.users.doc(id), data]);
  }
  ops.push([col.meta.doc('helloDoctor'), { seededAt: new Date().toISOString(), version: 1 }]);
  await writeAll(ops);
}

/** Give each approved doctor bookable slots for the next 7 days if they have none. */
export async function ensureSlots() {
  const now = new Date();
  const doctors = docs(await col.users.where('role', '==', 'doctor').get()).filter((u) => u.idStatus === 'verified');
  const future = docs(await col.slots.where('startAt', '>', now.toISOString()).get());
  const withSlots = new Set(future.map((s) => s.doctorId));
  const ops = [];
  for (const [n, { id }] of doctors.entries()) {
    if (withSlots.has(id)) continue;
    for (let day = 0; day < 7; day++) {
      for (const hour of [9, 11, 14, 16, 18]) {
        if ((n + day + hour) % 4 === 0) continue; // some gaps so calendars look real
        const t = new Date(now);
        t.setDate(t.getDate() + day);
        t.setHours(hour, 0, 0, 0);
        if (t <= now) continue;
        const startAt = t.toISOString();
        ops.push([col.slots.doc(slotId(id, startAt)), { doctorId: id, startAt, booked: false }]);
      }
    }
  }
  if (ops.length) await writeAll(ops);
}

export const slotId = (doctorId, startAt) => `${doctorId}_${startAt.replace(/[^0-9]/g, '').slice(0, 12)}`;

export async function ensureSeed() {
  const meta = await col.meta.doc('helloDoctor').get();
  if (!meta.exists) {
    console.log('Creating demo data in Firebase (first start, takes a few seconds)…');
    await seed();
    console.log('Demo data created.');
  }
  await ensureSlots();
}
