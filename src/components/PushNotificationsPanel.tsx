'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellRing, Send, RefreshCw } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

type Summary = { configured: boolean; devices: number; guests: number };

export default function PushNotificationsPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [title, setTitle] = useState('Petit rappel pour le pagne');
  const [message, setMessage] = useState('Bonjour ! N’oubliez pas de vous procurer votre pagne pour notre cérémonie du 12 décembre 2026. Merci et à très bientôt !');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setNotice('');
    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Votre session organisateur a expiré. Reconnectez-vous.');
      const response = await fetch('/api/admin/push', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Chargement impossible.');
      setSummary(result as Summary);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Chargement impossible.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function send() {
    if (!summary?.devices) return;
    if (!window.confirm(`Envoyer cette notification aux ${summary.guests} invité(s) ayant activé les rappels sur ${summary.devices} appareil(s) ?`)) return;
    setBusy(true);
    setNotice('');
    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Votre session organisateur a expiré. Reconnectez-vous.');
      const response = await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, message }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Envoi impossible.');
      setNotice(`Envoi terminé : ${result.sent} notification(s) envoyée(s), ${result.failed} échec(s), ${result.removed} ancien(s) appareil(s) retiré(s).`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-inline-head"><div><h3>Rappels sur les téléphones</h3><p className="admin-muted">Envoyez une alerte aux invités qui ont accepté les notifications sur leur appareil.</p></div><BellRing size={22}/></div>
      <div className="admin-stat-grid three">
        <article className="admin-stat"><span>Invités abonnés</span><strong>{summary?.guests ?? '—'}</strong><small>ont accepté les rappels</small></article>
        <article className="admin-stat"><span>Téléphones</span><strong>{summary?.devices ?? '—'}</strong><small>appareils enregistrés</small></article>
        <article className="admin-stat"><span>Service</span><strong>{summary?.configured ? 'Prêt' : 'À configurer'}</strong><small><Bell size={14}/> notifications Web Push</small></article>
      </div>
      {!summary?.configured && <p className="admin-muted">Les clés du service doivent être configurées sur Vercel avant le premier envoi.</p>}
      <div className="admin-edit-card">
        <label htmlFor="push-title">Titre de la notification</label>
        <input id="push-title" maxLength={60} value={title} onChange={event => setTitle(event.target.value)}/>
        <label htmlFor="push-message">Message</label>
        <textarea id="push-message" maxLength={240} rows={4} value={message} onChange={event => setMessage(event.target.value)}/>
        <p className="admin-muted">{message.length}/240 caractères. Les téléphones doivent avoir accepté les notifications.</p>
        <div className="row">
          <button className="button secondary small" type="button" onClick={() => void load()}><RefreshCw size={15}/> Actualiser</button>
          <button className="button" type="button" onClick={() => void send()} disabled={busy || !summary?.configured || !summary.devices || title.trim().length < 2 || message.trim().length < 2}><Send size={16}/>{busy ? 'Envoi…' : 'Envoyer le rappel'}</button>
        </div>
      </div>
      {notice && <p className="admin-muted" role="status">{notice}</p>}
    </div>
  );
}
