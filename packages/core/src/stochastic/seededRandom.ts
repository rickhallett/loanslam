import { createHash } from "node:crypto";

const UINT64_MASK = (1n << 64n) - 1n;
const SPLITMIX_INCREMENT = 0x9e3779b97f4a7c15n;
const DOUBLE_DENOMINATOR = 2 ** 53;

export interface SeededRandom {
  next(): number;
  integer(maxExclusive: number): number;
  pick<T>(values: readonly T[]): T;
  shuffle<T>(values: readonly T[]): T[];
}

export function createSeededRandom(seed: string): SeededRandom {
  let state = hashSeedToState(seed);

  const next = (): number => {
    state = (state + SPLITMIX_INCREMENT) & UINT64_MASK;
    let value = state;
    value = ((value ^ (value >> 30n)) * 0xbf58476d1ce4e5b9n) & UINT64_MASK;
    value = ((value ^ (value >> 27n)) * 0x94d049bb133111ebn) & UINT64_MASK;
    value = value ^ (value >> 31n);

    return Number(value >> 11n) / DOUBLE_DENOMINATOR;
  };

  const integer = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error("maxExclusive must be greater than 0");
    }

    return Math.floor(next() * maxExclusive);
  };

  const pick = <T>(values: readonly T[]): T => {
    if (values.length === 0) {
      throw new Error("Cannot pick from an empty array");
    }

    const value = values[integer(values.length)];
    if (value === undefined) {
      throw new Error("Seeded pick selected an out-of-range value");
    }

    return value;
  };

  const shuffle = <T>(values: readonly T[]): T[] => {
    const shuffled = [...values];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = integer(index + 1);
      const current = shuffled[index];
      const swap = shuffled[swapIndex];

      if (current === undefined || swap === undefined) {
        throw new Error("Seeded shuffle selected an out-of-range value");
      }

      shuffled[index] = swap;
      shuffled[swapIndex] = current;
    }

    return shuffled;
  };

  return {
    next,
    integer,
    pick,
    shuffle,
  };
}

export function deriveScenarioSeed(
  runSeed: string,
  scenarioPath: string,
): string {
  return createHash("sha256")
    .update("loanslam-sts-scenario-seed")
    .update("\0")
    .update(runSeed)
    .update("\0")
    .update(scenarioPath)
    .digest("hex");
}

function hashSeedToState(seed: string): bigint {
  const digest = createHash("sha256")
    .update("loanslam-sts-run-seed")
    .update("\0")
    .update(seed)
    .digest();

  return digest.readBigUInt64BE(0);
}
