export interface StorageAdapter { get(key: string): string | null; set(key: string, value: string): void; remove(key: string): void }
export interface Storage {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  subscribe(key: string, fn: () => void): () => void;
  refresh(key: string): void;
}
export function memoryAdapter(seed?: Record<string, string>): StorageAdapter;
export function webAdapter(getStorage?: () => globalThis.Storage): StorageAdapter;
export function createStorage(adapter: StorageAdapter): Storage;
export function toggleKey(list: string[], key: string): { list: string[]; on: boolean };
export function pushRecent(list: string[], key: string, max?: number): string[];
export interface FilterCombo { name: string; query: string; at: number }
export function saveCombo(list: FilterCombo[], name: string, query: string, max?: number): FilterCombo[];
export function removeCombo(list: FilterCombo[], name: string): FilterCombo[];
