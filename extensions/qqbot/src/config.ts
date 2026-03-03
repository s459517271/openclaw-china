import { z } from "zod";

const optionalCoercedString = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    const next = String(value).trim();
    return next;
  },
  z.string().min(1).optional()
);

// ── Account-level Schema ──────────────────────────────────────────────────────

const QQBotAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  appId: optionalCoercedString,
  clientSecret: optionalCoercedString,
  asr: z
    .object({
      enabled: z.boolean().optional().default(false),
      appId: optionalCoercedString,
      secretId: optionalCoercedString,
      secretKey: optionalCoercedString,
    })
    .optional(),
  markdownSupport: z.boolean().optional().default(true),
  dmPolicy: z.enum(["open", "pairing", "allowlist"]).optional().default("open"),
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).optional().default("open"),
  requireMention: z.boolean().optional().default(true),
  allowFrom: z.array(z.string()).optional(),
  groupAllowFrom: z.array(z.string()).optional(),
  historyLimit: z.number().int().min(0).optional().default(10),
  textChunkLimit: z.number().int().positive().optional().default(1500),
  replyFinalOnly: z.boolean().optional().default(false),
  maxFileSizeMB: z.number().positive().optional().default(100),
  mediaTimeoutMs: z.number().int().positive().optional().default(30000),
});

// ── Top-level Schema (extends account with multi-account fields) ─────────────

export const QQBotConfigSchema = QQBotAccountSchema.extend({
  defaultAccount: z.string().optional(),
  accounts: z.record(QQBotAccountSchema).optional(),
});

export type QQBotConfig = z.infer<typeof QQBotConfigSchema>;
export type QQBotAccountConfig = z.infer<typeof QQBotAccountSchema>;

// ── PluginConfig interface ────────────────────────────────────────────────────

export interface PluginConfig {
  channels?: {
    qqbot?: QQBotConfig;
  };
}

// ── Multi-account helpers ─────────────────────────────────────────────────────

export const DEFAULT_ACCOUNT_ID = "default";

export function normalizeAccountId(raw?: string | null): string {
  const trimmed = String(raw ?? "").trim();
  return trimmed || DEFAULT_ACCOUNT_ID;
}

function listConfiguredAccountIds(cfg: PluginConfig): string[] {
  const accounts = cfg.channels?.qqbot?.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}

export function listQQBotAccountIds(cfg: PluginConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [DEFAULT_ACCOUNT_ID];
  return ids.sort((a, b) => a.localeCompare(b));
}

export function resolveDefaultQQBotAccountId(cfg: PluginConfig): string {
  const qqbotConfig = cfg.channels?.qqbot;
  if (qqbotConfig?.defaultAccount?.trim()) return qqbotConfig.defaultAccount.trim();
  const ids = listQQBotAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(cfg: PluginConfig, accountId: string): QQBotAccountConfig | undefined {
  const accounts = cfg.channels?.qqbot?.accounts;
  if (!accounts || typeof accounts !== "object") return undefined;
  return accounts[accountId] as QQBotAccountConfig | undefined;
}

export function mergeQQBotAccountConfig(cfg: PluginConfig, accountId: string): QQBotAccountConfig {
  const base = (cfg.channels?.qqbot ?? {}) as QQBotConfig;
  const { accounts: _ignored, defaultAccount: _ignored2, ...baseConfig } = base;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...baseConfig, ...account };
}

// ── Credential helpers ────────────────────────────────────────────────────────

export function isConfigured(config: QQBotAccountConfig | undefined): boolean {
  return Boolean(config?.appId && config?.clientSecret);
}

export function resolveQQBotCredentials(
  config: QQBotAccountConfig | undefined
): { appId: string; clientSecret: string } | undefined {
  if (!config?.appId || !config?.clientSecret) return undefined;
  return { appId: config.appId, clientSecret: config.clientSecret };
}

export function resolveQQBotASRCredentials(
  config: QQBotAccountConfig | undefined
): { appId: string; secretId: string; secretKey: string } | undefined {
  const asr = config?.asr;
  if (!asr?.enabled) return undefined;
  if (!asr.appId || !asr.secretId || !asr.secretKey) return undefined;
  return {
    appId: asr.appId,
    secretId: asr.secretId,
    secretKey: asr.secretKey,
  };
}
