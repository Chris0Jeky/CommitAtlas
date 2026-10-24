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

test("ancestor swaps after the target check stop writes and cleanup before outside mutation", async t => {
  for (const operation of ["write", "cleanup"]) await t.test(operation, async t => {
    let armed = false, swapped = false, victim, directory, outside, checks = 0;
    async function swap() {
      armed = false;
      swapped = true;
      await fs.rename(directory, `${directory}-saved`);
      await fs.symlink(outside, directory, process.platform === "win32" ? "junction" : "dir");
    }
    const storage = { ...nodePublicationStorage, async lstat(file, ...args) {
      let result, failure;
      try { result = await fs.lstat(file, ...args); } catch (error) { failure = error; }
      if (armed && operation === "write" && file === victim) await swap();
      if (failure) throw failure;
      return result;
    }, async realpath(file, ...args) {
      const result = await fs.realpath(file, ...args);
      if (armed && operation === "cleanup" && file === victim && ++checks === 3) await swap();
      return result;
    } };
    const f = await fixture(t, storage);
    if (operation === "cleanup") { await prepared(f); await cleaning(f); }
    else await f.store.createTransaction(f.journal);
    victim = artifact(f.root, f.id, 0, "staged");
    directory = path.dirname(victim);
    outside = path.join(f.temp, "outside");
    await fs.mkdir(outside);
    const sentinel = path.join(outside, "atlas.svg");
    if (operation === "cleanup") await fs.writeFile(sentinel, f.next.get("0:atlas.svg"));
    armed = true;
    await assert.rejects(operation === "write" ?
      f.store.writeArtifact(f.id, 0, "atlas.svg", "staged", f.next.get("0:atlas.svg")) :
      f.store.removeArtifact(f.id, 0, "atlas.svg", "staged"));
    assert.equal(swapped, true);
    if (operation === "write") assert.deepEqual(await fs.readdir(outside), []);
    else assert.deepEqual(await fs.readFile(sentinel), f.next.get("0:atlas.svg"));
    // Restoring the namespace must not silently revive this failed store's mutations.
    await fs.unlink(directory);
    await fs.rename(`${directory}-saved`, directory);
    await assert.rejects(f.store.writeArtifact(f.id, 1, "new.svg", "staged", f.next.get("1:new.svg")), /containment|ancestor/);
    await unchanged(f);
  });
});

