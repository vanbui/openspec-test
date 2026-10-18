import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/** Emit closed outcomes only; titles, steps, errors and process output may contain credentials. */
export default class JourneyReporter implements Reporter {
  printsToStdio() { return true; }
  onTestEnd(_test: TestCase, result: TestResult) {
    const status = ['passed', 'failed', 'timedOut', 'skipped', 'interrupted'].includes(result.status) ? result.status : 'failed';
    process.stdout.write(`journey-browser:${status}\n`);
  }
  onError() { process.stderr.write('journey-browser:failed\n'); }
  onStdOut() { /* Private child output is discarded. */ }
  onStdErr() { /* Private child output is discarded. */ }
  onEnd(result: FullResult) {
    const status = ['passed', 'failed', 'timedout', 'interrupted'].includes(result.status) ? result.status : 'failed';
    process.stdout.write(`journey-browser-run:${status}\n`);
  }
}
