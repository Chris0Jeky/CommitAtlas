/**
 * Test-only v2 repository storage. Nothing in the v1 writer imports this module.
 * This stores evidence; the future publication engine must prove ownership and destination
 * state before requesting later phases. A journal digest is not itself ownership proof.
 */
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  assertPhaseAdvance,
  validatePublicationStatus,
  type PublicationFileVersion,
  type PublicationJournal,
  type PublicationPhase,
  type PublicationStatus,
} from "./publication-protocol.js";
import {
  decodePublicationJournal, decodePublicationStatus, encodePublicationJournal,
  encodePublicationStatus, MAX_PUBLICATION_JOURNAL_BYTES, MAX_PUBLICATION_STATUS_BYTES,
} from "./publication-codec.js";

/** Unresolved design decisions are explicit and cannot enable production v2 publication. */
export const PUBLICATION_CONTROL_POLICY = Object.freeze({
  ownership: "destination-mutation-disabled-pending-ownership-migration",
  statusExposure: "control-root-only",
  staleLock: "explicit-recovery-only-no-automatic-reclamation",
  directoryFlush: "require" as const,
});

export type ControlCheckpoint = "before-journal-publication" | "after-journal-publication" |
  "after-staged-payload" | "after-backup" | "before-committed-status" |
  "after-committed-status" | "during-staged-cleanup" | "during-backup-cleanup";

/** Every I/O primitive is replaceable, including handle writes/flushes for crash injection. */
export interface PublicationStorage {
  lstat: typeof fs.lstat;
  realpath: typeof fs.realpath;
  mkdir: typeof fs.mkdir;
  readdir: typeof fs.readdir;
  open(file: string, flags: number, mode?: number): Promise<Pick<FileHandle,
    "stat" | "readFile" | "writeFile" | "sync" | "close">>;
  rename: typeof fs.rename;
  unlink: typeof fs.unlink;
  flushDirectory(directory: string): Promise<"supported" | "unsupported">;
  checkpoint?(name: ControlCheckpoint): Promise<void>;
}

export const nodePublicationStorage: PublicationStorage = {
  lstat: fs.lstat, realpath: fs.realpath, mkdir: fs.mkdir, readdir: fs.readdir,
  open: fs.open, rename: fs.rename, unlink: fs.unlink,
  async flushDirectory(directory) {
    let handle: FileHandle | undefined;
    try {
      handle = await fs.open(directory, constants.O_RDONLY);
      await handle.sync();
      return "supported";
    } catch (error) {
      const code = errorCode(error);
      if (["ENOTSUP", "EOPNOTSUPP", "EINVAL", "ENOSYS"].includes(code) ||
        (process.platform === "win32" && ["EPERM", "EACCES", "EISDIR", "EBADF"].includes(code))) {
        return "unsupported";
      }
      throw error;
    } finally { await handle?.close(); }
  },
};

export interface PublicationLock {
  readonly version: 1;
  readonly pid: number;
  readonly startedAt: string;
  readonly hostname: string;
  readonly transactionId: string;
}

export interface ControlStoreOptions {
  readonly storage?: PublicationStorage;
  /** Explicit weaker durability for tests/opt-in qualification; default fails closed. */
  readonly directoryFlush?: "require" | "report-unsupported";
  readonly sharingRetryMs?: number;
}

const CONTROL = ".commitatlas";
const TRANSACTIONS = `${CONTROL}/transactions`;
const LOCK = `${CONTROL}/publication.lock`;
const LOCK_LIMIT = 1024;
const encoder = new TextEncoder();
type FileIdentity = { dev: number; ino: number };
type OwnedFile = FileIdentity & { bytes: Uint8Array };

/** Opening creates only the control root, never an output directory or publication. */
export async function openPublicationControlStore(root: string, options: ControlStoreOptions = {}) {
  if (!path.isAbsolute(root)) throw new Error("publication repository root must be absolute");
  if (options.directoryFlush !== undefined && !["require", "report-unsupported"].includes(options.directoryFlush)) {
    throw new Error("invalid directory flush policy");
  }
  const retry = options.sharingRetryMs ?? 100;
  if (!Number.isSafeInteger(retry) || retry < 0 || retry > 1000) throw new Error("invalid sharing retry deadline");
  const store = new PublicationControlStore(path.resolve(root), options, retry);
  await store.initialize();
  return store;
}

