export interface TestRepo {
  path: string;
  cleanup: () => Promise<void>;
}

export interface CommitData {
  message: string;
  files?: Record<string, string>;
  author?: {
    name: string;
    email: string;
  };
}

export interface TestScenario {
  name: string;
  commits: CommitData[];
  originAt: number; // Index of commit where origin points
  currentBranch?: string;
}

export interface TestResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
  input?: string;
  timeout?: number;
}