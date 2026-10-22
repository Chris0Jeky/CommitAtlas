import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  nodePublicationStorage, openPublicationControlStore, PUBLICATION_CONTROL_POLICY,
} from "../dist/publication-control-store.js";
import { PUBLICATION_PHASES, planPublicationRecoveryFromStatus } from "../dist/publication-protocol.js";

const bytes = text => Buffer.from(text);
const version = data => ({ sha256: createHash("sha256").update(data).digest("hex"), bytes: data.length });
const options = storage => ({ directoryFlush: "report-unsupported", ...(storage ? { storage } : {}) });
const control = (root, ...parts) => path.join(root, ".commitatlas", ...parts);
const transaction = (root, id, ...parts) => control(root, "transactions", id, ...parts);
const artifact = (root, id, target, kind, name = "atlas.svg") => transaction(root, id, "targets", String(target).padStart(3, "0"), kind, name);

async function fixture(t, storage) {
  const temp = await fs.mkdtemp(path.join(tmpdir(), "commitatlas-control-"));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const root = path.join(temp, "repo");
  await fs.mkdir(root);
  const prior = new Map(), next = new Map();
  for (const [index, theme] of ["dark", "light"].entries()) {
    await fs.mkdir(path.join(root, "assets", theme), { recursive: true });
    for (const name of ["atlas.svg", "obsolete.json", "manifest.json"]) {
      const data = bytes(`old-${index}-${name}`);
      prior.set(`${index}:${name}`, data);
      await fs.writeFile(path.join(root, "assets", theme, name), data);
    }
    for (const name of ["atlas.svg", "new.svg"]) next.set(`${index}:${name}`, bytes(`next-${index}-${name}`));
    const manifest = bytes(JSON.stringify(["atlas.svg", "new.svg"].map(name => ({ name, ...version(next.get(`${index}:${name}`)) }))));
    next.set(`${index}:manifest.json`, manifest);
    await fs.writeFile(path.join(root, "assets", theme, "caller.txt"), "caller-owned");
  }
  const store = await openPublicationControlStore(root, options(storage));
  const lock = await store.acquireLock();
  const journal = {
    version: 1, generator: "CommitAtlas", transactionId: lock.transactionId,
    createdAt: "2026-10-22T00:00:00.000Z",
    targets: ["dark", "light"].map((theme, index) => ({ outputDir: `assets/${theme}`, operations: [
      { name: "atlas.svg", action: "replace", previous: version(prior.get(`${index}:atlas.svg`)), next: version(next.get(`${index}:atlas.svg`)) },
      { name: "new.svg", action: "create", next: version(next.get(`${index}:new.svg`)) },
      { name: "obsolete.json", action: "remove", previous: version(prior.get(`${index}:obsolete.json`)) },
      { name: "manifest.json", action: "replace", previous: version(prior.get(`${index}:manifest.json`)), next: version(next.get(`${index}:manifest.json`)) },
    ] })),
  };
  return { root, temp, store, journal, id: lock.transactionId, prior, next };
}

