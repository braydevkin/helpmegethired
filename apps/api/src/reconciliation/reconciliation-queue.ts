export type ReconciliationRunHandler = () => Promise<void>;

// The repeatable job that runs the reconciliation: scheduled once however many workers run,
// consumed by one of them at a time.
export abstract class ReconciliationQueue {
  abstract schedule(everyMs: number): Promise<void>;
  abstract work(handler: ReconciliationRunHandler): Promise<void>;
}
