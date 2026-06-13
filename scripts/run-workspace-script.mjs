import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [, , scriptName, targetWorkspace] = process.argv;

if (!scriptName) {
  console.error('Usage: node scripts/run-workspace-script.mjs <script> [workspace]');
  process.exit(1);
}

const workspaceNames = ['contracts', 'backend', 'widget'];
const candidates = targetWorkspace ? [targetWorkspace] : workspaceNames;
const existingWorkspaces = candidates.filter((name) => existsSync(`${name}/package.json`));

if (existingWorkspaces.length === 0) {
  if (targetWorkspace) {
    console.error(`${targetWorkspace} workspace is not scaffolded yet.`);
    process.exit(1);
  }

  console.log(`No workspace packages scaffolded yet; skipping "${scriptName}".`);
  process.exit(0);
}

const args = targetWorkspace
  ? ['run', scriptName, '-w', targetWorkspace]
  : ['run', scriptName, '--workspaces'];

const result = spawnSync('npm', args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