async function stage(f) {
  for (const [index, target] of f.journal.targets.entries()) {
    for (const op of target.operations) if (op.next) await f.store.writeArtifact(f.id, index, op.name, "staged", f.next.get(`${index}:${op.name}`));
  }
}
async function backup(f) {
  for (const [index, target] of f.journal.targets.entries()) {
    for (const op of target.operations) if (op.previous) await f.store.writeArtifact(f.id, index, op.name, "backup", f.prior.get(`${index}:${op.name}`));
  }
}
async function prepared(f) {
  await f.store.createTransaction(f.journal);
  await stage(f);
  await f.store.advanceStatus(f.id, "prepared");
  await backup(f);
  await f.store.advanceStatus(f.id, "backed-up");
}
async function cleaning(f) {
  for (const phase of ["installing", "installed", "committing", "committed", "cleaning"]) await f.store.advanceStatus(f.id, phase);
}
async function cleanup(f) {
  for (const [index, target] of f.journal.targets.entries()) {
    for (const op of target.operations) {
      if (op.next) await f.store.removeArtifact(f.id, index, op.name, "staged");
      if (op.previous) await f.store.removeArtifact(f.id, index, op.name, "backup");
    }
  }
}
async function unchanged(f) {
  for (const [index, target] of f.journal.targets.entries()) {
    for (const op of target.operations) {
      const file = path.join(f.root, target.outputDir, op.name);
      if (op.previous) assert.deepEqual(await fs.readFile(file), f.prior.get(`${index}:${op.name}`));
      else await assert.rejects(fs.lstat(file), { code: "ENOENT" });
    }
    assert.equal(await fs.readFile(path.join(f.root, target.outputDir, "caller.txt"), "utf8"), "caller-owned");
  }
}

async function snapshot(f, name) {
  const destination = path.join(f.temp, name);
  await fs.cp(f.root, destination, { recursive: true,
    filter: source => path.basename(source) !== "publication.lock" });
  return destination;
}
async function cloneFixture(t, f, source, storage) {
  const temp = await fs.mkdtemp(path.join(tmpdir(), "commitatlas-restart-"));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const root = path.join(temp, "repo");
  await fs.cp(source, root, { recursive: true });
  const store = await openPublicationControlStore(root, options(storage));
  // The fixture represents an operator having recovered/released the old lock.
  // Production store code never deletes a stale lock automatically.
  await store.acquireLock(f.id);
  return { ...f, root, temp, store };
}

/** Throws AFTER a successful primitive, modelling persistence before process loss. */
function faultStorage() {
  const events = [];
  let armed, count = 0;
  function hit(operation) {
    events.push(operation);
    if (armed && armed(operation, ++count)) { armed = undefined; throw new Error(`injected after ${operation}`); }
  }
  const storage = { ...nodePublicationStorage,
    async mkdir(...args) { const result = await fs.mkdir(...args); hit("mkdir"); return result; },
    async flushDirectory(file) { const result = await nodePublicationStorage.flushDirectory(file); hit("directory-flush"); return result; },
    async rename(...args) { await fs.rename(...args); hit("rename"); },
    async unlink(...args) { await fs.unlink(...args); hit("unlink"); },
    async checkpoint(name) { hit(name); },
    async open(file, flags, mode) {
      const handle = await fs.open(file, flags, mode);
      const writing = (flags & 1) !== 0;
      if (writing) {
        try { hit("exclusive-open"); } catch (error) { await handle.close(); throw error; }
      }
      return {
        stat: (...args) => handle.stat(...args), readFile: (...args) => handle.readFile(...args),
        async writeFile(...args) { await handle.writeFile(...args); hit("file-write"); },
        async sync() { await handle.sync(); hit("file-flush"); },
        async close() { await handle.close(); if (writing) hit("file-close"); },
      };
    },
  };
  return { storage, events, arm(predicate) { count = 0; armed = predicate; }, disarm() { armed = undefined; } };
}

test("control policy leaves all four open decisions explicit and v2 outside the public entry point", async () => {
  assert.deepEqual(PUBLICATION_CONTROL_POLICY, {
    ownership: "destination-mutation-disabled-pending-ownership-migration", statusExposure: "control-root-only",
    staleLock: "explicit-recovery-only-no-automatic-reclamation", directoryFlush: "require",
  });
  const publicApi = await import("../dist/index.js");
  assert.equal(publicApi.openPublicationControlStore, undefined);
});