test("a swap inside exclusive open is detected before payload bytes are written", async t => {
  let victim, directory, outside, armed = false;
  const storage = { ...nodePublicationStorage, async open(file, ...args) {
    if (armed && file === victim) {
      armed = false;
      await fs.rename(directory, `${directory}-saved`);
      await fs.symlink(outside, directory, process.platform === "win32" ? "junction" : "dir");
    }
    return fs.open(file, ...args);
  } };
  const f = await fixture(t, storage);
  await f.store.createTransaction(f.journal);
  victim = artifact(f.root, f.id, 0, "staged");
  directory = path.dirname(victim);
  outside = path.join(f.temp, "outside");
  await fs.mkdir(outside);
  armed = true;
  await assert.rejects(f.store.writeArtifact(f.id, 0, "atlas.svg", "staged", f.next.get("0:atlas.svg")));
  // Path-based open can still create an empty file: this is a production blocker.
  assert.equal((await fs.stat(path.join(outside, "atlas.svg"))).size, 0);
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
  assert.deepEqual(await fs.readdir(control(f.root)), ["transactions"]); // Lock path free, no quarantine left.
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

test("failed lock acquisition retains safe release ownership after write, sync, close or directory flush failure", async t => {
  for (const failure of ["write", "partial-write", "sync", "close", "directory-flush"]) await t.test(failure, async t => {
    const f = await fixture(t);
    await f.store.releaseLock();
    let armed = true;
    const fail = () => { armed = false; throw Object.assign(new Error(`injected lock ${failure}`), { code: "EIO" }); };
    const storage = { ...nodePublicationStorage,
      async flushDirectory(file) {
        if (armed && failure === "directory-flush" && file === control(f.root)) fail();
        return nodePublicationStorage.flushDirectory(file);
      },
      async open(file, flags, mode) {
        const handle = await fs.open(file, flags, mode);
        const lockWrite = file === control(f.root, "publication.lock") && (flags & 1) !== 0;
        return {
          stat: (...args) => handle.stat(...args), readFile: (...args) => handle.readFile(...args),
          async writeFile(data) {
            if (armed && lockWrite && failure === "write") fail();
            if (armed && lockWrite && failure === "partial-write") { await handle.writeFile(data.subarray(0, 5)); fail(); }
            await handle.writeFile(data);
          },
          async sync() { if (armed && lockWrite && failure === "sync") fail(); await handle.sync(); },
          async close() { await handle.close(); if (armed && lockWrite && failure === "close") fail(); },
        };
      },
    };
    const store = await openPublicationControlStore(f.root, options(storage));
    await assert.rejects(store.acquireLock(), /injected lock/);
    await assert.rejects(store.createTransaction(f.journal), /acquisition|exclusive lock/);
    const second = await openPublicationControlStore(f.root, options());
    await assert.rejects(second.acquireLock(), { code: "EEXIST" });
    await store.releaseLock();
    await second.acquireLock();
    await second.releaseLock();
  });
});

test("partial lock release refuses replacement bytes", async t => {
  const f = await fixture(t);
  await f.store.releaseLock();
  const fault = faultStorage();
  const store = await openPublicationControlStore(f.root, options(fault.storage));
  fault.arm(operation => operation === "file-flush");
  await assert.rejects(store.acquireLock(), /injected/);
  await fs.writeFile(control(f.root, "publication.lock"), "other owner");
  await assert.rejects(store.releaseLock(), /owner changed/);
  assert.equal(await fs.readFile(control(f.root, "publication.lock"), "utf8"), "other owner");
});

test("owned removal quarantines before verification and never deletes a replacement lock", async t => {
  let lockFile, replace = false;
  async function swap(file) {
    if (!replace || file !== lockFile) return;
    replace = false; // A recovering process replaces the lock after our ownership check.
    await fs.unlink(file);
    await fs.writeFile(file, "recovering owner", { flag: "wx" });
  }
  const storage = { ...nodePublicationStorage,
    async rename(source, ...args) { await swap(source); return fs.rename(source, ...args); },
    async unlink(file) { await swap(file); return fs.unlink(file); } };
  const f = await fixture(t, storage);
  lockFile = control(f.root, "publication.lock");
  replace = true;
  await assert.rejects(f.store.releaseLock(), /owner changed; explicit recovery required/);
  const quarantined = (await fs.readdir(control(f.root))).filter(name => name.endsWith(".quarantine"));
  assert.equal(quarantined.length, 1);
  const next = await openPublicationControlStore(f.root, options());
  await assert.rejects(next.acquireLock(), /quarantine is present/);
  assert.equal(await fs.readFile(control(f.root, quarantined[0]), "utf8"), "recovering owner");
});

test("owned removal retries from its own quarantine after a rename that persisted then failed", async t => {
  const fault = faultStorage(), f = await fixture(t, fault.storage);
  fault.arm(operation => operation === "rename");
  await assert.rejects(f.store.releaseLock(), /injected after rename/);
  await f.store.releaseLock();
  assert.deepEqual(await fs.readdir(control(f.root)), ["transactions"]);
});

test("leftover status quarantine files block progress instead of being ignored", async t => {
  const f = await fixture(t);
  await f.store.createTransaction(f.journal);
  await stage(f);
  await fs.writeFile(transaction(f.root, f.id, "status-x.tmp.y.quarantine"), "retained");
  await assert.rejects(f.store.advanceStatus(f.id, "prepared"), /unowned status temporary/);
  assert.equal((await f.store.readStatus(f.id)).phase, "preparing");
});

test("an exclusive create whose identity cannot be read fails closed for explicit recovery", async t => {
  const f = await fixture(t);
  await f.store.releaseLock();
  const lockFile = control(f.root, "publication.lock");
  const storage = { ...nodePublicationStorage, async open(file, flags, mode) {
    const handle = await fs.open(file, flags, mode);
    if (file !== lockFile || !(flags & 1)) return handle;
    return { async stat() { throw Object.assign(new Error("injected stat"), { code: "EIO" }); },
      readFile: (...args) => handle.readFile(...args), writeFile: (...args) => handle.writeFile(...args),
      sync: () => handle.sync(), close: () => handle.close() };
  } };
  const store = await openPublicationControlStore(f.root, options(storage));
  await assert.rejects(store.acquireLock(), /identity is unknown; explicit recovery required/);
  assert.equal((await fs.stat(lockFile)).size, 0);
  await assert.rejects(store.releaseLock(), /requires the exclusive lock/);
  await assert.rejects((await openPublicationControlStore(f.root, options())).acquireLock(), { code: "EEXIST" });
});

test("completed transactions with undeclared on-disk target entries block the next generation", async t => {
  for (const entry of ["999/staged/payload", "000/extra/payload"]) await t.test(entry, async t => {
    const f = await fixture(t);
    await prepared(f);
    await cleaning(f);
    await cleanup(f);
    await f.store.advanceStatus(f.id, "complete");
    const file = transaction(f.root, f.id, "targets", ...entry.split("/"));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "undeclared");
    await f.store.releaseLock();
    const next = await openPublicationControlStore(f.root, options());
    const lock = await next.acquireLock();
    await assert.rejects(next.createTransaction({ ...f.journal, transactionId: lock.transactionId }), /recovery bytes/);
    assert.equal(await fs.readFile(file, "utf8"), "undeclared");
  });
});

test("three failed status renames remove owned temps and leave status unchanged", async t => {
  let failures = 0;
  const storage = { ...nodePublicationStorage, async rename(...args) {
    // Only status replacement fails; owned removal also renames (to its quarantine name).
    if (args[1].endsWith("status.json") && failures++ < 3) throw Object.assign(new Error("injected sharing failure"), { code: "EBUSY" });
    return fs.rename(...args);
  } };
  const f = await fixture(t, storage);
  await f.store.createTransaction(f.journal);
  await stage(f);
  // A zero deadline makes each injected failure one complete replacement attempt.
  await f.store.releaseLock();
  f.store = await openPublicationControlStore(f.root, { ...options(storage), sharingRetryMs: 0 });
  await f.store.acquireLock(f.id);
  for (let attempt = 0; attempt < 3; attempt++) {
    await assert.rejects(f.store.advanceStatus(f.id, "prepared"), /injected sharing failure/);
    assert.equal((await f.store.readStatus(f.id)).phase, "preparing");
    assert.deepEqual((await fs.readdir(transaction(f.root, f.id))).sort(), ["journal.json", "status.json", "targets"]);
  }
  await f.store.advanceStatus(f.id, "prepared");
});

test("cleanup bounds retained status temps and refuses to delete changed or unowned bytes", async t => {
  for (const changed of [false, true]) await t.test(changed ? "changed ownership" : "retry cleanup", async t => {
    let failRename = false, failUnlink = false, retained;
    const storage = { ...nodePublicationStorage,
      async rename(...args) {
        if (failRename) { failRename = false; throw new Error("injected status rename"); }
        return fs.rename(...args);
      },
      async unlink(file) {
        if (failUnlink && /status-.*\.tmp\..*\.quarantine$/.test(file)) {
          retained = file;
          throw new Error("injected temp unlink");
        }
        return fs.unlink(file);
      },
    };
    const f = await fixture(t, storage);
    await prepared(f);
    await cleaning(f);
    await cleanup(f);
    failRename = failUnlink = true;
    for (let attempt = 0; attempt < 3; attempt++) {
      await assert.rejects(f.store.advanceStatus(f.id, "complete"), /injected temp unlink/);
      assert.equal((await fs.readdir(transaction(f.root, f.id))).filter(name => name.endsWith(".quarantine")).length, 1);
    }
    assert.equal((await f.store.readStatus(f.id)).phase, "cleaning");
    failUnlink = false;
    if (changed) {
      await fs.writeFile(retained, "caller-owned");
      await assert.rejects(f.store.advanceStatus(f.id, "complete"), /owner changed/);
      assert.equal(await fs.readFile(retained, "utf8"), "caller-owned");
      await f.store.releaseLock();
      const restart = await openPublicationControlStore(f.root, options());
      await restart.acquireLock(f.id);
      await assert.rejects(restart.advanceStatus(f.id, "complete"), /unowned status temporary/);
      assert.equal(await fs.readFile(retained, "utf8"), "caller-owned");
    } else {
      await f.store.advanceStatus(f.id, "complete");
      assert.equal((await f.store.readStatus(f.id)).phase, "complete");
      assert.deepEqual((await fs.readdir(transaction(f.root, f.id))).sort(), ["journal.json", "status.json", "targets"]);
    }
  });
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
