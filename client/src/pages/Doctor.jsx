import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import {
  ErrorText, Loading, LocalitySelect, MaltaMap, Notice, StatusBadge, SPECIALTY, VISIT,
  euro, fmtDate, fmtDateTime, fmtTime, timeAgo, useLoad, live,
} from '../components.jsx';
import { FlagForm, Timeline, useTracking } from './Patient.jsx';

function OnlineToggle() {
  const { user, setUser } = useAuth();
  const [error, setError] = useState(null);
  const online = user.profile?.online;
  const toggle = async () => {
    setError(null);
    try {
      const { user: u } = await api('/doctor/profile', { method: 'PATCH', body: { online: !online } });
      setUser(u);
    } catch (e) { setError(e); }
  };
  return (
    <div className={`online-toggle${online ? ' on' : ''}`}>
      <button type="button" role="switch" aria-checked={!!online} onClick={toggle}>
        <span className="knob" aria-hidden="true" />
        <span>{online ? 'You are online' : 'You are offline'}</span>
      </button>
      <p className="hint">{online ? 'Patients can request you now and you appear in "nearest doctor".' : 'Patients can only book your time slots.'}</p>
      <ErrorText error={error} />
    </div>
  );
}

function PatientTags({ p }) {
  return (
    <span className="tags">
      {p.age != null && <span className={`tag${p.age >= 75 ? ' prio' : ''}`}>{p.age} years old</span>}
      {p.reducedMobility && <span className="tag prio">Reduced mobility</span>}
      {p.isTourist && <span className="tag">Visitor</span>}
      {p.idStatus !== 'verified' && <span className="tag warn">ID check pending</span>}
    </span>
  );
}

