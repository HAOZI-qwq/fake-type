export type CompletionMode = 'native' | 'nativeFallback' | 'always';
export type CompletionTriggerPolicy = 'identifier' | 'code' | 'always';

export interface CompletionSettings {
    enabled: boolean;
    mode: CompletionMode;
    delayMs: number;
    triggerPolicy: CompletionTriggerPolicy;
    syncAcceptedCompletion: boolean;
    diagnostics: boolean;
}

export const DEFAULT_COMPLETION_SETTINGS: CompletionSettings = {
    enabled: true,
    mode: 'nativeFallback',
    delayMs: 80,
    triggerPolicy: 'code',
    syncAcceptedCompletion: true,
    diagnostics: false
};

const MODES = new Set<CompletionMode>(['native', 'nativeFallback', 'always']);
const POLICIES = new Set<CompletionTriggerPolicy>(['identifier', 'code', 'always']);

export function normalizeCompletionSettings(raw: Partial<CompletionSettings> | undefined): CompletionSettings {
    const source = raw ?? {};
    const mode = MODES.has(source.mode as CompletionMode)
        ? source.mode as CompletionMode
        : DEFAULT_COMPLETION_SETTINGS.mode;
    const triggerPolicy = POLICIES.has(source.triggerPolicy as CompletionTriggerPolicy)
        ? source.triggerPolicy as CompletionTriggerPolicy
        : DEFAULT_COMPLETION_SETTINGS.triggerPolicy;
    const delay = Number.isFinite(source.delayMs)
        ? Math.round(source.delayMs as number)
        : DEFAULT_COMPLETION_SETTINGS.delayMs;

    return {
        enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_COMPLETION_SETTINGS.enabled,
        mode,
        delayMs: Math.max(0, Math.min(500, delay)),
        triggerPolicy,
        syncAcceptedCompletion: typeof source.syncAcceptedCompletion === 'boolean'
            ? source.syncAcceptedCompletion
            : DEFAULT_COMPLETION_SETTINGS.syncAcceptedCompletion,
        diagnostics: typeof source.diagnostics === 'boolean'
            ? source.diagnostics
            : DEFAULT_COMPLETION_SETTINGS.diagnostics
    };
}

export function shouldForceSuggest(char: string, settings: CompletionSettings): boolean {
    if (!settings.enabled || settings.mode === 'native' || !char) {
        return false;
    }

    if (settings.triggerPolicy === 'always') {
        return true;
    }

    if (settings.triggerPolicy === 'identifier') {
        return /[\p{L}\p{N}_$]/u.test(char);
    }

    return /[\p{L}\p{N}_.$@?:>]/u.test(char);
}
