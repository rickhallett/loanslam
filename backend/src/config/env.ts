import 'dotenv/config';

/**
 * Centralised, typed configuration. Loaded once at startup. Secrets and AI
 * access come from the environment, never hardcoded (architecture.md "Infra").
 */
const bool = (v: string | undefined, dflt: boolean): boolean =>
  v === undefined ? dflt : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());

const num = (v: string | undefined, dflt: number): number => {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : dflt;
};

export interface AppConfig {
  port: number;
  nodeEnv: string;
  logLevel: string;
  widgetOrigin: string;
  ai: {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  groundingThreshold: number;
  persistence: 'memory' | 'sqlserver';
  dataDir: string;
  databaseUrl: string | undefined;
  ticket: {
    webhookUrl: string | undefined;
    webhookToken: string | undefined;
  };
  sessionSecret: string;
}

export const config: AppConfig = {
  port: num(process.env.PORT, 8787),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  widgetOrigin: process.env.WIDGET_ORIGIN ?? 'http://localhost:5173',
  ai: {
    enabled: bool(process.env.AI_ENABLED, true) && Boolean(process.env.OPENAI_API_KEY),
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },
  groundingThreshold: num(process.env.GROUNDING_THRESHOLD, 0.42),
  persistence: (process.env.PERSISTENCE as 'memory' | 'sqlserver') ?? 'memory',
  dataDir: process.env.DATA_DIR ?? './.data',
  databaseUrl: process.env.DATABASE_URL,
  ticket: {
    webhookUrl: process.env.TICKET_WEBHOOK_URL || undefined,
    webhookToken: process.env.TICKET_WEBHOOK_TOKEN || undefined,
  },
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-only-change-me',
};
