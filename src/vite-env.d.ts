/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DUSTTWIN_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
