export type Item = { id: string; title: string; detail: string; confirmed: boolean; timeBegin?: string; timeEnd?: string; phase?: string; highlight?: boolean; familyOnly?: boolean };
export type PagneContact = { id: string; label: string; phone: string };
export type PagneContent = { enabled: boolean; price: number; description: string; imageUrl: string; contacts: PagneContact[] };
export type BusLine = { id: string; number: string; from: string; to: string };
export type TravelContent = { stopName: string; walkNote: string; taxiFrom: string; taxiStop: string; taxiDestination: string; busLines: BusLine[] };
export type Content = {
  updatedAt?: string;
  heroTitle: string;
  travel: TravelContent;
  pagne: PagneContent;
  announcement: string;
  items: Item[];
  faq: Item[];
  refoWhatsApp: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  venueDetail: string;
  mapUrl: string;
  groomName: string;
  brideName: string;
  familyNames: string;
};

export const initialContent: Content = {
  heroTitle: 'Deux peuples pour une union sacrée',
  travel: {
    stopName: '',
    walkNote: '',
    taxiFrom: '',
    taxiStop: '',
    taxiDestination: '',
    busLines: [],
  },
  pagne: {
    enabled: true,
    price: 2500,
    description: 'Le pagne de la dot est disponible auprès des vendeurs indiqués. Contactez directement le vendeur de votre choix pour commander.',
    imageUrl: '',
    contacts: [{ id: 'vendeuse-madame-traore-0759698321', label: 'Madame Traoré', phone: '0759698321' }],
  },
  announcement: 'Bienvenue sur votre espace famille. Les prochaines informations seront partagées ici.',
  items: [
    { id: 'step-1', timeBegin: '06:00', timeEnd: '08:00', phase: 'Matinée en famille', title: 'Préparation et mise en beauté', detail: 'Maquillage professionnel et coiffure de la mariée à domicile.', highlight: false, familyOnly: true, confirmed: true },
    { id: 'step-2', timeBegin: '08:00', timeEnd: '08:30', phase: 'Matinée en famille', title: 'Mise en place logistique', detail: 'Ajustement final de la sonorisation, nappage des tables et disposition des chaises.', highlight: false, familyOnly: true, confirmed: true },
    { id: 'step-3', timeBegin: '08:30', timeEnd: '09:00', phase: 'Matinée en famille', title: 'Rassemblement des familles', detail: 'Arrivée de la délégation du marié. Accueil discret et séparation initiale des deux familles.', highlight: false, familyOnly: true, confirmed: true },
    { id: 'step-4', timeBegin: '09:00', timeEnd: '11:00', phase: 'Cérémonie de la dot (réservée aux familles)', title: 'Cérémonie traditionnelle de la dot', detail: 'Libations, négociation des porte-paroles, vérification des présents de la dot et bénédiction des patriarches.', highlight: true, confirmed: true },
    { id: 'step-5', timeBegin: '11:00', timeEnd: '11:30', phase: 'Matinée en famille', title: 'Séance photo officielle en famille', detail: 'Prise de vue exclusive avec les parents et les témoins avant l’effervescence du public.', highlight: false, familyOnly: true, confirmed: true },
    { id: 'step-6', timeBegin: '11:30', timeEnd: '11:45', phase: 'Accueil des invités', title: 'Installation du public et ouverture', detail: 'Accueil et placement des invités (voisins, collègues, amis) sous les grandes bâches.', highlight: false, confirmed: true },
    { id: 'step-7', timeBegin: '11:45', timeEnd: '12:15', phase: 'Accueil des invités', title: 'Prière et lancement du buffet', detail: 'Bénédiction solennelle de la nourriture par le Pasteur ou le Prêtre. Ouverture des boissons.', highlight: false, confirmed: true },
    { id: 'step-8', timeBegin: '12:15', timeEnd: '13:00', phase: 'Accueil des invités', title: 'Service des entrées', detail: 'Distribution des rafraîchissements (jus locaux, eau, bières) et amuse-bouches.', highlight: false, confirmed: true },
    { id: 'step-9', timeBegin: '13:00', timeEnd: '', phase: 'Accueil des invités', title: 'Fin des installations', detail: 'Clôture de l’accès aux places assises pour figer l’audience et préparer l’entrée royale.', highlight: false, confirmed: true },
    { id: 'step-10', timeBegin: '13:30', timeEnd: '14:00', phase: 'Fête et sorties de la mariée', title: 'Première sortie de la mariée', detail: 'Entrée en pagne uniforme : la mariée fait sa première apparition officielle avec son cortège.', highlight: true, confirmed: true },
    { id: 'step-11', timeBegin: '14:00', timeEnd: '15:00', phase: 'Fête et sorties de la mariée', title: 'Plat principal et animation', detail: 'Service du plat principal chaud (tchep, alloco, foutou) accompagné par l’animation du MC.', highlight: false, confirmed: true },
    { id: 'step-12', timeBegin: '15:00', timeEnd: '15:30', phase: 'Fête et sorties de la mariée', title: 'Deuxième sortie de la mariée', detail: 'Entrée royale en pagne Kita / Kente : présentation de la mariée parée de ses attributs royaux.', highlight: true, confirmed: true },
    { id: 'step-13', timeBegin: '15:30', timeEnd: '16:30', phase: 'Fête et sorties de la mariée', title: 'Animation, gâteau et rituels', detail: 'Animation dansante majeure de la mi-journée, coupure du gâteau et photos par table.', highlight: false, confirmed: true },
    { id: 'step-14', timeBegin: '16:30', timeEnd: '17:00', phase: 'Fête et sorties de la mariée', title: 'Troisième sortie et allocutions', detail: 'Apparition en tenue finale (tenue nigériane). Mots de remerciement officiels des mariés.', highlight: true, confirmed: true },
    { id: 'step-15', timeBegin: '17:00', timeEnd: '18:00', phase: 'Fête et sorties de la mariée', title: 'Ambiance libre', detail: 'Clôture du protocole. Piste de danse ouverte à tous les invités.', highlight: false, confirmed: true },
  ],
  faq: [
    { id: 'dress', title: 'Quelle tenue porter ?', detail: 'Les indications vestimentaires seront communiquées par les familles.', confirmed: false },
    { id: 'gift', title: 'Que faut-il apporter ?', detail: 'Les informations seront ajoutées dès confirmation.', confirmed: false },
    { id: 'kids', title: 'Les enfants sont-ils les bienvenus ?', detail: 'Merci de vous rapprocher des familles pour cette information.', confirmed: false },
  ],
  refoWhatsApp: '0100372900',
  eventDate: '2026-12-12',
  eventTime: '14:00',
  venue: '',
  venueDetail: '',
  mapUrl: '',
  groomName: 'Anougbre Brou Frédéric',
  brideName: 'Dukoua You Vanessa',
  familyNames: 'Anougbre et Dukoua',
};

