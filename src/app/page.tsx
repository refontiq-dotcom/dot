'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  MapPin,
  Megaphone,
  Clock3,
  Heart,
  House,
  CalendarCheck,
  CircleHelp,
  Share2,
  Navigation,
  Info,
  ShoppingBag,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { initialContent, loadContent, type Content } from '@/lib/content';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function Calendar() {
  return <CalendarDays size={19} />;
}

export default function Home() {
  const [content, setContent] = useState<Content>(initialContent);
  const [updated, setUpdated] = useState<string>('');
  const [shareMsg, setShareMsg] = useState('');
  const [guestName, setGuestName] = useState('');
  const [attending, setAttending] = useState('yes');
  const [personCount, setPersonCount] = useState('1');
  const [rsvpStatus, setRsvpStatus] = useState('');
  const [website, setWebsite] = useState('');
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [showTravelGuide, setShowTravelGuide] = useState(false);
  const eventDate = new Date(`${content.eventDate}T${content.eventTime}:00+00:00`);
  const formattedEventDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(eventDate);
  const formattedEventTime = content.eventTime.replace(':', ' h ');
  const [remaining, setRemaining] = useState<number>(() => Math.max(0, eventDate.getTime() - Date.now()));

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
      setRemaining(Math.max(0, eventDate.getTime() - Date.now()));
    };
    tick();
    const intervalId = window.setInterval(tick, 60_000);
    return () => window.clearInterval(intervalId);
  }, [content.eventDate, content.eventTime]);

  const days = Math.ceil(remaining / DAY_IN_MS);
  const stamp = updated || 'Mise à jour non renseignée';

  async function submitRsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRsvpBusy(true);
    setRsvpStatus('');
    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName, attending: attending === 'yes', personCount: attending === 'yes' ? Number(personCount) : 0, website }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Enregistrement impossible.');
      setRsvpStatus('Merci ! Votre réponse a bien été enregistrée.');
      setShowTravelGuide(attending === 'yes');
      setGuestName('');
      setAttending('yes');
      setPersonCount('1');
      setWebsite('');
    } catch (error) {
      setRsvpStatus(error instanceof Error ? error.message : 'Une erreur est survenue. Réessayez.');
    } finally {
      setRsvpBusy(false);
    }
  }

  async function share() {
    const shareData = {
      title: `La dot d’${content.groomName} & ${content.brideName}`,
      text: `Retrouvons-nous le ${formattedEventDate} à ${formattedEventTime} à ${content.venue}, ${content.venueDetail}.`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareMsg('Merci d’avoir partagé cette invitation.');
        return;
      }
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      setShareMsg('Le lien de l’invitation a été copié.');
    } catch {
      setShareMsg('Le partage n’a pas pu être effectué. Vous pouvez copier le lien depuis la barre d’adresse.');
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="shell nav">
          <a href="#accueil" className="brand">A <span style={{ color: 'var(--clay)' }}>×</span> D</a>
          <nav className="navlinks" aria-label="Navigation principale">
            <a href="#details">La cérémonie</a>
            {content.pagne.enabled && <a href="#pagne">Acheter le pagne</a>}
            <a href="#programme">Programme</a>
            <a href="#lieu">Le lieu</a>
            <a href="#rsvp">Présence</a>
            <a href="#faq">Questions</a>
          </nav>
          <a className="button small" href="#annonces">Dernières nouvelles <Megaphone size={16} /></a>
        </div>
      </header>

      <main>
        <section className="hero" id="accueil">
          <div className="shell hero-grid">
            <div>
              <div className="eyebrow">Une célébration de famille</div>
              <h1 className="serif">Deux héritages,<br />une même union</h1>
              <p className="lead">Avec joie, les familles {content.familyNames} vous invitent à célébrer la dot traditionnelle de</p>
              <h2 className="serif" style={{ fontSize: 'clamp(25px,4vw,34px)', marginBottom: 8 }}>
                {content.groomName}<br />
                <span style={{ fontStyle: 'italic', color: 'var(--clay)' }}>&amp;</span> {content.brideName}
              </h2>
              <div className="date-pill"><Calendar /><span>{formattedEventDate} · {formattedEventTime}</span></div>
              <div className="countdown" aria-label={`Dans ${days} jours`}>
                <div className="countbox"><span>{days}</span><small>jours</small></div>
                <div className="countbox"><span>{eventDate.getUTCDate()}</span><small>{new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(eventDate).replace('.', '')}</small></div>
                <div className="countbox"><span>{eventDate.getUTCFullYear()}</span><small>année</small></div>
              </div>
              <div className="actions">
                <a className="button" href="#lieu"><MapPin size={18} /> Voir le lieu</a>
                {content.pagne.enabled && <a className="button clay" href="#pagne"><ShoppingBag size={18} /> Acheter le pagne de la dot</a>}
                <a className="button secondary" href="#rsvp">Confirmer ma présence</a>
                <button type="button" onClick={share} className="button secondary"><Share2 size={17} /> Partager</button>
              </div>
              {shareMsg && <p className="latest" role="status">{shareMsg}</p>}
            </div>
            <div className="portrait" aria-label="Monogramme des familles Anougbre et Dukoua">
              <div className="portrait-inner">
                <small>Une union</small>
                <span className="initials">A <span style={{ color: 'var(--clay)' }}>&amp;</span> D</span>
                <small>{content.eventDate.split('-').reverse().join(' · ')}</small>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="details">
          <div className="shell">
            <div className="section-head">
              <div className="eyebrow">Tout en un seul endroit</div>
              <h2>Les repères de la journée</h2>
              <p>Retrouvez ici les informations utiles, faciles à consulter et à partager avec vos proches.</p>
            </div>
            <div className="grid3">
              <article className="card"><div className="iconbox"><CalendarCheck /></div><h3>Quand ?</h3><p>{formattedEventDate}<br />À partir de {formattedEventTime}</p></article>
              <article className="card"><div className="iconbox"><MapPin /></div><h3>Où ?</h3><p>{content.venue}<br />{content.venueDetail}</p></article>
              <article className="card"><div className="iconbox"><Heart /></div><h3>Avec qui ?</h3><p>Les familles {content.familyNames}</p></article>
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
                <div className="latest" style={{ color: '#e7dce3' }}>Mis à jour : {stamp}</div>
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
              <p style={{ color: 'var(--muted)' }}>Les familles complèteront cette page au fur et à mesure. Seules les informations confirmées sont présentées comme définitives.</p>
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
              {showTravelGuide ? (
                <div className="travel-guide" aria-live="polite">
                  <div className="card" style={{ marginTop: 24 }}>
                    <div className="eyebrow">Votre accès à la réception</div>
                    <h3>Merci d’avoir confirmé votre présence !</h3>
                    <p>Voici les indications pour rejoindre facilement le lieu de la cérémonie.</p>
                    <a href={content.mapUrl} target="_blank" rel="noreferrer" className="button" style={{ marginTop: 12 }}><Navigation size={17} /> Ouvrir l’itinéraire Google Maps</a>
                  </div>
                  <div className="card" style={{ marginTop: 16 }}>
                    <div className="eyebrow">En transport en commun</div>
                    <h3>En bus SOTRA</h3>
                    <p>Les lignes ci-dessous desservent l’arrêt du commissariat du 22e arrondissement. Descendez à cet arrêt, puis suivez l’itinéraire à pied vers Laser Park et le lieu de réception.</p>
                    <ul>
                      <li><strong>81 :</strong> au départ de la Gare Nord (Adjamé).</li>
                      <li><strong>82 :</strong> au départ de la Gare Sud (Plateau).</li>
                      <li><strong>90 :</strong> au départ de Cocody Blockauss.</li>
                      <li><strong>719 :</strong> au départ de Yopougon Saint-André.</li>
                      <li><strong>775 :</strong> ligne desservant le secteur d’Angré.</li>
                      <li><strong>704 :</strong> ligne desservant le secteur d’Angré.</li>
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
              <fieldset>
                <legend>Serez-vous présent(e) ?</legend>
                <label className="rsvp-choice">
                  <input type="radio" name="attending" value="yes" checked={attending === 'yes'} onChange={() => setAttending('yes')} />
                  Oui, je serai présent(e)
                </label>
                <label className="rsvp-choice">
                  <input type="radio" name="attending" value="no" checked={attending === 'no'} onChange={() => setAttending('no')} />
                  Non, je ne pourrai pas venir
                </label>
              </fieldset>
              {attending === 'yes' && (
                <div>
                  <label htmlFor="person-count">Nombre total de personnes (vous compris)</label>
                  <select id="person-count" value={personCount} onChange={event => setPersonCount(event.target.value)}>
                    {Array.from({ length: 10 }, (_, index) => String(index + 1)).map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
              )}
              <div className="rsvp-trap" aria-hidden="true">
                <label htmlFor="rsvp-website">Ne pas remplir ce champ</label>
                <input id="rsvp-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} />
              </div>
              <button className="button" type="submit" disabled={rsvpBusy}>{rsvpBusy ? 'Envoi en cours…' : 'Envoyer ma réponse'}</button>
              {rsvpStatus && <p className="rsvp-status" role="status" aria-live="polite">{rsvpStatus}</p>}
              <p className="rsvp-privacy">Votre réponse est réservée à l’organisation de la cérémonie et n’est pas affichée publiquement.</p>
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

        <section className="section soft">
          <div className="shell">
            <div className="promo">
              <div>
                <div className="eyebrow" style={{ color: '#e7b4a0' }}>Un projet pour votre activité ?</div>
                <h2>Votre savoir-faire mérite aussi sa vitrine en ligne.</h2>
                <p><strong>Refontiq</strong> crée des solutions numériques sur mesure pour aider les entreprises à mieux présenter leur activité, toucher leurs clients et se développer en ligne.</p>
                <div style={{ marginTop: 20 }}>
                  {content.refoWhatsApp
                    ? <a className="button clay" href={`https://wa.me/${content.refoWhatsApp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Parler à Refontiq sur WhatsApp</a>
                    : <span className="tag">WhatsApp Refontiq : numéro à configurer</span>}
                </div>
              </div>
              <div className="promo-mark">refontiq<span style={{ color: '#e09176' }}>.</span></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="shell" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <span>Avec affection, les familles {content.familyNames} · {eventDate.getUTCFullYear()}</span>
          <a href="/admin">Accès organisateurs</a>
        </div>
      </footer>

      <nav className="mobile-nav" aria-label="Navigation rapide">
        <a href="#accueil"><House /><span>Accueil</span></a>
        <a href="#details"><Calendar /><span>Infos</span></a>
        <a href="#annonces"><Megaphone /><span>Actus</span></a>
        <a href="#lieu"><MapPin /><span>Lieu</span></a>
        <a href="#faq"><CircleHelp /><span>FAQ</span></a>
      </nav>
    </>
  );
}
