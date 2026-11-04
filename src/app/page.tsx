'use client';

import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { initialContent, loadContent, type Content } from '@/lib/content';

const eventDate = new Date('2026-12-12T14:00:00+00:00');
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function Calendar() {
  return <CalendarDays size={19} />;
}

export default function Home() {
  const [content, setContent] = useState<Content>(initialContent);
  const [updated, setUpdated] = useState<string>('');
  const [shareMsg, setShareMsg] = useState('');
  const [remaining, setRemaining] = useState<number>(() =>
    Math.max(0, eventDate.getTime() - Date.now()),
  );

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
  }, []);

  const days = Math.ceil(remaining / DAY_IN_MS);
  const stamp = updated || 'Mise à jour non renseignée';

  async function share() {
    const shareData = {
      title: 'La dot d’Anougbre Brou Frédéric & Dukoua You Vanessa',
      text: 'Retrouvons-nous le samedi 12 décembre 2026 à 14 h à Cocody Angré Mahou, près de Laser Park.',
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
            <a href="#programme">Programme</a>
            <a href="#lieu">Le lieu</a>
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
              <p className="lead">Avec joie, les familles Anougbre et Dukoua vous invitent à célébrer la dot traditionnelle de</p>
              <h2 className="serif" style={{ fontSize: 'clamp(25px,4vw,34px)', marginBottom: 8 }}>
                Anougbre Brou Frédéric<br />
                <span style={{ fontStyle: 'italic', color: 'var(--clay)' }}>&amp;</span> Dukoua You Vanessa
              </h2>
              <div className="date-pill"><Calendar /><span>Samedi 12 décembre 2026 · 14 h 00</span></div>
              <div className="countdown" aria-label={`Dans ${days} jours`}>
                <div className="countbox"><span>{days}</span><small>jours</small></div>
                <div className="countbox"><span>12</span><small>déc.</small></div>
                <div className="countbox"><span>2026</span><small>année</small></div>
              </div>
              <div className="actions">
                <a className="button" href="#lieu"><MapPin size={18} /> Voir le lieu</a>
                <button type="button" onClick={share} className="button secondary"><Share2 size={17} /> Partager</button>
              </div>
              {shareMsg && <p className="latest" role="status">{shareMsg}</p>}
            </div>
            <div className="portrait" aria-label="Monogramme des familles Anougbre et Dukoua">
              <div className="portrait-inner">
                <small>Une union</small>
                <span className="initials">A <span style={{ color: 'var(--clay)' }}>&amp;</span> D</span>
                <small>12 · 12 · 2026</small>
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
              <article className="card"><div className="iconbox"><CalendarCheck /></div><h3>Quand ?</h3><p>Samedi 12 décembre 2026<br />À partir de 14 h 00</p></article>
              <article className="card"><div className="iconbox"><MapPin /></div><h3>Où ?</h3><p>Cocody Angré Mahou<br />Près de Laser Park</p></article>
              <article className="card"><div className="iconbox"><Heart /></div><h3>Avec qui ?</h3><p>Les familles Anougbre<br />et Dukoua</p></article>
            </div>
          </div>
        </section>

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
              <p style={{ color: 'var(--muted)' }}>Cocody Angré Mahou, près de Laser Park.</p>
              <p>Un repère facilement partageable : <strong>Laser Park</strong>, à Cocody Angré Mahou. Les indications plus précises seront ajoutées dès confirmation par les familles.</p>
              <div className="notice"><Info size={17} style={{ verticalAlign: '-3px' }} /> Adresse précise et lien cartographique à confirmer.</div>
              <a href="https://www.google.com/maps/search/?api=1&query=Laser+Park+Cocody+Angre+Mahou" target="_blank" rel="noreferrer" className="button secondary" style={{ marginTop: 16 }}><Navigation size={17} /> Chercher le repère</a>
            </div>
            <div className="mapbox">
              <div><MapPin size={30} /><p style={{ margin: '8px 0 2px', fontWeight: 700 }}>Cocody Angré Mahou</p><small>Près de Laser Park<br />Repère indicatif</small></div>
            </div>
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
          <span>Avec affection, les familles Anougbre &amp; Dukoua · 2026</span>
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