class PublicationControlStore {
  private readonly io: PublicationStorage;
  private heldLock?: OwnedFile;
  private lockAcquired = false;
  private readonly statusTemps = new Map<string, OwnedFile>();
  private readonly ancestors = new Map<string, FileIdentity>();
  private containmentFailed = false;
  private directoryCapability: "supported" | "unsupported" = "supported";

  constructor(private readonly root: string, private readonly options: ControlStoreOptions,
    private readonly sharingRetryMs: number) {
    this.io = options.storage ?? nodePublicationStorage;
  }

  get capabilities() {
    return Object.freeze({ fileFlush: "required" as const, directoryFlush: this.directoryCapability,
      directoryFlushPolicy: this.options.directoryFlush ?? PUBLICATION_CONTROL_POLICY.directoryFlush });
  }

  async initialize(): Promise<void> {
    await this.checked("", "directory");
    // Probe before creating control data when strict durability is unavailable.
    await this.flush("");
    await this.directory(CONTROL, false);
    await this.directory(TRANSACTIONS, false);
  }

  /** Existing locks, including provably dead/remote/malformed locks, are never age-deleted. */
  async acquireLock(recoverTransactionId?: string): Promise<PublicationLock> {
    if (this.heldLock) throw new Error("publication lock is already held by this store");
    if (recoverTransactionId !== undefined) await this.readStatus(recoverTransactionId);
    const owner: PublicationLock = { version: 1, pid: process.pid,
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      hostname: hostname(), transactionId: recoverTransactionId ?? randomUUID() };
    const bytes = encoder.encode(`${JSON.stringify(owner)}\n`);
    await this.create(LOCK, bytes, identity => { this.heldLock = { ...identity, bytes }; });
    this.lockAcquired = true;
    return owner;
  }

  async inspectLock(): Promise<PublicationLock> {
    const bytes = await this.read(LOCK, LOCK_LIMIT);
    let record: PublicationLock;
    try { record = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new Error("publication lock is malformed; explicit recovery required"); }
    if (!record || Object.keys(record).sort().join() !== "hostname,pid,startedAt,transactionId,version" ||
      record.version !== 1 || !Number.isSafeInteger(record.pid) || record.pid <= 0 ||
      typeof record.hostname !== "string" || !record.hostname || record.hostname.length > 255 ||
      hasControlCharacters(record.hostname) || typeof record.startedAt !== "string" ||
      !Number.isFinite(Date.parse(record.startedAt)) || new Date(record.startedAt).toISOString() !== record.startedAt) {
      throw new Error("publication lock is malformed; explicit recovery required");
    }
    this.transactionPath(record.transactionId);
    return record;
  }

  async releaseLock(): Promise<void> {
    if (!this.heldLock) throw new Error("publication mutation requires the exclusive lock");
    await this.removeOwned(LOCK, this.heldLock, !this.lockAcquired);
    this.heldLock = undefined;
    this.lockAcquired = false;
    await this.flush(CONTROL);
  }

