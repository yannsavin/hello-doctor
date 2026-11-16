import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { LOCALITIES } from '../../shared/localities.js';
import { db } from './firebase.js';

export { LOCALITIES };

// ---------- Formatting ----------

export const SPECIALTY = { gp: 'General practitioner', physio: 'Physiotherapist' };
export const SPECIALTY_SHORT = { gp: 'GP', physio: 'Physio' };
export const VISIT = { home: 'Home visit', video: 'Video consultation' };
export const STATUS = {
  pending: 'Waiting for the doctor',
  accepted: 'Accepted',
  en_route: 'Doctor on the way',
  in_progress: 'In consultation',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};
export const STATUS_DOCTOR = { ...STATUS, pending: 'New request', en_route: 'Travelling' };

export const euro = (n) => '€' + Number(n || 0).toFixed(2).replace(/\.00$/, '');
export const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (iso) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
export function timeAgo(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return fmtDate(iso);
}
export const initials = (name) => name.replace(/^Dr\s+/, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('');

// ---------- Hooks ----------

/**
 * Load data from the API.
 * - `watch`: optional function returning a Firestore document or query. Every change pushed by
 *   Firestore (real time) reloads the data. If the listener is refused (security rules not
 *   installed), we fall back to polling.
 * - `ms`: polling interval when there is no listener.
 */
export function useLoad(fn, deps = [], ms = 0, watch = null) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const watchRef = useRef(watch);
  watchRef.current = watch;
  const reload = useCallback(async () => {
    try {
      const data = await fnRef.current();
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false }));
    }
  }, []);
  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    reload();
    let timer = null;
    let unsubscribe = null;
    const poll = (every) => { if (every && !timer) timer = setInterval(reload, every); };
    const target = db && watchRef.current ? watchRef.current() : null;
    if (target) {
      let first = true;
      unsubscribe = onSnapshot(
        target,
        () => { if (first) { first = false; return; } reload(); },
        () => poll(ms || 5000),
      );
    } else {
      poll(ms);
    }
    return () => { if (timer) clearInterval(timer); if (unsubscribe) unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ...state, reload };
}

/** Firestore targets used for real-time updates. */
export const live = {
  visit: (id) => doc(db, 'appointments', String(id)),
  myVisits: (user) => query(collection(db, 'appointments'), where(user.role === 'doctor' ? 'doctorId' : 'patientId', '==', user.id)),
};

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

// ---------- Brand & chrome ----------

export function Logo({ light = true }) {
  return (
    <span className={'logo' + (light ? ' on-dark' : '')}>
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <circle cx="16" cy="16" r="15" fill="var(--luzzu)" />
        <path d="M16 9v14M9 16h14" stroke="var(--sea)" strokeWidth="4.5" strokeLinecap="round" />
      </svg>
      <span>hello doctor</span>
    </span>
  );
}

export function EmergencyStrip() {
  return (
    <div className="emergency" role="note">
      Chest pain, trouble breathing or a serious injury? Don't wait for a home visit. <a href="tel:112">Call 112</a>
    </div>
  );
}

