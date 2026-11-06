'use client';

import { useState, type CSSProperties } from 'react';
import { Bus, Car, CarTaxiFront, MapPinned, Navigation } from 'lucide-react';
import type { TravelContent } from '@/lib/content';

type Mode = 'bus' | 'taxi' | 'car';

const MODES: { id: Mode; label: string; icon: typeof Bus }[] = [
  { id: 'bus', label: 'En bus', icon: Bus },
  { id: 'taxi', label: 'Taxi ou Yango', icon: CarTaxiFront },
  { id: 'car', label: 'En voiture', icon: Car },
];

export default function TravelGuide({ travel, mapUrl }: { travel: TravelContent; mapUrl: string }) {
  const [mode, setMode] = useState<Mode>('bus');
  const lines = travel.busLines.filter(line => line.number.trim());

  const mapsButton = (
    <a href={mapUrl} target="_blank" rel="noreferrer" className="button">
      <Navigation size={17} /> Ouvrir l’itinéraire Google Maps
    </a>
  );

  return (
    <div className="travel-guide" aria-live="polite">
      <div className="card travel-card">
        <div className="eyebrow">Votre accès à la réception</div>
        <h3>Merci d’avoir confirmé votre présence !</h3>
        <p className="travel-ask">Comment venez-vous ? Touchez votre choix :</p>
        <div className="travel-modes" role="group" aria-label="Moyen de transport">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}>
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {mode === 'bus' && (
          <ol className="travel-steps" key={mode}>
            <li>
              <h4>Prenez l’un de ces bus</h4>
              <ul className="travel-lines">
                {lines.map((line, index) => (
                  <li key={line.id} style={{ '--i': index } as CSSProperties}>
                    <span className="travel-badge" aria-label={`Ligne ${line.number}`}>{line.number}</span>
                    <span className="travel-line-text">
                      <span><b>Départ :</b> {line.from || 'à confirmer'}</span>
                      {line.to.trim() && <span><b>Direction :</b> {line.to}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
            <li>
              <h4>Descendez à cet arrêt</h4>
              <div className="travel-stop"><MapPinned size={22} /><div><strong>{travel.stopName}</strong><small>Tous ces bus s’y arrêtent.</small></div></div>
            </li>
            <li>
              <h4>Terminez à pied</h4>
              <p>{travel.walkNote}</p>
              {mapsButton}
            </li>
          </ol>
        )}

        {mode === 'taxi' && (
          <ol className="travel-steps" key={mode}>
            <li>
              <h4>Prenez un taxi depuis ce point</h4>
              <div className="travel-stop"><MapPinned size={22} /><div><strong>{travel.taxiFrom}</strong><small>Point de départ conseillé.</small></div></div>
            </li>
            <li>
              <h4>Descendez à ce carrefour</h4>
              <div className="travel-stop"><MapPinned size={22} /><div><strong>{travel.taxiStop}</strong></div></div>
            </li>
            <li>
              <h4>Terminez à pied</h4>
              <p>{travel.walkNote}</p>
              {mapsButton}
            </li>
            {travel.taxiDestination.trim() && (
              <li className="travel-alt">
                <h4>Vous préférez Yango ?</h4>
                <p>Entrez cette destination dans l’application : <strong>{travel.taxiDestination}</strong></p>
              </li>
            )}
          </ol>
        )}

        {mode === 'car' && (
          <ol className="travel-steps" key={mode}>
            <li>
              <h4>Ouvrez l’itinéraire</h4>
              <p>Touchez le bouton ci-dessous : Google Maps vous guide depuis votre position.</p>
              {mapsButton}
            </li>
            <li>
              <h4>Suivez le trajet jusqu’au lieu</h4>
              <p>Suivez le trajet affiché jusqu’au lieu de réception.</p>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}
