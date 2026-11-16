import { useState } from 'react';
import { api } from '../api.js';
import { ErrorText, Loading, Notice, euro, fmtDate, timeAgo, useLoad } from '../components.jsx';

const ROLE = { patient: 'Patient', doctor: 'Doctor' };
const ID_TYPE = { maltese_id: 'Maltese ID', passport: 'Passport' };

export function Admin() {
  const [tab, setTab] = useState('verify');
  const overview = useLoad(() => api('/admin/overview'), [], 10000);
  const users = useLoad(() => api('/admin/users'), []);
  const flags = useLoad(() => api('/admin/flags'), []);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const o = overview.data;

  const reloadAll = () => { overview.reload(); users.reload(); flags.reload(); };
  const act = async (id, action) => {
    setError(null);
    if (action === 'block' && !window.confirm('Block this account? They will be logged out and cannot log in again until unblocked.')) return;
    try { await api('/admin/users/' + id, { method: 'POST', body: { action } }); reloadAll(); } catch (e) { setError(e); }
  };
  const resolve = async (id, resolution) => {
    try { await api(`/admin/flags/${id}/resolve`, { method: 'POST', body: { resolution } }); reloadAll(); } catch (e) { setError(e); }
  };

  const all = users.data?.users || [];
  const pending = all.filter((u) => u.idStatus === 'pending');
  const filtered = all.filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  const openFlags = (flags.data?.flags || []).filter((f) => f.status === 'open');

  return (
    <div className="page wide">
      <h1 className="page-title">Moderation</h1>
      {o ? (
        <dl className="stat-row admin-stats">
          <div><dt>Patients</dt><dd>{o.patients}</dd></div>
          <div><dt>Approved doctors</dt><dd>{o.doctors}<small>{o.doctorsOnline} online</small></dd></div>
          <div className={o.pendingVerifications ? 'attn' : ''}><dt>ID checks waiting</dt><dd>{o.pendingVerifications}</dd></div>
          <div className={o.openFlags ? 'attn' : ''}><dt>Open reports</dt><dd>{o.openFlags}</dd></div>
          <div><dt>Visits in progress</dt><dd>{o.activeVisits}</dd></div>
          <div><dt>Payments taken</dt><dd>{euro(o.revenue)}<small>{o.subscribers} subscribers</small></dd></div>
        </dl>
      ) : <Loading />}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'verify'} onClick={() => setTab('verify')}>ID checks ({pending.length})</button>
        <button role="tab" aria-selected={tab === 'flags'} onClick={() => setTab('flags')}>Reports ({openFlags.length})</button>
        <button role="tab" aria-selected={tab === 'users'} onClick={() => setTab('users')}>All accounts</button>
      </div>
      <ErrorText error={error} />

      {tab === 'verify' && (
        <section>
          {pending.length === 0 && <p className="empty-line">Every account has been checked.</p>}
          <div className="admin-list">
            {pending.map((u) => (
              <article key={u.id} className="admin-item">
                <div>
                  <h2>{u.name} <span className="tag">{ROLE[u.role]}</span></h2>
                  <p>{u.email}{u.phone ? `, ${u.phone}` : ''}</p>
                  <p><strong>{ID_TYPE[u.idType]}:</strong> {u.idNumber}{u.licenseNumber ? <> &nbsp; <strong>Medical Council:</strong> {u.licenseNumber}</> : null}</p>
                  <p className="hint">Signed up {timeAgo(u.createdAt)}{u.locality ? `, ${u.locality}` : ''}</p>
                </div>
                <div className="admin-actions">
                  <button className="btn secondary" onClick={() => act(u.id, 'reject')}>Reject</button>
                  <button className="btn primary" onClick={() => act(u.id, 'verify')}>Approve</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'flags' && (
        <section>
          {(flags.data?.flags || []).length === 0 && <p className="empty-line">No reports.</p>}
          <div className="admin-list">
            {(flags.data?.flags || []).map((f) => (
              <article key={f.id} className={`admin-item${f.status === 'resolved' ? ' resolved' : ''}`}>
                <div>
                  <h2>{f.reason}</h2>
                  <p><strong>{f.reporter.name}</strong> ({ROLE[f.reporter.role]}) reported <strong>{f.target.name}</strong> ({ROLE[f.target.role]}){f.target.blocked ? ', now blocked' : ''}</p>
                  {f.details && <p>“{f.details}”</p>}
                  <p className="hint">{fmtDate(f.createdAt)}{f.status === 'resolved' ? `. Resolved: ${f.resolution}` : ''}</p>
                </div>
                {f.status === 'open' && (
                  <div className="admin-actions">
                    <button className="btn secondary" onClick={() => resolve(f.id, 'No action needed')}>Dismiss</button>
                    {!f.target.blocked && (
                      <button className="btn danger" onClick={async () => { await act(f.target.id, 'block'); resolve(f.id, 'Account blocked'); }}>Block {f.target.name.split(' ')[0]}</button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'users' && (
        <section>
          <div className="field search-field">
            <label htmlFor="u-q">Search accounts</label>
            <input id="u-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" />
          </div>
          {!users.data && <Loading />}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">ID check</th><th scope="col">Reports</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className={u.blocked ? 'blocked' : ''}>
                    <td><strong>{u.name}</strong><br /><span className="hint">{u.email}</span></td>
                    <td>{ROLE[u.role]}{u.specialty ? ` (${u.specialty === 'gp' ? 'GP' : 'physio'})` : ''}</td>
                    <td><span className={`id-${u.idStatus}`}>{u.idStatus}</span></td>
                    <td>{u.flagCount || '—'}</td>
                    <td>{u.blocked ? 'Blocked' : 'Active'}</td>
                    <td>
                      {u.blocked
                        ? <button className="btn secondary sm" onClick={() => act(u.id, 'unblock')}>Unblock</button>
                        : <button className="btn danger sm" onClick={() => act(u.id, 'block')}>Block</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {o && o.pendingVerifications === 0 && o.openFlags === 0 && tab !== 'users' && <Notice tone="ok">Nothing needs your attention right now.</Notice>}
    </div>
  );
}
