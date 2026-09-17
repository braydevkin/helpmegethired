import { describe, expect, it } from "vitest";

import { runConcurrently } from "./run-concurrently";

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("runConcurrently", () => {
  it("runs at most three items at once and runs them all", async () => {
    let inFlight = 0;
    let most = 0;

    const results = await runConcurrently(
      [1, 2, 3, 4, 5, 6, 7],
      3,
      async (item) => {
        inFlight += 1;
        most = Math.max(most, inFlight);
        await tick();
        inFlight -= 1;

        return item * 10;
      },
      () => false,
    );

    expect(most).toBe(3);
    expect([...results].sort((left, right) => left - right)).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });

  it("runs one at a time in order when the limit is one", async () => {
    const seen: number[] = [];

    await runConcurrently([1, 2, 3], 1, async (item) => void seen.push(item), () => false);

    expect(seen).toEqual([1, 2, 3]);
  });

  it("starts nothing new once a result halts the run", async () => {
    const started: number[] = [];

    const results = await runConcurrently(
      [1, 2, 3, 4, 5],
      1,
      async (item) => {
        started.push(item);

        return item === 2 ? "halt" : "done";
      },
      (result) => result === "halt",
    );

    expect(started).toEqual([1, 2]);
    expect(results).toEqual(["done", "halt"]);
  });

  it("answers nothing for no items", async () => {
    expect(await runConcurrently([], 3, async () => 1, () => false)).toEqual([]);
  });
});
