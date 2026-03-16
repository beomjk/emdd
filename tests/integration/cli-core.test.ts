import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI = './node_modules/.bin/tsx src/cli.ts';

function run(args: string, cwd?: string): string {
  return execSync(`${CLI} ${args}`, {
    encoding: 'utf-8',
    cwd: cwd ?? process.cwd(),
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

function runMayFail(args: string, cwd?: string): { stdout: string; exitCode: number } {
  try {
    const stdout = run(args, cwd);
    return { stdout, exitCode: 0 };
  } catch (e: any) {
    return { stdout: e.stdout ?? '', exitCode: e.status ?? 1 };
  }
}

describe('emdd init', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('graph/ 디렉토리와 7개 서브디렉토리를 생성한다', () => {
    run(`init ${tmpDir}`);
    expect(existsSync(join(tmpDir, 'graph'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'hypotheses'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'experiments'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'findings'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'knowledge'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'questions'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'decisions'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'episodes'))).toBe(true);
  });

  it('.emdd.yml 설정 파일을 생성한다', () => {
    run(`init ${tmpDir}`);
    expect(existsSync(join(tmpDir, '.emdd.yml'))).toBe(true);
  });

  it('--lang ko 옵션이 설정에 반영된다', () => {
    run(`init ${tmpDir} --lang ko`);
    const config = readFileSync(join(tmpDir, '.emdd.yml'), 'utf-8');
    expect(config).toContain('lang: ko');
  });

  it('이미 초기화된 프로젝트에서 경고를 출력한다', () => {
    run(`init ${tmpDir}`);
    const result = run(`init ${tmpDir}`);
    expect(result.toLowerCase()).toMatch(/already|exist/);
  });
});

describe('emdd new', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-test-'));
    run(`init ${tmpDir}`);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('hypothesis 노드 파일을 생성한다', () => {
    run(`new hypothesis test-hyp --path ${tmpDir}`);
    const files = readdirSync(join(tmpDir, 'graph', 'hypotheses'));
    expect(files.some(f => f.includes('hyp-001'))).toBe(true);
  });

  it('잘못된 타입이면 에러를 반환한다', () => {
    const { exitCode } = runMayFail(`new invalid-type test --path ${tmpDir}`);
    expect(exitCode).not.toBe(0);
  });

  it('연속 생성 시 ID가 증가한다', () => {
    run(`new hypothesis first --path ${tmpDir}`);
    run(`new hypothesis second --path ${tmpDir}`);
    const files = readdirSync(join(tmpDir, 'graph', 'hypotheses'));
    expect(files.some(f => f.includes('hyp-002'))).toBe(true);
  });

  it('생성 메시지를 출력한다', () => {
    const result = run(`new hypothesis test-hyp --path ${tmpDir}`);
    expect(result).toMatch(/hyp-001/);
  });
});

describe('emdd lint', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-test-'));
    run(`init ${tmpDir}`);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('정상 그래프에서 exit code 0을 반환한다', () => {
    run(`new hypothesis test --path ${tmpDir}`);
    const { exitCode } = runMayFail(`lint ${tmpDir}`);
    expect(exitCode).toBe(0);
  });

  it('정상 그래프에서 에러 없음 메시지를 출력한다', () => {
    run(`new hypothesis test --path ${tmpDir}`);
    const result = run(`lint ${tmpDir}`);
    expect(result.toLowerCase()).toMatch(/valid|clean|no error/);
  });
});

describe('emdd health', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-test-'));
    run(`init ${tmpDir}`);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('대시보드를 출력한다', () => {
    run(`new hypothesis test --path ${tmpDir}`);
    const result = run(`health ${tmpDir}`);
    expect(result.toLowerCase()).toContain('health');
  });

  it('노드 수를 표시한다', () => {
    run(`new hypothesis test1 --path ${tmpDir}`);
    run(`new experiment test2 --path ${tmpDir}`);
    const result = run(`health ${tmpDir}`);
    // Should show node counts
    expect(result).toMatch(/[12]/);
  });
});
