export function shouldTriggerSuggestion(currentText: string, presetContent: string): boolean {
    if (currentText.length === 0
        || currentText.length >= presetContent.length
        || !presetContent.startsWith(currentText)) {
        return false;
    }

    const lastChar = currentText[currentText.length - 1];
    return /[\p{L}\p{N}_.$@]/u.test(lastChar);
}

export class SuggestionTriggerScheduler {
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        private readonly trigger: () => void | Promise<void>,
        private readonly delayMs: number = 60
    ) {}

    schedule(): void {
        if (this.timer) {
            return;
        }

        this.timer = setTimeout(() => {
            this.timer = undefined;
            void this.trigger();
        }, this.delayMs);
    }

    dispose(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }
}
