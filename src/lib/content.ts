export type Item = { id: string; title: string; detail: string; confirmed: boolean };
export type Content = { announcement: string; items: Item[]; faq: Item[]; refoWhatsApp: string };

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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ content, updated: new Date().toISOString() }));
    } catch {}
  }
}

let supabaseRepo: ContentRepository | null = null;
let supabaseRepoTried = false;

async function trySupabaseRepository(): Promise<ContentRepository | null> {
  if (supabaseRepoTried) return supabaseRepo;
  supabaseRepoTried = true;
  try {
    const { getSupabase } = await import('./supabase');
    const supabase = getSupabase();
    const { data: siteData } = await supabase.from('site_content').select('key, value').eq('key', 'content').single();
    const { data: programData } = await supabase.from('program_items').select('id, title, detail, confirmed, sort_order').order('sort_order', { ascending: true });
    const { data: faqData } = await supabase.from('faq_items').select('id, question, answer, confirmed, sort_order').order('sort_order', { ascending: true });

    if (siteData?.value) {
      const loaded: Content = {
        announcement: (siteData.value as any).announcement ?? initialContent.announcement,
        items: Array.isArray(programData) ? programData.map(p => ({ id: p.id, title: p.title, detail: p.detail, confirmed: !!p.confirmed })) : initialContent.items,
        faq: Array.isArray(faqData) ? faqData.map(f => ({ id: f.id, title: f.question, detail: f.answer, confirmed: !!f.confirmed })) : initialContent.faq,
        refoWhatsApp: (siteData.value as any).refoWhatsApp ?? initialContent.refoWhatsApp,
      };
      supabaseRepo = {
        async get() { return loaded; },
        async set(content: Content) {
          await supabase.from('site_content').upsert({ key: 'content', value: content, updated_at: new Date().toISOString() }, { onConflict: 'key' });
          if (Array.isArray(content.items)) {
            await supabase.from('program_items').upsert(content.items.map((i, idx) => ({ id: i.id, title: i.title, detail: i.detail, confirmed: i.confirmed, sort_order: idx })));
          }
          if (Array.isArray(content.faq)) {
            await supabase.from('faq_items').upsert(content.faq.map((f, idx) => ({ id: f.id, question: f.title, answer: f.detail, confirmed: f.confirmed, sort_order: idx })));
          }
        },
      };
      return supabaseRepo;
    }
  } catch {
    // Supabase non configuré ou tables absentes : on reste sur localStorage
  }
  return null;
}

export async function getContentRepository(): Promise<ContentRepository> {
  const sb = await trySupabaseRepository();
  if (sb) return sb;
  return new LocalStorageRepository();
}

export async function loadContent(): Promise<Content> {
  const repo = await getContentRepository();
  return repo.get();
}

export async function saveContent(content: Content): Promise<void> {
  const repo = await getContentRepository();
  await repo.set(content);
}
