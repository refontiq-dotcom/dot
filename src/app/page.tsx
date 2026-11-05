'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  MapPin,
  Megaphone,
  Clock3,
  Heart,
  PartyPopper,
  House,
  CalendarCheck,
  CircleHelp,
  Navigation,
  Info,
  ShoppingBag,
  Phone,
  MessageCircle,
  Lock,
} from 'lucide-react';
import { initialContent, loadContent, type Content } from '@/lib/content';
import { cleanPersonName, normalizeIvorianPhone, normalizeNameKey, removedCompanions } from '@/lib/rsvp';

type RsvpReceipt = {
  guestName: string;
  attending: boolean;
  companionCount: number;
  personCount: number;
  updated: boolean;
  possibleDuplicate: boolean;
};

function Calendar() {
  return <CalendarDays size={19} />;
}

export default function Home() {
  const [content, setContent] = useState<Content>(initialContent);
  const [updated, setUpdated] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [attending, setAttending] = useState('yes');
  const [companions, setCompanions] = useState<string[]>([]);
  const [pendingRemoval, setPendingRemoval] = useState<{ names: string[]; nextCount: number } | null>(null);
  const [rsvpStatus, setRsvpStatus] = useState('');
  const [rsvpReceipt, setRsvpReceipt] = useState<RsvpReceipt | null>(null);
  const [website, setWebsite] = useState('');
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [showTravelGuide, setShowTravelGuide] = useState(false);
  const [activeSection, setActiveSection] = useState('accueil');
  const modalRef = useRef<HTMLDivElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      setShowTravelGuide(window.sessionStorage.getItem('dot-travel-guide-unlocked') === 'yes');
    } catch {
      setShowTravelGuide(false);
    }
  }, []);
  const eventDate = new Date(`${content.eventDate}T${content.eventTime}:00+00:00`);
  const formattedEventDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(eventDate);
  const formattedEventTime = content.eventTime.replace(':', ' h ');
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refreshContent() {
      try {
        const loaded = await loadContent();
        if (!cancelled) {
          setContent(loaded);
          setUpdated(new Date().toLocaleString('fr-FR', {
            dateStyle: 'long',
            timeStyle: 'short',
          }));
        }
      } catch {
        if (!cancelled) {
          setContent(initialContent);
        }
      }
    }

    void refreshContent();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
    };
    tick();
    const intervalId = window.setInterval(tick, 1_000);
    return () => window.clearInterval(intervalId);
  }, [content.eventDate, content.eventTime]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sections = ['accueil', 'annonces', 'lieu', 'rsvp', 'faq']
      .map(id => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.2, 0.5, 1] });
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!rsvpReceipt) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyOverflow = document.body.style.overflow;
    modalCloseRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setRsvpReceipt(null);
        return;
      }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'))
        .filter(element => !element.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = bodyOverflow;
      previouslyFocused?.focus();
    };
  }, [rsvpReceipt]);

  const monthShort = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(eventDate).replace('.', '');
  const countdown = (() => {
    if (now === null) return { state: 'pending' as const };
    const diff = eventDate.getTime() - now;
    if (diff <= 0) return { state: 'past' as const };
    const totalSeconds = Math.floor(diff / 1_000);
    return {
      state: 'remaining' as const,
      days: Math.floor(totalSeconds / 86_400),
      hours: Math.floor((totalSeconds % 86_400) / 3_600),
      minutes: Math.floor((totalSeconds % 3_600) / 60),
      seconds: totalSeconds % 60,
    };
  })();
  const countdownLabel = countdown.state === 'remaining'
    ? `Cérémonie dans ${countdown.days} ${countdown.days > 1 ? 'jours' : 'jour'}, ${countdown.hours} h ${String(countdown.minutes).padStart(2, '0')} min et ${String(countdown.seconds).padStart(2, '0')} s`
    : `Cérémonie le ${formattedEventDate} à ${formattedEventTime}`;
  const stamp = updated || 'Mise à jour non renseignée';
  const venueMapUrl = (() => {
    try {
      const parsed = new URL(content.mapUrl);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : initialContent.mapUrl;
    } catch {
      return initialContent.mapUrl;
    }
  })();

  const companionNames = companions.map(name => name.trim()).filter(Boolean);
  const totalPeople = attending === 'yes' ? 1 + companions.length : 0;

  function resetRsvpForm() {
    setGuestName('');
    setPhone('');
    setAttending('yes');
    setCompanions([]);
    setPendingRemoval(null);
    setWebsite('');
    setRsvpStatus('');
  }

  function changeCompanionCount(nextCount: number) {
    setRsvpStatus('');
    if (nextCount === companions.length) return;
    if (nextCount > companions.length) {
      setCompanions(previous => [...previous, ...Array.from({ length: nextCount - previous.length }, () => '')]);
      return;
    }
    const removed = removedCompanions(companions, nextCount);
    if (removed.length > 0) {
      setPendingRemoval({ names: removed, nextCount });
      return;
    }
    setCompanions(previous => previous.slice(0, nextCount));
  }

  async function submitRsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRsvpStatus('');

    const parsed = normalizeIvorianPhone(phone);
    if (!parsed.ok) {
      setRsvpStatus(parsed.error);
      return;
    }

    const attendingYes = attending === 'yes';
    if (attendingYes) {
      const missing = companions
        .map((name, index) => (name.trim() ? -1 : index))
        .filter(index => index >= 0);
      if (missing.length > 0) {
        const positions = missing.map(index => index + 1);
        const list = positions.length === 1
          ? String(positions[0])
          : `${positions.slice(0, -1).join(', ')} et ${positions[positions.length - 1]}`;
        setRsvpStatus(positions.length === 1
          ? `Renseignez le nom de l’accompagnateur ${list} pour envoyer votre réponse.`
          : `Renseignez le nom des accompagnateurs ${list} pour envoyer votre réponse.`);
        const firstEmpty = document.getElementById(`companion-${missing[0]}`);
        firstEmpty?.focus({ preventScroll: true });
        firstEmpty?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const seenNames = new Map<string, number>();
      const guestKey = normalizeNameKey(guestName);
      if (guestKey) seenNames.set(guestKey, -1);
      for (let index = 0; index < companions.length; index += 1) {
        const key = normalizeNameKey(companions[index]);
        if (!key) continue;
        const previous = seenNames.get(key);
        if (previous !== undefined) {
          const duplicateLabel = companions[index].trim() || `l’accompagnateur ${index + 1}`;
          setRsvpStatus(previous === -1
            ? `« ${duplicateLabel} » est déjà indiqué comme invité principal. Utilisez un nom différent pour l’accompagnateur ${index + 1}.`
            : `Le nom de l’accompagnateur ${previous + 1} est indiqué deux fois. Renseignez un nom différent pour l’accompagnateur ${index + 1}.`);
          const duplicateField = document.getElementById(`companion-${index}`);
          duplicateField?.focus({ preventScroll: true });
          duplicateField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        seenNames.set(key, index);
      }
    }

    setRsvpBusy(true);
    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName,
          phone: parsed.normalized,
          attending: attendingYes,
          companions: attendingYes ? companionNames : [],
          website,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Enregistrement impossible.');
      }

      setRsvpReceipt({
        guestName: typeof result.guestName === 'string' ? result.guestName : cleanPersonName(guestName),
        attending: typeof result.attending === 'boolean' ? result.attending : attendingYes,
        companionCount: typeof result.companionCount === 'number' ? result.companionCount : 0,
        personCount: typeof result.personCount === 'number' ? result.personCount : 1,
        updated: Boolean(result.updated),
        possibleDuplicate: Boolean(result.possibleDuplicate),
      });

      const travelGuideUnlocked = attendingYes;
      setShowTravelGuide(travelGuideUnlocked);
      try {
        if (travelGuideUnlocked) {
          window.sessionStorage.setItem('dot-travel-guide-unlocked', 'yes');
        } else {
          window.sessionStorage.removeItem('dot-travel-guide-unlocked');
        }
      } catch {
        // Le guide reste accessible dans la session courante même si le stockage est indisponible.
      }
      resetRsvpForm();
    } catch (error) {
      setRsvpStatus(error instanceof Error ? error.message : 'Une erreur est survenue. Réessayez.');
    } finally {
      setRsvpBusy(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#contenu">Aller au contenu principal</a>
      <header className="topbar">
        <div className="shell nav">
          <a href="#accueil" className="brand">F <span style={{ color: 'var(--accent)' }}>×</span> V</a>
          <nav className="navlinks" aria-label="Navigation principale">
            {content.pagne.enabled && <a href="#pagne">Acheter le pagne</a>}
            <a href="#programme">Programme</a>
            <a href="#lieu">Le lieu</a>
            <a href="#rsvp">Présence</a>
            <a href="#faq">Questions</a>
          </nav>
          <a className="button small" href="#annonces">Dernières nouvelles <Megaphone size={16} /></a>
        </div>
      </header>

      <main id="contenu" tabIndex={-1}>
        <section className="hero" id="accueil">
          <div className="shell hero-grid">
            <div>
              <div className="eyebrow">Une célébration de famille</div>
              <h1 className="serif">Deux héritages,<br />une même union</h1>
              <p className="lead">Avec joie, les familles {content.familyNames} vous invitent à célébrer la dot traditionnelle :</p>
              <h2 className="serif" style={{ fontSize: 'clamp(25px,4vw,34px)', marginBottom: 8 }}>
                {content.groomName}<br />
                <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>&amp;</span> {content.brideName}
              </h2>
              <div className="date-pill"><Calendar /><span>{formattedEventDate} · {formattedEventTime}</span></div>
              <div className="countdown" aria-label={countdownLabel}>
                {countdown.state === 'remaining' ? (
                  <>
                    <div className="countbox"><span>{countdown.days}</span><small>{countdown.days > 1 ? 'jours' : 'jour'}</small></div>
                    <div className="countbox"><span>{String(countdown.hours).padStart(2, '0')}</span><small>{countdown.hours > 1 ? 'heures' : 'heure'}</small></div>
                    <div className="countbox"><span>{String(countdown.minutes).padStart(2, '0')}</span><small>{countdown.minutes > 1 ? 'minutes' : 'minute'}</small></div>
                    <div className="countbox"><span>{String(countdown.seconds).padStart(2, '0')}</span><small>{countdown.seconds > 1 ? 'secondes' : 'seconde'}</small></div>
                  </>
                ) : (
                  <>
                    <div className="countbox"><span>{eventDate.getUTCDate()}</span><small>{monthShort}</small></div>
                    <div className="countbox"><span>{eventDate.getUTCFullYear()}</span><small>année</small></div>
                  </>
                )}
              </div>
              {countdown.state === 'past' && <p className="latest">La cérémonie a eu lieu le {formattedEventDate}.</p>}
              <div className="actions">
                {content.pagne.enabled && <a className="button accent" href="#pagne"><ShoppingBag size={18} /> Acheter le pagne de la dot</a>}
                <a className="button" href="#rsvp"><CalendarCheck size={18} /> Confirmer ma présence</a>
                <a className="button secondary" href="#lieu"><MapPin size={18} /> Voir le lieu</a>
              </div>
            </div>
          </div>
        </section>

        {content.pagne.enabled && (
          <section className="section" id="pagne">
            <div className="shell pagne-section">
              <div className="section-head">
                <div className="eyebrow">Commande directe auprès des vendeurs</div>
                <h2>Le pagne de la dot</h2>
                <p>{content.pagne.description}</p>
              </div>
              <div className="pagne-card">
                <div className="pagne-visual">
                  {content.pagne.imageUrl
                    ? <img src={content.pagne.imageUrl} alt="Pagne proposé pour la dot" />
                    : <div className="pagne-placeholder"><ShoppingBag size={42}/><span>Photo du pagne à venir</span></div>}
                </div>
                <div className="pagne-details">
                  <div className="eyebrow">Prix du pagne</div>
                  <div className="pagne-price">{Number(content.pagne.price || 0).toLocaleString('fr-FR')} FCFA</div>
                  <p>Choisissez un vendeur et contactez-le directement pour passer votre commande.</p>
                  {content.pagne.contacts.length > 0 ? content.pagne.contacts.map((contact, index) => {
                    const digits = contact.phone.replace(/\D/g, '');
                    const whatsappDigits = digits.startsWith('0') ? `225${digits.slice(1)}` : digits;
                    return <div className="pagne-seller" key={contact.id}>
                      <strong>{contact.label.trim() || `Vendeur ${index + 1}`}</strong>
                      <span>{contact.phone}</span>
                      {digits.length >= 8 && <div className="pagne-actions">
                        <a className="button" href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}><Phone size={17}/> Appeler pour commander</a>
                        <a className="button secondary" href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer"><MessageCircle size={17}/> Commander sur WhatsApp</a>
                      </div>}
                    </div>;
                  }) : <p className="notice">Les contacts des vendeurs seront bientôt affichés ici.</p>}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="section soft" id="annonces">
          <div className="shell">
            <div className="section-head"><div className="eyebrow">À lire en premier</div><h2>La dernière nouvelle</h2></div>
            <div className="announcement">
              <Megaphone size={24} style={{ flexShrink: 0, marginTop: 3 }} />
              <div>
                <h3>Information des familles</h3>
                <p>{content.announcement}</p>
                <div className="latest" style={{ color: '#cfe0ec' }}>Mis à jour : {stamp}</div>
              </div>
            </div>
            <p className="latest"><Info size={14} style={{ verticalAlign: '-2px' }} /> Les détails encore en préparation sont indiqués « à confirmer ».</p>
          </div>
        </section>

        <section className="section" id="programme">
          <div className="shell location">
            <div>
              <div className="eyebrow">Le déroulement</div>
              <h2>Programme de la journée</h2>
              <p style={{ color: 'var(--muted)' }}>Les familles compléteront cette page au fur et à mesure. Seules les informations confirmées sont présentées comme définitives.</p>
              <div className="timeline">
                {content.items.map(item => (
                  <div className="timeline-item" key={item.id}>
                    <div className="dot" />
                    <div>
                      <h3>{item.title}</h3>
                      <p style={{ color: 'var(--muted)', marginBottom: 0 }}>{item.detail}</p>
                      <span className={`tag ${item.confirmed ? 'confirmed' : ''}`}>{item.confirmed ? 'Confirmé' : 'À confirmer'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ background: 'var(--sand)', border: 0 }}>
              <div className="iconbox"><Clock3 /></div>
              <h3>Un programme qui évolue</h3>
              <p>Revenez consulter cette page avant la cérémonie : les dernières précisions seront publiées ici par les familles.</p>
              <p className="latest">Dernière mise à jour : {stamp}</p>
            </div>
          </div>
        </section>

        <section className="section soft" id="lieu">
          <div className="shell location">
            <div>
              <div className="eyebrow">Retrouvons-nous</div>
              <h2>Comment venir ?</h2>
              <p style={{ color: 'var(--muted)' }}>{content.venue}, {content.venueDetail}.</p>
              <p>Un repère facilement partageable : <strong>{content.venueDetail}</strong>, à {content.venue}. Les indications plus précises seront ajoutées dès confirmation par les familles.</p>
              <div className="notice"><Info size={17} style={{ verticalAlign: '-3px' }} /> {content.venue} — {content.venueDetail}.</div>
              <div style={{ marginTop: 16 }}>
                <a className="button secondary" href={venueMapUrl} target="_blank" rel="noreferrer"><Navigation size={17} /> Voir le lieu sur Google Maps</a>
              </div>
              {showTravelGuide ? (
                <div className="travel-guide" aria-live="polite">
                  <div className="card" style={{ marginTop: 24 }}>
                    <div className="eyebrow">Votre accès à la réception</div>
                    <h3>Merci d’avoir confirmé votre présence !</h3>
                    <p>Voici les indications pour rejoindre facilement le lieu de la cérémonie.</p>
                    <a href={venueMapUrl} target="_blank" rel="noreferrer" className="button" style={{ marginTop: 12 }}><Navigation size={17} /> Ouvrir l’itinéraire Google Maps</a>
                  </div>
                  <div className="card" style={{ marginTop: 16 }}>
                    <div className="eyebrow">En transport en commun</div>
                    <h3>En bus SOTRA</h3>
                    <p>Les lignes ci-dessous desservent l’arrêt du commissariat du 22e arrondissement. Descendez à cet arrêt, puis suivez l’itinéraire à pied vers Laser Park et le lieu de réception.</p>
                    <ul>
                      <li><strong>81 :</strong> au départ de la Gare Nord (Adjamé).</li>
                      <li><strong>82 :</strong> au départ de la Gare Sud (Plateau).</li>
                      <li><strong>90 :</strong> au départ de Cocody Blockhaus.</li>
                      <li><strong>719 :</strong> au départ de Yopougon Saint-André.</li>
                      <li><strong>775 :</strong> descendez à l’arrêt du commissariat du 22e arrondissement.</li>
                      <li><strong>704 :</strong> descendez à l’arrêt du commissariat du 22e arrondissement.</li>
                    </ul>
                    <p>À l’arrêt du commissariat du 22e, ouvrez l’itinéraire Google Maps pour terminer le trajet à pied.</p>
                  </div>
                  <div className="card" style={{ marginTop: 16 }}>
                    <div className="eyebrow">En taxi ou en voiture</div>
                    <h3>Taxi compteur, Yango ou véhicule personnel</h3>
                    <p><strong>En taxi compteur ou avec Yango :</strong> indiquez « Laser Park, Cocody Angré Mahou » comme destination. À l’arrivée, suivez le court trajet à pied jusqu’au lieu de réception.</p>
                    <p><strong>Avec votre propre voiture :</strong> ouvrez l’itinéraire Google Maps et suivez le trajet jusqu’au lieu de réception.</p>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ marginTop: 24 }}>
                  <div className="eyebrow">Accès aux indications détaillées</div>
                  <h3>Vous venez célébrer avec nous ?</h3>
                  <p>Confirmez votre présence dans le formulaire ci-dessous pour afficher les différents moyens de rejoindre le lieu de réception.</p>
                  <a className="button secondary" href="#rsvp" style={{ marginTop: 12 }}>Confirmer ma présence</a>
                </div>
              )}
            </div>
            <div className="mapbox">
              <div><MapPin size={30} /><p style={{ margin: '8px 0 2px', fontWeight: 700 }}>{content.venue}</p><small>{content.venueDetail}<br />Repère indicatif</small></div>
            </div>
          </div>
        </section>

        <section className="section soft" id="rsvp">
          <div className="shell">
            <div className="section-head">
              <div className="eyebrow">Votre réponse nous aide à nous organiser</div>
              <h2>Confirmer votre présence</h2>
              <p>Merci de répondre pour que les familles puissent préparer votre accueil.</p>
            </div>
            <form className="rsvp-form" onSubmit={submitRsvp}>
              <label htmlFor="guest-name">Votre nom et prénom</label>
              <input id="guest-name" name="guestName" autoComplete="name" maxLength={120} required value={guestName} onChange={event => setGuestName(event.target.value)} placeholder="Ex. : Marie Kouassi" />

              <label htmlFor="guest-phone">Votre numéro de téléphone</label>
              <input
                id="guest-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={24}
                required
                value={phone}
                onChange={event => setPhone(event.target.value)}
                placeholder="Ex. : 07 00 00 00 00"
              />
              <fieldset>
                <legend>Serez-vous présent(e) ?</legend>
                <label className="rsvp-choice">
                  <input type="radio" name="attending" value="yes" checked={attending === 'yes'} onChange={() => { setAttending('yes'); setRsvpStatus(''); }} />
                  Oui, je serai présent(e)
                </label>
                <label className="rsvp-choice">
                  <input type="radio" name="attending" value="no" checked={attending === 'no'} onChange={() => { setAttending('no'); setRsvpStatus(''); }} />
                  Non, je ne pourrai pas venir
                </label>
              </fieldset>

              {attending === 'yes' && (
                <div>
                  <label htmlFor="companion-count">Nombre d’accompagnateurs</label>
                  <select id="companion-count" value={String(companions.length)} onChange={event => changeCompanionCount(Number(event.target.value))}>
                    {Array.from({ length: 10 }, (_, index) => index).map(count => (
                      <option key={count} value={count}>
                        {count === 0 ? 'Aucun, je viens seul(e)' : `${count} accompagnateur${count > 1 ? 's' : ''}`}
                      </option>
                    ))}
                  </select>
                  {companions.map((companion, index) => (
                    <div key={index}>
                      <label htmlFor={`companion-${index}`}>Accompagnateur {index + 1}</label>
                      <input
                        id={`companion-${index}`}
                        maxLength={120}
                        value={companion}
                        onChange={event => { setRsvpStatus(''); setCompanions(previous => previous.map((name, position) => position === index ? event.target.value : name)); }}
                        placeholder="Nom et prénom"
                      />
                    </div>
                  ))}
                </div>
              )}

              {pendingRemoval && (
                <div className="rsvp-confirm" role="alert">
                  <b>Retirer {pendingRemoval.names.length > 1 ? 'ces accompagnateurs' : 'cet accompagnateur'} ?</b>
                  <p>{pendingRemoval.names.join(', ')} {pendingRemoval.names.length > 1 ? 'ne seront plus comptés' : 'ne sera plus compté(e)'} dans votre groupe.</p>
                  <div className="rsvp-actions">
                    <button type="button" className="button small" onClick={() => { setCompanions(previous => previous.slice(0, pendingRemoval.nextCount)); setPendingRemoval(null); }}>Oui, retirer</button>
                    <button type="button" className="button secondary small" onClick={() => setPendingRemoval(null)}>Conserver</button>
                  </div>
                </div>
              )}

              <div className="rsvp-summary" aria-live="polite">
                <b>Récapitulatif</b>
                {attending === 'yes' ? (
                  <>
                    <p>{companions.length > 0 ? `Vous serez présent(e) avec ${companions.length} accompagnateur${companions.length > 1 ? 's' : ''}, soit ${totalPeople} personnes au total.` : 'Vous serez présent(e), seul(e).'}</p>
                    {companionNames.length > 0 && <p className="rsvp-hint">{companionNames.join(' · ')}</p>}
                  </>
                ) : (
                  <p>Vous serez absent(e). Aucune place ne sera réservée.</p>
                )}
              </div>

              <div className="rsvp-trap" aria-hidden="true">
                <label htmlFor="rsvp-website">Ne pas remplir ce champ</label>
                <input id="rsvp-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} />
              </div>
              <button className="button" type="submit" disabled={rsvpBusy}>
                {rsvpBusy ? 'Envoi en cours…' : 'Envoyer ma réponse'}
              </button>
              {rsvpStatus && <p className="rsvp-status" role="alert" aria-live="assertive">{rsvpStatus}</p>}
              <p className="rsvp-privacy">Votre numéro et votre réponse restent privés.</p>
            </form>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="shell">
            <div className="section-head">
              <div className="eyebrow">Besoin d’un renseignement ?</div>
              <h2>Questions fréquentes</h2>
              <p>Les réponses sont ajoutées au fil des confirmations des familles.</p>
            </div>
            <div className="faq">
              {content.faq.map(item => (
                <details key={item.id}>
                  <summary>{item.title}{!item.confirmed && <span className="tag" style={{ marginLeft: 8 }}>À confirmer</span>}</summary>
                  <p>{item.detail}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="refontiq-band" aria-label="À propos de ce site">
          <div className="shell refontiq-note">
            <span>Invitation conçue par <strong>Refontiq</strong>. Vous souhaitez un site comme celui-ci pour votre événement ?</span>
            {content.refoWhatsApp && (
              <a href={`https://wa.me/${content.refoWhatsApp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Contacter Refontiq sur WhatsApp</a>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="shell footer-inner">
          <span>Avec affection, les familles {content.familyNames} · {eventDate.getUTCFullYear()}</span>
          <a className="organizer-access" href="/admin"><Lock size={16} /> Accès organisateurs</a>
        </div>
      </footer>

      <nav className="mobile-nav" aria-label="Navigation rapide">
        <a href="#accueil" aria-current={activeSection === 'accueil' ? 'location' : undefined}><House /><span>Accueil</span></a>
        <a href="#lieu" aria-current={activeSection === 'lieu' ? 'location' : undefined}><MapPin /><span>Lieu</span></a>
        <a href="#rsvp" aria-current={activeSection === 'rsvp' ? 'location' : undefined}><CalendarCheck /><span>Présence</span></a>
        <a href="#faq" aria-current={activeSection === 'faq' ? 'location' : undefined}><CircleHelp /><span>FAQ</span></a>
      </nav>

      {rsvpReceipt && (
        <div
          className="modal-overlay"
          onClick={event => { if (event.target === event.currentTarget) setRsvpReceipt(null); }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rsvp-modal-title" aria-describedby="rsvp-modal-text" ref={modalRef}>
            <div className={`modal-icon ${rsvpReceipt.attending ? 'yes' : 'no'}`}>
              {rsvpReceipt.attending ? <PartyPopper size={26} /> : <Heart size={26} />}
            </div>
            <div className="eyebrow">{rsvpReceipt.updated ? 'Votre réponse a été mise à jour' : rsvpReceipt.attending ? 'Votre présence est confirmée' : 'Votre réponse est enregistrée'}</div>
            <h3 id="rsvp-modal-title">Merci {rsvpReceipt.guestName} !</h3>
            {rsvpReceipt.attending ? (
              <>
                <p id="rsvp-modal-text">
                  {rsvpReceipt.updated ? 'Votre réponse a bien été mise à jour.' : 'Nous sommes heureux de vous compter parmi nous.'}{' '}
                  {rsvpReceipt.companionCount > 0
                    ? `Vos ${rsvpReceipt.personCount} places sont réservées (vous et ${rsvpReceipt.companionCount} accompagnateur${rsvpReceipt.companionCount > 1 ? 's' : ''}).`
                    : 'Votre place est réservée.'}
                </p>
                <div className="modal-event">
                  <CalendarCheck size={18} />
                  <span>{formattedEventDate} · {formattedEventTime}<br />{content.venue}, {content.venueDetail}</span>
                </div>
                {rsvpReceipt.possibleDuplicate && (
                  <p className="modal-note"><Info size={16} /> Un nom identique figure déjà dans la liste. Les organisateurs vérifieront qu’il ne s’agit pas d’un doublon.</p>
                )}
                <p className="modal-note">Vous pourrez modifier votre réponse en renvoyant ce formulaire avec le même numéro.</p>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setRsvpReceipt(null);
                      window.setTimeout(() => document.getElementById('lieu')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
                    }}
                  >
                    <Navigation size={17} /> Voir comment venir
                  </button>
                  <button type="button" className="button secondary" ref={modalCloseRef} onClick={() => setRsvpReceipt(null)}>Fermer</button>
                </div>
              </>
            ) : (
              <>
                <p id="rsvp-modal-text">
                  {rsvpReceipt.updated ? 'Votre réponse a bien été mise à jour.' : 'Votre réponse a bien été transmise aux familles.'} Vous nous manquerez — nous penserons à vous le {formattedEventDate}.
                </p>
                {rsvpReceipt.possibleDuplicate && (
                  <p className="modal-note"><Info size={16} /> Un nom identique figure déjà dans la liste. Les organisateurs vérifieront qu’il ne s’agit pas d’un doublon.</p>
                )}
                <p className="modal-note">Vous pourrez modifier votre réponse en renvoyant ce formulaire avec le même numéro.</p>
                <div className="modal-actions">
                  <button type="button" className="button" ref={modalCloseRef} onClick={() => setRsvpReceipt(null)}>Fermer</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