export function DoctorDesk() {
  const { user } = useAuth();
  const { data, error, reload } = useLoad(() => api('/appointments'), [user.id], 5000, () => live.myVisits(user));
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const list = data?.appointments || [];
  const requests = list.filter((a) => a.status === 'pending').sort((a, b) => b.priority - a.priority || new Date(a.createdAt) - new Date(b.createdAt));
  const active = list.filter((a) => ['accepted', 'en_route', 'in_progress'].includes(a.status));
  const done = list.filter((a) => a.status === 'completed').slice(0, 8);

  const act = async (id, status) => {
    setBusyId(id); setActionError(null);
    try { await api(`/appointments/${id}/status`, { method: 'POST', body: { status } }); await reload(); } catch (e) { setActionError(e); }
    setBusyId(null);
  };

  return (
    <div className="page">
      <h1 className="page-title">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user.name.replace(/^Dr\s+/, 'Dr ').split(' ').slice(0, 2).join(' ')}.</h1>
      {user.idStatus !== 'verified' && (
        <Notice tone="warn">Your account is waiting for an administrator to check your ID and Medical Council number. You'll receive requests once it's approved.</Notice>
      )}
      <OnlineToggle />
      <ErrorText error={error || actionError} />

      <section className="block">
        <h2>New requests {requests.length > 0 && <span className="count">{requests.length}</span>}</h2>
        <p className="hint">Older patients and people with reduced mobility are listed first.</p>
        {!data && <Loading />}
        {data && requests.length === 0 && <p className="empty-line">No new requests. They appear here automatically.</p>}
        <div className="request-list">
          {requests.map((a) => (
            <article key={a.id} className={`request${a.priority >= 4 ? ' high' : ''}`}>
              <header>
                <div>
                  <h3>{a.patient.name}</h3>
                  <PatientTags p={a.patient} />
                </div>
                <span className="req-when">{a.asap ? `ASAP, sent ${timeAgo(a.createdAt)}` : fmtDateTime(a.scheduledAt)}</span>
              </header>
              <p className="req-type"><strong>{VISIT[a.visitType]}</strong>{a.address ? ` at ${a.address}` : ''}{a.visitType === 'home' && a.etaMinutes ? `, about ${a.etaMinutes} min drive` : ''}</p>
              <p className="req-symptoms">“{a.symptoms}”</p>
              <div className="req-actions">
                <span className="req-price">You earn {euro(a.price.base)}</span>
                <button className="btn secondary" disabled={busyId === a.id} onClick={() => act(a.id, 'declined')}>Decline</button>
                <button className="btn primary" disabled={busyId === a.id} onClick={() => act(a.id, 'accepted')}>Accept</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {active.length > 0 && (
        <section className="block">
          <h2>Your active visits</h2>
          <div className="visit-list">
            {active.map((a) => (
              <Link key={a.id} to={`/doctor/visits/${a.id}`} className={`visit-row st-${a.status}`}>
                <span className="vr-when"><strong>{a.asap ? 'Now' : fmtTime(a.scheduledAt)}</strong><span>{a.asap ? 'ASAP' : fmtDate(a.scheduledAt)}</span></span>
                <span className="vr-main"><strong>{a.patient.name}</strong><span>{VISIT[a.visitType]}{a.address ? `, ${a.address}` : ''}</span></span>
                <span className="vr-side"><StatusBadge status={a.status} doctorView /></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section className="block">
          <h2>Recently completed</h2>
          <div className="visit-list">
            {done.map((a) => (
              <Link key={a.id} to={`/doctor/visits/${a.id}`} className="visit-row st-completed">
                <span className="vr-when"><strong>{fmtDate(a.completedAt || a.scheduledAt)}</strong></span>
                <span className="vr-main"><strong>{a.patient.name}</strong><span>{VISIT[a.visitType]}</span></span>
                <span className="vr-side"><span className="vr-price">{euro(a.price.base)}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function DoctorVisit() {
  const { id } = useParams();
  const { data, error, reload } = useLoad(() => api('/appointments/' + id), [id], 5000, () => live.visit(id));
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const track = useTracking(data?.appointment);

  if (error && !data) return <div className="page"><ErrorText error={error} /></div>;
  if (!data) return <div className="page"><Loading /></div>;
  const { appointment: a, report, review, myFlag, doctorSpecialty } = data;

  const act = async (status) => {
    setBusy(true); setActionError(null);
    try { await api(`/appointments/${a.id}/status`, { method: 'POST', body: { status } }); await reload(); } catch (e) { setActionError(e); }
    setBusy(false);
  };

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`;

  return (
    <div className="page">
      <Link to="/doctor" className="back">Requests</Link>
      <header className="visit-head">
        <div>
          <h1 className="page-title">{a.patient.name}</h1>
          <PatientTags p={a.patient} />
        </div>
        <StatusBadge status={a.status} doctorView />
      </header>
      <Timeline a={a} />

      <section className="block">
        <h2>{VISIT[a.visitType]}</h2>
        <dl className="kv">
          <dt>When</dt><dd>{a.asap ? `As soon as possible (requested ${timeAgo(a.createdAt)})` : fmtDateTime(a.scheduledAt)}</dd>
          <dt>Symptoms</dt><dd>{a.symptoms}</dd>
          {a.address && <><dt>Address</dt><dd>{a.address}</dd></>}
          {a.patient.phone && <><dt>Phone</dt><dd><a href={`tel:${a.patient.phone.replace(/\s/g, '')}`}>{a.patient.phone}</a></dd></>}
          <dt>Your fee</dt><dd>{euro(a.price.base)}</dd>
        </dl>
      </section>

      {a.visitType === 'home' && !['completed', 'declined', 'cancelled'].includes(a.status) && (
        <section className="tracking">
          <div className="tracking-info">
            {a.status === 'en_route' && track ? <p className="big-line"><strong>{track.left} min</strong> to arrival</p> : <p className="big-line">About {a.etaMinutes} min drive</p>}
            <a className="btn secondary sm" href={mapsUrl} target="_blank" rel="noreferrer">Open directions</a>
          </div>
          <MaltaMap
            zoom
            className="small"
            pins={a.status === 'en_route' ? [] : [{ id: a.doctor.id, lat: a.doctor.lat, lng: a.doctor.lng, specialty: doctorSpecialty, online: true, label: 'You' }]}
            home={{ lat: a.lat, lng: a.lng }}
            route={a.status === 'en_route' && track ? { from: { lat: a.doctor.lat, lng: a.doctor.lng }, to: { lat: a.lat, lng: a.lng }, progress: track.progress } : null}
            label="Map showing your position and the patient's address"
          />
        </section>
      )}

      <div className="action-bar">
        {a.status === 'pending' && (
          <>
            <button className="btn secondary" disabled={busy} onClick={() => act('declined')}>Decline</button>
            <button className="btn primary lg" disabled={busy} onClick={() => act('accepted')}>Accept</button>
          </>
        )}
        {a.status === 'accepted' && a.visitType === 'home' && <button className="btn primary lg" disabled={busy} onClick={() => act('en_route')}>I'm on my way</button>}
        {a.status === 'accepted' && a.visitType === 'video' && (
          <a className="btn primary lg" href={a.videoUrl} target="_blank" rel="noreferrer" onClick={() => act('in_progress')}>Start the video call</a>
        )}
        {a.status === 'en_route' && <button className="btn primary lg" disabled={busy} onClick={() => act('in_progress')}>I've arrived</button>}
        {a.status === 'in_progress' && a.visitType === 'video' && <a className="btn secondary" href={a.videoUrl} target="_blank" rel="noreferrer">Rejoin the call</a>}
        {['accepted'].includes(a.status) && <button className="btn danger" disabled={busy} onClick={() => window.confirm('Cancel this visit? The patient is refunded.') && act('cancelled')}>Cancel visit</button>}
        <ErrorText error={actionError} />
      </div>

      {a.status === 'in_progress' && <ReportForm id={a.id} onDone={reload} />}

      {report && (
        <section className="block report">
          <h2>Report sent to the patient</h2>
          <dl className="report-body">
            <dt>Diagnosis</dt><dd>{report.diagnosis}</dd>
            {report.notes && <><dt>Notes</dt><dd>{report.notes}</dd></>}
            {report.followUp && <><dt>Follow-up</dt><dd>{report.followUp}</dd></>}
          </dl>
          {report.prescription && <div className="prescription"><h3>Prescription</h3><p>{report.prescription}</p></div>}
        </section>
      )}
      {review && <p className="hint">The patient rated this visit {review.rating}/5{review.comment ? `: “${review.comment}”` : '.'}</p>}

      <FlagForm appointmentId={a.id} otherName={a.patient.name} existing={myFlag} onDone={reload} />
    </div>
  );
}

function ReportForm({ id, onDone }) {
  const [f, setF] = useState({ diagnosis: '', notes: '', prescription: '', followUp: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api(`/appointments/${id}/report`, { method: 'POST', body: f }); onDone(); } catch (err) { setError(err); setBusy(false); }
  };
  return (
    <form className="block report-form" onSubmit={submit}>
      <h2>Consultation report</h2>
      <p className="hint">The patient receives this report as soon as you finish the visit.</p>
      <div className="field">
        <label htmlFor="r-diag">Diagnosis</label>
        <input id="r-diag" value={f.diagnosis} onChange={set('diagnosis')} required />
      </div>
      <div className="field">
        <label htmlFor="r-notes">Examination notes</label>
        <textarea id="r-notes" rows={3} value={f.notes} onChange={set('notes')} />
      </div>
      <div className="field">
        <label htmlFor="r-presc">Prescription</label>
        <textarea id="r-presc" rows={3} value={f.prescription} onChange={set('prescription')} placeholder="Medicine, dose, how often, for how long" />
      </div>
      <div className="field">
        <label htmlFor="r-follow">Follow-up advice</label>
        <input id="r-follow" value={f.followUp} onChange={set('followUp')} />
      </div>
      <ErrorText error={error} />
      <button className="btn primary lg" disabled={busy}>{busy ? 'Sending…' : 'Finish visit and send report'}</button>
    </form>
  );
}

export function Schedule() {
  const { user, setUser } = useAuth();
  const p = user.profile;
  const { data, reload } = useLoad(() => api('/doctor/slots'), []);
  const [slot, setSlot] = useState({ date: '', time: '09:00' });
  const [form, setForm] = useState({
    homeFee: p.homeFee, videoFee: p.videoFee, offersHome: p.offersHome, offersVideo: p.offersVideo,
    bio: p.bio || '', languages: p.languages.join(', '), locality: user.locality || '',
  });
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [slotError, setSlotError] = useState(null);

  const addSlot = async (e) => {
    e.preventDefault();
    setSlotError(null);
    try {
      await api('/doctor/slots', { method: 'POST', body: { startAt: new Date(`${slot.date}T${slot.time}`).toISOString() } });
      reload();
    } catch (err) { setSlotError(err); }
  };
  const removeSlot = async (id) => {
    try { await api('/doctor/slots/' + id, { method: 'DELETE' }); reload(); } catch (err) { setSlotError(err); }
  };
  const save = async (e) => {
    e.preventDefault();
    setError(null); setMsg(null);
    try {
      const { user: u } = await api('/doctor/profile', { method: 'PATCH', body: form });
      setUser(u);
      setMsg('Profile saved.');
    } catch (err) { setError(err); }
  };
  const set = (k) => (e) => setForm((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const byDay = new Map();
  for (const s of data?.slots || []) {
    const k = fmtDate(s.startAt);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(s);
  }

  return (
    <div className="page">
      <h1 className="page-title">Schedule</h1>
      <OnlineToggle />

      <section className="block">
        <h2>Bookable times</h2>
        <p className="hint">Patients can book these times even when you're offline.</p>
        <form className="slot-add" onSubmit={addSlot}>
          <div className="field">
            <label htmlFor="s-date">Date</label>
            <input id="s-date" type="date" required value={slot.date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setSlot((x) => ({ ...x, date: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="s-time">Time</label>
            <input id="s-time" type="time" required step="900" value={slot.time} onChange={(e) => setSlot((x) => ({ ...x, time: e.target.value }))} />
          </div>
          <button className="btn primary">Add time</button>
        </form>
        <ErrorText error={slotError} />
        {[...byDay.entries()].map(([day, list]) => (
          <div key={day} className="slot-day">
            <h3>{day}</h3>
            <div className="slot-chips">
              {list.map((s) => s.booked
                ? <span key={s.id} className="chip booked" title="Booked by a patient">{fmtTime(s.startAt)} booked</span>
                : (
                  <span key={s.id} className="chip removable">
                    {fmtTime(s.startAt)}
                    <button type="button" aria-label={`Remove ${day} ${fmtTime(s.startAt)}`} onClick={() => removeSlot(s.id)}>×</button>
                  </span>
                ))}
            </div>
          </div>
        ))}
      </section>

      <form className="block" onSubmit={save}>
        <h2>Your services</h2>
        <p className="hint">{SPECIALTY[p.specialty]}, Medical Council number {p.licenseNumber}</p>
        <div className="field-row">
          <label className="check"><input type="checkbox" checked={form.offersHome} onChange={set('offersHome')} /><span>Home visits</span></label>
          <div className="field narrow">
            <label htmlFor="fee-h">Home fee (€)</label>
            <input id="fee-h" type="number" min="0" max="500" value={form.homeFee} onChange={set('homeFee')} />
          </div>
        </div>
        <div className="field-row">
          <label className="check"><input type="checkbox" checked={form.offersVideo} onChange={set('offersVideo')} /><span>Video consultations</span></label>
          <div className="field narrow">
            <label htmlFor="fee-v">Video fee (€)</label>
            <input id="fee-v" type="number" min="0" max="500" value={form.videoFee} onChange={set('videoFee')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="d-loc">Where you are now</label>
          <LocalitySelect id="d-loc" value={form.locality} onChange={(v) => setForm((x) => ({ ...x, locality: v }))} />
          <p className="hint">Used to calculate arrival times for patients.</p>
        </div>
        <div className="field">
          <label htmlFor="d-lang">Languages</label>
          <input id="d-lang" value={form.languages} onChange={set('languages')} />
        </div>
        <div className="field">
          <label htmlFor="d-bio">About you</label>
          <textarea id="d-bio" rows={3} value={form.bio} onChange={set('bio')} />
        </div>
        <ErrorText error={error} />
        {msg && <p className="ok-text" role="status">{msg}</p>}
        <button className="btn primary">Save profile</button>
      </form>
    </div>
  );
}
