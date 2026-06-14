import { spawnSync } from 'node:child_process';
import pc from 'picocolors';

type Status = 'ok' | 'warn' | 'fail';
interface Check {
  name: string;
  status: Status;
  detail: string;
}

/** True when `bin --version` runs (i.e. the binary is on PATH). */
function hasBinary(bin: string): boolean {
  const result = spawnSync(bin, ['--version'], { stdio: 'ignore' });
  return !result.error;
}

/** Runs environment checks and prints a human-readable report. */
export function runDoctor(): void {
  const checks: Check[] = [];

  checks.push(
    hasBinary('jq')
      ? { name: 'jq', status: 'ok', detail: 'found' }
      : { name: 'jq', status: 'fail', detail: 'not found — the status line degrades to a minimal line' },
  );

  checks.push(
    hasBinary('git')
      ? { name: 'git', status: 'ok', detail: 'found' }
      : { name: 'git', status: 'warn', detail: 'not found — the git section will be hidden' },
  );

  const colorterm = process.env.COLORTERM ?? '';
  checks.push(
    /truecolor|24bit/.test(colorterm)
      ? { name: 'truecolor', status: 'ok', detail: `COLORTERM=${colorterm}` }
      : { name: 'truecolor', status: 'warn', detail: 'COLORTERM not truecolor — colors degrade to 256' },
  );

  checks.push({
    name: 'Nerd Font',
    status: 'warn',
    detail: 'cannot auto-detect — check the sample below',
  });

  console.log(pc.bold('space-statusline doctor') + '\n');
  for (const c of checks) {
    const icon = c.status === 'ok' ? pc.green('✓') : c.status === 'warn' ? pc.yellow('!') : pc.red('✗');
    console.log(`  ${icon} ${c.name.padEnd(11)} ${pc.dim(c.detail)}`);
  }

  console.log(
    `\n  Nerd Font sample:  \u{f07b}  \u{e0a0}  \u{f017}   ${pc.dim('(folder · branch · clock)')}`,
  );
  console.log(pc.dim('  If those show as boxes, run the wizard and pick the Unicode glyph set.'));
}