test("exclusive lock and journal/artifact creation preserve existing bytes", async t => {
  const f = await fixture(t);
  const second = await openPublicationControlStore(f.root, options());
  await assert.rejects(second.acquireLock(), { code: "EEXIST" });
  await assert.rejects(second.createTransaction(f.journal), /requires the exclusive lock/);
  await f.store.createTransaction(f.journal);
  await assert.rejects(f.store.createTransaction(f.journal), /requires recovery/);
  await f.store.writeArtifact(f.id, 0, "atlas.svg", "staged", f.next.get("0:atlas.svg"));
  await assert.rejects(f.store.writeArtifact(f.id, 0, "atlas.svg", "staged", f.next.get("0:atlas.svg")), { code: "EEXIST" });
  assert.deepEqual(await f.store.readJournal(f.id), f.journal);
  await unchanged(f);
});

test("journal validation rejects traversal, absolute/ADS/Windows aliases and control/output overlap", async t => {
  const f = await fixture(t);
  for (const outputDir of ["../escape", "assets/../escape", "/absolute", "C:/escape", "assets//dark", "assets\\dark", ".commitatlas", ".commitatlas/child", ".COMMITATLAS", "assets/foo.", "assets/foo ", "assets/CON.json", "assets/file:stream"]) {
    const value = structuredClone(f.journal);
    value.targets[0].outputDir = outputDir;
    await assert.rejects(f.store.createTransaction(value), /unsafe|overlaps/, outputDir);
  }
  for (const id of ["../escape", "a/b", "NUL", "", "/absolute"]) await assert.rejects(f.store.readStatus(id), /transactionId|unsafe/);
  await assert.rejects(fs.lstat(transaction(f.root, f.id)), { code: "ENOENT" });
  await unchanged(f);
});

test("control root, transaction ancestors, and output junction escapes are rejected", async t => {
  for (const location of ["control", "transaction", "output"]) {
    await t.test(location, async t => {
      const f = await fixture(t);
      const outside = path.join(f.temp, "outside");
      await fs.mkdir(outside);
      const victim = location === "control" ? control(f.root) : location === "transaction" ? control(f.root, "transactions") : path.join(f.root, "assets", "dark");
      await fs.rename(victim, `${victim}-saved`);
      await fs.symlink(outside, victim, process.platform === "win32" ? "junction" : "dir");
      await assert.rejects(f.store.createTransaction(f.journal), /unsafe entry kind/);
      assert.deepEqual(await fs.readdir(outside), []);
    });
  }
});

