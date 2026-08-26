import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DATA_ROOT = fileURLToPath(new URL("../data/", import.meta.url));
const PROHIBITED_LEGAL_COPY = [
  /Monthly Advance Loans/i,
  /912359/,
  /ZA55367/i,
  /12070468/,
  /Bourne Park/i,
  /Exeter Park Road/i,
  /authorised and regulated by the FCA/i,
  /consumer credit lender not a broker/i,
  /Company Reg no 133047C/i,
  /Data Protection Act R002085/i,
  /Office of Fair Trading under the Moneylenders Act/i,
];

function jsonFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return jsonFiles(path);
    return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
  });
}

describe("legal identity copy policy", () => {
  it("keeps original lender legal identifiers out of Nuxt data", () => {
    for (const path of jsonFiles(DATA_ROOT)) {
      const contents = readFileSync(path, "utf8");
      for (const prohibited of PROHIBITED_LEGAL_COPY) {
        expect(
          contents,
          `${relative(DATA_ROOT, path)} contains ${prohibited}`,
        ).not.toMatch(prohibited);
      }
    }
  });
});
