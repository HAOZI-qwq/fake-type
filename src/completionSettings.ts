export type CompletionMode = 'native' | 'nativeFallback' | 'always';
export type CompletionTriggerPolicy = 'identifier' | 'code' | 'always';

export const COMPLETION_STORAGE_KEY = 'fakeType.completionSettings.v2';

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
    const delay = typeof source.delayMs === 'number' && Number.isFinite(source.delayMs)
        ? Math.round(source.delayMs)
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

export interface PresetCompletion {
    label: string;
    insertText: string;
    filterText: string;
    replacementLength: number;
    presetEndIndex: number;
    preselect: true;
    sortText: string;
    commitCharacters: string[];
}

function isPresetIdentifierCharacter(char: string): boolean {
    return /[\p{L}\p{N}_$-]/u.test(char);
}

function previousCodePointStart(text: string, index: number): number {
    let start = index - 1;
    const trailing = text.charCodeAt(start);
    if (start > 0 && trailing >= 0xDC00 && trailing <= 0xDFFF) {
        const leading = text.charCodeAt(start - 1);
        if (leading >= 0xD800 && leading <= 0xDBFF) {
            start--;
        }
    }
    return start;
}

export function getPresetCompletion(
    presetContent: string,
    currentIndex: number
): PresetCompletion | undefined {
    const index = Math.min(Math.max(0, currentIndex), presetContent.length);
    let start = index;
    let end = index;

    while (start > 0) {
        const previousStart = previousCodePointStart(presetContent, start);
        const previous = String.fromCodePoint(presetContent.codePointAt(previousStart) ?? 0);
        if (!isPresetIdentifierCharacter(previous)) {
            break;
        }
        start = previousStart;
    }

    while (end < presetContent.length) {
        const next = String.fromCodePoint(presetContent.codePointAt(end) ?? 0);
        if (!isPresetIdentifierCharacter(next)) {
            break;
        }
        end += next.length;
    }

    if (start === index || end === index) {
        return undefined;
    }

    const label = presetContent.slice(start, end);
    return {
        label,
        insertText: label,
        filterText: presetContent.slice(start, index),
        replacementLength: index - start,
        presetEndIndex: end,
        preselect: true,
        sortText: '\u0000fake-type',
        commitCharacters: []
    };
}

export function shouldHideSuggestWidgetBeforeTyping(text: string): boolean {
    const characters = Array.from(text);
    if (characters.length !== 1 || /^\s$/u.test(characters[0])) {
        return false;
    }

    return !/[\p{L}\p{N}_$]/u.test(characters[0]);
}

export function shouldProvidePresetCompletion(settings: CompletionSettings): boolean {
    return settings.enabled && settings.mode !== 'native';
}
