'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, LogOut, LockKeyhole, Users, UserCheck, UserX, MapPin, ListChecks, Megaphone, CircleHelp, Save, Plus, Trash2, Download, RefreshCw, Search, ShieldCheck, ShoppingBag, ImagePlus } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { initialContent, loadContent, saveContent, type Content, type Item } from '@/lib/content';
import { declaredGroupSize, normalizeNameKey, summarizeGuests } from '@/lib/rsvp';

const ADMIN_EMAIL = 'refontiq@gmail.com';
type Companion = { id: string; full_name: string; position: number };
type RSVP = { id: string; guest_name: string; phone: string | null; person_count: number; confirmed: boolean; created_at: string; updated_at: string | null; rsvp_companions: Companion[] | null };
type GuestFilter = 'all' | 'yes' | 'no' | 'principals' | 'companions' | 'duplicates';
type PersonRow = { key: string; rsvpId: string; name: string; kind: 'principal' | 'companion'; phone: string | null; principal: string; groupSize: number; confirmed: boolean; createdAt: string; updatedAt: string | null; duplicate: boolean };
type Tab = 'overview' | 'event' | 'program' | 'announcement' | 'faq' | 'guests' | 'pagne';

export default function AdminPage() {
  const [password,setPassword]=useState(''),[ready,setReady]=useState(false),[logged,setLogged]=useState(false);
  const [loginError,setLoginError]=useState(''),[busy,setBusy]=useState(false),[content,setContent]=useState<Content>(initialContent);
  const [guests,setGuests]=useState<RSVP[]>([]),[tab,setTab]=useState<Tab>('overview'),[notice,setNotice]=useState('');
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[search,setSearch]=useState('');
  const [filter,setFilter]=useState<GuestFilter>('all');
  const [uploadingPagne,setUploadingPagne]=useState(false);

  const checkSession=useCallback(async()=>{
    try { const {data}=await getSupabase().auth.getSession(); const email=data.session?.user.email?.toLowerCase();
      if(email===ADMIN_EMAIL)setLogged(true); else {setLogged(false);if(data.session)await getSupabase().auth.signOut();}
    } catch {setLogged(false);} finally {setReady(true);}
  },[]);
  const refresh=useCallback(async()=>{
    setLoading(true);setNotice('');
    try { const sb=getSupabase(); const [c,r]=await Promise.all([loadContent(),sb.from('rsvp_responses').select('id,guest_name,phone,person_count,confirmed,created_at,updated_at,rsvp_companions(id,full_name,position)').order('created_at',{ascending:false})]);
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
    catch(e){const raw=e instanceof Error?e.message:'';
      setLoginError(/invalid login credentials/i.test(raw)?'Mot de passe incorrect. Vérifiez votre saisie, puis réessayez.':/too many|rate limit/i.test(raw)?'Trop de tentatives. Patientez une minute avant de réessayer.':'Connexion impossible pour le moment. Réessayez dans un instant.');}
    finally{setBusy(false);}
  }
  async function logout(){await getSupabase().auth.signOut();setLogged(false);setGuests([]);}
  function field<K extends keyof Content>(key:K,value:Content[K]){setContent(v=>({...v,[key]:value}));}
  function editItem(list:'items'|'faq',i:number,patch:Partial<Item>){setContent(v=>({...v,[list]:v[list].map((x,n)=>n===i?{...x,...patch}:x)}));}
  function addItem(list:'items'|'faq'){setContent(v=>({...v,[list]:[...v[list],{id:crypto.randomUUID(),title:'',detail:'',confirmed:false}]}));}
  function removeItem(list:'items'|'faq',i:number){setContent(v=>({...v,[list]:v[list].filter((_,n)=>n!==i)}));}
  async function save(){setSaving(true);setNotice('');try{if(!content.eventDate||!content.eventTime||!content.venue.trim())throw new Error('La date, l’heure et le lieu sont obligatoires.');const map=new URL(content.mapUrl);if(!['http:','https:'].includes(map.protocol))throw new Error('Le lien d’itinéraire doit commencer par https:// ou http://.');await saveContent(content);setNotice('Modifications enregistrées. Le site public affichera les nouvelles informations.');}catch(e){setNotice(e instanceof Error?e.message:'Enregistrement impossible.');}finally{setSaving(false);}}
  async function uploadPagneImage(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setNotice('Choisissez une image JPG, PNG ou WebP.');return;}
    if(file.size>5*1024*1024){setNotice('L’image ne doit pas dépasser 5 Mo.');return;}
    setUploadingPagne(true);setNotice('');
    try{
      const sb=getSupabase();
      const {error}=await sb.storage.from('dot-pagne').upload('pagne/visuel',file,{upsert:true,contentType:file.type,cacheControl:'3600'});
      if(error)throw error;
      const {data}=sb.storage.from('dot-pagne').getPublicUrl('pagne/visuel');
      const next={...content,pagne:{...content.pagne,imageUrl:`${data.publicUrl}?v=${Date.now()}`}};
      await saveContent(next);
      setContent(next);
      setNotice('Photo du pagne mise à jour et publiée.');
    }catch(e){setNotice(e instanceof Error?e.message:'Envoi de la photo impossible.');}
    finally{setUploadingPagne(false);}
  }
  function addPagneContact(){field('pagne',{...content.pagne,contacts:[...content.pagne.contacts,{id:crypto.randomUUID(),label:'',phone:''}]});}
  function editPagneContact(index:number,patch:Partial<Content['pagne']['contacts'][number]>){
    field('pagne',{...content.pagne,contacts:content.pagne.contacts.map((item,i)=>i===index?{...item,...patch}:item)});
  }
  function removePagneContact(index:number){field('pagne',{...content.pagne,contacts:content.pagne.contacts.filter((_,i)=>i!==index)});}
  const summary=useMemo(()=>summarizeGuests(guests),[guests]);
  const people=useMemo<PersonRow[]>(()=>{
    const rows:PersonRow[]=[];
    for(const g of guests){
      const companions=[...(g.rsvp_companions??[])].sort((a,b)=>a.position-b.position);
      const size=declaredGroupSize(g.person_count,companions.length,g.confirmed);
      rows.push({key:`p:${g.id}`,rsvpId:g.id,name:g.guest_name,kind:'principal',phone:g.phone,principal:g.guest_name,groupSize:size,confirmed:g.confirmed,createdAt:g.created_at,updatedAt:g.updated_at,duplicate:false});
      for(const c of companions) rows.push({key:`c:${c.id}`,rsvpId:g.id,name:c.full_name,kind:'companion',phone:null,principal:g.guest_name,groupSize:size,confirmed:g.confirmed,createdAt:g.created_at,updatedAt:g.updated_at,duplicate:false});
    }
    // Un nom identique dans deux groupes distincts est signalé, jamais fusionné.
    const groups=new Map<string,Set<string>>();
    for(const row of rows){const key=normalizeNameKey(row.name);if(!key)continue;const ids=groups.get(key)??new Set<string>();ids.add(row.rsvpId);groups.set(key,ids);}
    return rows.map(row=>{const key=normalizeNameKey(row.name);const ids=groups.get(key);return {...row,duplicate:Boolean(ids&&ids.size>1)};});
  },[guests]);
  const searchTerm=search.trim().toLowerCase();
  const shown=useMemo(()=>people.filter(p=>{
    if(searchTerm&&!p.name.toLowerCase().includes(searchTerm)&&!p.principal.toLowerCase().includes(searchTerm))return false;
    if(filter==='yes')return p.confirmed;
    if(filter==='no')return !p.confirmed;
    if(filter==='principals')return p.kind==='principal';
    if(filter==='companions')return p.kind==='companion';
    if(filter==='duplicates')return p.duplicate;
    return true;
  }),[people,searchTerm,filter]);
  function exportCsv(){const rows=[['Nom','Type','Téléphone','Invité principal','Groupe','Réponse','Créé le','Modifié le'],...shown.map(p=>[p.name,p.kind==='principal'?'Invité principal':'Accompagnateur',p.phone??'',p.kind==='companion'?p.principal:'',p.confirmed?`${p.groupSize} personne(s)`:'',p.confirmed?'Présent(e)':'Absent(e)',new Date(p.createdAt).toLocaleString('fr-FR'),p.updatedAt?new Date(p.updatedAt).toLocaleString('fr-FR'):''])];
    const csv='\uFEFF'+rows.map(row=>row.map(x=>{const safe=/^[=+\-@]/.test(x)?`'${x}`:x;return '"'+safe.replace(/"/g,'""')+'"';}).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='liste-invites-dot.csv';a.click();URL.revokeObjectURL(url);
  }
  if(!ready)return <main className="admin-wrap"><div className="shell">Vérification de la session…</div></main>;
  if(!logged)return <main className="admin-wrap admin-login"><section className="admin-login-card">
    <div className="admin-login-mark"><LockKeyhole size={25}/></div><div className="eyebrow">Accès réservé à l’organisation</div><h1>Espace organisateurs</h1>
    <p>L’adresse du compte est déjà renseignée. Saisissez le mot de passe communiqué par les organisateurs.</p>
    <form onSubmit={login}><label htmlFor="admin-password">Mot de passe</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Saisissez le mot de passe"/>
    {loginError&&<p className="admin-error" role="alert">{loginError}</p>}<button className="button admin-login-submit" disabled={busy}>{busy?'Connexion…':'Se connecter'}</button></form>
    <div className="admin-login-security"><ShieldCheck size={16}/> Connexion sécurisée · réponses confidentielles</div><Link href="/" className="admin-back-link"><ArrowLeft size={16}/> Retour à l’invitation</Link>
  </section></main>;

  const tabs:{id:Tab;label:string;icon:ReactNode}[]=[
    {id:'overview',label:'Vue d’ensemble',icon:<Users/>},{id:'event',label:'Date et lieu',icon:<MapPin/>},
    {id:'program',label:'Programme',icon:<ListChecks/>},{id:'announcement',label:'Annonces',icon:<Megaphone/>},
    {id:'faq',label:'Questions fréquentes',icon:<CircleHelp/>},{id:'guests',label:'Invités et réponses',icon:<UserCheck/>},
    {id:'pagne',label:'Pagne de la dot',icon:<ShoppingBag/>},
  ];
  return <main className="admin-wrap"><div className="shell">
    <header className="admin-dashboard-head"><div><div className="eyebrow">Deux héritages, une même union</div><h1>Administration</h1><p>Gestion de la cérémonie et suivi des invités</p></div>
      <div className="row"><Link href="/" className="button secondary small"><ArrowLeft size={16}/> Voir le site</Link><button className="button secondary small" onClick={logout}><LogOut size={16}/> Déconnexion</button></div>
    </header>
    <div className="admin-dashboard-grid"><aside className="admin-menu"><div className="admin-menu-label">GESTION DE LA CÉRÉMONIE</div>
      {tabs.map(t=><button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}>{t.icon}<span>{t.label}</span></button>)}
      <div className="admin-menu-note">Connecté en tant que<br/><strong>{ADMIN_EMAIL}</strong></div>
    </aside><section className="admin-main">
      <div className="admin-section-head"><div><div className="eyebrow">Espace organisateurs</div><h2>{tabs.find(t=>t.id===tab)?.label}</h2></div><button className="button secondary small" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={15}/> Actualiser</button></div>
      {notice&&<div className="admin-success" role="status">{notice}</div>}
      {tab==='overview'&&<><div className="admin-stat-grid">
        <article className="admin-stat"><span>Réponses reçues</span><strong>{summary.responses}</strong><small>Invités principaux ayant répondu</small></article>
        <article className="admin-stat"><span>Présences confirmées</span><strong>{summary.attending}</strong><small><UserCheck size={14}/> réponses positives</small></article>
        <article className="admin-stat"><span>Personnes attendues</span><strong>{summary.expectedPeople}</strong><small>{summary.attending} principal{summary.attending > 1 ? 'aux' : ''} + {summary.companions} accompagnateur{summary.companions > 1 ? 's' : ''}</small></article>
        <article className="admin-stat"><span>Indisponibilités</span><strong>{summary.declined}</strong><small><UserX size={14}/> réponses négatives</small></article></div>
        <div className="admin-panel"><h3>Raccourcis</h3><div className="admin-shortcuts"><button onClick={()=>setTab('event')}><MapPin/> Modifier lieu et itinéraire</button><button onClick={()=>setTab('program')}><ListChecks/> Modifier le programme</button><button onClick={()=>setTab('guests')}><Users/> Voir les invités</button><button onClick={()=>setTab('pagne')}><ImagePlus/> Ajouter la photo du pagne</button></div></div>
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

      {tab==='pagne'&&<div className="admin-panel"><h3>Le pagne de la dot</h3>
        <p className="admin-muted">Une présentation simple : photo, prix et contacts directs des vendeurs.</p>
        <div className="admin-edit-card">
          <div className="admin-edit-card-head"><b>Photo du pagne</b><ImagePlus size={20}/></div>
          {content.pagne.imageUrl&&<img className="admin-pagne-preview" src={content.pagne.imageUrl} alt="Aperçu du pagne"/>}
          <label htmlFor="pagne-image">Téléverser ou remplacer la photo</label>
          <input id="pagne-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPagneImage} disabled={uploadingPagne}/>
          <p className="admin-muted">{uploadingPagne?'Téléversement en cours…':'JPG, PNG ou WebP · 5 Mo maximum. La photo est publiée dès son envoi.'}</p>
          <label htmlFor="pagne-image-url">Ou coller le lien d’une photo en ligne</label>
          <input id="pagne-image-url" type="url" value={content.pagne.imageUrl} onChange={e=>field('pagne',{...content.pagne,imageUrl:e.target.value})} placeholder="https://exemple.com/photo-pagne.jpg"/>
          <p className="admin-muted">Le lien est enregistré avec le bouton « Enregistrer le pagne et les contacts ».</p>
        </div>
        <label className="admin-checkbox"><input type="checkbox" checked={content.pagne.enabled} onChange={e=>field('pagne',{...content.pagne,enabled:e.target.checked})}/> Afficher le pagne sur l’invitation</label>
        <div className="admin-form-grid">
          <div><label>Prix (FCFA)</label><input type="number" min="0" step="50" value={content.pagne.price} onChange={e=>field('pagne',{...content.pagne,price:Number(e.target.value)})}/></div>
          <div className="admin-full"><label>Description courte</label><textarea value={content.pagne.description} onChange={e=>field('pagne',{...content.pagne,description:e.target.value})}/></div>
        </div>
        <div className="admin-inline-head"><div><h3>Contacts des vendeurs</h3><p className="admin-muted">Chaque numéro affiche les boutons Appeler et WhatsApp.</p></div><button className="button secondary small" onClick={addPagneContact}><Plus size={16}/> Ajouter un vendeur</button></div>
        {content.pagne.contacts.map((contact,i)=><div className="admin-edit-card" key={contact.id}>
          <div className="admin-edit-card-head"><b>Vendeur {i+1}</b><button className="admin-icon-button danger" onClick={()=>removePagneContact(i)} aria-label="Supprimer ce vendeur"><Trash2/></button></div>
          <label>Nom ou repère du vendeur</label><input value={contact.label} onChange={e=>editPagneContact(i,{label:e.target.value})} placeholder="Ex. : Vendeur 1"/>
          <label>Numéro de téléphone (avec indicatif pays pour WhatsApp)</label><input type="tel" value={contact.phone} onChange={e=>editPagneContact(i,{phone:e.target.value})} placeholder="Ex. : +225 07 00 00 00 00"/>
        </div>)}
        <button className="button" onClick={()=>void save()} disabled={saving}><Save size={16}/>{saving?'Enregistrement…':'Enregistrer le pagne et les contacts'}</button>
      </div>}

      {tab==='guests'&&<div className="admin-panel"><div className="admin-inline-head"><div><h3>Réponses des invités</h3><p className="admin-muted">Liste privée accessible uniquement aux organisateurs.</p></div><button className="button secondary small" onClick={exportCsv}><Download size={16}/> Exporter CSV / Excel</button></div>
        <div className="admin-guest-tools"><div className="admin-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un nom…"/></div><select value={filter} onChange={e=>setFilter(e.target.value as GuestFilter)}>
          <option value="all">Toutes les personnes</option><option value="principals">Invités principaux</option><option value="companions">Accompagnateurs</option><option value="yes">Présences confirmées</option><option value="no">Absences</option><option value="duplicates">Doublons potentiels</option></select></div>
        <div className="admin-guest-summary">{shown.length} {shown.length > 1 ? 'personnes affichées' : 'personne affichée'} · {summary.expectedPeople} {summary.expectedPeople > 1 ? 'personnes attendues' : 'personne attendue'} · {summary.companions} accompagnateur{summary.companions > 1 ? 's' : ''}</div><div className="admin-table-wrap"><table className="admin-guest-table"><thead><tr><th>Nom</th><th>Type</th><th>Téléphone</th><th>Invité principal</th><th>Groupe</th><th>Réponse</th><th>Créé le</th><th>Modifié le</th></tr></thead><tbody>
          {shown.map(p=><tr key={p.key}><td>{p.name}{p.duplicate&&<span className="admin-duplicate" title="Un nom identique apparaît dans un autre groupe">Doublon possible</span>}</td><td>{p.kind==='principal'?'Invité principal':'Accompagnateur'}</td><td>{p.phone?<a href={`tel:${p.phone.replace(/[^+\d]/g,'')}`}>{p.phone}</a>:'—'}</td><td>{p.kind==='companion'?p.principal:'—'}</td><td>{p.confirmed?`${p.groupSize} pers.`:'—'}</td><td><span className={p.confirmed?'admin-status yes':'admin-status no'}>{p.confirmed?'Présent(e)':'Absent(e)'}</span></td><td>{new Date(p.createdAt).toLocaleDateString('fr-FR')}</td><td>{p.updatedAt?new Date(p.updatedAt).toLocaleDateString('fr-FR'):'—'}</td></tr>)}
          {!shown.length&&<tr><td colSpan={8} className="admin-empty">{loading?'Chargement…':'Aucune personne pour ce filtre.'}</td></tr>}</tbody></table></div>
        <p className="admin-muted admin-export-note"><Download size={14}/> Les accompagnateurs n’ont pas de numéro propre : leur contact de référence est l’invité principal.</p></div>}
    </section></div><footer className="admin-dashboard-footer">Espace privé de l’organisation · <Link href="/">Retour à l’invitation</Link></footer>
  </div></main>;
}
