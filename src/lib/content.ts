export type Item = { id: string; title: string; detail: string; confirmed: boolean };
export type PagneContact = { id: string; label: string; phone: string };
export type PagneContent = { enabled: boolean; price: number; description: string; imageUrl: string; contacts: PagneContact[] };
export type BusLine = { id: string; number: string; from: string; to: string };
export type TravelContent = { stopName: string; walkNote: string; taxiFrom: string; taxiStop: string; taxiDestination: string; busLines: BusLine[] };
export type Content = {
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
    stopName: 'Commissariat du 22e arrondissement',
    walkNote: 'Depuis l’arrêt, marchez jusqu’à Laser Park, puis jusqu’au lieu de réception.',
    taxiFrom: 'Carrefour La Vie',
    taxiStop: 'Carrefour du commissariat du 22e arrondissement',
    taxiDestination: 'Laser Park, Cocody Angré Mahou',
    busLines: [
      { id: 'bus-81', number: '81', from: 'Gare Nord (Adjamé)', to: '' },
      { id: 'bus-82', number: '82', from: 'Gare Sud (Plateau)', to: '' },
      { id: 'bus-90', number: '90', from: 'Cocody Blockhaus', to: '' },
      { id: 'bus-719', number: '719', from: 'Yopougon Saint-André', to: 'Cocody Terminus 81-82' },
      { id: 'bus-775', number: '775', from: 'Gare de Bassam (Treichville)', to: 'Angré Château (Cocody)' },
      { id: 'bus-704', number: '704', from: 'Saint-Jean (Cocody)', to: 'Angré Château' },
    ],
  },
  pagne: {
    enabled: true,
    price: 2500,
    description: 'Le pagne de la dot est disponible auprès des vendeurs indiqués. Contactez directement le vendeur de votre choix pour commander.',
    imageUrl: '',
    contacts: [{ id: 'vendeuse-alida-duk-0759698321', label: 'Alida Dukoua', phone: '0759698321' }],
  },
  announcement: 'Bienvenue sur votre espace famille. Les prochaines informations seront partagées ici.',
  items: [
    { id: 'arrival', title: 'Accueil des familles', detail: 'Horaire à confirmer par les familles.', confirmed: false },
    { id: 'ceremony', title: 'Cérémonie traditionnelle', detail: '12 décembre 2026 à 14 h 00.', confirmed: true },
    { id: 'program-next', title: 'Suite du programme', detail: 'Informations à venir.', confirmed: false },
  ],
  faq: [
    { id: 'dress', title: 'Quelle tenue porter ?', detail: 'Les indications vestimentaires seront communiquées par les familles.', confirmed: false },
    { id: 'gift', title: 'Que faut-il apporter ?', detail: 'Les informations seront ajoutées dès confirmation.', confirmed: false },
    { id: 'kids', title: 'Les enfants sont-ils les bienvenus ?', detail: 'Merci de vous rapprocher des familles pour cette information.', confirmed: false },
  ],
  refoWhatsApp: '0100372900',
  eventDate: '2026-12-12',
  eventTime: '14:00',
  venue: 'Cocody Angré Mahou',
  venueDetail: 'Près de Laser Park',
  mapUrl: 'https://maps.app.goo.gl/EnyMdjAcEYsvyqW48',
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
        return { ...initialContent, ...stored, travel: { ...initialContent.travel, ...(stored.travel ?? {}) } };
      }
    } catch {}
    return initialContent;
  }
  async set(content: Content): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ content, updated: new Date().toISOString() }));
  }
}

async function getSupabaseRepository(): Promise<ContentRepository> {
  const { getSupabase } = await import('./supabase');
  const supabase = getSupabase();

  return {
    async get() {
      const [siteResult, programResult, faqResult] = await Promise.all([
        supabase.from('site_content').select('key, value').in('key', ['content', 'announcement', 'whatsapp']),
        supabase.from('program_items').select('id, title, detail, confirmed, sort_order').order('sort_order', { ascending: true }),
        supabase.from('faq_items').select('id, question, answer, confirmed, sort_order').order('sort_order', { ascending: true }),
      ]);
      if (siteResult.error) throw siteResult.error;
      if (programResult.error) throw programResult.error;
      if (faqResult.error) throw faqResult.error;

      const rows = siteResult.data ?? [];
      const value = (rows.find(row => row.key === 'content')?.value ?? {}) as Partial<Content>;
      const legacyAnnouncement = rows.find(row => row.key === 'announcement')?.value as { text?: string } | undefined;
      const legacyWhatsApp = rows.find(row => row.key === 'whatsapp')?.value as { number?: string } | undefined;
      return {
        ...initialContent,
        ...value,
        pagne: { ...initialContent.pagne, ...(value.pagne ?? {}) },
        travel: { ...initialContent.travel, ...(value.travel ?? {}) },
        announcement: value.announcement ?? legacyAnnouncement?.text ?? initialContent.announcement,
        refoWhatsApp: value.refoWhatsApp ?? legacyWhatsApp?.number ?? initialContent.refoWhatsApp,
        items: Array.isArray(programResult.data)
          ? programResult.data.map(item => ({ id: item.id, title: item.title, detail: item.detail ?? '', confirmed: item.confirmed }))
          : (value.items ?? initialContent.items),
        faq: Array.isArray(faqResult.data)
          ? faqResult.data.map(item => ({ id: item.id, title: item.question, detail: item.answer, confirmed: item.confirmed }))
          : (value.faq ?? initialContent.faq),
      };
    },
    async set(content) {
      const { items, faq, ...siteValues } = content;
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