  /** An interrupted or corrupt transaction blocks the next generation, regardless of age. */
  async createTransaction(value: PublicationJournal): Promise<void> {
    const bytes = encodePublicationJournal(value);
    const journal = decodePublicationJournal(bytes);
    await this.assertLock(journal.transactionId);
    await this.checked(TRANSACTIONS, "directory");
    for (const id of await this.io.readdir(this.absolute(TRANSACTIONS))) {
      const status = await this.readStatus(id);
      if (status.phase !== "complete") throw new Error(`publication transaction ${id} requires recovery`);
      await this.assertRecoveryBytesAbsent(await this.readJournal(id));
    }
    const base = this.transactionPath(journal.transactionId);
    for (const target of journal.targets) {
      this.assertOutputPath(target.outputDir);
      await this.checked(target.outputDir, "directory", true);
      for (const operation of target.operations) {
        safeRelative(operation.name);
        const destination = `${target.outputDir}/${operation.name}`;
        const exists = await this.checked(destination, "file", true);
        if (operation.previous) {
          if (!exists) throw new Error("publication previous destination is missing");
          verify(await this.read(destination, operation.previous.bytes), operation.previous);
        } else if (exists) throw new Error("publication create destination already exists");
      }
    }
    await this.directory(base, true);
    await this.directory(`${base}/targets`, true);
    for (let index = 0; index < journal.targets.length; index++) {
      const target = `${base}/targets/${String(index).padStart(3, "0")}`;
      await this.directory(target, true);
      await this.directory(`${target}/staged`, true);
      await this.directory(`${target}/backup`, true);
    }
    await this.create(`${base}/status.json`, encodePublicationStatus({ version: 1,
      generator: "CommitAtlas", transactionId: journal.transactionId, phase: "preparing" }));
    await this.io.checkpoint?.("before-journal-publication");
    await this.create(`${base}/journal.json`, bytes);
    await this.io.checkpoint?.("after-journal-publication");
  }

  async readJournal(id: string): Promise<PublicationJournal> {
    const journal = decodePublicationJournal(await this.read(`${this.transactionPath(id)}/journal.json`, MAX_PUBLICATION_JOURNAL_BYTES));
    if (journal.transactionId !== id) throw new Error("publication journal transactionId does not match directory");
    for (const target of journal.targets) {
      this.assertOutputPath(target.outputDir);
      await this.checked(target.outputDir, "directory", true);
    }
    return journal;
  }

  async readStatus(id: string): Promise<PublicationStatus> {
    const status = decodePublicationStatus(await this.read(`${this.transactionPath(id)}/status.json`, MAX_PUBLICATION_STATUS_BYTES));
    if (status.transactionId !== id) throw new Error("publication status transactionId does not match directory");
    return status;
  }

  /** Only journal-derived names and versions are accepted; caller paths are never used. */
  async writeArtifact(id: string, target: number, name: string, kind: "staged" | "backup", bytes: Uint8Array): Promise<void> {
    await this.assertLock(id);
    const status = await this.readStatus(id);
    if (status.phase !== (kind === "staged" ? "preparing" : "prepared")) {
      throw new Error("publication artifact write is outside its preparation phase");
    }
    const { file, version } = await this.artifact(id, target, name, kind);
    verify(bytes, version);
    await this.create(file, bytes);
    verify(await this.read(file, version.bytes), version);
    await this.io.checkpoint?.(kind === "staged" ? "after-staged-payload" : "after-backup");
  }

  async readArtifact(id: string, target: number, name: string, kind: "staged" | "backup"): Promise<Uint8Array> {
    return this.verifiedArtifact(id, target, name, kind, false);
  }

  private async verifiedArtifact(id: string, target: number, name: string, kind: "staged" | "backup", durable: boolean): Promise<Uint8Array> {
    const { file, version } = await this.artifact(id, target, name, kind);
    const bytes = await this.read(file, version.bytes, durable);
    verify(bytes, version);
    return bytes;
  }

