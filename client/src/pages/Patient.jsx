import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import {
  Avatar, ErrorText, Loading, LocalitySelect, MaltaMap, Notice, PaymentForm, PriceSummary, Stars, StatusBadge, Steps,
  SPECIALTY, SPECIALTY_SHORT, VISIT, euro, fmtDate, fmtDateTime, fmtTime, timeAgo, useLoad, useNow, live,
} from '../components.jsx';

const ACTIVE = ['pending', 'accepted', 'en_route', 'in_progress'];

// ---------- Home ----------

export function PatientHome() {
  const { user } = useAuth();
  const { data } = useLoad(() => api('/appointments'), [user.id], 15000, () => live.myVisits(user));
  const active = data?.appointments.filter((a) => ACTIVE.includes(a.status)) || [];
  const last = data?.appointments.find((a) => a.status === 'completed');

  return (
    <div className="page">
      <h1 className="page-title">Hello {user.name.split(' ')[0]}.</h1>
      <p className="page-lead">How would you like to see a doctor?</p>

      {user.idStatus === 'pending' && (
        <Notice tone="warn">Your passport is being checked by our team. You can already book; your doctor will see that the check is in progress.</Notice>
      )}
      {!user.address && (
        <Notice action={<Link className="btn secondary sm" to="/account">Add address</Link>}>Add your address so we can send the closest doctor.</Notice>
      )}

      <div className="mode-picker">
        <Link to="/app/book?mode=nearest" className="mode nearest">
          <span className="mode-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="6" /><circle cx="24" cy="24" r="14" fill="none" strokeWidth="3" /><circle cx="24" cy="24" r="21" fill="none" strokeWidth="2" opacity=".5" /></svg>
          </span>
          <span className="mode-title">Nearest available doctor</span>
          <span className="mode-text">We send the closest doctor who is free right now. Best if you don't have a regular doctor.</span>
        </Link>
        <Link to="/app/doctors" className="mode chosen">
          <span className="mode-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><circle cx="24" cy="17" r="8" /><path d="M8 42c2-9 8-13 16-13s14 4 16 13z" /></svg>
          </span>
          <span className="mode-title">Choose a specific doctor</span>
          <span className="mode-text">Compare ratings, experience and arrival time, or see the same doctor again.</span>
        </Link>
      </div>

      {active.length > 0 && (
        <section className="block">
          <h2>Happening now</h2>
          <div className="visit-list">{active.map((a) => <VisitRow key={a.id} a={a} />)}</div>
        </section>
      )}

      {last && (
        <section className="block">
          <h2>Your last visit</h2>
          <div className="visit-list"><VisitRow a={last} /></div>
          <Link className="text-link" to={`/app/book?doctor=${last.doctor.id}`}>Book {last.doctor.name} again</Link>
        </section>
      )}
    </div>
  );
}

function VisitRow({ a }) {
  return (
    <Link to={`/app/visits/${a.id}`} className={`visit-row st-${a.status}`}>
      <span className="vr-when">
        <strong>{fmtDate(a.scheduledAt)}</strong>
        <span>{a.asap ? 'As soon as possible' : fmtTime(a.scheduledAt)}</span>
      </span>
      <span className="vr-main">
        <strong>{a.doctor.name}</strong>
        <span>{VISIT[a.visitType]}, {SPECIALTY_SHORT[a.specialty]}</span>
      </span>
      <span className="vr-side">
        <StatusBadge status={a.status} />
        <span className="vr-price">{euro(a.price.total)}</span>
      </span>
    </Link>
  );
}

// ---------- Doctor search ----------

