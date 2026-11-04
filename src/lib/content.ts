export type Item = { id: string; title: string; detail: string; confirmed: boolean };
export type Content = {
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
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=Laser+Park+Cocody+Angre+Mahou',
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
        return { ...initialContent, ...(parsed.content as Partial<Content>) };
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
        supabase.from('site_content').select('value').eq('key', 'content').maybeSingle(),
        supabase.from('program_items').select('id, title, detail, confirmed, sort_order').order('sort_order', { ascending: true }),
        supabase.from('faq_items').select('id, question, answer, confirmed, sort_order').order('sort_order', { ascending: true }),
      ]);
      if (siteResult.error) throw siteResult.error;
      if (programResult.error) throw programResult.error;
      if (faqResult.error) throw faqResult.error;

      const value = (siteResult.data?.value ?? {}) as Partial<Content>;
      return {
        ...initialContent,
        ...value,
        items: programResult.data?.length
          ? programResult.data.map(item => ({ id: item.id, title: item.title, detail: item.detail ?? '', confirmed: item.confirmed }))
          : (value.items ?? initialContent.items),
        faq: faqResult.data?.length
          ? faqResult.data.map(item => ({ id: item.id, title: item.question, detail: item.answer, confirmed: item.confirmed }))
          : (value.faq ?? initialContent.faq),
      };
    },
    async set(content) {
      const { items, faq, ...siteValues } = content;
      const siteResult = await supabase.from('site_content').upsert(
        { key: 'content', value: siteValues, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
      if (siteResult.error) throw siteResult.error;

      const programDelete = await supabase.from('program_items').delete().not('id', 'is', null);
      if (programDelete.error) throw programDelete.error;
      if (items.length) {
        const programInsert = await supabase.from('program_items').insert(items.map((item, index) => ({
          title: item.title, detail: item.detail, confirmed: item.confirmed, sort_order: index,
        })));
        if (programInsert.error) throw programInsert.error;
      }

      const faqDelete = await supabase.from('faq_items').delete().not('id', 'is', null);
      if (faqDelete.error) throw faqDelete.error;
      if (faq.length) {
        const faqInsert = await supabase.from('faq_items').insert(faq.map((item, index) => ({
          question: item.title, answer: item.detail, confirmed: item.confirmed, sort_order: index,
        })));
        if (faqInsert.error) throw faqInsert.error;
      }
    },
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