  /** Storage primitive only: destination/ownership evidence remains the future engine's gate. */
  async advanceStatus(id: string, phase: PublicationPhase): Promise<void> {
    await this.assertLock(id);
    const previous = await this.readStatus(id);
    assertPhaseAdvance(previous.phase, phase);
    const journal = await this.readJournal(id);
    if (phase === "prepared" || phase === "backed-up") {
      // A previous write may have failed at fsync/parent flush while leaving readable bytes.
      // Re-establish durability; a matching digest alone cannot prove a completed flush.
      await this.read(`${this.transactionPath(id)}/journal.json`, MAX_PUBLICATION_JOURNAL_BYTES, true);
      for (const [index, target] of journal.targets.entries()) {
        for (const operation of target.operations) {
          if (operation.next) await this.verifiedArtifact(id, index, operation.name, "staged", true);
          if (phase === "backed-up" && operation.previous) await this.verifiedArtifact(id, index, operation.name, "backup", true);
        }
      }
    }
    if (phase === "complete") {
      await this.assertRecoveryBytesAbsent(journal);
    }
    if (phase === "committed") await this.io.checkpoint?.("before-committed-status");
    const base = this.transactionPath(id);
    const temporary = `${base}/status-${randomUUID()}.tmp`;
    const statusBytes = encodePublicationStatus({ ...previous, phase });
    // Retry retained owned temps before allocating another one, bounding ordinary failure debris.
    await this.cleanupStatusTemps(id);
    try {
      await this.create(temporary, statusBytes, identity => {
        this.statusTemps.set(temporary, { ...identity, bytes: statusBytes });
      });
      const deadline = Date.now() + this.sharingRetryMs;
      for (;;) {
        await this.assertLock(id);
        await this.assertOwned(temporary, this.statusTemps.get(temporary)!, false);
        await this.checked(`${base}/status.json`, "file");
        try {
          await this.mutate([base], () => this.io.rename(this.absolute(temporary), this.absolute(`${base}/status.json`)));
          this.statusTemps.delete(temporary);
          break;
        } catch (error) {
          if (this.containmentFailed || process.platform !== "win32" || !["EACCES", "EPERM", "EBUSY"].includes(errorCode(error)) || Date.now() >= deadline) throw error;
          await delay(Math.min(10, Math.max(0, deadline - Date.now())));
        }
      }
    } finally {
      // No pathname cleanup follows detected containment drift. Operator recovery is required.
      if (!this.containmentFailed) await this.cleanupStatusTemps(id);
    }
    await this.flush(base);
    if (phase === "committed") await this.io.checkpoint?.("after-committed-status");
  }

  /** No recursive removal; drifted control files are retained for explicit recovery. */
  async removeArtifact(id: string, target: number, name: string, kind: "staged" | "backup"): Promise<void> {
    await this.assertLock(id);
    const status = await this.readStatus(id);
    if (status.phase !== "cleaning") throw new Error("publication cleanup requires cleaning status");
    const { file } = await this.artifact(id, target, name, kind);
    // Missing files make interrupted cleanup safely retryable.
    if (!await this.checked(file, "file", true)) {
      await this.flush(path.posix.dirname(file));
      return;
    }
    await this.readArtifact(id, target, name, kind);
    await this.checked(file, "file");
    await this.mutate([path.posix.dirname(file)], () => this.io.unlink(this.absolute(file)));
    await this.flush(path.posix.dirname(file));
    await this.io.checkpoint?.(kind === "staged" ? "during-staged-cleanup" : "during-backup-cleanup");
  }

  private async artifact(id: string, target: number, name: string, kind: "staged" | "backup") {
    if (kind !== "staged" && kind !== "backup") throw new Error("invalid publication storage kind");
    const journal = await this.readJournal(id);
    if (!Number.isSafeInteger(target) || target < 0) throw new Error("invalid publication target");
    const operation = journal.targets[target]?.operations.find(operation => operation.name === name);
    const version = kind === "staged" ? operation?.next : operation?.previous;
    if (!version) throw new Error("publication artifact is not recorded in journal");
    safeRelative(name);
    return { file: `${this.transactionPath(id)}/targets/${String(target).padStart(3, "0")}/${kind}/${name}`, version };
  }

  private async assertRecoveryBytesAbsent(journal: PublicationJournal): Promise<void> {
    await this.cleanupStatusTemps(journal.transactionId);
    for (const [index] of journal.targets.entries()) {
      for (const kind of ["staged", "backup"] as const) {
        const directory = `${this.transactionPath(journal.transactionId)}/targets/${String(index).padStart(3, "0")}/${kind}`;
        await this.checked(directory, "directory");
        if ((await this.io.readdir(this.absolute(directory))).length) throw new Error("publication transaction still contains recovery bytes");
        await this.flush(directory);
      }
    }
  }

  private assertOutputPath(output: string): void {
    safeRelative(output);
    const lower = output.toLowerCase();
    if (lower === CONTROL || lower.startsWith(`${CONTROL}/`) || CONTROL.startsWith(`${lower}/`)) {
      throw new Error("publication output overlaps the control root");
    }
  }