export function Doctors() {
  const [filters, setFilters] = useState({ specialty: '', type: '', sort: 'recommended', online: false, q: '' });
  const [selected, setSelected] = useState(null);
  const qs = new URLSearchParams({ ...filters, online: filters.online ? '1' : '' }).toString();
  const { data, error, loading } = useLoad(() => api('/doctors?' + qs), [qs], 15000);
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const doctors = data?.doctors || [];

  useEffect(() => {
    if (selected) document.getElementById(`doc-${selected}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selected]);

  return (
    <div className="page wide">
      <h1 className="page-title">Choose a doctor</h1>
      <form className="filters" onSubmit={(e) => e.preventDefault()} aria-label="Filter doctors">
        <div className="field">
          <label htmlFor="f-q">Name</label>
          <input id="f-q" type="search" value={filters.q} onChange={set('q')} placeholder="Search by name" />
        </div>
        <div className="field">
          <label htmlFor="f-sp">Specialty</label>
          <select id="f-sp" value={filters.specialty} onChange={set('specialty')}>
            <option value="">All</option><option value="gp">GP</option><option value="physio">Physiotherapist</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-type">Visit</label>
          <select id="f-type" value={filters.type} onChange={set('type')}>
            <option value="">Home or video</option><option value="home">Home visit</option><option value="video">Video</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-sort">Sort by</label>
          <select id="f-sort" value={filters.sort} onChange={set('sort')}>
            <option value="recommended">Recommended</option>
            <option value="eta">Arrival time</option>
            <option value="rating">Rating</option>
            <option value="experience">Experience</option>
            <option value="price">Price</option>
          </select>
        </div>
        <label className="check inline">
          <input type="checkbox" checked={filters.online} onChange={set('online')} />
          <span>Available now</span>
        </label>
      </form>

      <div className="doctors-layout">
        <div className="doctor-list" aria-live="polite">
          <ErrorText error={error} />
          {loading && !data && <Loading />}
          {data && doctors.length === 0 && (
            <div className="empty">
              <p>No doctor matches these filters.</p>
              <button className="btn secondary" onClick={() => setFilters({ specialty: '', type: '', sort: 'recommended', online: false, q: '' })}>Clear filters</button>
            </div>
          )}
          {doctors.map((d) => <DoctorCard key={d.id} d={d} selected={selected === d.id} />)}
        </div>
        <aside className="doctors-map" aria-label="Doctors on the map">
          <MaltaMap
            pins={doctors.map((d) => ({ ...d, label: `${d.name}, ${d.locality}${d.online ? ', available' : ', offline'}` }))}
            selectedId={selected}
            onSelect={setSelected}
          />
          <p className="hint">Select a pin to find that doctor in the list.</p>
        </aside>
      </div>
    </div>
  );
}

function DoctorCard({ d, selected }) {
  return (
    <article id={`doc-${d.id}`} className={`doctor-card${selected ? ' selected' : ''}${d.online ? '' : ' offline'}`}>
      <Avatar name={d.name} specialty={d.specialty} />
      <div className="dc-body">
        <h2><Link to={`/app/doctors/${d.id}`}>{d.name}</Link></h2>
        <p className="dc-sub">{SPECIALTY[d.specialty]} in {d.locality}</p>
        <Stars value={d.rating} count={d.reviewCount} size="sm" />
        <ul className="dc-facts">
          <li><strong>{d.yearsExperience}</strong> years</li>
          <li><strong>{d.consultations.toLocaleString('en-GB')}</strong> consultations</li>
          {d.offersHome && <li>Home <strong>{euro(d.homeFee)}</strong></li>}
          {d.offersVideo && <li>Video <strong>{euro(d.videoFee)}</strong></li>}
        </ul>
      </div>
      <div className="dc-side">
        {d.online ? (
          d.busy ? <span className="avail busy">On a visit</span> : <span className="avail on">Available{d.offersHome && d.etaMinutes ? `, ~${d.etaMinutes} min away` : ''}</span>
        ) : <span className="avail off">Offline, book a time</span>}
        <Link className="btn primary sm" to={`/app/book?doctor=${d.id}`}>Book</Link>
      </div>
    </article>
  );
}

export function DoctorDetail() {
  const { id } = useParams();
  const { data, error } = useLoad(() => api('/doctors/' + id), [id]);
  if (error) return <div className="page"><ErrorText error={error} /><Link to="/app/doctors">Back to doctors</Link></div>;
  if (!data) return <div className="page"><Loading /></div>;
  const { doctor: d, reviews, slots, seenBefore } = data;
  const byDay = groupSlots(slots);

  return (
    <div className="page">
      <Link to="/app/doctors" className="back">All doctors</Link>
      <header className="profile-head">
        <Avatar name={d.name} specialty={d.specialty} size={84} />
        <div>
          <h1 className="page-title">{d.name}</h1>
          <p className="dc-sub">{SPECIALTY[d.specialty]} based in {d.locality}</p>
          <Stars value={d.rating} count={d.reviewCount} />
          {seenBefore > 0 && <p className="seen-before">You've seen {d.name.replace('Dr ', 'Dr ')} {seenBefore === 1 ? 'once' : `${seenBefore} times`} before.</p>}
        </div>
      </header>

      <dl className="stat-row">
        <div><dt>Arrival time</dt><dd>{d.online && d.offersHome ? `~${d.etaMinutes} min` : '—'}</dd></div>
        <div><dt>Consultations</dt><dd>{d.consultations.toLocaleString('en-GB')}</dd></div>
        <div><dt>Practising</dt><dd>{d.yearsExperience} yrs</dd></div>
        <div><dt>Distance</dt><dd>{d.distanceKm} km</dd></div>
      </dl>

      <div className="two-col">
        <section className="block">
          <h2>About</h2>
          <p>{d.bio}</p>
          <p><strong>Speaks:</strong> {d.languages.join(', ')}</p>
          <ul className="fee-list">
            {d.offersHome && <li><span>Home visit</span><strong>{euro(d.homeFee)}</strong></li>}
            {d.offersVideo && <li><span>Video consultation</span><strong>{euro(d.videoFee)}</strong></li>}
          </ul>
          <Link className="btn primary lg block" to={`/app/book?doctor=${d.id}`}>{d.online ? 'Book now' : 'Book a time'}</Link>
        </section>

        <section className="block">
          <h2>Next free times</h2>
          {slots.length === 0 && <p>No free times this week.</p>}
          {byDay.slice(0, 4).map(([day, list]) => (
            <div key={day} className="slot-day">
              <h3>{day}</h3>
              <div className="slot-chips">
                {list.map((s) => <Link key={s.id} className="chip" to={`/app/book?doctor=${d.id}&slot=${s.id}`}>{fmtTime(s.startAt)}</Link>)}
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="block">
        <h2>What patients say</h2>
        {reviews.length === 0 && <p>No reviews yet.</p>}
        <ul className="reviews">
          {reviews.map((r, i) => (
            <li key={i}>
              <Stars value={r.rating} size="sm" />
              {r.comment && <p>“{r.comment}”</p>}
              <span className="hint">{r.author}, {fmtDate(r.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function groupSlots(slots) {
  const map = new Map();
  for (const s of slots) {
    const k = fmtDate(s.startAt);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(s);
  }
  return [...map.entries()];
}

// ---------- Booking flow ----------

export function Book() {
  const { user, plan } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get('mode') === 'nearest' ? 'nearest' : 'chosen';
  const doctorParam = params.get('doctor');
  const slotParam = params.get('slot');

  const [step, setStep] = useState(0);
  const [doctor, setDoctor] = useState(null);
  const [slots, setSlots] = useState([]);
  const [f, setF] = useState({
    specialty: 'gp', visitType: 'home', when: slotParam ? 'slot' : 'asap', slotId: slotParam || '',
    symptoms: '', locality: user.locality || '', address: user.address || '',
  });
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'chosen' || !doctorParam) return;
    api('/doctors/' + doctorParam).then((d) => {
      setDoctor(d.doctor);
      setSlots(d.slots);
      setF((x) => ({
        ...x,
        specialty: d.doctor.specialty,
        visitType: d.doctor.offersHome ? 'home' : 'video',
        when: slotParam ? 'slot' : d.doctor.online ? 'asap' : 'slot',
      }));
    }).catch(setError);
  }, [mode, doctorParam, slotParam]);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  if (mode === 'chosen' && !doctorParam) return <Navigate to="/app/doctors" replace />;

  const steps = mode === 'nearest' ? ['Visit', 'Your doctor', 'Details', 'Payment'] : ['Visit', 'Time', 'Details', 'Payment'];
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const goNext = async () => {
    setError(null);
    if (step === 0 && mode === 'nearest') {
      setBusy(true);
      try {
        const { doctor: match } = await api(`/match?specialty=${f.specialty}&type=${f.visitType}`);
        setDoctor(match);
        setStep(1);
      } catch (e) { setError(e); }
      setBusy(false);
      return;
    }
    if (step === 1 && mode === 'chosen' && f.when === 'slot' && !f.slotId) { setError(new Error('Choose a time.')); return; }
    if (step === 2) {
      if (f.symptoms.trim().length < 5) { setError(new Error('Describe your symptoms in a few words so the doctor can prepare.')); return; }
      if (f.visitType === 'home' && (!f.locality || f.address.trim().length < 3)) { setError(new Error('Enter the address where the doctor should come.')); return; }
      setBusy(true);
      try {
        const q = await api('/quote', { method: 'POST', body: { doctorId: doctor.id, visitType: f.visitType } });
        setQuote(q.quote);
        setStep(3);
      } catch (e) { setError(e); }
      setBusy(false);
      return;
    }
    setStep((s) => s + 1);
  };

  const pay = async (card) => {
    setBusy(true); setError(null);
    try {
      const { appointment } = await api('/appointments', {
        method: 'POST',
        body: {
          doctorId: doctor.id, visitType: f.visitType, matchMode: mode,
          slotId: mode === 'chosen' && f.when === 'slot' ? f.slotId : null,
          symptoms: f.symptoms, locality: f.locality, address: f.address, card,
        },
      });
      nav(`/app/visits/${appointment.id}`, { replace: true, state: { justBooked: true } });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  const chosenSlot = slots.find((s) => String(s.id) === String(f.slotId));

  return (
    <div className="page narrow">
      <h1 className="page-title">{mode === 'nearest' ? 'Get the nearest doctor' : doctor ? `Book ${doctor.name}` : 'Book a doctor'}</h1>
      <Steps steps={steps} current={step} />

      <div className="book-panel">
        {step === 0 && (
          <>
            <fieldset className="choice-group" disabled={mode === 'chosen'}>
              <legend>Who do you need?</legend>
              {['gp', 'physio'].map((s) => (
                <label key={s} className={`choice${f.specialty === s ? ' on' : ''}`}>
                  <input type="radio" name="specialty" value={s} checked={f.specialty === s} onChange={() => set('specialty', s)} />
                  <span className="choice-title">{SPECIALTY[s]}</span>
                  <span className="choice-text">{s === 'gp' ? 'Fever, infections, pain, check-ups, prescriptions.' : 'Back pain, injuries, rehabilitation, mobility.'}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="choice-group">
              <legend>How?</legend>
              {['home', 'video'].map((t) => {
                const unavailable = doctor && mode === 'chosen' && (t === 'home' ? !doctor.offersHome : !doctor.offersVideo);
                return (
                  <label key={t} className={`choice${f.visitType === t ? ' on' : ''}${unavailable ? ' disabled' : ''}`}>
                    <input type="radio" name="visitType" value={t} checked={f.visitType === t} disabled={unavailable} onChange={() => set('visitType', t)} />
                    <span className="choice-title">{VISIT[t]}{doctor && mode === 'chosen' && !unavailable ? `, ${euro(t === 'home' ? doctor.homeFee : doctor.videoFee)}` : ''}</span>
                    <span className="choice-text">
                      {unavailable ? `${doctor.name} doesn't offer this.` : t === 'home' ? 'The doctor comes to your home or hotel.' : 'Talk to the doctor from your phone or computer.'}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </>
        )}

        {step === 1 && mode === 'nearest' && doctor && (
          <div className="match">
            <p className="match-intro">{f.visitType === 'home' ? 'The closest free doctor is' : 'A free doctor can see you now:'}</p>
            <div className="match-card">
              <Avatar name={doctor.name} specialty={doctor.specialty} size={72} />
              <div>
                <h2>{doctor.name}</h2>
                <p className="dc-sub">{SPECIALTY[doctor.specialty]} in {doctor.locality}</p>
                <Stars value={doctor.rating} count={doctor.reviewCount} size="sm" />
              </div>
              {f.visitType === 'home' && <p className="match-eta"><strong>~{doctor.etaMinutes} min</strong><span>{doctor.distanceKm} km away</span></p>}
            </div>
            {f.visitType === 'home' && user.lat != null && (
              <MaltaMap pins={[{ ...doctor, label: doctor.name }]} home={{ lat: user.lat, lng: user.lng }} className="small" zoom />
            )}
            <p className="hint">The doctor confirms your request after you pay. If they decline, you get a full refund.</p>
          </div>
        )}

        {step === 1 && mode === 'chosen' && doctor && (
          <fieldset className="choice-group">
            <legend>When?</legend>
            <label className={`choice${f.when === 'asap' ? ' on' : ''}${doctor.online ? '' : ' disabled'}`}>
              <input type="radio" name="when" checked={f.when === 'asap'} disabled={!doctor.online} onChange={() => set('when', 'asap')} />
              <span className="choice-title">As soon as possible</span>
              <span className="choice-text">
                {doctor.online ? (f.visitType === 'home' ? `${doctor.name} could be with you in about ${doctor.etaMinutes} minutes.` : `${doctor.name} is online now.`) : `${doctor.name} is offline. Choose a time below.`}
              </span>
            </label>
            <label className={`choice${f.when === 'slot' ? ' on' : ''}`}>
              <input type="radio" name="when" checked={f.when === 'slot'} onChange={() => set('when', 'slot')} />
              <span className="choice-title">At a set time</span>
              <span className="choice-text">{chosenSlot ? fmtDateTime(chosenSlot.startAt) : 'Pick one of the free times.'}</span>
            </label>
            {f.when === 'slot' && (
              <div className="slot-picker">
                {slots.length === 0 && <p>No free times this week. Try another doctor.</p>}
                {groupSlots(slots).map(([day, list]) => (
                  <div key={day} className="slot-day">
                    <h3>{day}</h3>
                    <div className="slot-chips" role="radiogroup" aria-label={day}>
                      {list.map((s) => (
                        <button type="button" key={s.id} role="radio" aria-checked={String(f.slotId) === String(s.id)}
                          className={`chip${String(f.slotId) === String(s.id) ? ' on' : ''}`} onClick={() => set('slotId', s.id)}>
                          {fmtTime(s.startAt)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </fieldset>
        )}

        {step === 2 && (
          <div className="details-step">
            <div className="field">
              <label htmlFor="symptoms">What's wrong?</label>
              <textarea id="symptoms" rows={4} value={f.symptoms} onChange={(e) => set('symptoms', e.target.value)}
                placeholder="For example: high fever since yesterday, sore throat, I take blood pressure medication." aria-describedby="sym-hint" />
              <p className="hint" id="sym-hint">Only your doctor sees this.</p>
            </div>
            {f.visitType === 'home' ? (
              <>
                <div className="field">
                  <label htmlFor="b-loc">Locality</label>
                  <LocalitySelect id="b-loc" value={f.locality} onChange={(v) => set('locality', v)} required />
                </div>
                <div className="field">
                  <label htmlFor="b-addr">Street address, hotel or apartment</label>
                  <input id="b-addr" value={f.address} onChange={(e) => set('address', e.target.value)} autoComplete="street-address" />
                </div>
              </>
            ) : (
              <Notice>You'll get a video link once the doctor accepts. It works in your browser, no app to install.</Notice>
            )}
            {(user.age >= 65 || user.reducedMobility) && (
              <p className="hint priority-hint">Your profile gives you priority: doctors see your request near the top of their list.</p>
            )}
          </div>
        )}

        {step === 3 && doctor && (
          <div className="pay-step">
            <div className="recap">
              <p><strong>{VISIT[f.visitType]}</strong> with {doctor.name}</p>
              <p>{mode === 'chosen' && f.when === 'slot' && chosenSlot ? fmtDateTime(chosenSlot.startAt) : 'As soon as possible'}</p>
              {f.visitType === 'home' && <p>{f.address}, {f.locality}</p>}
            </div>
            <PriceSummary quote={quote} />
            {!plan && quote?.serviceFee > 0 && (
              <p className="hint">With a <Link to="/app/plans">Care plan</Link> you'd pay no booking fee and get a discount.</p>
            )}
            <ErrorText error={error} />
            <PaymentForm cta={`Pay ${euro(quote?.total)} and book`} onPay={pay} busy={busy} />
          </div>
        )}

        {step < 3 && (
          <>
            <ErrorText error={error} />
            <div className="book-actions">
              {step > 0 && <button type="button" className="btn secondary" onClick={() => { setError(null); setStep((s) => s - 1); }}>Back</button>}
              <button type="button" className="btn primary lg" onClick={goNext} disabled={busy || (mode === 'chosen' && !doctor)}>
                {busy ? 'Please wait…' : step === 0 && mode === 'nearest' ? 'Find a doctor' : step === 1 && mode === 'nearest' ? `Continue with ${doctor?.name}` : 'Continue'}
              </button>
            </div>
          </>
        )}
        {step === 3 && <button type="button" className="btn secondary" onClick={() => setStep(2)}>Back</button>}
      </div>
    </div>
  );
}

// ---------- Visits ----------

export function Visits() {
  const { user } = useAuth();
  const { data, error } = useLoad(() => api('/appointments'), [user.id], 15000, () => live.myVisits(user));
  const [tab, setTab] = useState('current');
  const list = data?.appointments || [];
  const current = list.filter((a) => ACTIVE.includes(a.status));
  const past = list.filter((a) => !ACTIVE.includes(a.status));
  const shown = tab === 'current' ? current : past;

  return (
    <div className="page">
      <h1 className="page-title">My visits</h1>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'current'} onClick={() => setTab('current')}>Current ({current.length})</button>
        <button role="tab" aria-selected={tab === 'past'} onClick={() => setTab('past')}>Past ({past.length})</button>
      </div>
      <ErrorText error={error} />
      {!data && !error && <Loading />}
      {data && shown.length === 0 && (
        <div className="empty">
          <p>{tab === 'current' ? 'No visit planned.' : 'No past visits yet.'}</p>
          <Link className="btn primary" to="/app">Book a doctor</Link>
        </div>
      )}
      <div className="visit-list">{shown.map((a) => <VisitRow key={a.id} a={a} />)}</div>
    </div>
  );
}

const TIMELINE = {
  home: [['pending', 'Requested'], ['accepted', 'Accepted'], ['en_route', 'On the way'], ['in_progress', 'With you'], ['completed', 'Report ready']],
  video: [['pending', 'Requested'], ['accepted', 'Accepted'], ['in_progress', 'In the call'], ['completed', 'Report ready']],
};

export function Timeline({ a }) {
  const steps = TIMELINE[a.visitType];
  const idx = steps.findIndex(([s]) => s === a.status);
  if (a.status === 'declined' || a.status === 'cancelled') return null;
  return (
    <ol className="timeline">
      {steps.map(([s, label], i) => (
        <li key={s} className={i < idx ? 'done' : i === idx ? 'current' : ''}>{label}</li>
      ))}
    </ol>
  );
}

export function useTracking(a) {
  const now = useNow(1000);
  if (!a || a.status !== 'en_route' || !a.enRouteAt || !a.etaMinutes) return null;
  const elapsed = (now - new Date(a.enRouteAt)) / 60000;
  const progress = Math.min(0.97, elapsed / a.etaMinutes);
  const left = Math.max(1, Math.ceil(a.etaMinutes - elapsed));
  return { progress, left, arrival: new Date(new Date(a.enRouteAt).getTime() + a.etaMinutes * 60000).toISOString() };
}

export function VisitDetail() {
  const { id } = useParams();
  const { data, error, reload } = useLoad(() => api('/appointments/' + id), [id], 4000, () => live.visit(id));
  const [actionError, setActionError] = useState(null);
  const track = useTracking(data?.appointment);

  if (error && !data) return <div className="page"><ErrorText error={error} /></div>;
  if (!data) return <div className="page"><Loading /></div>;
  const { appointment: a, report, review, payment, myFlag, doctorSpecialty } = data;

  const cancel = async () => {
    if (!window.confirm('Cancel this visit? You will be refunded in full.')) return;
    try { await api(`/appointments/${a.id}/status`, { method: 'POST', body: { status: 'cancelled' } }); reload(); } catch (e) { setActionError(e); }
  };

  return (
    <div className="page">
      <Link to="/app/visits" className="back">My visits</Link>
      <header className="visit-head">
        <div>
          <h1 className="page-title">{VISIT[a.visitType]} with {a.doctor.name}</h1>
          <p className="page-lead">{a.asap ? `Requested ${timeAgo(a.createdAt)}` : fmtDateTime(a.scheduledAt)}</p>
        </div>
        <StatusBadge status={a.status} />
      </header>

      <Timeline a={a} />

      {a.status === 'pending' && <Notice>We've sent your request to {a.doctor.name}. You'll see here when they accept, usually within a few minutes.</Notice>}
      {a.status === 'declined' && (
        <Notice tone="warn" action={<Link className="btn primary sm" to="/app/book?mode=nearest">Find another doctor</Link>}>
          {a.doctor.name} can't take this visit. Your payment of {euro(a.price.total)} has been refunded.
        </Notice>
      )}
      {a.status === 'cancelled' && <Notice tone="warn">This visit was cancelled. Your payment has been refunded.</Notice>}

      {a.visitType === 'home' && ['accepted', 'en_route', 'in_progress'].includes(a.status) && (
        <section className="tracking">
          <div className="tracking-info">
            {a.status === 'accepted' && <p className="big-line">{a.doctor.name} accepted. They'll set off soon.</p>}
            {a.status === 'en_route' && track && (
              <>
                <p className="big-line"><strong>{track.left} min</strong> away</p>
                <p>Expected around {fmtTime(track.arrival)} at {a.address}</p>
              </>
            )}
            {a.status === 'in_progress' && <p className="big-line">{a.doctor.name} is with you.</p>}
            {a.doctor.phone && <a className="btn secondary sm" href={`tel:${a.doctor.phone.replace(/\s/g, '')}`}>Call the doctor</a>}
          </div>
          <MaltaMap
            zoom
            className="small"
            pins={a.status === 'en_route' ? [] : [{ id: a.doctor.id, lat: a.doctor.lat, lng: a.doctor.lng, specialty: doctorSpecialty, online: true, label: a.doctor.name }]}
            home={{ lat: a.lat, lng: a.lng }}
            route={a.status === 'en_route' && track ? { from: { lat: a.doctor.lat, lng: a.doctor.lng }, to: { lat: a.lat, lng: a.lng }, progress: track.progress } : null}
            label="Map showing the doctor's position and your address"
          />
        </section>
      )}

      {a.visitType === 'video' && ['accepted', 'in_progress'].includes(a.status) && a.videoUrl && (
        <section className="block video-box">
          <h2>{a.status === 'in_progress' ? 'Your doctor is in the call' : 'Your video room is ready'}</h2>
          <p>Join from this device. Allow camera and microphone when your browser asks.</p>
          <a className="btn primary lg" href={a.videoUrl} target="_blank" rel="noreferrer">Join the video call</a>
        </section>
      )}

      {report && (
        <section className="block report" aria-labelledby="report-title">
          <div className="report-head">
            <h2 id="report-title">Medical report</h2>
            <button className="btn secondary sm no-print" onClick={() => window.print()}>Print or save as PDF</button>
          </div>
          <p className="hint">Written by {a.doctor.name} on {fmtDateTime(report.createdAt)}</p>
          <dl className="report-body">
            <dt>Diagnosis</dt><dd>{report.diagnosis}</dd>
            {report.notes && <><dt>Notes</dt><dd>{report.notes}</dd></>}
            {report.followUp && <><dt>Follow-up</dt><dd>{report.followUp}</dd></>}
          </dl>
          {report.prescription && (
            <div className="prescription">
              <h3>Prescription</h3>
              <p>{report.prescription}</p>
              <p className="hint">Show this prescription at any pharmacy in Malta.</p>
            </div>
          )}
        </section>
      )}

      {a.status === 'completed' && (review ? (
        <section className="block">
          <h2>Your rating</h2>
          <Stars value={review.rating} />
          {review.comment && <p>“{review.comment}”</p>}
        </section>
      ) : <ReviewForm id={a.id} doctor={a.doctor.name} onDone={reload} />)}

      <section className="block details">
        <h2>Details</h2>
        <dl className="kv">
          <dt>Symptoms</dt><dd>{a.symptoms}</dd>
          {a.address && <><dt>Address</dt><dd>{a.address}</dd></>}
          <dt>Matched by</dt><dd>{a.matchMode === 'nearest' ? 'Nearest available doctor' : 'You chose this doctor'}</dd>
          <dt>Paid</dt>
          <dd>{euro(a.price.total)}{payment && ` by ${payment.brand} ending ${payment.last4}`}{payment?.status === 'refunded' && ' (refunded)'}</dd>
        </dl>
      </section>

      <div className="action-bar">
        {['pending', 'accepted'].includes(a.status) && <button className="btn danger" onClick={cancel}>Cancel visit</button>}
        {['completed', 'declined', 'cancelled'].includes(a.status) && (
          <Link className="btn secondary" to={`/app/book?doctor=${a.doctor.id}`}>Book {a.doctor.name} again</Link>
        )}
        <ErrorText error={actionError} />
      </div>

      <FlagForm appointmentId={a.id} otherName={a.doctor.name} existing={myFlag} onDone={reload} />
    </div>
  );
}

function ReviewForm({ id, doctor, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (!rating) { setError(new Error('Choose how many stars to give.')); return; }
    try { await api(`/appointments/${id}/review`, { method: 'POST', body: { rating, comment } }); onDone(); } catch (err) { setError(err); }
  };
  return (
    <form className="block review-form" onSubmit={submit}>
      <h2>How was your visit with {doctor}?</h2>
      <div className="star-input" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="rv-comment">Comment (optional)</label>
        <textarea id="rv-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <ErrorText error={error} />
      <button className="btn primary">Send rating</button>
    </form>
  );
}

const FLAG_REASONS = ['No-show', 'Very late', 'Rude or inappropriate behaviour', 'Payment problem', 'Safety concern', 'Other'];

export function FlagForm({ appointmentId, otherName, existing, onDone }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState(null);
  if (existing) return <p className="hint flag-sent">You reported a problem ({existing.reason}). Status: {existing.status === 'open' ? 'being reviewed' : 'reviewed'}.</p>;
  if (!open) return <button className="link-button" onClick={() => setOpen(true)}>Report a problem with this visit</button>;
  const submit = async (e) => {
    e.preventDefault();
    try { await api('/flags', { method: 'POST', body: { appointmentId, reason, details } }); onDone(); } catch (err) { setError(err); }
  };
  return (
    <form className="block flag-form" onSubmit={submit}>
      <h2>Report a problem</h2>
      <p className="hint">An administrator reads every report about {otherName} and can block accounts that break the rules.</p>
      <div className="field">
        <label htmlFor="fl-reason">What happened?</label>
        <select id="fl-reason" value={reason} onChange={(e) => setReason(e.target.value)} required>
          <option value="">Choose a reason</option>
          {FLAG_REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="fl-details">Details</label>
        <textarea id="fl-details" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>
      <ErrorText error={error} />
      <div className="book-actions">
        <button type="button" className="btn secondary" onClick={() => setOpen(false)}>Close</button>
        <button className="btn danger">Send report</button>
      </div>
    </form>
  );
}

// ---------- Plans (subscriptions) ----------

export function Plans() {
  const { refresh } = useAuth();
  const { data: plansData } = useLoad(() => api('/plans'), []);
  const { data: subData, reload } = useLoad(() => api('/subscription'), []);
  const [choosing, setChoosing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState('');
  const sub = subData?.subscription;
  const current = sub?.plan || 'payg';
  const plans = useMemo(() => plansData?.plans || [], [plansData]);

  const subscribe = async (card) => {
    setBusy(true); setError(null);
    try {
      await api('/subscription', { method: 'POST', body: { plan: choosing.id, card } });
      setDone(`You're now on ${choosing.name}. Your next bookings have no fee.`);
      setChoosing(null);
      reload(); refresh();
    } catch (e) { setError(e); }
    setBusy(false);
  };
  const cancel = async () => {
    if (!window.confirm('Stop renewing your plan? You keep the benefits until the end of the period.')) return;
    try { await api('/subscription', { method: 'DELETE' }); reload(); refresh(); setDone('Your plan will not renew.'); } catch (e) { setError(e); }
  };

  return (
    <div className="page">
      <h1 className="page-title">Plans</h1>
      <p className="page-lead">If you need a doctor more than once or twice a year, a plan costs less than booking fees.</p>
      {done && <Notice tone="ok">{done}</Notice>}
      {sub && (
        <Notice tone="ok" action={sub.status === 'active' ? <button className="btn secondary sm" onClick={cancel}>Stop renewal</button> : null}>
          You're on <strong>{sub.info.name}</strong> until {fmtDate(sub.endsAt)}{sub.status === 'cancelled' ? ' (won\'t renew)' : ''}.
        </Notice>
      )}
      <div className="plan-grid">
        {plans.map((p) => (
          <article key={p.id} className={`plan ${p.id}${current === p.id ? ' current' : ''}`}>
            <h2>{p.name}</h2>
            <p className="plan-price">{p.price ? <>{euro(p.price)}<small>/{p.months === 12 ? 'year' : 'month'}</small></> : 'Free'}</p>
            <ul>{p.perks.map((x) => <li key={x}>{x}</li>)}</ul>
            {current === p.id ? <span className="plan-current">Your plan</span>
              : p.id !== 'payg' && <button className="btn primary block" onClick={() => { setChoosing(p); setError(null); }}>Choose {p.name}</button>}
          </article>
        ))}
      </div>
      {choosing && (
        <section className="block checkout" aria-labelledby="co-title">
          <h2 id="co-title">Subscribe to {choosing.name}</h2>
          <p>{euro(choosing.price)} now, then every {choosing.months === 12 ? 'year' : 'month'}. Stop the renewal any time.</p>
          <ErrorText error={error} />
          <PaymentForm cta={`Pay ${euro(choosing.price)} and subscribe`} onPay={subscribe} busy={busy} />
          <button className="btn secondary" onClick={() => setChoosing(null)}>Not now</button>
        </section>
      )}
    </div>
  );
}