test("a junction swapped into staged storage after preparation cannot redirect any operation", async t => {
  const f = await fixture(t);
  await f.store.createTransaction(f.journal);
  const outside = path.join(f.temp, "outside");
  await fs.mkdir(outside);
  const directory = path.dirname(artifact(f.root, f.id, 0, "staged"));
  await fs.rmdir(directory);
  await fs.symlink(outside, directory, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(f.store.writeArtifact(f.id, 0, "atlas.svg", "staged", f.next.get("0:atlas.svg")), /unsafe entry kind/);
  await assert.rejects(f.store.readArtifact(f.id, 0, "atlas.svg", "staged"), /unsafe entry kind/);
  assert.deepEqual(await fs.readdir(outside), []);
  await unchanged(f);
});

test("regular-file entry checks reject directories, hard links and file symlinks", async t => {
  const f = await fixture(t);
  await f.store.createTransaction(f.journal);
  const file = artifact(f.root, f.id, 0, "staged");
  await fs.mkdir(file);
  await assert.rejects(f.store.readArtifact(f.id, 0, "atlas.svg", "staged"), /unsafe entry kind/);
  await fs.rmdir(file);
  const source = path.join(f.temp, "source");
  await fs.writeFile(source, f.next.get("0:atlas.svg"));
  await fs.link(source, file);
  await assert.rejects(f.store.readArtifact(f.id, 0, "atlas.svg", "staged"), /unsafe entry kind/);
  await fs.unlink(file);
  if (process.platform !== "win32") {
    await fs.symlink(source, file);
    await assert.rejects(f.store.readArtifact(f.id, 0, "atlas.svg", "staged"), /unsafe entry kind/);
  }
});

test("staged and backup byte lengths/digests are verified on both write and read", async t => {
  const f = await fixture(t);
  await f.store.createTransaction(f.journal);
  for (const invalid of [Buffer.alloc(f.next.get("0:atlas.svg").length), bytes("short"), bytes("too-long".repeat(100))]) {
    await assert.rejects(f.store.writeArtifact(f.id, 0, "atlas.svg", "staged", invalid), /digest or byte length mismatch/);
  }
  await assert.rejects(f.store.writeArtifact(f.id, 0, "../atlas.svg", "staged", bytes("x")), /not recorded/);
  await assert.rejects(f.store.writeArtifact(f.id, -1, "atlas.svg", "staged", bytes("x")), /invalid publication target/);
  await assert.rejects(f.store.advanceStatus(f.id, "prepared"), { code: "ENOENT" });
  assert.equal((await f.store.readStatus(f.id)).phase, "preparing");
  await stage(f);
  const staged = artifact(f.root, f.id, 0, "staged");
  await fs.writeFile(staged, Buffer.alloc(f.next.get("0:atlas.svg").length));
  await assert.rejects(f.store.readArtifact(f.id, 0, "atlas.svg", "staged"), /digest/);
  await assert.rejects(f.store.advanceStatus(f.id, "prepared"), /digest/);
  await fs.writeFile(staged, f.next.get("0:atlas.svg"));
  await f.store.advanceStatus(f.id, "prepared");
  await assert.rejects(f.store.writeArtifact(f.id, 0, "atlas.svg", "backup", f.next.get("0:atlas.svg")), /digest/);
  await backup(f);
  await fs.writeFile(artifact(f.root, f.id, 1, "backup"), Buffer.alloc(f.prior.get("1:atlas.svg").length));
  await assert.rejects(f.store.advanceStatus(f.id, "backed-up"), /digest/);
  assert.equal((await f.store.readStatus(f.id)).phase, "prepared");
  await unchanged(f);
});

test("status and journal records are bounded, immutable/identity-bound and fail closed when corrupt", async t => {
  const f = await fixture(t);
  await f.store.createTransaction(f.journal);
  const original = await fs.readFile(transaction(f.root, f.id, "journal.json"));
  await assert.rejects(f.store.advanceStatus(f.id, "committed"), /cannot advance/);
  await stage(f);
  await f.store.advanceStatus(f.id, "prepared");
  assert.deepEqual(await fs.readFile(transaction(f.root, f.id, "journal.json")), original);
  const record = await f.store.readStatus(f.id);
  await fs.writeFile(transaction(f.root, f.id, "status.json"), JSON.stringify({ ...record, transactionId: "other" }) + "\n");
  await assert.rejects(f.store.readStatus(f.id), /does not match directory/);
  await fs.writeFile(transaction(f.root, f.id, "status.json"), Buffer.alloc(513));
  await assert.rejects(f.store.readStatus(f.id), /byte limit/);
  await fs.writeFile(transaction(f.root, f.id, "journal.json"), "{broken");
  await assert.rejects(f.store.readJournal(f.id), /invalid JSON/);
});

test("stale, remote, unknown and malformed locks are preserved until explicit recovery", async t => {
  const f = await fixture(t);
  const owner = await f.store.inspectLock();
  assert.equal(owner.pid, process.pid);
  await f.store.releaseLock();
  const file = control(f.root, "publication.lock");
  for (const record of [
    { ...owner, pid: 2147483647, startedAt: "2000-01-01T00:00:00.000Z" },
    { ...owner, hostname: "some-other-host" },
    { ...owner, pid: 0 }, { ...owner, extra: true }, "malformed",
  ]) {
    const content = bytes(typeof record === "string" ? record : JSON.stringify(record) + "\n");
    await fs.writeFile(file, content, { flag: "wx" });
    const second = await openPublicationControlStore(f.root, options());
    await assert.rejects(second.acquireLock(), { code: "EEXIST" });
    if (typeof record === "string" || record.pid === 0 || record.extra) await assert.rejects(second.inspectLock(), /malformed/);
    else assert.deepEqual(await second.inspectLock(), record);
    assert.deepEqual(await fs.readFile(file), content);
    await fs.unlink(file); // Explicit fixture operator action, never store stale-lock reclamation.
  }
});

test("lock release and writes refuse a substituted owner; incomplete transactions block new generations", async t => {
  const f = await fixture(t);
  await f.store.createTransaction(f.journal);
  const file = control(f.root, "publication.lock");
  const original = await fs.readFile(file);
  await fs.writeFile(file, original.toString().replace(f.id, "another-owner"));
  await assert.rejects(f.store.releaseLock(), /owner changed/);
  await assert.rejects(f.store.writeArtifact(f.id, 0, "atlas.svg", "staged", f.next.get("0:atlas.svg")), /owner changed/);
  await fs.writeFile(file, original);
  await f.store.releaseLock();
  const second = await openPublicationControlStore(f.root, options());
  const owner = await second.acquireLock();
  await assert.rejects(second.createTransaction({ ...f.journal, transactionId: owner.transactionId }), /requires recovery/);
  await second.releaseLock();
  const recovery = await openPublicationControlStore(f.root, options());
  await recovery.acquireLock(f.id);
  await recovery.writeArtifact(f.id, 0, "atlas.svg", "staged", f.next.get("0:atlas.svg"));
  await unchanged(f);
});

test("directory durability defaults to required; unsupported capability is explicit and I/O errors propagate", async t => {
  const f = await fixture(t);
  const unsupported = { ...nodePublicationStorage, async flushDirectory() { return "unsupported"; } };
  await assert.rejects(openPublicationControlStore(f.root, { storage: unsupported }), /strict durability required/);
  const store = await openPublicationControlStore(f.root, options(unsupported));
  assert.deepEqual(store.capabilities, { fileFlush: "required", directoryFlush: "unsupported", directoryFlushPolicy: "report-unsupported" });
  const supported = await openPublicationControlStore(f.root, { storage: { ...unsupported, async flushDirectory() { return "supported"; } } });
  assert.equal(supported.capabilities.directoryFlush, "supported");
  const ioFailure = { ...nodePublicationStorage, async flushDirectory() { throw Object.assign(new Error("disk failure"), { code: "EIO" }); } };
  await assert.rejects(openPublicationControlStore(f.root, options(ioFailure)), /disk failure/);
  const native = await nodePublicationStorage.flushDirectory(f.root);
  assert.ok(["supported", "unsupported"].includes(native));
  const actual = await openPublicationControlStore(f.root, options());
  assert.equal(actual.capabilities.directoryFlush, native);
});

test("file flush errors cannot advance preparation and every created control file is flushed before its directory", async t => {
  const fault = faultStorage(), f = await fixture(t, fault.storage);
  await f.store.createTransaction(f.journal);
  fault.arm(operation => operation === "file-flush");
  await assert.rejects(f.store.writeArtifact(f.id, 0, "atlas.svg", "staged", f.next.get("0:atlas.svg")), /injected/);
  assert.equal((await f.store.readStatus(f.id)).phase, "preparing");
  const events = fault.events;
  for (let i = 0; i < events.length; i++) {
    if (events[i] === "exclusive-open") assert.deepEqual(events.slice(i, i + 4), ["exclusive-open", "file-write", "file-flush", "file-close"]);
  }
  // The failed flush left correct readable bytes. A phase retry must fsync them again,
  // even in a newly opened store with no knowledge of the earlier error.
  await f.store.releaseLock();
  const restart = await openPublicationControlStore(f.root, options(fault.storage));
  await restart.acquireLock(f.id);
  let flushes = 0;
  fault.arm(operation => operation === "file-flush" && ++flushes === 2);
  await assert.rejects(restart.advanceStatus(f.id, "prepared"), /injected after file-flush/);
  assert.equal((await restart.readStatus(f.id)).phase, "preparing");
});

test("two-theme status replacement closes/flushed handles before rename; cleanup retries and bounds recovery bytes", async t => {
  const fault = faultStorage(), f = await fixture(t, fault.storage);
  await prepared(f);
  await assert.rejects(f.store.writeArtifact(f.id, 0, "atlas.svg", "staged", f.next.get("0:atlas.svg")), /outside its preparation phase/);
  await assert.rejects(f.store.removeArtifact(f.id, 0, "atlas.svg", "staged"), /requires cleaning/);
  await cleaning(f);
  await assert.rejects(f.store.advanceStatus(f.id, "complete"), /still contains recovery bytes/);
  for (let i = 0; i < fault.events.length; i++) {
    if (fault.events[i] === "rename") assert.deepEqual(fault.events.slice(i - 3, i + 2), ["file-flush", "file-close", "directory-flush", "rename", "directory-flush"]);
  }
  await cleanup(f);
  await cleanup(f);
  await f.store.advanceStatus(f.id, "complete");
  assert.equal((await f.store.readStatus(f.id)).phase, "complete");
  for (const index of [0, 1]) for (const kind of ["staged", "backup"]) assert.deepEqual(await fs.readdir(path.dirname(artifact(f.root, f.id, index, kind))), []);
  assert.deepEqual((await fs.readdir(transaction(f.root, f.id))).sort(), ["journal.json", "status.json", "targets"]);
  await unchanged(f);
  await f.store.releaseLock();
  const nextStore = await openPublicationControlStore(f.root, options());
  const lock = await nextStore.acquireLock();
  await nextStore.createTransaction({ ...f.journal, transactionId: lock.transactionId });
});

test("cleanup refuses drifted bytes and swapped directory entries", async t => {
  const f = await fixture(t);
  await prepared(f);
  await cleaning(f);
  const file = artifact(f.root, f.id, 0, "backup");
  await fs.writeFile(file, bytes("human edit"));
  await assert.rejects(f.store.removeArtifact(f.id, 0, "atlas.svg", "backup"), /digest|byte limit/);
  assert.equal(await fs.readFile(file, "utf8"), "human edit");
  const staged = artifact(f.root, f.id, 0, "staged");
  await fs.unlink(staged);
  await fs.mkdir(staged);
  await assert.rejects(f.store.removeArtifact(f.id, 0, "atlas.svg", "staged"), /unsafe entry kind/);
  await unchanged(f);
});

test("single-theme control storage follows the same preparation protocol", async t => {
  const f = await fixture(t);
  f.journal.targets = f.journal.targets.slice(0, 1);
  await prepared(f);
  assert.equal((await f.store.readJournal(f.id)).targets.length, 1);
  assert.equal((await f.store.readStatus(f.id)).phase, "backed-up");
});

test("failure injection covers every slice-2 named checkpoint and each staged/backup file in two themes", async t => {
  const seed = await fixture(t);
  await seed.store.createTransaction(seed.journal);
  const preparingSnapshot = await snapshot(seed, "preparing");
  await stage(seed);
  await seed.store.advanceStatus(seed.id, "prepared");
  const preparedSnapshot = await snapshot(seed, "prepared");
  await backup(seed);
  for (const phase of ["backed-up", "installing", "installed", "committing"]) await seed.store.advanceStatus(seed.id, phase);
  const committingSnapshot = await snapshot(seed, "committing");
  await seed.store.advanceStatus(seed.id, "committed");
  await seed.store.advanceStatus(seed.id, "cleaning");
  const cleaningSnapshot = await snapshot(seed, "cleaning");
  const checkpoints = [
    ["before-journal-publication", 1], ["after-journal-publication", 1],
    ["after-staged-payload", 6], ["after-backup", 6],
    ["before-committed-status", 1], ["after-committed-status", 1],
    ["during-staged-cleanup", 6], ["during-backup-cleanup", 6],
  ];
  for (const [name, occurrences] of checkpoints) for (let occurrence = 1; occurrence <= occurrences; occurrence++) {
    await t.test(`${name}:${occurrence}`, async t => {
      const fault = faultStorage();
      const source = name === "after-staged-payload" ? preparingSnapshot : name === "after-backup" ? preparedSnapshot :
        name.includes("committed-status") ? committingSnapshot : name.startsWith("during-") ? cleaningSnapshot : undefined;
      const f = source ? await cloneFixture(t, seed, source, fault.storage) : await fixture(t, fault.storage);
      let seen = 0;
      fault.arm(operation => operation === name && ++seen === occurrence);
      await assert.rejects((async () => {
        if (name.includes("journal-publication")) await f.store.createTransaction(f.journal);
        else if (name === "after-staged-payload") await stage(f);
        else if (name === "after-backup") await backup(f);
        else if (name.includes("committed-status")) await f.store.advanceStatus(f.id, "committed");
        else await cleanup(f);
      })(), /injected/);
      await unchanged(f);
      const restart = await openPublicationControlStore(f.root, options());
      await assert.rejects(restart.acquireLock(), { code: "EEXIST" });
      const status = await restart.readStatus(f.id);
      assert.notEqual(status.phase, "complete");
      if (name === "before-journal-publication") await assert.rejects(restart.readJournal(f.id), { code: "ENOENT" });
      else {
        const journal = await restart.readJournal(f.id);
        const observations = journal.targets.flatMap((target, index) => target.operations.map(op => ({
          target: index, name: op.name, ...(op.previous ? { kind: "file", ...op.previous } : { kind: "missing" }),
        })));
        for (let retry = 0; retry < 3; retry++) {
          const plan = planPublicationRecoveryFromStatus(journal, await restart.readStatus(f.id), observations);
          const expected = PUBLICATION_PHASES.indexOf(status.phase) < PUBLICATION_PHASES.indexOf("committed") ? "rollback" : "roll-forward";
          assert.equal(plan.direction, expected);
          if (expected === "rollback") assert.deepEqual(plan.steps, []);
        }
      }
      if (name.startsWith("during-")) {
        await cleanup(f);
        await cleanup(f);
        await f.store.advanceStatus(f.id, "complete");
        assert.equal((await f.store.readStatus(f.id)).phase, "complete");
      }
    });
  }
});

test("operation-count crash sweep across transaction creation preserves destinations and refuses a second generation", async t => {
  const baseline = faultStorage(), f = await fixture(t, baseline.storage);
  const start = baseline.events.length;
  await f.store.createTransaction(f.journal);
  const operations = baseline.events.slice(start).filter(event => !event.includes("journal-publication"));
  assert.ok(operations.length > 20);
  for (let stop = 1; stop <= operations.length; stop++) {
    await t.test(`after operation ${stop}: ${operations[stop - 1]}`, async t => {
      const fault = faultStorage(), interrupted = await fixture(t, fault.storage);
      let count = 0;
      fault.arm(operation => !operation.includes("journal-publication") && ++count === stop);
      await assert.rejects(interrupted.store.createTransaction(interrupted.journal), /injected/);
      fault.disarm();
      await unchanged(interrupted);
      await interrupted.store.releaseLock();
      const restart = await openPublicationControlStore(interrupted.root, options());
      const owner = await restart.acquireLock();
      await assert.rejects(restart.createTransaction({ ...interrupted.journal, transactionId: owner.transactionId }));
      // Partial preparing records are retained rather than guessed away.
      assert.deepEqual(await fs.readdir(control(interrupted.root, "transactions")), [interrupted.id]);
    });
  }
});
