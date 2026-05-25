import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

function getDefaultTag() {
  const pkgPath = resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return `v${pkg.version}`;
}

const tagFromArg = process.argv[2];
const tagFromNpmArg = process.env.npm_config_tag;
const tag = tagFromArg || tagFromNpmArg || getDefaultTag();

if (!tag || !tag.trim()) {
  console.error('Tag name cannot be empty.');
  process.exit(1);
}

try {
  run('git rev-parse --is-inside-work-tree');
  run(`git tag ${tag}`);
  run(`git push origin ${tag}`);
  console.log(`Created and pushed release tag: ${tag}`);
} catch (error) {
  process.exit(1);
}
