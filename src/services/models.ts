import { paint } from '../core/paint';
import { MKEY } from '../core/keys';

export interface ModelInfo {
  id: string;
  name: string;
  ctx: number;
  pin: number;
  pout: number;
  mods: string;
}

export let MODELS: ModelInfo[] = [];
export let MQ = '';
export let MFREE = false;
export let MLOAD = false;
export let MERR = '';

export function setModelQuery(q: string): void {
  MQ = q;
}
export function setModelFreeOnly(v: boolean): void {
  MFREE = v;
}

export function restoreModelsCache(list: ModelInfo[]): void {
  MODELS = list;
}

export async function loadModels(force?: boolean): Promise<void> {
  if (MLOAD) return;
  if (MODELS.length && !force) return;
  MLOAD = true;
  MERR = '';
  paint();
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    MODELS = (j.data || [])
      .map((m: Record<string, unknown>) => ({
        id: m.id,
        name: m.name || m.id,
        ctx: m.context_length || 0,
        pin: +((m.pricing as Record<string, unknown>) || {}).prompt! * 1e6,
        pout: +((m.pricing as Record<string, unknown>) || {}).completion! * 1e6,
        mods: (
          (((m.architecture as Record<string, unknown>) || {}).input_modalities as string[]) ||
          (m.input_modalities as string[]) ||
          []
        ).join(','),
      }))
      .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
    try {
      await window.storage!.set(MKEY, JSON.stringify({ at: Date.now(), list: MODELS }));
    } catch {
      /* ignore */
    }
  } catch (e) {
    MERR = 'не удалось получить список: ' + (e as Error).message;
  }
  MLOAD = false;
  paint();
}