export interface ContentRepository {
  get(): Promise<Content>;
  set(content: Content): Promise<void>;
}

const STORAGE_KEY = 'anougbre-dukousite-content-v1';

class LocalStorageRepository implements ContentRepository {
  async get(): Promise<Content> {
    if (typeof window === 'undefined') return initialContent;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const stored = parsed.content as Partial<Content>;
        return { ...initialContent, ...stored, venue: '', venueDetail: '', mapUrl: '', travel: initialContent.travel };
      }
    } catch {}
    return initialContent;
  }
  async set(content: Content): Promise<void> {
    if (typeof window === 'undefined') return;
    const { venue, venueDetail, mapUrl, travel, ...publicContent } = content;
    void venue; void venueDetail; void mapUrl; void travel;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ content: publicContent, updated: new Date().toISOString() }));
  }
}

async function getSupabaseRepository(): Promise<ContentRepository> {
  const { getSupabase } = await import('./supabase');
  const supabase = getSupabase();

  return {
    async get() {
      const [siteResult, programResult, faqResult] = await Promise.all([
        supabase.from('site_content').select('key, value, updated_at').in('key', ['content', 'announcement', 'whatsapp']),
        supabase.from('program_items').select('id, title, detail, confirmed, sort_order, time_begin, time_end, phase, highlight, family_only, updated_at').order('sort_order', { ascending: true }),
        supabase.from('faq_items').select('id, question, answer, confirmed, sort_order, updated_at').order('sort_order', { ascending: true }),
      ]);
      if (siteResult.error) throw siteResult.error;
      if (programResult.error) throw programResult.error;
      if (faqResult.error) throw faqResult.error;

      const rows = siteResult.data ?? [];
      const value = (rows.find(row => row.key === 'content')?.value ?? {}) as Partial<Content>;
      const legacyAnnouncement = rows.find(row => row.key === 'announcement')?.value as { text?: string } | undefined;
      const legacyWhatsApp = rows.find(row => row.key === 'whatsapp')?.value as { number?: string } | undefined;
      // Vraie date de dernière modification : la plus récente parmi le contenu, le programme et la FAQ.
      const stamps = [
        ...rows.map(row => row.updated_at as string | null),
        ...(programResult.data ?? []).map(item => item.updated_at as string | null),
        ...(faqResult.data ?? []).map(item => item.updated_at as string | null),
      ].filter((v): v is string => Boolean(v)).map(v => new Date(v).getTime()).filter(n => !Number.isNaN(n));
      const updatedAt = stamps.length ? new Date(Math.max(...stamps)).toISOString() : undefined;
      return {
        ...initialContent,
        ...value,
        // Les détails du lieu sont privés : ils ne sont jamais chargés depuis site_content public.
        venue: '',
        venueDetail: '',
        mapUrl: '',
        updatedAt,
        pagne: { ...initialContent.pagne, ...(value.pagne ?? {}) },
        travel: initialContent.travel,
        announcement: value.announcement ?? legacyAnnouncement?.text ?? initialContent.announcement,
        refoWhatsApp: value.refoWhatsApp ?? legacyWhatsApp?.number ?? initialContent.refoWhatsApp,
        items: Array.isArray(programResult.data)
          ? programResult.data.map(item => ({ id: item.id, title: item.title, detail: item.detail ?? '', confirmed: item.confirmed, timeBegin: item.time_begin ?? '', timeEnd: item.time_end ?? '', phase: item.phase ?? '', highlight: item.highlight === true, familyOnly: item.family_only === true }))
          : (value.items ?? initialContent.items),
        faq: Array.isArray(faqResult.data)
          ? faqResult.data.map(item => ({ id: item.id, title: item.question, detail: item.answer, confirmed: item.confirmed }))
          : (value.faq ?? initialContent.faq),
      };
    },
    async set(content) {
      const { items, faq, updatedAt, venue, venueDetail, mapUrl, travel, ...siteValues } = content;
      void venue; void venueDetail; void mapUrl; void travel;
      void updatedAt;
      // site_content.key has a UNIQUE constraint in the live schema, so this upsert is valid.
      // Legacy announcement and whatsapp rows are left untouched.
      const siteResult = await supabase.from('site_content').upsert(
        { key: 'content', value: siteValues, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
      if (siteResult.error) throw siteResult.error;

      const syncItems = async (
        table: 'program_items' | 'faq_items',
        nextItems: Item[],
        toRow: (item: Item, sortOrder: number) => Record<string, unknown>,
      ) => {
        const { data: existingRows, error: readError } = await supabase
          .from(table)
          .select('id');
        if (readError) throw readError;

        const existingIds = new Set((existingRows ?? []).map(row => String(row.id)));
        const retainedIds = new Set<string>();

        // Insert or update first. If any operation fails, no existing row is deleted.
        for (const [index, item] of nextItems.entries()) {
          const row = toRow(item, index);
          if (existingIds.has(item.id)) {
            const { error } = await supabase.from(table).update(row).eq('id', item.id);
            if (error) throw error;
            retainedIds.add(item.id);
          } else {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id);
            const { error } = await supabase.from(table).insert({
              ...(isUuid ? { id: item.id } : {}),
              ...row,
            });
            if (error) throw error;
          }
        }

        // Remove only rows explicitly omitted from the submitted list, and only after
        // every requested insert/update has succeeded.
        const removedIds = [...existingIds].filter(id => !retainedIds.has(id));
        if (removedIds.length) {
          const { error } = await supabase.from(table).delete().in('id', removedIds);
          if (error) throw error;
        }
      };

      await syncItems('program_items', items, (item, sortOrder) => ({
        title: item.title, detail: item.detail, confirmed: item.confirmed, sort_order: sortOrder,
        time_begin: item.timeBegin?.trim() || null, time_end: item.timeEnd?.trim() || null,
        phase: item.phase?.trim() || null, highlight: item.highlight === true, family_only: item.familyOnly === true,
      }));
      await syncItems('faq_items', faq, (item, sortOrder) => ({
        question: item.title, answer: item.detail, confirmed: item.confirmed, sort_order: sortOrder,
      }));
    }
  };
}

export async function loadContent(): Promise<Content> {
  try {
    const repository = await getSupabaseRepository();
    return await repository.get();
  } catch {
    return new LocalStorageRepository().get();
  }
}

export async function saveContent(content: Content): Promise<void> {
  const repository = await getSupabaseRepository();
  await repository.set(content);
}
