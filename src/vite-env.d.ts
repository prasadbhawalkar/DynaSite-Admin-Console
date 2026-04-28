/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONSOLE_GAS_URL: string;
  readonly VITE_ADMIN_SPREADSHEET_ID: string;
  readonly VITE_TEMPLATE_SPREADSHEET_ID: string;
  readonly VITE_TEMPLATE_GAS_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
