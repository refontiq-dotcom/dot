'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Bus, Home, LogOut, MessageCircle, Phone, LockKeyhole, Users, UserCheck, UserX, MapPin, ListChecks, Megaphone, CircleHelp, Save, Plus, Trash2, Download, RefreshCw, Search, ShieldCheck, ShoppingBag, ImagePlus } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { initialContent, loadContent, saveContent, type Content, type Item } from '@/lib/content';
import { declaredGroupSize, namesMayReferToSamePerson, summarizeGuests } from '@/lib/rsvp';
import { formatRange, sortByTime } from '@/lib/program';

const ADMIN_EMAIL = 'refontiq@gmail.com';
const plain = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const phoneDigits = (phone: string) => { const d = phone.replace(/\D/g, ''); return d.length === 10 ? `225${d}` : d; };
type Companion = { id: string; full_name: string; position: number };
type RSVP = { id: string; guest_name: string; phone: string | null; person_count: number; confirmed: boolean; attendance_status?: 'accepted' | 'waitlisted' | 'declined' | 'review'; created_at: string; updated_at: string | null; rsvp_companions: Companion[] | null };
type GuestFilter = 'all' | 'yes' | 'no' | 'waitlisted' | 'check';
type GuestGroup = { id: string; name: string; phone: string | null; confirmed: boolean; status: 'accepted' | 'waitlisted' | 'declined' | 'review'; size: number; companions: string[]; unnamed: number; createdAt: string; updatedAt: string | null; duplicates: string[] };
type Tab = 'overview' | 'travel' | 'event' | 'program' | 'announcement' | 'faq' | 'guests' | 'pagne';

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
    try { const sb=getSupabase(); const {data:auth}=await sb.auth.getSession(); const token=auth.session?.access_token;
      if(!token)throw new Error('Votre session organisateur a expiré. Reconnectez-vous.');
      const [c,r,privateResponse]=await Promise.all([
        loadContent(),
        sb.from('rsvp_responses').select('id,guest_name,phone,person_count,confirmed,attendance_status,created_at,updated_at,rsvp_companions(id,full_name,position)').order('created_at',{ascending:false}),
        fetch('/api/admin/event-details',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'}),
      ]);
      if(r.error)throw r.error;
      const privateResult=await privateResponse.json();
      if(!privateResponse.ok)throw new Error(privateResult.error||'Impossible de charger le lieu privé.');
      const d=privateResult.details??{};
      setContent({...c,venue:String(d.venue??''),venueDetail:String(d.venue_detail??''),mapUrl:String(d.map_url??''),travel:{...c.travel,...(d.travel??{})}});
      setGuests((r.data??[]) as RSVP[]);
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
  async function resolveReview(id:string,decision:'accepted'|'declined'){
    setNotice('');
    try{
      const {data}=await getSupabase().auth.getSession();
      const token=data.session?.access_token;
      if(!token)throw new Error('Votre session organisateur a expiré. Reconnectez-vous.');
      const response=await fetch('/api/admin/rsvp-review',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({id,decision})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Impossible de traiter cette demande.');
      await refresh();
      setNotice(result.status==='waitlisted'?'Demande validée, mais le groupe est placé en attente faute de places disponibles.':decision==='accepted'?'Demande vérifiée : invitation confirmée.':'Demande vérifiée : invitation refusée.');
    }catch(e){setNotice(e instanceof Error?e.message:'Impossible de traiter cette demande.');}
  }
  function field<K extends keyof Content>(key:K,value:Content[K]){setContent(v=>({...v,[key]:value}));}
  function setTravel(patch:Partial<Content['travel']>){setContent(v=>({...v,travel:{...v.travel,...patch}}));}
  function editBusLine(i:number,patch:Partial<Content['travel']['busLines'][number]>){setContent(v=>({...v,travel:{...v.travel,busLines:v.travel.busLines.map((l,n)=>n===i?{...l,...patch}:l)}}));}
  function addBusLine(){setContent(v=>({...v,travel:{...v.travel,busLines:[...v.travel.busLines,{id:crypto.randomUUID(),number:'',from:'',to:''}]}}));}
  function removeBusLine(i:number){setContent(v=>({...v,travel:{...v.travel,busLines:v.travel.busLines.filter((_,n)=>n!==i)}}));}
  function editItem(list:'items'|'faq',i:number,patch:Partial<Item>){setContent(v=>({...v,[list]:v[list].map((x,n)=>n===i?{...x,...patch}:x)}));}
  function addItem(list:'items'|'faq'){setContent(v=>({...v,[list]:[...v[list],{id:crypto.randomUUID(),title:'',detail:'',confirmed:false}]}));}
  function moveItem(i:number,dir:-1|1){setContent(v=>{const j=i+dir;if(j<0||j>=v.items.length)return v;const items=[...v.items];[items[i],items[j]]=[items[j],items[i]];return {...v,items};});}
  function sortItemsByTime(){setContent(v=>({...v,items:sortByTime(v.items)}));}
  function removeItem(list:'items'|'faq',i:number){setContent(v=>({...v,[list]:v[list].filter((_,n)=>n!==i)}));}
  async function save(){setSaving(true);setNotice('');try{if(!content.heroTitle.trim())throw new Error('Le titre principal ne peut pas être vide.');if(!content.travel.stopName.trim())throw new Error('Indiquez le nom de l’arrêt où les bus descendent.');if(!content.eventDate||!content.eventTime||!content.venue.trim())throw new Error('La date, l’heure et le lieu sont obligatoires.');const map=new URL(content.mapUrl);if(!['http:','https:'].includes(map.protocol))throw new Error('Le lien d’itinéraire doit commencer par https:// ou http://.');const next={...content,heroTitle:content.heroTitle.trim()};
      await saveContent(next);
      const sb=getSupabase();const {data:auth}=await sb.auth.getSession();const token=auth.session?.access_token;
      if(!token)throw new Error('Votre session organisateur a expiré. Reconnectez-vous.');
      const privateResponse=await fetch('/api/admin/event-details',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({venue:next.venue,venueDetail:next.venueDetail,mapUrl:next.mapUrl,travel:next.travel})});
      const privateResult=await privateResponse.json();
      if(!privateResponse.ok)throw new Error(privateResult.error||'Impossible d’enregistrer le lieu privé.');
      setContent(next);setNotice('Modifications enregistrées. Le lieu reste privé et ne sera communiqué qu’aux invités acceptés.');}catch(e){const raw=e instanceof Error?e.message:'';setNotice(/column .*(time|phase|highlight).* does not exist/i.test(raw)?'Le programme nécessite une mise à jour de la base : exécutez les migrations 20261106000002 et 20261106000003 dans Supabase, puis réessayez.':raw||'Enregistrement impossible.');}finally{setSaving(false);}}
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
  const acceptedGuests=guests.filter(g=>g.attendance_status ? g.attendance_status==='accepted' : g.confirmed);
  const waitlistedGuests=guests.filter(g=>g.attendance_status==='waitlisted');
  const summary=useMemo(()=>summarizeGuests(acceptedGuests),[acceptedGuests]);
  const closeOnes=Math.max(summary.expectedPeople-summary.attending,0);
  const acceptedPeople=summary.expectedPeople;
  const groups=useMemo<GuestGroup[]>(()=>{
    const list:GuestGroup[]=guests.map(g=>{
      const companions=[...(g.rsvp_companions??[])].sort((a,b)=>a.position-b.position).map(c=>c.full_name);
      const status=g.attendance_status??(g.confirmed?'accepted':'declined');
      const size=status==='declined'?0:Math.max(Number(g.person_count)||0,companions.length+1);
      return {id:g.id,name:g.guest_name,phone:g.phone,confirmed:status==='accepted',status,size,companions,unnamed:status==='accepted'?Math.max(size-1-companions.length,0):0,createdAt:g.created_at,updatedAt:g.updated_at,duplicates:[]};
    });
    // Les ressemblances entre groupes sont signalées sans fusion ni modification automatique.
    return list.map(g=>({...g,duplicates:[g.name,...g.companions].filter(name=>
      list.some(other=>other.id!==g.id&&[other.name,...other.companions].some(candidate=>namesMayReferToSamePerson(name,candidate)))
    )}));
  },[guests]);
  const searchTerm=plain(search.trim());
  const counts={all:groups.length,yes:groups.filter(g=>g.status==='accepted').length,no:groups.filter(g=>g.status==='declined').length,waitlisted:groups.filter(g=>g.status==='waitlisted').length,check:groups.filter(g=>g.status==='review'||g.duplicates.length>0).length};
  const shown=useMemo(()=>groups.filter(g=>{
    if(searchTerm&&![g.name,...g.companions].some(n=>plain(n).includes(searchTerm)))return false;
    if(filter==='yes')return g.confirmed;
    if(filter==='no')return g.status==='declined';
    if(filter==='waitlisted')return g.status==='waitlisted';
    if(filter==='check')return g.status==='review'||g.duplicates.length>0;
    return true;
  }),[groups,searchTerm,filter]);
  function exportCsv(){
    const day=(v:string)=>new Date(v).toLocaleDateString('fr-FR');
    const rows=[['Nom','Invité ou proche','Venu(e) avec','Téléphone','Réponse','Personnes dans le groupe','Répondu le'],
      ...shown.flatMap(g=>{
        const answer=g.status==='accepted'?'Présent(e)':g.status==='waitlisted'?'En attente':g.status==='review'?'À vérifier':'Absent(e)',size=g.status==='accepted'?String(g.size):'0';
        return [[g.name,'Invité','',g.phone??'',answer,size,day(g.createdAt)],
          ...g.companions.map(n=>[n,'Proche',g.name,'',answer,size,day(g.createdAt)]),
          ...(g.unnamed>0?[[`${g.unnamed} proche${g.unnamed>1?'s':''} (nom non donné)`,'Proche',g.name,'',answer,size,day(g.createdAt)]]:[])];
      })];
    const csv='\uFEFF'+rows.map(row=>row.map(x=>{const safe=/^[=+\-@]/.test(x)?`'${x}`:x;return '"'+safe.replace(/"/g,'""')+'"';}).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='liste-invites-dot.csv';a.click();URL.revokeObjectURL(url);
  }
  if(!ready)return <main className="admin-wrap"><div className="shell">Vérification de la session…</div></main>;
  if(!logged)return <main className="admin-wrap admin-login"><section className="admin-login-card">
    <div className="admin-login-mark"><LockKeyhole size={25}/></div><div className="eyebrow">Accès réservé à l’organisation</div><h1>Espace organisateurs</h1>
    <p>Entrez le mot de passe que les organisateurs vous ont donné.</p>
    <form onSubmit={login}><label htmlFor="admin-password">Mot de passe</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Saisissez le mot de passe"/>
    {loginError&&<p className="admin-error" role="alert">{loginError}</p>}<button className="button admin-login-submit" disabled={busy}>{busy?'Connexion…':'Se connecter'}</button></form>
    <div className="admin-login-security"><ShieldCheck size={16}/> Connexion sécurisée · réponses confidentielles</div><Link href="/" className="admin-back-link"><ArrowLeft size={16}/> Retour à l’invitation</Link>
  </section></main>;

  const tabs:{id:Tab;label:string;help:string;icon:ReactNode}[]=[
    {id:'overview',label:'Accueil',help:'Un résumé simple de vos invités et de ce qu’il reste à faire.',icon:<Home/>},
    {id:'guests',label:'Liste des invités',help:'Qui vient, avec qui, et comment les joindre.',icon:<Users/>},
    {id:'event',label:'Titre, date et lieu',help:'Le titre du site, la date, l’heure et le lieu affichés sur l’invitation.',icon:<MapPin/>},
    {id:'travel',label:'Trajet (bus, taxi)',help:'Les bus et les indications montrés aux invités après leur confirmation.',icon:<Bus/>},
    {id:'program',label:'Programme',help:'Les étapes de la journée, telles que vos invités les voient.',icon:<ListChecks/>},
    {id:'announcement',label:'Message aux invités',help:'Un message mis en avant en haut du site.',icon:<Megaphone/>},
    {id:'faq',label:'Questions des invités',help:'Les réponses aux questions que se posent vos invités.',icon:<CircleHelp/>},
    {id:'pagne',label:'Pagne de la dot',help:'La photo, le prix et les vendeurs du pagne.',icon:<ShoppingBag/>},
  ];
  const plural=(n:number,one:string,many:string)=>`${n} ${n>1?many:one}`;
  const pendingProgram=content.items.filter(i=>!i.confirmed).length,pendingFaq=content.faq.filter(i=>!i.confirmed).length;
  const todos:{text:string;tab:Tab;filter?:GuestFilter;action:string}[]=[];
  if(counts.check>0)todos.push({text:`${plural(counts.check,'réponse à vérifier','réponses à vérifier')} : un même nom apparaît deux fois.`,tab:'guests',filter:'check',action:'Voir'});
  if(pendingProgram>0)todos.push({text:`${plural(pendingProgram,'étape du programme est','étapes du programme sont')} encore « à confirmer ».`,tab:'program',action:'Compléter'});
  if(pendingFaq>0)todos.push({text:`${plural(pendingFaq,'réponse aux questions est','réponses aux questions sont')} encore « à confirmer ».`,tab:'faq',action:'Compléter'});
  if(content.pagne.enabled&&!content.pagne.imageUrl)todos.push({text:'La photo du pagne n’a pas encore été ajoutée.',tab:'pagne',action:'Ajouter'});
  const eventDay=(()=>{const d=new Date(`${content.eventDate}T12:00:00`);return Number.isNaN(d.getTime())?content.eventDate:d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});})();
  const current=tabs.find(t=>t.id===tab);
  return <main className="admin-wrap"><div className="shell">
    <header className="admin-dashboard-head"><div><div className="eyebrow">{content.heroTitle.trim() || initialContent.heroTitle}</div><h1>Espace organisateurs</h1><p>Suivez vos invités et modifiez le site, simplement.</p></div>
      <div className="row"><Link href="/" className="button secondary small"><ArrowLeft size={16}/> Voir le site</Link><button className="button secondary small" onClick={logout}><LogOut size={16}/> Me déconnecter</button></div>
    </header>
    <div className="admin-dashboard-grid"><aside className="admin-menu"><div className="admin-menu-label">MENU</div>
      {tabs.map(t=><button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}>{t.icon}<span>{t.label}</span></button>)}
      <div className="admin-menu-note">Connecté en tant que<br/><strong>{ADMIN_EMAIL}</strong></div>
    </aside><section className="admin-main">
      <div className="admin-section-head"><div><h2>{current?.label}</h2><p className="admin-tab-help">{current?.help}</p></div><button className="button secondary small" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={15}/> {loading?'Mise à jour…':'Actualiser'}</button></div>
      {notice&&<div className="admin-success" role="status">{notice}</div>}
      {tab==='overview'&&<>
        <div className="admin-hero-stat"><span>Personnes attendues le jour J</span><strong>{summary.expectedPeople}</strong>
          <p>{summary.attending===0?'Aucune présence acceptée pour le moment.':`${plural(summary.attending,'invité','invités')} + ${plural(closeOnes,'proche venu avec eux','proches venus avec eux')}`}</p></div>
        <div className="admin-stat-grid three">
          <article className="admin-stat"><span>Invités présents</span><strong>{summary.attending}</strong><small><UserCheck size={14}/> ont dit oui</small></article>
          <article className="admin-stat"><span>Proches avec eux</span><strong>{closeOnes}</strong><small><Users size={14}/> famille, amis</small></article>
          <article className="admin-stat"><span>En attente</span><strong>{waitlistedGuests.length}</strong><small>réponses reçues</small></article></div>
        <div className="admin-panel"><h3>Capacité des invités</h3><p><b>{acceptedPeople} / 100</b> places confirmées · {Math.max(100-acceptedPeople,0)} restantes. Les 20 places des organisateurs sont réservées séparément.</p></div>
        <div className="admin-panel"><h3>Ce qu’il reste à faire</h3>
          <ul className="admin-todo">{todos.length===0?<li className="ok"><span>Tout est à jour. Rien à faire pour le moment.</span></li>:todos.map(t=><li key={t.text}><span>{t.text}</span><button className="button secondary small" onClick={()=>{if(t.filter)setFilter(t.filter);setTab(t.tab);}}>{t.action}</button></li>)}</ul></div>
        <div className="admin-panel"><h3>Accès rapide</h3><div className="admin-shortcuts"><button onClick={()=>{setFilter('all');setTab('guests');}}><Users/> Voir qui vient</button><button onClick={()=>setTab('announcement')}><Megaphone/> Écrire un message aux invités</button><button onClick={()=>setTab('program')}><ListChecks/> Modifier le programme</button><button onClick={()=>setTab('event')}><MapPin/> Modifier le titre, la date ou le lieu</button></div></div>
        <div className="admin-panel"><h3>Ce que vos invités voient</h3><p><b>Date :</b> {eventDay} à {content.eventTime}</p><p><b>Lieu :</b> {content.venue}, {content.venueDetail}</p></div></>}

      {tab==='event'&&<div className="admin-panel"><h3>Informations de la cérémonie</h3><p className="admin-muted">Ces informations seront publiées sur l’invitation après enregistrement.</p><div className="admin-form-grid">
        <div className="admin-full"><label>Titre principal du site</label><input value={content.heroTitle} maxLength={80} onChange={e=>field('heroTitle',e.target.value)} placeholder="Ex. : Deux peuples pour une union sacrée"/><small className="admin-muted">C’est la grande phrase affichée en haut du site, juste sous « Une célébration de famille ».</small></div>
        <div><label>Date</label><input type="date" value={content.eventDate} onChange={e=>field('eventDate',e.target.value)}/></div><div><label>Heure</label><input type="time" value={content.eventTime} onChange={e=>field('eventTime',e.target.value)}/></div>
        <div><label>Nom du futur marié</label><input value={content.groomName} onChange={e=>field('groomName',e.target.value)}/></div><div><label>Nom de la future mariée</label><input value={content.brideName} onChange={e=>field('brideName',e.target.value)}/></div>
        <div className="admin-full"><label>Noms des familles</label><input value={content.familyNames} onChange={e=>field('familyNames',e.target.value)}/></div>
        <div><label>Commune / quartier</label><input value={content.venue} onChange={e=>field('venue',e.target.value)}/></div><div><label>Repère / précision</label><input value={content.venueDetail} onChange={e=>field('venueDetail',e.target.value)}/></div>
        <div className="admin-full"><label>Lien Google Maps / itinéraire</label><input type="url" value={content.mapUrl} onChange={e=>field('mapUrl',e.target.value)} placeholder="https://maps.google.com/…"/><small className="admin-muted">Collez le lien de partage Google Maps.</small></div>
        <div className="admin-full"><label>WhatsApp Refontiq</label><input value={content.refoWhatsApp} onChange={e=>field('refoWhatsApp',e.target.value)}/></div></div>
        <button className="button" onClick={()=>void save()} disabled={saving}><Save size={16}/>{saving?'Enregistrement…':'Enregistrer les informations'}</button></div>}

      {tab==='travel'&&<div className="admin-panel"><h3>Comment venir</h3><p className="admin-muted">Vos invités voient ces informations après avoir confirmé leur présence.</p>
        <div className="admin-form-grid">
          <div className="admin-full"><label>Arrêt où tous les bus descendent</label><input value={content.travel.stopName} onChange={e=>setTravel({stopName:e.target.value})} placeholder="Ex. : Commissariat du 22e arrondissement"/></div>
          <div className="admin-full"><label>Trajet à pied depuis l’arrêt</label><textarea rows={3} value={content.travel.walkNote} onChange={e=>setTravel({walkNote:e.target.value})}/></div>
          <div><label>Taxi : où le prendre</label><input value={content.travel.taxiFrom} onChange={e=>setTravel({taxiFrom:e.target.value})} placeholder="Ex. : Carrefour La Vie"/></div>
          <div><label>Taxi : où descendre</label><input value={content.travel.taxiStop} onChange={e=>setTravel({taxiStop:e.target.value})} placeholder="Ex. : Carrefour du commissariat du 22e"/></div>
          <div className="admin-full"><label>Destination à entrer dans Yango (facultatif)</label><input value={content.travel.taxiDestination} onChange={e=>setTravel({taxiDestination:e.target.value})}/></div>
        </div>
        <div className="admin-inline-head"><div><h3>Les bus</h3><p className="admin-muted">Une ligne par bus : son numéro, d’où il part, et sa direction.</p></div><button className="button secondary small" onClick={addBusLine}><Plus size={16}/> Ajouter un bus</button></div>
        {content.travel.busLines.map((line,i)=><div className="admin-edit-card" key={line.id}><div className="admin-edit-card-head"><b>Bus {line.number||i+1}</b><button className="admin-icon-button danger" onClick={()=>removeBusLine(i)} aria-label="Supprimer ce bus"><Trash2/></button></div>
          <div className="admin-form-grid"><div><label>Numéro de la ligne</label><input value={line.number} onChange={e=>editBusLine(i,{number:e.target.value})} placeholder="Ex. : 775"/></div><div><label>Part de</label><input value={line.from} onChange={e=>editBusLine(i,{from:e.target.value})} placeholder="Ex. : Yopougon Saint-André"/></div><div className="admin-full"><label>Direction (facultatif)</label><input value={line.to} onChange={e=>editBusLine(i,{to:e.target.value})} placeholder="Ex. : Angré Château"/></div></div></div>)}
        <button className="button" onClick={()=>void save()} disabled={saving}><Save size={16}/>{saving?'Enregistrement…':'Enregistrer le trajet'}</button></div>}

      {tab==='program'&&<div className="admin-panel"><div className="admin-inline-head"><div><h3>Programme de la journée</h3><p className="admin-muted">Une carte par étape. Vos invités les voient classées par partie de la journée, avec l’heure en premier. Les étapes « Famille uniquement » ne sont pas montrées au public.</p></div><div className="row"><button className="button secondary small" onClick={sortItemsByTime}><ArrowUpDown size={16}/> Trier par heure</button><button className="button secondary small" onClick={()=>addItem('items')}><Plus size={16}/> Ajouter une étape</button></div></div>
        <datalist id="phases">{[...new Set(content.items.map(i=>(i.phase??'').trim()).filter(Boolean))].map(p=><option key={p} value={p}/>)}</datalist>
        {content.items.map((item,i)=><div className="admin-edit-card" key={item.id}><div className="admin-edit-card-head"><b>{formatRange(item.timeBegin,item.timeEnd)||`Étape ${i+1}`} · {item.title||'Nouvelle étape'}{item.familyOnly&&<span className="admin-family-tag">Famille uniquement</span>}</b><span className="row"><button className="admin-icon-button" onClick={()=>moveItem(i,-1)} disabled={i===0} aria-label="Monter cette étape"><ArrowUp/></button><button className="admin-icon-button" onClick={()=>moveItem(i,1)} disabled={i===content.items.length-1} aria-label="Descendre cette étape"><ArrowDown/></button><button className="admin-icon-button danger" onClick={()=>removeItem('items',i)} aria-label="Supprimer cette étape"><Trash2/></button></span></div>
          <div className="admin-form-grid"><div><label>Début</label><input type="time" value={item.timeBegin??''} onChange={e=>editItem('items',i,{timeBegin:e.target.value})}/></div><div><label>Fin (facultatif)</label><input type="time" value={item.timeEnd??''} onChange={e=>editItem('items',i,{timeEnd:e.target.value})}/></div>
          <div className="admin-full"><label>Partie de la journée</label><input list="phases" value={item.phase??''} onChange={e=>editItem('items',i,{phase:e.target.value})} placeholder="Ex. : Accueil des invités"/><small className="admin-muted">Les étapes qui se suivent avec le même nom sont regroupées sous un seul titre.</small></div>
          <div className="admin-full"><label>Nom de l’étape</label><input value={item.title} onChange={e=>editItem('items',i,{title:e.target.value})}/></div>
          <div className="admin-full"><label>Ce qui se passe</label><textarea value={item.detail} onChange={e=>editItem('items',i,{detail:e.target.value})}/></div></div>
          <label className="admin-checkbox"><input type="checkbox" checked={item.familyOnly===true} onChange={e=>editItem('items',i,{familyOnly:e.target.checked})}/> Réservé à la famille (caché aux invités)</label>
          <label className="admin-checkbox"><input type="checkbox" checked={item.highlight===true} onChange={e=>editItem('items',i,{highlight:e.target.checked})}/> Temps fort (mis en avant pour les invités)</label>
          <label className="admin-checkbox"><input type="checkbox" checked={item.confirmed} onChange={e=>editItem('items',i,{confirmed:e.target.checked})}/> Information confirmée</label></div>)}
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

      {tab==='guests'&&<div className="admin-panel"><div className="admin-inline-head"><div><h3>Qui vient ?</h3><p className="admin-muted">Chaque carte est un invité, avec les proches qui viennent avec lui.</p></div><button className="button secondary small" onClick={exportCsv}><Download size={16}/> Télécharger la liste (Excel)</button></div>
        <div className="admin-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Chercher un nom…" aria-label="Chercher un nom"/></div>
        <div className="admin-pills">{([['all','Tous',counts.all],['yes','Présents',counts.yes],['no','Absents',counts.no],['waitlisted','En attente',counts.waitlisted],...(counts.check>0?[['check','À vérifier',counts.check]]:[])] as [GuestFilter,string,number][]).map(([id,label,n])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label} ({n})</button>)}</div>
        <ul className="admin-guest-list">
          {shown.map(g=>{const digits=g.phone?phoneDigits(g.phone):'';return <li className="admin-guest-card" key={g.id}>
            <div className="admin-guest-top"><b>{g.name}</b><span className={g.status==='accepted'?'admin-status yes':g.status==='waitlisted'?'admin-status':g.status==='review'?'admin-status review':'admin-status no'}>{g.status==='accepted'?'Vient':g.status==='waitlisted'?'En attente':g.status==='review'?'À vérifier':'Ne vient pas'}</span></div>
            {(g.status==='accepted'||g.status==='waitlisted'||g.status==='review')&&<p className="admin-guest-line"><Users size={16}/><span>{g.status==='waitlisted'?'Groupe en attente · ':g.status==='review'?'Groupe non confirmé · ':''}{g.size>1?`${g.size} personnes au total`:'Vient seul(e)'}{g.companions.length>0&&<> · avec {g.companions.join(', ')}</>}{g.unnamed>0&&<> · {plural(g.unnamed,'proche dont le nom n’a pas été donné','proches dont le nom n’a pas été donné')}</>}</span></p>}
            {digits&&<div className="admin-guest-actions"><a className="admin-chip" href={`tel:+${digits}`}><Phone size={16}/> Appeler</a><a className="admin-chip" href={g.status==='review'? `https://wa.me/${digits}?text=${encodeURIComponent(`Bonjour ${g.name}, votre demande de présence à la dot de ${content.groomName} et ${content.brideName} a bien été reçue. Toutefois, votre nom semble déjà figurer dans notre liste d’invités. Afin de vérifier qu’il ne s’agit pas d’un doublon, pouvez-vous nous confirmer qu’il s’agit bien de votre première inscription ? Merci, les familles.`) }` : `https://wa.me/${digits}`} target="_blank" rel="noreferrer"><MessageCircle size={16}/> {g.status==='review'?'Contacter sur WhatsApp':'WhatsApp'}</a></div>}
            {g.status==='review'&&<div className="admin-guest-actions"><button className="button small" onClick={()=>void resolveReview(g.id,'accepted')}>Confirmer l’invitation</button><button className="button secondary small" onClick={()=>void resolveReview(g.id,'declined')}>Refuser après vérification</button></div>}
            {g.duplicates.length>0&&<p className="admin-warn"><AlertTriangle size={15}/> À vérifier : le nom « {g.duplicates[0]} » apparaît aussi dans une autre réponse. C’est peut-être la même personne.</p>}
            <p className="admin-guest-date">Répondu le {new Date(g.createdAt).toLocaleDateString('fr-FR')}{g.updatedAt&&g.updatedAt!==g.createdAt&&` · modifié le ${new Date(g.updatedAt).toLocaleDateString('fr-FR')}`}</p>
          </li>;})}
          {!shown.length&&<li className="admin-empty">{loading?'Chargement…':groups.length===0?'Aucune réponse pour le moment.':'Aucun résultat. Essayez un autre nom ou choisissez « Tous ».'}</li>}
        </ul>
        <p className="admin-muted admin-export-note">Le numéro affiché est celui de l’invité : ses proches n’ont pas de numéro propre.</p></div>}
    </section></div><footer className="admin-dashboard-footer">Espace privé de l’organisation · <Link href="/">Retour à l’invitation</Link></footer>
  </div></main>;
}
