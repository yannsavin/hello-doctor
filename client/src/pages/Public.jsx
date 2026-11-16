import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, homeFor } from '../App.jsx';
import { Logo, MaltaMap, TextSizeToggle, EmergencyStrip, ErrorText, LocalitySelect, euro } from '../components.jsx';

export function Landing() {
  const { user } = useAuth();
  const [map, setMap] = useState(null);
  const [plans, setPlans] = useState([]);
  useEffect(() => {
    api('/public/map').then(setMap).catch(() => {});
    api('/plans').then((d) => setPlans(d.plans)).catch(() => {});
  }, []);
  const start = (path) => (user?.role === 'patient' ? path : user ? homeFor(user) : `/signup?next=${encodeURIComponent(path)}`);

  return (
    <div className="landing">
      <EmergencyStrip />
      <header className="site-header">
        <Logo />
        <nav className="site-nav" aria-label="Account">
          <TextSizeToggle />
          {user ? (
            <Link className="btn primary sm" to={homeFor(user)}>Open my space</Link>
          ) : (
            <>
              <Link to="/login" className="link-light">Log in</Link>
              <Link to="/signup" className="btn primary sm">Create account</Link>
            </>
          )}
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>A doctor at your door, anywhere in Malta.</h1>
          <p className="lead">
            Book a home visit or a video consultation with a GP or a physiotherapist.
            Made for people who can't easily get to a clinic, and for visitors who have no doctor here.
          </p>
          <div className="hero-actions">
            <Link to={start('/app/book?mode=nearest')} className="btn primary lg">Get the nearest doctor</Link>
            <Link to={start('/app/doctors')} className="btn secondary-light lg">Choose my doctor</Link>
          </div>
        </div>
        <figure className="hero-map">
          <MaltaMap pins={map?.doctors || []} label={`Map of Malta and Gozo showing ${map?.online ?? 'the'} doctors available now`} />
          <figcaption>
            <span className="live-dot" aria-hidden="true" />
            <strong>{map ? map.online : '…'}</strong> of {map ? map.total : '…'} doctors are available right now
            <span className="legend"><i className="lg-gp" /> GP <i className="lg-physio" /> Physio</span>
          </figcaption>
        </figure>
      </section>

      <section className="section how" aria-labelledby="how-title">
        <h2 id="how-title">How a visit works</h2>
        <ol className="how-steps">
          <li><h3>Say what's wrong</h3><p>A few words about your symptoms and where you are. Home visit or video call, GP or physio.</p></li>
          <li><h3>Pick your doctor</h3><p>Let us send the nearest free doctor, or choose one by rating, experience and arrival time.</p></li>
          <li><h3>Pay in the app</h3><p>You see the full price before you book. If the doctor declines, you get refunded.</p></li>
          <li><h3>Follow the visit</h3><p>Watch the doctor arrive on the map, then keep the medical report and prescription in your account.</p></li>
        </ol>
      </section>

      <section className="section audiences" aria-label="Who it is for">
        <div className="aud aud-home">
          <h2>For patients at home</h2>
          <p>Older people and anyone with reduced mobility get seen first. Tell us once in your profile and doctors see it with every request.</p>
        </div>
        <div className="aud aud-visit">
          <h2>For visitors and expats</h2>
          <p>No local GP? Sign up with your passport, get the closest doctor to your hotel and pay by card. Reports are in English.</p>
        </div>
        <div className="aud aud-doc">
          <h2>For doctors</h2>
          <p>Go online when it suits you, accept the visits that fit your route, and write your report from your phone.</p>
          <Link to="/signup?role=doctor" className="text-link">Join as a doctor</Link>
        </div>
      </section>

      {plans.length > 0 && (
        <section className="section plans-band" aria-labelledby="plans-title">
          <h2 id="plans-title">Pay per visit, or save with a plan</h2>
          <div className="plan-strip">
            {plans.map((p) => (
              <div key={p.id} className={`plan-mini ${p.id}`}>
                <h3>{p.name}</h3>
                <p className="plan-price">{p.price ? <>{euro(p.price)}<small>/{p.months === 12 ? 'year' : 'month'}</small></> : 'Free'}</p>
                <p>{p.perks[0]}. {p.perks[1]}.</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section limits" aria-labelledby="limits-title">
        <h2 id="limits-title">What Hello Doctor doesn't do</h2>
        <ul>
          <li><strong>Emergencies.</strong> For chest pain, stroke signs, heavy bleeding or breathing problems, call <a href="tel:112">112</a>.</li>
          <li><strong>Hospital procedures.</strong> X-rays, scans and surgery need a clinic or hospital.</li>
          <li><strong>Medicine delivery.</strong> Your doctor gives you a digital prescription to take to any pharmacy.</li>
        </ul>
      </section>

      <footer className="site-footer">
        <Logo />
        <p>Student prototype for CIS3186 Mobile Device Programming, University of Malta. Not a real medical service.</p>
      </footer>
    </div>
  );
}

const DEMO = [
  { label: 'Patient', email: 'patient@hellodoctor.test' },
  { label: 'Doctor', email: 'doctor@hellodoctor.test' },
  { label: 'Admin', email: 'admin@hellodoctor.test' },
];

export function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) nav(homeFor(user), { replace: true }); }, []); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const u = await login(email, password);
      const next = params.get('next');
      nav(next && next.startsWith('/') ? next : homeFor(u), { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Log in">
      <form onSubmit={submit} className="auth-form">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <ErrorText error={error} />
        <button className="btn primary lg block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <div className="demo-box">
        <p>Testing the prototype? Fill in a demo account:</p>
        <div className="demo-buttons">
          {DEMO.map((d) => (
            <button key={d.label} type="button" className="btn secondary sm" onClick={() => { setEmail(d.email); setPassword('hellodoctor'); }}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <p className="auth-switch">New here? <Link to={`/signup${params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : ''}`}>Create an account</Link></p>
    </AuthLayout>
  );
}

export function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') === 'doctor' ? 'doctor' : 'patient');
  const [f, setF] = useState({
    name: '', email: '', password: '', phone: '', idType: 'maltese_id', idNumber: '',
    age: '', locality: '', address: '', reducedMobility: false, isTourist: false,
    specialty: 'gp', licenseNumber: '', yearsExperience: '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const u = await signup({ ...f, role });
      const next = params.get('next');
      nav(u.role === 'patient' && next?.startsWith('/app') ? next : homeFor(u), { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create your account" wide>
      <div className="segmented" role="radiogroup" aria-label="I am signing up as">
        {[['patient', 'I need a doctor'], ['doctor', 'I am a doctor']].map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={role === v} className={role === v ? 'on' : ''} onClick={() => setRole(v)}>{l}</button>
        ))}
      </div>

      <form onSubmit={submit} className="auth-form">
        <fieldset>
          <legend>About you</legend>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" autoComplete="name" value={f.name} onChange={set('name')} required />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="su-email">Email</label>
              <input id="su-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} required />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="+356" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="su-password">Password</label>
            <input id="su-password" type="password" autoComplete="new-password" minLength={8} value={f.password} onChange={set('password')} required aria-describedby="pw-hint" />
            <p className="hint" id="pw-hint">At least 8 characters.</p>
          </div>
        </fieldset>

        <fieldset>
          <legend>Identity check</legend>
          <p className="hint">
            {role === 'doctor'
              ? 'An administrator checks your ID and Medical Council number before you can receive requests.'
              : 'We check every account so doctors know who they are visiting. Maltese ID cards are checked straight away; passports are checked by our team.'}
          </p>
          <div className="field-row">
            <div className="field">
              <label htmlFor="idType">Document</label>
              <select id="idType" value={f.idType} onChange={set('idType')}>
                <option value="maltese_id">Maltese ID card</option>
                <option value="passport">Passport</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="idNumber">Document number</label>
              <input id="idNumber" value={f.idNumber} onChange={set('idNumber')} required placeholder={f.idType === 'passport' ? 'AB1234567' : '123456M'} autoCapitalize="characters" />
            </div>
          </div>
        </fieldset>

        {role === 'patient' ? (
          <fieldset>
            <legend>Where doctors should come</legend>
            <div className="field-row">
              <div className="field">
                <label htmlFor="locality">Locality</label>
                <LocalitySelect id="locality" value={f.locality} onChange={(v) => setF((x) => ({ ...x, locality: v }))} required />
              </div>
              <div className="field narrow">
                <label htmlFor="age">Age</label>
                <input id="age" type="number" min="0" max="120" inputMode="numeric" value={f.age} onChange={set('age')} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="address">Street address, hotel or apartment</label>
              <input id="address" autoComplete="street-address" value={f.address} onChange={set('address')} />
            </div>
            <label className="check">
              <input type="checkbox" checked={f.reducedMobility} onChange={set('reducedMobility')} />
              <span>I have reduced mobility or find it hard to leave home</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={f.isTourist} onChange={set('isTourist')} />
              <span>I'm visiting Malta and don't have a doctor here</span>
            </label>
          </fieldset>
        ) : (
          <fieldset>
            <legend>Your practice</legend>
            <div className="field-row">
              <div className="field">
                <label htmlFor="specialty">Specialty</label>
                <select id="specialty" value={f.specialty} onChange={set('specialty')}>
                  <option value="gp">General practitioner</option>
                  <option value="physio">Physiotherapist</option>
                </select>
              </div>
              <div className="field narrow">
                <label htmlFor="years">Years practising</label>
                <input id="years" type="number" min="0" max="60" value={f.yearsExperience} onChange={set('yearsExperience')} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="license">Medical Council number</label>
                <input id="license" value={f.licenseNumber} onChange={set('licenseNumber')} required />
              </div>
              <div className="field">
                <label htmlFor="d-locality">Where you usually start</label>
                <LocalitySelect id="d-locality" value={f.locality} onChange={(v) => setF((x) => ({ ...x, locality: v }))} required />
              </div>
            </div>
          </fieldset>
        )}

        <ErrorText error={error} />
        <button className="btn primary lg block" disabled={busy}>{busy ? 'Creating your account…' : 'Create account'}</button>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthLayout>
  );
}

function AuthLayout({ title, children, wide }) {
  return (
    <div className="auth-page">
      <header className="site-header">
        <Link to="/" className="logo-link" aria-label="Hello Doctor home"><Logo /></Link>
        <TextSizeToggle />
      </header>
      <main className={`auth-card${wide ? ' wide' : ''}`}>
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function NotFound() {
  const { user } = useAuth();
  return (
    <AuthLayout title="This page doesn't exist">
      <p>The link may be old or mistyped.</p>
      <Link className="btn primary" to={homeFor(user)}>Go to the home page</Link>
    </AuthLayout>
  );
}
