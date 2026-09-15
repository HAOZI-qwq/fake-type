export interface PresetProgress {
    content: string;
    index: number;
}

export interface ReservedInput<TTarget> {
    target: TTarget;
    text: string;
    presetStartIndex?: number;
    presetEndIndex?: number;
}

type ReservedInputWriter<TTarget> = (item: ReservedInput<TTarget>) => Promise<boolean>;
type TargetIdleHandler<TTarget> = (target: TTarget, hadFailure: boolean) => void;

/**
 * Reserves preset input synchronously, then serializes the actual editor writes.
 * The synchronous reservation is what prevents rapid key events from observing
 * the same preset index while an earlier default:type command is still pending.
 */
export class PresetInputCoordinator<TTarget> {
    private readonly queue: ReservedInput<TTarget>[] = [];
    private readonly pendingByTarget = new Map<TTarget, number>();
    private readonly failedTargets = new Set<TTarget>();
    private readonly idleWaiters: Array<() => void> = [];
    private activeItem: ReservedInput<TTarget> | undefined;
    private processing = false;

    constructor(
        private readonly writer: ReservedInputWriter<TTarget>,
        private readonly onTargetIdle?: TargetIdleHandler<TTarget>
    ) {}

    reserve(target: TTarget, progress: PresetProgress): boolean {
        if (progress.index >= progress.content.length) {
            return false;
        }

        const codePoint = progress.content.codePointAt(progress.index);
        if (codePoint === undefined) {
            return false;
        }

        const text = String.fromCodePoint(codePoint);
        const presetStartIndex = progress.index;
        progress.index += text.length;
        this.enqueueItem({
            target,
            text,
            presetStartIndex,
            presetEndIndex: progress.index
        });
        return true;
    }

    enqueue(target: TTarget, text: string): void {
        this.enqueueItem({ target, text });
    }

    private enqueueItem(item: ReservedInput<TTarget>): void {
        this.queue.push(item);
        const target = item.target;
        this.pendingByTarget.set(target, (this.pendingByTarget.get(target) ?? 0) + 1);
        void this.drain();
    }

    hasPending(target: TTarget): boolean {
        return (this.pendingByTarget.get(target) ?? 0) > 0;
    }

    getActiveReservation(target: TTarget): ReservedInput<TTarget> | undefined {
        return this.activeItem?.target === target ? { ...this.activeItem } : undefined;
    }

    cancelQueuedReservations(target: TTarget, progress: PresetProgress): number {
        if (this.activeItem?.target !== target) {
            return 0;
        }

        let earliestCancelledIndex: number | undefined;
        let cancelledCount = 0;
        const retainedItems: ReservedInput<TTarget>[] = [];

        for (const item of this.queue) {
            if (item.target === target && item.presetStartIndex !== undefined) {
                earliestCancelledIndex = Math.min(
                    earliestCancelledIndex ?? item.presetStartIndex,
                    item.presetStartIndex
                );
                cancelledCount++;
            } else {
                retainedItems.push(item);
            }
        }

        if (cancelledCount === 0 || earliestCancelledIndex === undefined) {
            return 0;
        }

        this.queue.splice(0, this.queue.length, ...retainedItems);
        progress.index = Math.min(progress.index, earliestCancelledIndex);
        const remaining = (this.pendingByTarget.get(target) ?? cancelledCount) - cancelledCount;
        this.pendingByTarget.set(target, remaining);
        return cancelledCount;
    }

    whenIdle(): Promise<void> {
        if (!this.processing && this.queue.length === 0) {
            return Promise.resolve();
        }

        return new Promise(resolve => this.idleWaiters.push(resolve));
    }

    private async drain(): Promise<void> {
        if (this.processing) {
            return;
        }

        this.processing = true;
        try {
            while (this.queue.length > 0) {
                const item = this.queue.shift()!;
                this.activeItem = item;
                let succeeded = false;
                try {
                    succeeded = await this.writer(item);
                } catch {
                    succeeded = false;
                } finally {
                    this.activeItem = undefined;
                }

                if (!succeeded) {
                    this.failedTargets.add(item.target);
                }
                this.settle(item.target);
            }
        } finally {
            this.processing = false;
            if (this.queue.length > 0) {
                void this.drain();
                return;
            }

            for (const resolve of this.idleWaiters.splice(0)) {
                resolve();
            }
        }
    }

    private settle(target: TTarget): void {
        const remaining = (this.pendingByTarget.get(target) ?? 1) - 1;
        if (remaining > 0) {
            this.pendingByTarget.set(target, remaining);
            return;
        }

        this.pendingByTarget.delete(target);
        const hadFailure = this.failedTargets.delete(target);
        this.onTargetIdle?.(target, hadFailure);
    }
}
