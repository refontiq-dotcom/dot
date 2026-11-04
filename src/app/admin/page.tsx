'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, LogOut, LockKeyhole, Users, UserCheck, UserX, MapPin, ListChecks, Megaphone, CircleHelp, Save, Plus, Trash2, Download, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { initialContent, loadContent, saveContent, type Content, type Item } from '@/lib/content';

const ADMIN_EMAIL = 'refontiq@gmail.com';
type RSVP = { id: string; guest_name: string; person_count: number; confirmed: boolean; created_at: string };
type Tab = 'overview' | 'event' | 'program' | 'announcement' | 'faq' | 'guests';

export default function AdminPage() {
  const [password,setPassword]=useState(''),[ready,setReady]=useState(false),[logged,setLogged]=useState(false);
  const [loginError,setLoginError]=useState(''),[busy,setBusy]=useState(false),[content,setContent]=useState<Content>(initialContent);
  const [guests,setGuests]=useState<RSVP[]>([]),[tab,setTab]=useState<Tab>('overview'),[notice,setNotice]=useState('');
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[search,setSearch]=useState('');
  const [filter,setFilter]=useState<'all'|'yes'|'no'>('all');

  const checkSession=useCallback(async()=>{
    try { const {data}=await getSupabase().auth.getSession(); const email=data.session?.user.email?.toLowerCase();
      if(email===ADMIN_EMAIL)setLogged(true); else {setLogged(false);if(data.session)await getSupabase().auth.signOut();}
    } catch {setLogged(false);} finally {setReady(true);}
  },[]);
  const refresh=useCallback(async()=>{
    setLoading(true);setNotice('');
    try { const sb=getSupabase(); const [c,r]=await Promise.all([loadContent(),sb.from('rsvp_responses').select('id,guest_name,person_count,confirmed,created_at').order('created_at',{ascending:false})]);
      if(r.error)throw r.error;setContent(c);setGuests((r.data??[]) as RSVP[]);
    } catch(e){setNotice(e instanceof Error?e.message:'Chargement impossible.');} finally{setLoading(false);}
  },[]);
  useEffect(()=>{void checkSession();let sub:{unsubscribe:()=>void}|undefined;
    try {const sb=getSupabase();const {data}=sb.auth.onAuthStateChange((_event,session)=>{const ok=session?.user.email?.toLowerCase()===ADMIN_EMAIL;setLogged(ok);if(session&&!ok)window.setTimeout(()=>{void sb.auth.signOut();},0);});sub=data.subscription;}catch{}
    return()=>sub?.unsubscribe();
  },[checkSession]);
  useEffect(()=>{if(logged)void refresh();},[logged,refresh]);

  async function login(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setLoginError('');
    try{const {error}=await getSupabase().auth.signInWithPassword({email:ADMIN_EMAIL,password});if(error)throw error;setPassword('');await checkSession();}
    catch(e){setLoginError(e instanceof Error?e.message:'Connexion impossible.');}finally{setBusy(false);}
  }
  async function logout(){await getSupabase().auth.signOut();setLogged(false);setGuests([]);}
  function field<K extends keyof Content>(key:K,value:Content[K]){setContent(v=>({...v,[key]:value}));}
  function editItem(list:'items'|'faq',i:number,patch:Partial<Item>){setContent(v=>({...v,[list]:v[list].map((x,n)=>n===i?{...x,...patch}:x)}));}
  function addItem(list:'items'|'faq'){setContent(v=>({...v,[list]:[...v[list],{id:crypto.randomUUID(),title:'',detail:'',confirmed:false}]}));}
  function removeItem(list:'items'|'faq',i:number){setContent(v=>({...v,[list]:v[list].filter((_,n)=>n!==i)}));}
  async function save(){setSaving(true);setNotice('');try{await saveContent(content);setNotice('Modifications enregistrées. Le site public affichera les nouvelles informations.');}catch(e){setNotice(e instanceof Error?e.message:'Enregistrement impossible.');}finally{setSaving(false);}}
  const shown=useMemo(()=>guests.filter(g=>g.guest_name.toLowerCase().includes(search.trim().toLowerCase())&&(filter==='all'||(filter==='yes'&&g.confirmed)||(filter==='no'&&!g.confirmed))),[guests,search,filter]);
  const yes=guests.filter(g=>g.confirmed).length,no=guests.length-yes,total=guests.reduce((s,g)=>s+(g.confirmed?g.person_count:0),0);
  function exportCsv(){const rows=[['Nom','Réponse','Nombre de personnes','Date'],...shown.map(g=>[g.guest_name,g.confirmed?'Présent(e)':'Absent(e)',String(g.person_count),new Date(g.created_at).toLocaleString('fr-FR')])];
    const csv='\uFEFF'+rows.map(row=>row.map(x=>'"'+x.replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='liste-invites-dot.csv';a.click();URL.revokeObjectURL(url);
  }
  if(!ready)return <main className="admin-wrap"><div className="shell">Vérification de la session…</div></main>;
  if(!logged)return <main className="admin-wrap admin-login"><section className="admin-login-card">
    <div className="admin-login-mark"><LockKeyhole size={25}/></div><div className="eyebrow">Accès réservé à l'organisation</div><h1>Espace organisateurs</h1>
    <p>Le compte est prérempli. Saisissez uniquement le mot de passe partagé par les organisateurs.</p>
    <form onSubmit={login}><label htmlFor="admin-password">Mot de passe</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Saisissez le mot de passe"/>
    {loginError&&<p className="admin-error" role="alert">{loginError}</p>}<button className="button admin-login-submit" disabled={busy}>{busy?'Connexion…':'Se connecter'}</button></form>
    <div className="admin-login-security"><ShieldCheck size={16}/> Accès protégé · réponses privées</div><Link href="/" className="admin-back-link"><ArrowLeft size={16}/> Retour à l’invitation</Link>
  </section></main>;

  const tabs:{id:Tab;label:string;icon:React.ReactNode}[]=[
    {id:'overview',label:'Vue d’ensemble',icon:<Users/>},{id:'event',label:'Date et lieu',icon:<MapPin/>},
    {id:'program',label:'Programme',icon:<ListChecks/>},{id:'announcement',label:'Annonces',icon:<Megaphone/>},
    {id:'faq',label:'Questions fréquentes',icon:<CircleHelp/>},{id:'guests',label:'Invités et réponses',icon:<UserCheck/>},
  ];
  return <main className="admin-wrap"><div className="shell">
    <header className="admin-dashboard-head"><div><div className="eyebrow">Deux héritages, une même union</div><h1>Administration</h1><p>Gestion de la cérémonie et suivi des invités</p></div>
      <div className="row"><Link href="/" className="button secondary small"><ArrowLeft size={16}/> Voir le site</Link><button className="button secondary small" onClick={logout}><LogOut size={16}/> Déconnexion</button></div>
    </header>
    <div className="admin-dashboard-grid"><aside className="admin-menu"><div className="admin-menu-label">GESTION DU MARIAGE</div>
      {tabs.map(t=><button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}>{t.icon}<span>{t.label}</span></button>)}
      <div className="admin-menu-note">Connecté en tant que<br/><strong>{ADMIN_EMAIL}</strong></div>
    </aside><section className="admin-main">
      <div className="admin-section-head"><div><div className="eyebrow">Espace organisateurs</div><h2>{tabs.find(t=>t.id===tab)?.label}</h2></div><button className="button secondary small" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={15}/> Actualiser</button></div>
      {notice&&<div className="admin-success" role="status">{notice}</div>}
      {tab==='overview'&&<><div className="admin-stat-grid">
        <article className="admin-stat"><span>Réponses reçues</span><strong>{guests.length}</strong><small>Tous les invités ayant répondu</small></article>
        <article className="admin-stat"><span>Présences confirmées</span><strong>{yes}</strong><small><UserCheck size={14}/> réponses positives</small></article>
        <article className="admin-stat"><span>Personnes attendues</span><strong>{total}</strong><small>Invités compris</small></article>
        <article className="admin-stat"><span>Indisponibilités</span><strong>{no}</strong><small><UserX size={14}/> réponses négatives</small></article></div>
        <div className="admin-panel"><h3>Raccourcis</h3><div className="admin-shortcuts"><button onClick={()=>setTab('event')}><MapPin/> Modifier lieu et itinéraire</button><button onClick={()=>setTab('program')}><ListChecks/> Modifier le programme</button><button onClick={()=>setTab('guests')}><Users/> Voir les invités</button></div></div>
        <div className="admin-panel"><h3>Informations actuelles</h3><p><b>Date :</b> {content.eventDate} à {content.eventTime}</p><p><b>Lieu :</b> {content.venue}, {content.venueDetail}</p><p><b>Étapes :</b> {content.items.length} · <b>Questions :</b> {content.faq.length}</p></div></>}

      {tab==='event'&&<div className="admin-panel"><h3>Informations de la cérémonie</h3><p className="admin-muted">Ces informations seront publiées sur l’invitation après enregistrement.</p><div className="admin-form-grid">
        <div><label>Date</label><input type="date" value={content.eventDate} onChange={e=>field('eventDate',e.target.value)}/></div><div><label>Heure</label><input type="time" value={content.eventTime} onChange={e=>field('eventTime',e.target.value)}/></div>
        <div><label>Nom du futur marié</label><input value={content.groomName} onChange={e=>field('groomName',e.target.value)}/></div><div><label>Nom de la future mariée</label><input value={content.brideName} onChange={e=>field('brideName',e.target.value)}/></div>
        <div className="admin-full"><label>Noms des familles</label><input value={content.familyNames} onChange={e=>field('familyNames',e.target.value)}/></div>
        <div><label>Commune / quartier</label><input value={content.venue} onChange={e=>field('venue',e.target.value)}/></div><div><label>Repère / précision</label><input value={content.venueDetail} onChange={e=>field('venueDetail',e.target.value)}/></div>
        <div className="admin-full"><label>Lien Google Maps / itinéraire</label><input type="url" value={content.mapUrl} onChange={e=>field('mapUrl',e.target.value)} placeholder="https://maps.google.com/…"/><small className="admin-muted">Collez le lien de partage Google Maps.</small></div>
        <div className="admin-full"><label>WhatsApp Refontiq</label><input value={content.refoWhatsApp} onChange={e=>field('refoWhatsApp',e.target.value)}/></div></div>
        <button className="button" onClick={()=>void save()} disabled={saving}><Save size={16}/>{saving?'Enregistrement…':'Enregistrer les informations'}</button></div>}

      {tab==='program'&&<div className="admin-panel"><div className="admin-inline-head"><div><h3>Programme de la journée</h3><p className="admin-muted">Ajoutez, modifiez, confirmez ou supprimez une étape.</p></div><button className="button secondary small" onClick={()=>addItem('items')}><Plus size={16}/> Ajouter</button></div>
        {content.items.map((item,i)=><div className="admin-edit-card" key={item.id}><div className="admin-edit-card-head"><b>Étape {i+1}</b><button className="admin-icon-button danger" onClick={()=>removeItem('items',i)} aria-label="Supprimer"><Trash2/></button></div>
          <label>Intitulé</label><input value={item.title} onChange={e=>editItem('items',i,{title:e.target.value})}/><label>Détails, heure et consignes</label><textarea value={item.detail} onChange={e=>editItem('items',i,{detail:e.target.value})}/><label className="admin-checkbox"><input type="checkbox" checked={item.confirmed} onChange={e=>editItem('items',i,{confirmed:e.target.checked})}/> Information confirmée</label></div>)}
        <button className="button" onClick={()=>void save()} disabled={saving}><Save size={16}/>{saving?'Enregistrement…':'Enregistrer le programme'}</button></div>}

      {tab==='announcement'&&<div className="admin-panel"><h3>Annonce pour les invités</h3><p className="admin-muted">Ce message apparaît dans la section « La dernière nouvelle ».</p><label>Message</label><textarea className="admin-large-textarea" value={content.announcement} onChange={e=>field('announcement',e.target.value)} placeholder="Écrivez une information à communiquer…"/><button className="button" onClick={()=>void save()} disabled={saving}><Save size={16}/>{saving?'Enregistrement…':'Publier l’annonce'}</button></div>}

      {tab==='faq'&&<div className="admin-panel"><div className="admin-inline-head"><div><h3>Questions fréquentes</h3><p className="admin-muted">Les réponses sont visibles par tous les invités.</p></div><button className="button secondary small" onClick={()=>addItem('faq')}><Plus size={16}/> Ajouter</button></div>
        {content.faq.map((item,i)=><div className="admin-edit-card" key={item.id}><div className="admin-edit-card-head"><b>Question {i+1}</b><button className="admin-icon-button danger" onClick={()=>removeItem('faq',i)} aria-label="Supprimer"><Trash2/></button></div>
          <label>Question</label><input value={item.title} onChange={e=>editItem('faq',i,{title:e.target.value})}/><label>Réponse</label><textarea value={item.detail} onChange={e=>editItem('faq',i,{detail:e.target.value})}/><label className="admin-checkbox"><input type="checkbox" checked={item.confirmed} onChange={e=>editItem('faq',i,{confirmed:e.target.checked})}/> Réponse confirmée</label></div>)}
        <button className="button" onClick={()=>void save()} disabled={saving}><Save size={16}/>{saving?'Enregistrement…':'Enregistrer la FAQ'}</button></div>}

      {tab==='guests'&&<div className="admin-panel"><div className="admin-inline-head"><div><h3>Réponses des invités</h3><p className="admin-muted">Liste privée accessible uniquement aux organisateurs.</p></div><button className="button secondary small" onClick={exportCsv}><Download size={16}/> Exporter CSV / Excel</button></div>
        <div className="admin-guest-tools"><div className="admin-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un nom…"/></div><select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">Toutes les réponses</option><option value="yes">Présences confirmées</option><option value="no">Absences</option></select></div>
        <div className="admin-guest-summary">{shown.length} réponse(s) affichée(s) · {total} personne(s) attendue(s)</div><div className="admin-table-wrap"><table className="admin-guest-table"><thead><tr><th>Nom</th><th>Réponse</th><th>Personnes</th><th>Date</th></tr></thead><tbody>
          {shown.map(g=><tr key={g.id}><td>{g.guest_name}</td><td><span className={g.confirmed?'admin-status yes':'admin-status no'}>{g.confirmed?'Présent(e)':'Absent(e)'}</span></td><td>{g.person_count}</td><td>{new Date(g.created_at).toLocaleDateString('fr-FR')}</td></tr>)}
          {!shown.length&&<tr><td colSpan={4} className="admin-empty">{loading?'Chargement…':'Aucune réponse pour ce filtre.'}</td></tr>}</tbody></table></div>
        <p className="admin-muted admin-export-note"><Download size={14}/> Le CSV est encodé pour s’ouvrir dans Excel.</p></div>}
    </section></div><footer className="admin-dashboard-footer">Espace privé de l’organisation · <Link href="/">Retour à l’invitation</Link></footer>
  </div></main>;
}
