'use client';

import { useEffect, useRef } from 'react';
import { Star } from 'lucide-react';
import type { Item } from '@/lib/content';
import { formatClock, groupProgram } from '@/lib/program';

export default function ProgramTimeline({ items }: { items: Item[] }) {
  const root = useRef<HTMLDivElement>(null);
  const groups = groupProgram(items);

  // Apparition douce des étapes quand elles entrent à l'écran.
  // Sans JavaScript, ou si le téléphone demande « réduire les animations », tout reste visible.
  useEffect(() => {
    const node = root.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    node.classList.add('reveal-on');
    const observer = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    node.querySelectorAll('.program-step, .program-phase').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <div className="program" ref={root}>
      {groups.map((group, g) => (
        <section className="program-group" key={`${group.phase}-${g}`}>
          {group.phase && <h3 className="program-phase"><span className="program-phase-label">{group.phase}</span></h3>}
          <ol className="program-steps">
            {group.items.map(item => {
              const start = formatClock(item.timeBegin);
              const end = formatClock(item.timeEnd);
              const spoken = start && end && start !== end ? `de ${start} à ${end}` : start;
              return (
                <li className={`program-step${item.highlight ? ' is-key' : ''}`} key={item.id}>
                  <span className="program-time" aria-label={spoken || undefined}>
                    <span className="program-time-start" aria-hidden={spoken ? 'true' : undefined}>{start || '—'}</span>
                    {end && end !== start && <span className="program-time-end" aria-hidden="true">→ {end}</span>}
                  </span>
                  <div className="program-body">
                    <h4>
                      {item.title}
                      {item.highlight && <span className="program-badge"><Star size={13} aria-hidden="true" /> Temps fort</span>}
                    </h4>
                    {item.detail && <p>{item.detail}</p>}
                    {!item.confirmed && <span className="tag">À confirmer</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
