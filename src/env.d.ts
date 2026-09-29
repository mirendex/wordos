/// <reference types="vite/client" />

declare module '*.txt?raw' {
  const content: string;
  export default content;
}

interface Window {
  __appBack?: () => boolean;
  __splashGone?: boolean;
  __splashDone?: (box?: { x: number; y: number; w: number; h: number } | null) => void;
  storage?: {
    get(key: string): Promise<{ key: string; value: string } | null>;
    set(key: string, value: string): Promise<{ key: string; value: string }>;
    delete(key: string): Promise<{ key: string; deleted: true }>;
    list(prefix?: string): Promise<{ keys: string[] }>;
  };
  __mt?: ReturnType<typeof setTimeout>;
  __qt?: ReturnType<typeof setTimeout>;
  __rz?: ReturnType<typeof setTimeout>;
}
