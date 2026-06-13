export type PageKind = 'book' | 'part' | 'chapter' | 'page' | 'folder';
export type SceneStatus = 'draft' | 'revised' | 'done';
export type EntityType = 'character' | 'nation' | 'location' | 'faction' | 'concept';
export type View = 'editor' | 'codex' | 'timeline' | 'map' | 'settings';

export interface Page {
  id: string;
  parent_id: string | null;
  kind: PageKind;
  title: string;
  body: string;
  status: SceneStatus | null;
  pinned: boolean;
  collapsed: boolean;
  word_count: number;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  cover_image: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  backlinks?: Backlink[];
}

export interface Backlink {
  pageId: string;
  title: string;
  loc: string;
  snippet: string;
}

export interface ChatThread {
  id: string;
  title: string;
  readonly: boolean;
  system_prompt: string | null;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export interface ContinuityFlag {
  id: string;
  quote: string;
  issue: string;
  suggestion: string;
  dismissed?: boolean;
}

export interface TimelineEvent {
  id: string;
  title: string;
  in_world_date: string;
  description: string;
  color: string;
  entity_ids: string[];
  scene_id: string | null;
  sort_order: number;
}

export interface MapPin {
  id: string;
  map_id: string;
  x: number;
  y: number;
  label: string;
  entity_id: string | null;
}

export interface WorldMap {
  id: string;
  name: string;
  image_path: string | null;
  position: number;
  pins: MapPin[];
}

export interface CalendarConfig {
  format: string;
  seasons: string[];
  currentYear: number;
}

export interface VersionMeta {
  id: string;
  label: string;
  title: string;
  word_count: number;
  kind: 'auto' | 'manual' | 'safety';
  created_at: string;
}

export interface ContextToggles {
  scene: boolean;
  chapter: boolean;
  codex: boolean;
  lore: boolean;
}

export type ProviderId = 'anthropic' | 'openai' | 'google';
export interface AiProvider {
  id: ProviderId;
  label: string;
  envVar: string;
  hasKey: boolean;
  model: string;
  defaultModel: string;
  suggestedModels: string[];
}
export interface AiStatus {
  provider: ProviderId;
  label: string;
  model: string;
  hasKey: boolean;
  providers: AiProvider[];
}

export interface DiffState {
  title: string;
  original: string;
  suggestion: string;
  tool?: string;
  instruction?: string;
}

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  snippet: string;
  dot: string;
}
export interface SearchGroup {
  label: string;
  items: SearchResult[];
}
