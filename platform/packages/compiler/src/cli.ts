/**
 * CLI entry points (`diy-guide compile|validate|data`).
 *
 * Exit codes: 0 ok, 1 blocking validation/publication errors, 2 usage or read failure.
 * `--json` switches report output to JSON. No command writes outside the given directories.
 */
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileBundle } from './compile';
import { formatGuideError } from './errors';
import { loadAuthoredBundle } from './load';
import { buildDataTree, writeCompiled } from './release';
import { validateBundle, type ValidationReport } from './validate';

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

const USAGE = `Usage: diy-guide <command> [options]

Commands:
  compile --project <dir> [--out <dir>]     compile one authored bundle
  validate --project <dir>                  validate one authored bundle
  data --projects <dir> --out <dir> [--slug <slug>]
                                            build the static data tree (catalog + releases)

Options:
  --project <dir>   authored bundle directory (contains manifest.json)
  --projects <dir>  directory containing <slug>/<revision>/ bundles
  --out <dir>       output directory (compile: defaults to the bundle directory)
  --slug <slug>     limit the data command to one project slug
  --json            print machine-readable JSON
  --help            show this help
`;

interface ParsedFlags {
  project?: string;
  projects?: string;
  out?: string;
  slug?: string;
  json: boolean;
  help: boolean;
  unknown: string[];
}

function parseFlags(args: string[]): ParsedFlags {
  const flags: ParsedFlags = { json: false, help: false, unknown: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? '';
    switch (arg) {
      case '--project':
        flags.project = args[++i];
        break;
      case '--projects':
        flags.projects = args[++i];
        break;
      case '--out':
        flags.out = args[++i];
        break;
      case '--slug':
        flags.slug = args[++i];
        break;
      case '--json':
        flags.json = true;
        break;
      case '--help':
      case '-h':
        flags.help = true;
        break;
      default:
        flags.unknown.push(arg);
        break;
    }
  }
  return flags;
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

function printReport(report: ValidationReport, json: boolean, io: CliIo): void {
  if (json) {
    io.out(JSON.stringify(report, null, 2));
    return;
  }
  for (const error of report.errors) io.out(formatGuideError(error));
  for (const warning of report.warnings) io.out(formatGuideError(warning));
  io.out(`${report.blockingCount} blocking error(s), ${report.warningCount} warning(s)`);
}

export async function main(argv: string[], io: CliIo = { out: console.log, err: console.error }): Promise<number> {
  const [command, ...rest] = argv;
  const flags = parseFlags(rest);

  if (!command || flags.help) {
    io.err(USAGE);
    return flags.help ? 0 : 2;
  }
  if (flags.unknown.length > 0) {
    io.err(`Unknown option(s): ${flags.unknown.join(', ')}`);
    io.err(USAGE);
    return 2;
  }

  if (command === 'compile') {
    if (!flags.project) {
      io.err('compile requires --project <dir>');
      return 2;
    }
    const projectDir = resolve(flags.project);
    if (!isDirectory(projectDir)) {
      io.err(`Read failure: project directory not found: ${projectDir}`);
      return 2;
    }
    const load = loadAuthoredBundle(projectDir);
    const { compiled, report } = compileBundle({
      bundle: load.bundle,
      files: load.files,
      rawFiles: load.rawFiles,
      loadErrors: load.errors,
      bundleDir: projectDir,
    });
    if (!compiled) {
      printReport(report, flags.json, io);
      return 1;
    }
    const outDir = flags.out ? resolve(flags.out) : projectDir;
    const written = writeCompiled(outDir, compiled, report);
    if (flags.json) {
      io.out(JSON.stringify({ ok: true, report, written, contentHash: compiled.meta.contentHash, sourceSetHash: compiled.meta.sourceSetHash }, null, 2));
    } else {
      io.out(`compiled ${written.compiledPath}`);
      io.out(`report   ${written.reportPath}`);
      io.out(`id-map   ${written.idMapPath}`);
      io.out(`contentHash ${compiled.meta.contentHash}`);
      if (report.warningCount > 0) io.out(`${report.warningCount} warning(s)`);
    }
    return 0;
  }

  if (command === 'validate') {
    if (!flags.project) {
      io.err('validate requires --project <dir>');
      return 2;
    }
    const projectDir = resolve(flags.project);
    if (!isDirectory(projectDir)) {
      io.err(`Read failure: project directory not found: ${projectDir}`);
      return 2;
    }
    const load = loadAuthoredBundle(projectDir);
    const report = validateBundle({
      bundle: load.bundle,
      files: load.files,
      rawFiles: load.rawFiles,
      loadErrors: load.errors,
      bundleDir: projectDir,
    });
    printReport(report, flags.json, io);
    return report.ok ? 0 : 1;
  }

  if (command === 'data') {
    if (!flags.projects || !flags.out) {
      io.err('data requires --projects <dir> and --out <dir>');
      return 2;
    }
    const projectsDir = resolve(flags.projects);
    if (!isDirectory(projectsDir)) {
      io.err(`Read failure: projects directory not found: ${projectsDir}`);
      return 2;
    }
    try {
      const result = buildDataTree({ projectsDir, outDir: resolve(flags.out), slug: flags.slug ?? null });
      if (flags.json) {
        io.out(JSON.stringify(result, null, 2));
      } else {
        for (const release of result.releases) {
          if (!release.publishable) {
            io.out(`SKIPPED ${release.slug}@${release.revision}`);
            for (const error of release.errors) io.out(formatGuideError(error));
          } else {
            io.out(`published ${release.slug}@${release.revision} ${release.releaseId}`);
          }
        }
        io.out(`catalog ${result.catalogPath} (${result.entries.length} entr${result.entries.length === 1 ? 'y' : 'ies'})`);
      }
      return result.ok ? 0 : 1;
    } catch (cause) {
      io.err(`Read failure: ${cause instanceof Error ? cause.message : String(cause)}`);
      return 2;
    }
  }

  io.err(`Unknown command: ${command}`);
  io.err(USAGE);
  return 2;
}

const invokedPath = process.argv[1];
const isDirectRun = invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href;
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((cause: unknown) => {
      console.error(cause instanceof Error ? cause.message : String(cause));
      process.exitCode = 2;
    });
}
