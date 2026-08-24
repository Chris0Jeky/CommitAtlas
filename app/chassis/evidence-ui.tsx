"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EVIDENCE_TIER_PRESENTATION, type EvidenceSet } from "@/lib/evidence";

/**
 * The evidence drawer — M8.
 *
 * Every metric on the page is a button that answers "how do you know that". The drawer is one
 * shared surface rather than a popover per number: there is only ever one question being asked, and
 * a single dialog is the only version of this that is navigable by keyboard without becoming a maze.
 *
 * The provider is a client boundary wrapped around server-rendered children. Those children stay
 * server components — only the individual `<Ev>` triggers and this drawer ship JavaScript.
 */

interface EvidenceContextValue {
  evidence: EvidenceSet;
  openId: string | null;
  open: (id: string, trigger: HTMLElement | null) => void;
  close: () => void;
}

const EvidenceContext = createContext<EvidenceContextValue | null>(null);

export function EvidenceProvider({ evidence, children }: { evidence: EvidenceSet; children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpenId(null);
    // Returning focus to the number that was asked about is what makes the drawer usable by
    // keyboard at all: without it, closing drops the caret back to the top of the document.
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, []);

  const open = useCallback((id: string, trigger: HTMLElement | null) => {
    triggerRef.current = trigger;
    setOpenId((current) => (current === id ? null : id));
  }, []);

  const value = useMemo<EvidenceContextValue>(
    () => ({ evidence, openId, open, close }),
    [evidence, openId, open, close],
  );

  return (
    <EvidenceContext.Provider value={value}>
      {children}
      <EvidenceDrawer />
    </EvidenceContext.Provider>
  );
}

/**
 * One metric, rendered as a question.
 *
 * Falls back to plain text when the id has no record, so a number can never end up presented as
 * explainable while silently having nothing to explain.
 */
export function Ev({ id, children }: { id: string; children: ReactNode }) {
  const context = useContext(EvidenceContext);
  const record = context?.evidence.byId[id];
  if (!context || !record) return <>{children}</>;

  const expanded = context.openId === id;
  return (
    <button
      type="button"
      className="ev"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onClick={(event) => context.open(id, event.currentTarget)}
    >
      {children}
      <span className="sr-only"> — how is {record.label} known?</span>
    </button>
  );
}

function EvidenceDrawer() {
  const context = useContext(EvidenceContext);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const openId = context?.openId ?? null;
  const close = context?.close;

  useEffect(() => {
    if (!openId || !close) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close!();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    drawerRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openId, close]);

  if (!context || !openId) return null;
  const record = context.evidence.byId[openId];
  if (!record) return null;
  const tier = EVIDENCE_TIER_PRESENTATION[record.tier];

  return (
    <>
      {/* The scrim is the click-outside target. It carries no name because the drawer's own close
          button is the accessible way out; a second focusable overlay would only add a stop. */}
      <div className="evidence-scrim" onClick={context.close} aria-hidden="true" />
      <div
        ref={drawerRef}
        className="evidence-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="drawer-head">
          <span className="drawer-title" id={titleId}>
            Evidence · {record.value} {record.label}
          </span>
          <span className="drawer-pills">
            <span className="pill" data-tier={record.tier}>{tier.glyph} {tier.word}</span>
            <span className="pill">{context.evidence.sourceLabel}</span>
            <button type="button" className="drawer-close" onClick={context.close} aria-label="Close the evidence drawer">
              <span aria-hidden="true">✕</span>
            </button>
          </span>
        </div>
        <dl className="drawer-body">
          <dt className="basis">BASIS</dt>
          <dd>{record.basis}</dd>
          {record.formula === null ? null : (
            <>
              <dt className="formula">FORMULA</dt>
              <dd className="formula">{record.formula}</dd>
            </>
          )}
          <dt className="caveat">CAVEAT</dt>
          <dd>{record.caveat}</dd>
          <dt>RULE</dt>
          <dd>{record.rule}</dd>
        </dl>
        <div className="drawer-foot">
          <span>{context.evidence.coverage}</span>
          <b>ESC / CLICK OUTSIDE TO CLOSE</b>
        </div>
      </div>
    </>
  );
}