  private transactionPath(id: string): string {
    validatePublicationStatus({ version: 1, generator: "CommitAtlas", transactionId: id, phase: "preparing" });
    safeRelative(id);
    return `${TRANSACTIONS}/${id}`;
  }

  private async assertLock(id?: string): Promise<void> {
    this.assertContainment();
    if (!this.heldLock || !this.lockAcquired) throw new Error("publication mutation requires the exclusive lock after successful acquisition");
    await this.assertOwned(LOCK, this.heldLock, false);
    if (id && (await this.inspectLock()).transactionId !== id) throw new Error("publication lock transactionId mismatch");
  }

  private absolute(relative: string): string {
    if (relative) safeRelative(relative);
    return path.join(this.root, ...relative.split("/"));
  }

  /** Walk without following symlinks/junctions, and reject special/hard-linked files. */
  private async checked(relative: string, kind: "file" | "directory", missing = false): Promise<boolean> {
    const segments = relative ? (safeRelative(relative), relative.split("/")) : [];
    for (let index = 0; index <= segments.length; index++) {
      const current = path.join(this.root, ...segments.slice(0, index));
      let stat;
      try { stat = await this.io.lstat(current); }
      catch (error) {
        if (this.ancestors.has(pathKey(current))) this.containmentFailed = true;
        if (missing && errorCode(error) === "ENOENT") return false;
        throw error;
      }
      const expected = index === segments.length ? kind : "directory";
      if (stat.isSymbolicLink() || (expected === "directory" ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1)) {
        if (expected === "directory") this.containmentFailed = true;
        throw new Error("publication path has an unsafe entry kind");
      }
      const resolved = await this.io.realpath(current);
      if (pathKey(resolved) !== pathKey(current)) {
        this.containmentFailed = true;
        throw new Error("publication path resolves outside its lexical location");
      }
      if (expected === "directory") {
        const previous = this.ancestors.get(pathKey(current));
        if (previous && (stat.dev !== previous.dev || stat.ino !== previous.ino)) {
          this.containmentFailed = true;
          throw new Error("publication ancestor identity changed; containment recovery required");
        }
        this.ancestors.set(pathKey(current), { dev: stat.dev, ino: stat.ino });
      }
    }
    return true;
  }

  private async directory(relative: string, exclusive: boolean): Promise<void> {
    await this.checked(path.posix.dirname(relative) === "." ? "" : path.posix.dirname(relative), "directory");
    const exists = await this.checked(relative, "directory", true);
    if (exists && !exclusive) return;
    await this.mutate([path.posix.dirname(relative) === "." ? "" : path.posix.dirname(relative)],
      () => this.io.mkdir(this.absolute(relative), { mode: 0o700 }));
    await this.flush(path.posix.dirname(relative) === "." ? "" : path.posix.dirname(relative));
  }

