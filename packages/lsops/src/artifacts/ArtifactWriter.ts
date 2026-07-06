import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export class ArtifactWriter {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
    mkdirSync(this.root, { recursive: true });
  }

  path(...segments: string[]): string {
    return resolve(this.root, ...segments);
  }

  writeJson(name: string, value: unknown): string {
    return this.writeText(name, `${JSON.stringify(value, null, 2)}\n`);
  }

  writeText(name: string, value: string): string {
    const target = this.path(name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, value);
    return target;
  }

  writeBuffer(name: string, value: Buffer): string {
    const target = this.path(name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, value);
    return target;
  }
}