export function TextSizeToggle() {
  const [large, setLarge] = useState(() => {
    try { return localStorage.getItem('hd_text') === 'large'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.dataset.text = large ? 'large' : 'normal';
    try { localStorage.setItem('hd_text', large ? 'large' : 'normal'); } catch { /* ignore */ }
  }, [large]);
  return (
    <button
      type="button"
      className="text-toggle"
      aria-pressed={large}
      onClick={() => setLarge((v) => !v)}
      title={large ? 'Use normal text size' : 'Use larger text'}
    >
      <span aria-hidden="true">A<span className="big-a">A</span></span>
      <span className="sr-only">Larger text</span>
    </button>
  );
}

export function Notice({ tone = 'info', children, action }) {
  return (
    <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div>{children}</div>
      {action}
    </div>
  );
}

export function ErrorText({ error }) {
  if (!error) return null;
  return <p className="error-text" role="alert">{error.message || String(error)}</p>;
}

export function Loading({ label = 'Loading…' }) {
  return <p className="loading" role="status">{label}</p>;
}

export function Avatar({ name, specialty, size = 56 }) {
  return (
    <span className={`avatar ${specialty || ''}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Stars({ value, count, size = 'md' }) {
  if (value == null) return <span className="stars-none">No ratings yet</span>;
  const full = Math.round(value);
  return (
    <span className={`stars ${size}`} aria-label={`Rated ${value} out of 5${count != null ? ` from ${count} reviews` : ''}`}>
      <span aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= full ? 'on' : ''}>★</span>)}
      </span>
      <span className="stars-num">{Number(value).toFixed(1)}</span>
      {count != null && <span className="stars-count">({count})</span>}
    </span>
  );
}

export function StatusBadge({ status, doctorView }) {
  return <span className={`badge st-${status}`}>{(doctorView ? STATUS_DOCTOR : STATUS)[status] || status}</span>;
}

export function Steps({ steps, current }) {
  return (
    <ol className="stepper" aria-label="Booking progress">
      {steps.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'current' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="step-num">{i + 1}</span>
          <span className="step-label">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function LocalitySelect({ id, value, onChange, required }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">Choose a locality</option>
      <optgroup label="Malta">
        {LOCALITIES.filter((l) => !l.name.includes('Gozo')).map((l) => <option key={l.name}>{l.name}</option>)}
      </optgroup>
      <optgroup label="Gozo">
        {LOCALITIES.filter((l) => l.name.includes('Gozo')).map((l) => <option key={l.name}>{l.name}</option>)}
      </optgroup>
    </select>
  );
}

// ---------- Map of Malta (signature element) ----------

const COS_LAT = 0.809; // cos(36°) keeps the island proportions right
export const project = (lat, lng) => [(lng - 14.15) * 1000 * COS_LAT, (36.1 - lat) * 1000];

const MALTA = [[14.327, 35.988], [14.352, 35.992], [14.375, 35.975], [14.39, 35.962], [14.405, 35.962], [14.425, 35.958], [14.43, 35.945], [14.455, 35.94], [14.493, 35.925], [14.515, 35.906], [14.523, 35.902], [14.535, 35.893], [14.548, 35.888], [14.572, 35.865], [14.578, 35.858], [14.565, 35.825], [14.545, 35.835], [14.525, 35.82], [14.515, 35.805], [14.47, 35.815], [14.425, 35.828], [14.385, 35.855], [14.345, 35.905], [14.345, 35.92], [14.338, 35.935], [14.335, 35.96], [14.33, 35.982]];
const GOZO = [[14.185, 36.035], [14.2, 36.055], [14.225, 36.07], [14.255, 36.078], [14.285, 36.075], [14.31, 36.065], [14.335, 36.045], [14.34, 36.03], [14.32, 36.02], [14.295, 36.015], [14.265, 36.012], [14.235, 36.018], [14.205, 36.022]];
const COMINO = [[14.33, 36.01], [14.345, 36.015], [14.352, 36.006], [14.336, 36.0]];

const toPath = (pts) =>
  'M' + pts.map(([lng, lat]) => project(lat, lng).map((n) => n.toFixed(1)).join(' ')).join(' L') + 'Z';

/**
 * pins: [{id, lat, lng, specialty, online, label}]
 * home: {lat, lng} patient position
 * route: {from:{lat,lng}, to:{lat,lng}, progress:0..1} live tracking
 */
export function MaltaMap({ pins = [], home, route, selectedId, onSelect, label = 'Map of Malta and Gozo', className = '', zoom = false }) {
  // Optional zoom: frame the visit (doctor + patient) instead of the whole archipelago.
  let vb = [0, 0, 364, 310];
  if (zoom) {
    const pts = [...pins, home, route?.from, route?.to].filter(Boolean).map((p) => project(p.lat, p.lng));
    if (pts.length) {
      const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
      let w = Math.max(...xs) - Math.min(...xs) + 60;
      let h = Math.max(...ys) - Math.min(...ys) + 60;
      const ratio = 364 / 310;
      if (w / h > ratio) h = w / ratio; else w = h * ratio;
      w = Math.max(w, 140); h = Math.max(h, 140 / ratio);
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2; const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      vb = [cx - w / 2, cy - h / 2, w, h];
    }
  }
  const s = vb[2] / 364; // keep pins the same size on screen when zoomed
  let traveller = null;
  if (route) {
    const [x1, y1] = project(route.from.lat, route.from.lng);
    const [x2, y2] = project(route.to.lat, route.to.lng);
    const p = Math.max(0, Math.min(1, route.progress ?? 0));
    traveller = { x1, y1, x2, y2, x: x1 + (x2 - x1) * p, y: y1 + (y2 - y1) * p };
  }
  return (
    <svg viewBox={vb.map((n) => n.toFixed(1)).join(' ')} className={`malta-map ${className}`} role="img" aria-label={label} style={{ '--s': s }}>
      <defs>
        <pattern id="hd-waves" width="22" height="11" patternUnits="userSpaceOnUse">
          <path d="M0 6 Q5.5 1 11 6 T22 6" fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="1.1" />
        </pattern>
      </defs>
      <rect x="-200" y="-200" width="764" height="710" fill="var(--sea)" />
      <rect x="-200" y="-200" width="764" height="710" fill="url(#hd-waves)" />
      <path d={toPath(MALTA)} vectorEffect="non-scaling-stroke" className="land" />
      <path d={toPath(GOZO)} vectorEffect="non-scaling-stroke" className="land" />
      <path d={toPath(COMINO)} vectorEffect="non-scaling-stroke" className="land" />
      {!zoom && <><text x="300" y="296" className="map-label">Malta</text><text x="40" y="20" className="map-label">Gozo</text></>}

      {traveller && (
        <g className="route">
          <line vectorEffect="non-scaling-stroke" x1={traveller.x1} y1={traveller.y1} x2={traveller.x2} y2={traveller.y2} />
          <line vectorEffect="non-scaling-stroke" className="done" x1={traveller.x1} y1={traveller.y1} x2={traveller.x} y2={traveller.y} />
        </g>
      )}

      {pins.map((p) => {
        const [x, y] = project(p.lat, p.lng);
        const interactive = !!onSelect;
        return (
          <g
            key={p.id}
            transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})`}
            className={`pin ${p.specialty}${p.online ? '' : ' off'}${selectedId === p.id ? ' sel' : ''}${interactive ? ' interactive' : ''}`}
            onClick={interactive ? () => onSelect(p.id) : undefined}
            onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.id); } } : undefined}
            tabIndex={interactive ? 0 : undefined}
            role={interactive ? 'button' : undefined}
            aria-label={p.label}
          >
            {p.online && <circle r="11" className="pulse" />}
            <circle r="7.5" className="dot" />
            <text y="3" textAnchor="middle">{p.specialty === 'physio' ? 'P' : 'G'}</text>
            <title>{p.label}</title>
          </g>
        );
      })}

      {home && (() => {
        const [x, y] = project(home.lat, home.lng);
        return (
          <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})`} className="home-pin">
            <path d="M0 -12 L9 -4 L9 7 L-9 7 L-9 -4 Z" />
            <title>Visit address</title>
          </g>
        );
      })()}

      {traveller && (
        <g transform={`translate(${traveller.x.toFixed(1)} ${traveller.y.toFixed(1)}) scale(${s.toFixed(3)})`} className="traveller">
          <circle r="9" />
          <path d="M-4 1h8l-1.5-4h-5zM-4 1v3h8v-3" />
          <title>Your doctor</title>
        </g>
      )}
    </svg>
  );
}

// ---------- Payment (m-commerce) ----------

export function PaymentForm({ cta, onPay, busy }) {
  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvc: '' });
  const set = (k) => (e) => {
    let v = e.target.value;
    if (k === 'number') v = v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
    if (k === 'expiry') {
      v = v.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
    }
    if (k === 'cvc') v = v.replace(/\D/g, '').slice(0, 4);
    setCard((c) => ({ ...c, [k]: v }));
  };
  return (
    <form className="pay-form" onSubmit={(e) => { e.preventDefault(); onPay(card); }}>
      <div className="field">
        <label htmlFor="cc-name">Name on card</label>
        <input id="cc-name" autoComplete="cc-name" value={card.name} onChange={set('name')} required />
      </div>
      <div className="field">
        <label htmlFor="cc-number">Card number</label>
        <input id="cc-number" autoComplete="cc-number" inputMode="numeric" placeholder="1234 5678 9012 3456" value={card.number} onChange={set('number')} required />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="cc-exp">Expiry</label>
          <input id="cc-exp" autoComplete="cc-exp" inputMode="numeric" placeholder="MM/YY" value={card.expiry} onChange={set('expiry')} required />
        </div>
        <div className="field">
          <label htmlFor="cc-cvc">Security code</label>
          <input id="cc-cvc" autoComplete="cc-csc" inputMode="numeric" placeholder="123" value={card.cvc} onChange={set('cvc')} required />
        </div>
      </div>
      <p className="hint test-hint">
        Prototype in test mode, no real money is taken. Use <strong>4242 4242 4242 4242</strong> with any future date.
        The card 4000 0000 0000 0002 shows what happens when a bank declines.
      </p>
      <button className="btn primary lg block" disabled={busy}>{busy ? 'Processing payment…' : cta}</button>
      <p className="hint secure">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H5v12h14V10h-2V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3z" /></svg>
        Only the last 4 digits of your card are stored.
      </p>
    </form>
  );
}

export function PriceSummary({ quote }) {
  if (!quote) return null;
  return (
    <dl className="price-summary">
      <div><dt>Consultation</dt><dd>{euro(quote.base)}</dd></div>
      {quote.serviceFee > 0 && <div><dt>Booking fee (10%)</dt><dd>{euro(quote.serviceFee)}</dd></div>}
      {quote.discount > 0 && <div className="saving"><dt>Plan discount</dt><dd>−{euro(quote.discount)}</dd></div>}
      <div className="total"><dt>Total</dt><dd>{euro(quote.total)}</dd></div>
    </dl>
  );
}
