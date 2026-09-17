// Runs the work at most `limit` items at a time and starts no new item once a result halts the
// run: a unit that stops or pauses the Curation leaves the rest for the next attempt.
export async function runConcurrently<Item, Result>(
  items: readonly Item[],
  limit: number,
  work: (item: Item) => Promise<Result>,
  halts: (result: Result) => boolean,
): Promise<Result[]> {
  const results: Result[] = [];
  let next = 0;
  let halted = false;

  const lane = async (): Promise<void> => {
    while (!halted && next < items.length) {
      const item = items[next] as Item;

      next += 1;

      const result = await work(item);

      results.push(result);
      halted ||= halts(result);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));

  return results;
}
