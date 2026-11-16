import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { ErrorText, LocalitySelect, euro, fmtDate, useLoad } from '../components.jsx';

const ID_STATUS = {
  verified: 'Checked',
  pending: 'Being checked by our team',
  rejected: 'Rejected, contact support',
};

export function Account() {
  const { user, setUser, plan } = useAuth();
  const isPatient = user.role === 'patient';
  const [f, setF] = useState({
    name: user.name, phone: user.phone || '', age: user.age ?? '', locality: user.locality || '',
    address: user.address || '', reducedMobility: user.reducedMobility, isTourist: user.isTourist,
  });
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const payments = useLoad(() => api('/payments'), []);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setError(null); setMsg(null);
    try {
      const body = isPatient ? f : { name: f.name, phone: f.phone };
      const { user: u } = await api('/me', { method: 'PATCH', body });
      setUser(u);
      setMsg('Changes saved.');
    } catch (err) { setError(err); }
  };

  return (
    <div className="page">
      <h1 className="page-title">Account</h1>

      <section className="block id-card">
        <h2>Identity</h2>
        <dl className="kv">
          <dt>Email</dt><dd>{user.email}</dd>
          <dt>Document</dt><dd>{user.idType === 'passport' ? 'Passport' : user.idType === 'maltese_id' ? 'Maltese ID card' : '—'} {user.idMasked}</dd>
          <dt>Check</dt><dd><span className={`id-${user.idStatus}`}>{ID_STATUS[user.idStatus]}</span></dd>
          {isPatient && <><dt>Plan</dt><dd>{plan ? `${plan.info.name}, until ${fmtDate(plan.endsAt)}` : 'Pay as you go'} <Link to="/app/plans" className="text-link">Change</Link></dd></>}
        </dl>
      </section>

      <form className="block" onSubmit={save}>
        <h2>Your details</h2>
        <div className="field">
          <label htmlFor="a-name">Full name</label>
          <input id="a-name" value={f.name} onChange={set('name')} required />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="a-phone">Phone</label>
            <input id="a-phone" type="tel" value={f.phone} onChange={set('phone')} />
          </div>
          {isPatient && (
            <div className="field narrow">
              <label htmlFor="a-age">Age</label>
              <input id="a-age" type="number" min="0" max="120" value={f.age} onChange={set('age')} />
            </div>
          )}
        </div>
        {isPatient && (
          <>
            <div className="field">
              <label htmlFor="a-loc">Locality</label>
              <LocalitySelect id="a-loc" value={f.locality} onChange={(v) => setF((x) => ({ ...x, locality: v }))} />
            </div>
            <div className="field">
              <label htmlFor="a-addr">Street address, hotel or apartment</label>
              <input id="a-addr" value={f.address} onChange={set('address')} />
            </div>
            <label className="check"><input type="checkbox" checked={f.reducedMobility} onChange={set('reducedMobility')} /><span>I have reduced mobility or find it hard to leave home</span></label>
            <label className="check"><input type="checkbox" checked={f.isTourist} onChange={set('isTourist')} /><span>I'm visiting Malta and don't have a doctor here</span></label>
          </>
        )}
        <ErrorText error={error} />
        {msg && <p className="ok-text" role="status">{msg}</p>}
        <button className="btn primary">Save changes</button>
      </form>

      {isPatient && (
        <section className="block">
          <h2>Payments</h2>
          {payments.data?.payments.length === 0 && <p>No payments yet.</p>}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Date</th><th scope="col">For</th><th scope="col">Card</th><th scope="col" className="num">Amount</th></tr></thead>
              <tbody>
                {(payments.data?.payments || []).map((p) => (
                  <tr key={p.id} className={p.status === 'refunded' ? 'refunded' : ''}>
                    <td>{fmtDate(p.createdAt)}</td>
                    <td>{p.description}{p.status === 'refunded' && <span className="tag">Refunded</span>}</td>
                    <td>{p.brand} {p.last4}</td>
                    <td className="num">{euro(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
