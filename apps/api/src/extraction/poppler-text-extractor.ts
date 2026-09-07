import { spawn } from "node:child_process";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { TimeoutError } from "../common/with-timeout";
import type { EnvironmentConfig } from "../config/environment.module";
import { ExtractorFailedError, ExtractorUnavailableError, corruptPdf, encryptedPdf } from "./extraction-errors";
import { TextExtractor, type ExtractedText } from "./text-extractor";

export interface PopplerSettings {
  command: readonly [executable: string, ...leadingArguments: string[]];
  timeoutMs: number;
}

export const POPPLER_SETTINGS = Symbol("POPPLER_SETTINGS");

export const popplerSettingsProvider = {
  provide: POPPLER_SETTINGS,
  useFactory: (config: EnvironmentConfig): PopplerSettings => ({
    command: ["pdftotext"],
    timeoutMs: config.get("EXTRACTION_TIMEOUT_MS", { infer: true }),
  }),
  inject: [ConfigService],
};

const LAYOUT_FROM_STDIN_TO_STDOUT = ["-layout", "-", "-"];
const VERSION_FLAG = ["-v"];
const VERSION_LINE = /pdftotext version (\S+)/;
const STDERR_LIMIT = 2_000;

// pdftotext exits with 1 when it cannot open the document (a broken structure or a wrong
// password, which it names on stderr) and with 3 when the document forbids copying its text.
const EXIT_CANNOT_OPEN = 1;
const EXIT_NO_PERMISSION = 3;
const INCORRECT_PASSWORD = /incorrect password/i;

interface Run {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: string;
  timedOut: boolean;
}

@Injectable()
export class PopplerTextExtractor extends TextExtractor {
  private version?: Promise<string>;

  constructor(@Inject(POPPLER_SETTINGS) private readonly settings: PopplerSettings) {
    super();
  }

  get executable(): string {
    return this.settings.command[0];
  }

  // Rejects with ExtractorUnavailableError when the executable cannot be started.
  versionInstalled(): Promise<string> {
    this.version ??= this.probeVersion().catch((error: unknown) => {
      this.version = undefined;

      throw error;
    });

    return this.version;
  }

  async extract(bytes: Buffer): Promise<ExtractedText> {
    const version = await this.versionInstalled();
    const run = await this.run(LAYOUT_FROM_STDIN_TO_STDOUT, bytes);

    return { text: this.textOf(run), extractorVersion: `pdftotext/${version}` };
  }

  private async probeVersion(): Promise<string> {
    const { stdout, stderr } = await this.run(VERSION_FLAG);

    return VERSION_LINE.exec(`${stderr}\n${stdout.toString()}`)?.[1] ?? "unknown";
  }

  private textOf(run: Run): string {
    if (run.timedOut) {
      throw new TimeoutError(`${this.executable} on the document`, this.settings.timeoutMs);
    }

    if (run.code === 0) {
      return run.stdout.toString("utf8");
    }

    const detail = run.stderr.trim();

    if (run.code === EXIT_NO_PERMISSION || (run.code === EXIT_CANNOT_OPEN && INCORRECT_PASSWORD.test(detail))) {
      throw encryptedPdf();
    }

    if (run.code === EXIT_CANNOT_OPEN) {
      throw corruptPdf(detail || `${this.executable} could not open it`);
    }

    throw new ExtractorFailedError(
      this.executable,
      run.signal ? `was stopped by ${run.signal}` : `exited with ${run.code}`,
      detail,
    );
  }

  private run(args: readonly string[], input?: Buffer): Promise<Run> {
    const [executable, ...leading] = this.settings.command;

    return new Promise((resolve, reject) => {
      const child = spawn(executable, [...leading, ...args], { stdio: ["pipe", "pipe", "pipe"] });
      const stdout: Buffer[] = [];
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, this.settings.timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = `${stderr}${chunk.toString()}`.slice(0, STDERR_LIMIT);
      });
      // A process that exits before reading its input closes the pipe; the exit code says why.
      child.stdin.on("error", () => undefined);
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(new ExtractorUnavailableError(executable, error));
      });
      child.on("close", (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal, stdout: Buffer.concat(stdout), stderr, timedOut });
      });

      child.stdin.end(input);
    });
  }
}
