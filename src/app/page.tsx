'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  MapPin,
  Megaphone,
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
  Pencil,
  ListChecks,
} from 'lucide-react';
import { initialContent, loadContent, type Content } from '@/lib/content';
import TravelGuide from '@/components/TravelGuide';
import ProgramTimeline from '@/components/ProgramTimeline';
import InstallApp from '@/components/InstallApp';
import { MAX_COMPANIONS, cleanPersonName, normalizeIvorianPhone, normalizeNameKey, removedCompanions } from '@/lib/rsvp';

type RsvpReceipt = {
  guestName: string;
  attending: boolean;
  companionCount: number;
  personCount: number;
  updated: boolean;
  possibleDuplicate: boolean;
  status: 'accepted' | 'waitlisted' | 'declined' | 'review';
};

type RsvpLookup = {
  guestName: string;
  attending: boolean;
  companions: string[];
  companionCount: number;
  personCount: number;
  maxCompanions: number;
  status: 'accepted' | 'waitlisted' | 'declined' | 'review';
  venueDetails?: { venue?: string; venue_detail?: string; map_url?: string; travel?: Content['travel'] };
};

function Calendar() {
  return <CalendarDays size={19} />;
}

function pagneWhatsAppUrl(phone: string, guestName: string, personCount: number, sellerName: string, price: number, eventCouple: string) {
  const digits = phone.replace(/\D/g, '');
  const whatsappDigits = digits.startsWith('0') ? `225${digits.slice(1)}` : digits;
  const groupLabel = personCount > 1 ? `${personCount} personnes` : '1 personne';
  const message = [
    `Bonjour ${sellerName},`,
    '',
    `Je suis ${guestName}. J'ai confirmé ma présence à la dot de ${eventCouple}.`,
    `Nous serons ${groupLabel}.`,
    '',
    `Je souhaite commander le pagne officiel de la dot, au prix de ${price.toLocaleString('fr-FR')} FCFA le morceau.`,
    'Pouvez-vous m’indiquer les modalités de commande et de retrait ?',
    '',
    'Merci.'
  ].join('\n');
  return `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(message)}`;
}