  private async create(relative: string, bytes: Uint8Array, created?: (identity: FileIdentity) => void): Promise<void> {
    const parent = path.posix.dirname(relative);
    await this.checked(parent, "directory");
    await this.checked(relative, "file", true);
    await this.checkMutationAncestors([parent]);
    let handle;
    try {
      handle = await this.io.open(this.absolute(relative), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
    } catch (error) {
      await this.checkMutationAncestors([parent]);
      throw error;
    }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1) throw new Error("publication control entry is not a regular file");
      created?.({ dev: stat.dev, ino: stat.ino });
      // Opening can already create an empty file outside a swapped ancestor. Do not write
      // payload bytes or attempt pathname deletion there. Node has no openat-style primitive.
      await this.checkMutationAncestors([parent]);
      await this.mutate([parent], () => handle.writeFile(bytes));
      await this.mutate([parent], () => handle.sync());
    } finally {
      try { await handle.close(); }
      finally { await this.checkMutationAncestors([parent]); }
    }
    await this.flush(parent);
  }

  private async read(relative: string, limit: number, durable = false): Promise<Uint8Array> {
    await this.checked(relative, "file");
    const before = await this.io.lstat(this.absolute(relative));
    const handle = await this.io.open(this.absolute(relative), (durable ? constants.O_RDWR : constants.O_RDONLY) | (constants.O_NOFOLLOW ?? 0));
    let bytes: Uint8Array;
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.dev !== before.dev || stat.ino !== before.ino) {
        throw new Error("publication control entry changed while opening");
      }
      if (stat.size > limit) throw new Error("publication control file exceeds byte limit");
      bytes = await handle.readFile();
      if (bytes.byteLength > limit) throw new Error("publication control file exceeds byte limit");
      if (durable) await this.mutate([path.posix.dirname(relative)], () => handle.sync());
    } finally { await handle.close(); }
    if (durable) await this.flush(path.posix.dirname(relative));
    return bytes;
  }

  private async flush(relative: string): Promise<void> {
    if (await this.mutate([relative], () => this.io.flushDirectory(this.absolute(relative))) === "unsupported") {
      this.directoryCapability = "unsupported";
      if ((this.options.directoryFlush ?? PUBLICATION_CONTROL_POLICY.directoryFlush) === "require") {
        throw new Error("publication directory flush is unsupported; strict durability required");
      }
    }
  }

  private assertContainment(): void {
    if (this.containmentFailed) throw new Error("publication containment failed; explicit recovery required");
  }

  private async checkMutationAncestors(directories: string[]): Promise<void> {
    this.assertContainment();
    try { for (const directory of directories) await this.checked(directory, "directory"); }
    catch (error) { this.containmentFailed = true; throw error; }
    this.assertContainment();
  }

  /** Detection only: path-based primitives cannot prevent a swap within the syscall window. */
  private async mutate<T>(directories: string[], operation: () => Promise<T>): Promise<T> {
    await this.checkMutationAncestors(directories);
    try { return await operation(); }
    finally { await this.checkMutationAncestors(directories); }
  }

  private async assertOwned(file: string, owner: OwnedFile, partial: boolean): Promise<void> {
    const bytes = await this.read(file, Math.max(LOCK_LIMIT, owner.bytes.byteLength));
    const stat = await this.io.lstat(this.absolute(file));
    const expected = partial ? owner.bytes.subarray(0, bytes.byteLength) : owner.bytes;
    if (stat.dev !== owner.dev || stat.ino !== owner.ino ||
      !Buffer.from(bytes).equals(Buffer.from(expected))) throw new Error("publication lock or temporary file owner changed");
  }

  private async removeOwned(file: string, owner: OwnedFile, partial: boolean): Promise<void> {
    await this.assertOwned(file, owner, partial);
    await this.checked(file, "file");
    await this.mutate([path.posix.dirname(file)], () => this.io.unlink(this.absolute(file)));
  }

  private async cleanupStatusTemps(id: string): Promise<void> {
    const base = this.transactionPath(id);
    for (const [file, owner] of this.statusTemps) {
      if (path.posix.dirname(file) !== base) continue;
      if (await this.checked(file, "file", true)) await this.removeOwned(file, owner, true);
      this.statusTemps.delete(file);
      await this.flush(base);
    }
    await this.checked(base, "directory");
    if ((await this.io.readdir(this.absolute(base))).some(name => /^status-.*\.tmp$/.test(name))) {
      throw new Error("publication has unowned status temporary files; explicit recovery required");
    }
  }
}

function safeRelative(value: string): void {
  if (typeof value !== "string" || !value || value.length > 1024 || value.split("/").some(segment =>
    !segment || segment === "." || segment === ".." || /[\\:<>"|?*]/.test(segment) || hasControlCharacters(segment) ||
    /[. ]$/.test(segment) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))) {
    throw new Error("publication path is unsafe");
  }
}

function verify(bytes: Uint8Array, version: PublicationFileVersion): void {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== version.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== version.sha256) {
    throw new Error("publication artifact digest or byte length mismatch");
  }
}

function pathKey(value: string): string { return process.platform === "win32" ? value.toLowerCase() : value; }
function hasControlCharacters(value: string): boolean {
  return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
function errorCode(error: unknown): string { return (error as NodeJS.ErrnoException)?.code ?? ""; }
