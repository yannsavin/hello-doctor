import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { api } from './api.js';
import { auth, authMessage, firebaseReady } from './firebase.js';
import { Logo, TextSizeToggle, EmergencyStrip } from './components.jsx';
import { Landing, Login, Signup, NotFound } from './pages/Public.jsx';
import { PatientHome, Doctors, DoctorDetail, Book, Visits, VisitDetail, Plans } from './pages/Patient.jsx';
import { DoctorDesk, DoctorVisit, Schedule } from './pages/Doctor.jsx';
import { Admin } from './pages/Admin.jsx';
import { Account } from './pages/Account.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export const homeFor = (user) =>
  !user ? '/' : user.role === 'doctor' ? '/doctor' : user.role === 'admin' ? '/admin' : '/app';

export default function App() {
  const [user, setUser] = useState(null);
  const [plan, setPlan] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!auth?.currentUser) { setUser(null); setPlan(null); return null; }
    const data = await api('/me');
    setUser(data.user);
    setPlan(data.plan);
    return data.user;
  }, []);

  // Firebase Auth keeps the session; we load the Hello Doctor profile from our API.
  useEffect(() => {
    if (!auth) { setReady(true); return undefined; }
    return onAuthStateChanged(auth, async () => {
      try { await refresh(); } catch { if (!auth.currentUser) setUser(null); }
      setReady(true);
    });
  }, [refresh]);

  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      throw authMessage(err);
    }
    try {
      return await refresh();
    } catch (err) {
      await signOut(auth);
      throw err;
    }
  };
  const signup = async (body) => {
    await api('/auth/signup', { method: 'POST', body });
    return login(body.email, body.password);
  };
  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setPlan(null);
  };

  if (!firebaseReady) return <SetupNeeded />;
  if (!ready) return <div className="boot" role="status">Loading Hello Doctor…</div>;

  return (
    <AuthCtx.Provider value={{ user, plan, setUser, refresh, login, signup, logout }}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<RequireRole roles={['patient']}><Shell /></RequireRole>}>
          <Route path="/app" element={<PatientHome />} />
          <Route path="/app/doctors" element={<Doctors />} />
          <Route path="/app/doctors/:id" element={<DoctorDetail />} />
          <Route path="/app/book" element={<Book />} />
          <Route path="/app/visits" element={<Visits />} />
          <Route path="/app/visits/:id" element={<VisitDetail />} />
          <Route path="/app/plans" element={<Plans />} />
        </Route>

        <Route element={<RequireRole roles={['doctor']}><Shell /></RequireRole>}>
          <Route path="/doctor" element={<DoctorDesk />} />
          <Route path="/doctor/visits/:id" element={<DoctorVisit />} />
          <Route path="/doctor/schedule" element={<Schedule />} />
        </Route>

        <Route element={<RequireRole roles={['admin']}><Shell /></RequireRole>}>
          <Route path="/admin" element={<Admin />} />
        </Route>

        <Route element={<RequireRole roles={['patient', 'doctor', 'admin']}><Shell /></RequireRole>}>
          <Route path="/account" element={<Account />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthCtx.Provider>
  );
}

function SetupNeeded() {
  return (
    <div className="auth-page">
      <main className="auth-card wide">
        <h1>Connect Firebase</h1>
        <p>The website needs your Firebase web configuration before it can start.</p>
        <ol>
          <li>Copy <code>.env.example</code> to <code>.env.local</code> at the project root.</li>
          <li>Fill it with the values from Firebase console, Project settings, Your apps, Web app.</li>
          <li>Restart <code>npm run dev</code>.</li>
        </ol>
      </main>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

const NAV = {
  patient: [
    { to: '/app', label: 'Home', icon: 'home', end: true },
    { to: '/app/doctors', label: 'Doctors', icon: 'search' },
    { to: '/app/visits', label: 'My visits', icon: 'list' },
    { to: '/app/plans', label: 'Plans', icon: 'card' },
    { to: '/account', label: 'Account', icon: 'user' },
  ],
  doctor: [
    { to: '/doctor', label: 'Requests', icon: 'list', end: true },
    { to: '/doctor/schedule', label: 'Schedule', icon: 'calendar' },
    { to: '/account', label: 'Account', icon: 'user' },
  ],
  admin: [
    { to: '/admin', label: 'Moderation', icon: 'shield', end: true },
    { to: '/account', label: 'Account', icon: 'user' },
  ],
};

function NavIcon({ name }) {
  const paths = {
    home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    search: 'M10.5 4a6.5 6.5 0 1 0 4.1 11.5l4.7 4.7 1.4-1.4-4.7-4.7A6.5 6.5 0 0 0 10.5 4zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z',
    list: 'M4 5h16v2H4zm0 6h16v2H4zm0 6h10v2H4z',
    card: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm2 3h14V6H5zm0 3v6h14v-6z',
    user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z',
    calendar: 'M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2zm-2 8v9h14v-9z',
    shield: 'M12 2 4 5v6c0 5 3.4 9.6 8 11 4.6-1.4 8-6 8-11V5z',
  };
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d={paths[name]} fill="currentColor" /></svg>;
}

function Shell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const items = NAV[user.role];
  return (
    <div className="shell">
      {user.role === 'patient' && <EmergencyStrip />}
      <header className="app-header">
        <Link to={homeFor(user)} className="logo-link" aria-label="Hello Doctor home"><Logo /></Link>
        <nav className="top-nav" aria-label="Main">
          {items.map((i) => <NavLink key={i.to} to={i.to} end={i.end}>{i.label}</NavLink>)}
        </nav>
        <div className="header-tools">
          <TextSizeToggle />
          <span className="who" title={user.email}>{user.name.split(' ').slice(0, 2).join(' ')}</span>
          <button className="btn ghost-light sm" onClick={async () => { await logout(); nav('/'); }}>Log out</button>
        </div>
      </header>
      <main id="main" className="app-main">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Main">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end}>
            <NavIcon name={i.icon} />
            <span>{i.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