export default function Home() {
  const [content, setContent] = useState<Content>(initialContent);
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [attending, setAttending] = useState('yes');
  const [companions, setCompanions] = useState<string[]>([]);
  const [pendingRemoval, setPendingRemoval] = useState<{ names: string[]; nextCount: number } | null>(null);
  const [rsvpStatus, setRsvpStatus] = useState('');
  const [rsvpReceipt, setRsvpReceipt] = useState<RsvpReceipt | null>(null);
  const [website, setWebsite] = useState('');
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editOriginalName, setEditOriginalName] = useState('');
  const [maxCompanions, setMaxCompanions] = useState(MAX_COMPANIONS);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupResult, setLookupResult] = useState<RsvpLookup | null>(null);
  const [lookupStatus, setLookupStatus] = useState('');
  const [activeSection, setActiveSection] = useState('accueil');
  const modalRef = useRef<HTMLDivElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Une ancienne valeur de session ne constitue jamais une preuve de confirmation.
    try { window.sessionStorage.removeItem('dot-travel-guide-unlocked'); } catch {}
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
    const sections = ['accueil', 'annonces', 'programme', 'rsvp', 'faq']
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
    if (typeof IntersectionObserver === 'undefined') return;
    document.documentElement.classList.add('anim-ready');
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-revealed)').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [content]);

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
  const stamp = content.updatedAt
    ? new Date(content.updatedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
    : '';
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
    setEditMode(false);
    setEditOriginalName('');
    setMaxCompanions(MAX_COMPANIONS);
  }

  // Retrouve la réponse déjà enregistrée à partir du numéro de téléphone.
  async function findRsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookupStatus('');
    setLookupResult(null);
    const parsed = normalizeIvorianPhone(lookupPhone);
    if (!parsed.ok) { setLookupStatus(parsed.error); return; }
    setLookupBusy(true);
    try {
      const response = await fetch('/api/rsvp/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: parsed.normalized }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Réponse introuvable.');
      const found: RsvpLookup = {
        guestName: String(result.guestName), attending: Boolean(result.attending),
        companions: Array.isArray(result.companions) ? result.companions.map(String) : [],
        companionCount: Number(result.companionCount) || 0, personCount: Number(result.personCount) || 0,
        maxCompanions: Number(result.maxCompanions) || 0,
        status: result.status === 'waitlisted' ? 'waitlisted' : result.status === 'declined' ? 'declined' : result.status === 'review' ? 'review' : 'accepted',
        ...(result.venueDetails ? { venueDetails: result.venueDetails } : {}),
      };
      setLookupResult(found);
      if (found.venueDetails) setContent(current => ({ ...current, venue: String(found.venueDetails?.venue ?? ''), venueDetail: String(found.venueDetails?.venue_detail ?? ''), mapUrl: String(found.venueDetails?.map_url ?? ''), travel: found.venueDetails?.travel ?? current.travel }));
    } catch (error) {
      setLookupStatus(error instanceof Error ? error.message : 'Une erreur est survenue. Réessayez.');
    } finally { setLookupBusy(false); }
  }

  // Ouvre le formulaire de modification existant avec les informations retrouvées.
  function startEdit() {
    if (!lookupResult) return;
    setRsvpStatus(''); setEditMode(true); setEditOriginalName(lookupResult.guestName);
    setGuestName(lookupResult.guestName); setPhone(lookupPhone);
    setAttending(lookupResult.attending ? 'yes' : 'no');
    setCompanions(lookupResult.attending ? [...lookupResult.companions] : []);
    setMaxCompanions(Math.min(MAX_COMPANIONS, Math.max(lookupResult.maxCompanions, Math.min(lookupResult.companions.length, MAX_COMPANIONS))));
    setPendingRemoval(null);
  }
  function cancelEdit() {
    resetRsvpForm();
  }

  function changeCompanionCount(requested: number) {
    setRsvpStatus('');
    const nextCount = editMode ? Math.min(requested, maxCompanions) : requested;
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
          ? `Indiquez le nom de votre proche n°${list} pour envoyer votre réponse.`
          : `Indiquez le nom de vos proches n°${list} pour envoyer votre réponse.`);
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
          const duplicateLabel = companions[index].trim() || `votre proche n°${index + 1}`;
          setRsvpStatus(previous === -1
            ? `« ${duplicateLabel} » est déjà votre propre nom. Indiquez le nom de votre proche n°${index + 1}.`
            : `Les proches n°${previous + 1} et n°${index + 1} ont le même nom. Indiquez un nom différent pour le proche n°${index + 1}.`);
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
          ...(editMode ? { mode: 'update', originalGuestName: editOriginalName } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Enregistrement impossible.');
      }

      if (result.status === 'accepted' && result.venueDetails) {
        const details = result.venueDetails as Record<string, unknown>;
        setContent(current => ({
          ...current,
          venue: String(details.venue ?? ''),
          venueDetail: String(details.venue_detail ?? ''),
          mapUrl: String(details.map_url ?? ''),
          travel: details.travel && typeof details.travel === 'object' ? details.travel as Content['travel'] : current.travel,
        }));
      }
      setRsvpReceipt({
        guestName: typeof result.guestName === 'string' ? result.guestName : cleanPersonName(guestName),
        attending: typeof result.attending === 'boolean' ? result.attending : attendingYes,
        companionCount: typeof result.companionCount === 'number' ? result.companionCount : 0,
        personCount: typeof result.personCount === 'number' ? result.personCount : 1,
        updated: Boolean(result.updated),
        possibleDuplicate: Boolean(result.possibleDuplicate),
        status: result.status === 'review' ? 'review' : result.status === 'waitlisted' ? 'waitlisted' : result.status === 'declined' ? 'declined' : 'accepted',
      });

      if (editMode) {
        setLookupResult(current => current ? {
          ...current,
          guestName: typeof result.guestName === 'string' ? result.guestName : cleanPersonName(guestName),
          attending: attendingYes,
          companions: attendingYes ? companionNames : [],
          companionCount: attendingYes ? companionNames.length : 0,
          personCount: typeof result.personCount === 'number' ? result.personCount : (attendingYes ? 1 + companionNames.length : 0),
          status: result.status === 'waitlisted' ? 'waitlisted' : result.status === 'declined' ? 'declined' : result.status === 'review' ? 'review' : 'accepted',
          ...(result.venueDetails ? { venueDetails: result.venueDetails } : {}),
        } : current);
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
            <a href="#programme">Programme</a>
            <a href="#rsvp">Présence</a>
            <a href="#faq">Questions</a>
          </nav>

        </div>
      </header>

      <main id="contenu" tabIndex={-1}>
        <section className="hero" id="accueil">
          <div className="shell hero-grid">
            <div>
              <div className="eyebrow">Une célébration de famille</div>
              <h1 className="serif">{content.heroTitle.trim() || initialContent.heroTitle}</h1>
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
                    <div className="countbox"><span key={countdown.seconds} className="count-value tick">{String(countdown.seconds).padStart(2, '0')}</span><small>{countdown.seconds > 1 ? 'secondes' : 'seconde'}</small></div>
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
                <a className="button" href="#rsvp"><CalendarCheck size={18} /> Confirmer ma présence</a>
              </div>
              <div className="hero-links">
                <a className="hero-link" href="#programme"><ListChecks size={17} /> Voir le programme de la journée</a>
                <InstallApp />
              </div>
            </div>
          </div>
        </section>

        {content.announcement.trim() && !content.announcement.trim().toLowerCase().startsWith('bienvenue sur votre espace famille') && (
          <section className="section soft" id="annonces">
            <div className="shell">
              <div className="section-head" data-reveal><div className="eyebrow">À lire en premier</div><h2>Information des familles</h2></div>
              <div className="announcement" data-reveal>
                <Megaphone size={24} style={{ flexShrink: 0, marginTop: 3 }} />
                <div>
                  <p>{content.announcement}</p>
                  {stamp && <div className="latest" style={{ color: '#cfe0ec' }}>Mis à jour : {stamp}</div>}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="section" id="programme">
          <div className="shell location">
            <div data-reveal>
              <div className="eyebrow">Le déroulement</div>
              <h2>Programme de la journée</h2>
              <p style={{ color: 'var(--muted)' }}>Voici le déroulé complet de la journée. Les horaires peuvent légèrement évoluer : revenez consulter cette page.</p>
              <ProgramTimeline items={content.items.filter(item => !item.familyOnly && item.confirmed).map(item => ({ ...item, detail: '' }))} />
            </div>
          </div>
        </section>

        <section className="section soft" id="rsvp">
          <div className="shell">
            <div className="section-head" data-reveal>
              <div className="eyebrow">Votre réponse nous aide à nous organiser</div>
              <h2>Confirmer votre présence</h2>
              <p>Merci de répondre pour que les familles puissent préparer votre accueil.</p>
            </div>
            <section className="rsvp-lookup-card" aria-labelledby="rsvp-lookup-title" data-reveal>
              <div className="eyebrow">Vous avez déjà répondu ?</div>
              <h3 id="rsvp-lookup-title">Déjà enregistré ?</h3>
              <p>Entrez le numéro utilisé lors de votre inscription pour retrouver votre réponse et les informations réservées aux invités confirmés.</p>
              <form className="rsvp-lookup-form" onSubmit={findRsvp}>
                <label htmlFor="lookup-phone">Votre numéro de téléphone</label>
                <input id="lookup-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={24} required value={lookupPhone} onChange={event => setLookupPhone(event.target.value)} placeholder="Ex. : 07 00 00 00 00" />
                <button className="button" type="submit" disabled={lookupBusy}>{lookupBusy ? 'Recherche…' : 'Retrouver ma réponse'}</button>
              </form>
              {lookupStatus && <p className="rsvp-status" role="alert">{lookupStatus}</p>}
              {lookupResult && (
                <div className="rsvp-lookup-result" aria-live="polite">
                  <div className="rsvp-lookup-result-head">
                    <div><span className="eyebrow">Votre réponse</span><h3>{lookupResult.guestName}</h3></div>
                    <span className={'rsvp-lookup-status ' + lookupResult.status}>{lookupResult.status === 'accepted' ? 'Présence confirmée' : lookupResult.status === 'waitlisted' ? 'En liste d’attente' : lookupResult.status === 'review' ? 'À vérifier' : 'Absence enregistrée'}</span>
                  </div>
                  <p>{lookupResult.status === 'accepted' ? 'Votre groupe compte ' + lookupResult.personCount + ' personne' + (lookupResult.personCount > 1 ? 's' : '') + '.' : lookupResult.status === 'waitlisted' ? 'Votre demande est enregistrée. Les familles vous informeront si une place se libère.' : lookupResult.status === 'review' ? 'Votre demande doit encore être vérifiée par les familles.' : 'Votre absence a bien été enregistrée.'}</p>
                  {lookupResult.attending && lookupResult.companions.length > 0 && <p className="rsvp-lookup-names"><strong>Personnes déclarées :</strong> {lookupResult.guestName}, {lookupResult.companions.join(', ')}</p>}
                  {lookupResult.status === 'accepted' && lookupResult.venueDetails && (
                    <div className="rsvp-private-details">
                      <div className="eyebrow">Informations réservées aux invités confirmés</div>
                      <h4><MapPin size={18} /> {content.venue || 'Votre lieu de réception'}</h4>
                      {content.venueDetail && <p>{content.venueDetail}</p>}
                      {venueMapUrl && <a className="button secondary" href={venueMapUrl} target="_blank" rel="noreferrer"><Navigation size={17} /> Voir mon itinéraire</a>}
                      <TravelGuide travel={content.travel} mapUrl={venueMapUrl} />
                    </div>
                  )}
                  {lookupResult.status === 'accepted' && content.pagne.enabled && (
                    <div className="rsvp-private-pagne">
                      <div className="eyebrow"><ShoppingBag size={16} /> Pagne officiel</div>
                      <p>Vous souhaitez commander le pagne de la dot ? Contactez directement la vendeuse.</p>
                      <strong>{Number(content.pagne.price || 0).toLocaleString('fr-FR')} FCFA le morceau</strong>
                      <div className="pagne-actions">
                        <a className="button" href={pagneWhatsAppUrl('+225 0501190633', lookupResult.guestName, lookupResult.personCount, content.pagne.contacts[0]?.label || 'Madame Traoré', Number(content.pagne.price || 0), content.groomName + ' et ' + content.brideName)} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Commander sur WhatsApp</a>
                        <a className="button secondary" href="tel:+2250501190633"><Phone size={17} /> Appeler</a>
                      </div>
                    </div>
                  )}
                  <div className="rsvp-lookup-actions"><button type="button" className="button" onClick={startEdit}><Pencil size={17} /> Modifier ma présence</button></div>
                </div>
              )}
            </section>
            <form className={'rsvp-form' + (editMode ? ' is-edit-modal' : '')} onSubmit={submitRsvp} data-reveal={editMode ? undefined : true} role={editMode ? 'dialog' : undefined} aria-modal={editMode ? true : undefined} aria-label={editMode ? 'Modifier ma présence' : undefined}>
              {editMode && (
                <div className="rsvp-edit-banner" role="status">
                  <b>Vous modifiez votre réponse</b>
                  <p>Vous pouvez corriger les noms, réduire le nombre de proches ou indiquer que vous ne viendrez pas. Il n’est pas possible d’ajouter des proches.</p>
                </div>
              )}
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
                readOnly={editMode}
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
                  <label htmlFor="companion-count">Qui vient avec vous ?</label>
                  <p className="rsvp-hint">Famille, conjoint(e), enfants : vous êtes les bienvenus. Dites-nous simplement combien vous serez.</p>
                  <select id="companion-count" value={String(companions.length)} onChange={event => changeCompanionCount(Number(event.target.value))}>
                    {Array.from({ length: (editMode ? Math.max(maxCompanions, companions.length) : MAX_COMPANIONS) + 1 }, (_, index) => index).map(count => (
                      <option key={count} value={count}>
                        {count === 0 ? 'Je viens seul(e)' : `${count} proche${count > 1 ? 's' : ''} avec moi`}
                      </option>
                    ))}
                  </select>
                  {editMode && <p className="rsvp-hint">{maxCompanions > 0 ? `Vous pouvez réduire le nombre de proches, mais pas en ajouter (maximum : ${maxCompanions}).` : 'Il n’est pas possible d’ajouter des proches à cette réponse. Contactez les familles si besoin.'}</p>}
                  {companions.map((companion, index) => (
                    <div key={index}>
                      <label htmlFor={`companion-${index}`}>Nom de votre proche n°{index + 1}</label>
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
                  <b>Retirer {pendingRemoval.names.length > 1 ? 'ces proches' : 'ce proche'} ?</b>
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
                    <p>{companions.length > 0 ? `Vous serez présent(e) avec ${companions.length} proche${companions.length > 1 ? 's' : ''}, soit ${totalPeople} personnes au total.` : 'Vous serez présent(e), seul(e).'}</p>
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
              <div className="rsvp-buttons">
                <button className="button" type="submit" disabled={rsvpBusy || lookupBusy}>
                  {rsvpBusy ? 'Envoi en cours…' : editMode ? 'Enregistrer mes modifications' : 'Envoyer ma réponse'}
                </button>
                {editMode && <button className="button secondary" type="button" onClick={cancelEdit} disabled={rsvpBusy}>Annuler</button>}
              </div>
              {!editMode && <p className="rsvp-hint">Déjà répondu ? Utilisez le cadre ci-dessus pour retrouver votre inscription.</p>}
              {rsvpStatus && <p className="rsvp-status" role="alert" aria-live="assertive">{rsvpStatus}</p>}
              <p className="rsvp-privacy">Votre numéro et votre réponse restent privés.</p>
            </form>
          </div>
        </section>

        {content.faq.some(item => item.confirmed && item.detail.trim()) && (
        <section className="section" id="faq">
          <div className="shell">
            <div className="section-head" data-reveal>
              <div className="eyebrow">Besoin d’un renseignement ?</div>
              <h2>Questions fréquentes</h2>
              <p>Les informations utiles pour votre journée.</p>
            </div>
            <div className="faq">
              {content.faq.filter(item => item.confirmed && item.detail.trim()).map(item => (
                <details key={item.id} data-reveal>
                  <summary>{item.title}</summary>
                  <p>{item.detail}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        )}

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
        <a href="#programme" aria-current={activeSection === 'programme' ? 'location' : undefined}><ListChecks /><span>Programme</span></a>
        <a href="#rsvp" aria-current={activeSection === 'rsvp' ? 'location' : undefined}><CalendarCheck /><span>Présence</span></a>
        <a href="#faq" aria-current={activeSection === 'faq' ? 'location' : undefined}><CircleHelp /><span>FAQ</span></a>
      </nav>

  useEffect(() => {
    if (!editMode) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.getElementById('guest-name')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelEdit();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [editMode]);

      {rsvpReceipt && (
        <div
          className="modal-overlay"
          onClick={event => { if (event.target === event.currentTarget) setRsvpReceipt(null); }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rsvp-modal-title" aria-describedby="rsvp-modal-text" ref={modalRef}>
            <div className={`modal-icon ${rsvpReceipt.attending ? 'yes' : 'no'}`}>
              {rsvpReceipt.attending && rsvpReceipt.status !== 'waitlisted' ? <PartyPopper size={26} /> : <Heart size={26} />}
            </div>
            <div className="eyebrow">{rsvpReceipt.status === 'review' ? 'Votre demande doit être vérifiée' : rsvpReceipt.status === 'waitlisted' ? 'Votre réponse a bien été reçue' : rsvpReceipt.updated ? 'Votre réponse a été modifiée' : rsvpReceipt.attending ? 'Votre présence est confirmée' : 'Votre réponse est enregistrée'}</div>
            <h3 id="rsvp-modal-title">Merci {rsvpReceipt.guestName} !</h3>
            {rsvpReceipt.status === 'review' ? (
              <>
                <p id="rsvp-modal-text">Votre demande a bien été reçue, mais un nom très proche figure déjà dans la liste des invités. Les organisateurs vont vérifier qu’il ne s’agit pas d’un doublon et vous contacteront sur WhatsApp au numéro indiqué.</p>
                <p className="modal-note">Votre invitation n’est pas encore confirmée. Aucune place n’est réservée tant que la vérification n’est pas terminée.</p>
                <div className="modal-actions"><button type="button" className="button" ref={modalCloseRef} onClick={() => setRsvpReceipt(null)}>Fermer</button></div>
              </>
            ) : rsvpReceipt.status === 'waitlisted' ? (
              <>
                <p id="rsvp-modal-text">Merci pour votre réponse. Les familles vous communiqueront les informations pratiques dès que possible.</p>
                <p className="modal-note">Nous avons bien enregistré votre demande.</p>
                <div className="modal-actions"><button type="button" className="button" ref={modalCloseRef} onClick={() => setRsvpReceipt(null)}>Fermer</button></div>
              </>
            ) : rsvpReceipt.attending ? (
              <>
                <p id="rsvp-modal-text">
                  {rsvpReceipt.updated ? 'Nous avons bien enregistré vos modifications.' : 'Nous sommes heureux de vous compter parmi nous.'}{' '}
                  {rsvpReceipt.companionCount > 0
                    ? `Vos ${rsvpReceipt.personCount} places sont réservées (vous et ${rsvpReceipt.companionCount} proche${rsvpReceipt.companionCount > 1 ? 's' : ''}).`
                    : 'Votre place est réservée.'}
                </p>
                <div className="modal-event">
                  <CalendarCheck size={18} />
                  <span>{formattedEventDate} · {formattedEventTime}<br />{content.venue}, {content.venueDetail}</span>
                </div>
                {rsvpReceipt.possibleDuplicate && (
                  <p className="modal-note"><Info size={16} /> Un nom identique figure déjà dans la liste. Les organisateurs vérifieront qu’il ne s’agit pas d’un doublon.</p>
                )}
                {content.pagne.enabled && content.pagne.contacts.length > 0 && (
                  <section className="modal-pagne" aria-labelledby="modal-pagne-title">
                    <div className="modal-pagne-heading"><ShoppingBag size={19} /><span id="modal-pagne-title">Pensez à votre uniforme</span></div>
                    <p>Pour cette journée, les familles invitent tous les convives à porter le pagne officiel de la dot.</p>
                    <strong className="modal-pagne-price">{Number(content.pagne.price || 0).toLocaleString('fr-FR')} FCFA <span>le morceau</span></strong>
                    <div className="modal-pagne-contacts">
                      {content.pagne.contacts.map((contact, index) => {
                        const digits = contact.phone.replace(/\D/g, '');
                        const sellerName = contact.label.trim() || `Vendeur ${index + 1}`;
                        const whatsappUrl = pagneWhatsAppUrl('+225 0501190633', rsvpReceipt.guestName, rsvpReceipt.personCount, sellerName, Number(content.pagne.price || 0), `${content.groomName} et ${content.brideName}`);
                        return digits.length >= 8 ? (
                          <div className="modal-pagne-contact" key={contact.id}>
                            <span>Contact : <strong>{sellerName}</strong></span>
                            <div className="modal-pagne-actions">
                              <a className="button" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Commander sur WhatsApp</a>
                              <a className="button secondary" href="tel:+2250501190633"><Phone size={16} /> Appeler</a>
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </section>
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
                  {rsvpReceipt.updated ? 'Nous avons bien enregistré vos modifications.' : 'Votre réponse a bien été transmise aux familles.'} Vous nous manquerez — nous penserons à vous le {formattedEventDate}.
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
