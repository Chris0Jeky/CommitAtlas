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
 *
 * It is a real `<dialog>` opened with `showModal()`, not a `<div role="dialog" aria-modal="true">`.
 * The hand-rolled version declared modality it did not have: nothing outside it was inert, so two
 * Tab presses walked a keyboard user out through the footer and into the navigation *underneath the
 * scrim*, while a screen-reader user in browse mode stayed correctly confined by `aria-modal`. The
 * two experiences disagreed, and the ARIA claim was the one that was false. `showModal()` puts the
 * element in the top layer and makes the rest of the document inert for real, so the browser
 * supplies the focus trap, the backdrop, and the Escape handling that the markup was promising.
 */

interface EvidenceContextValue {
  evidence: EvidenceSet;
  openId: string | null;
  open: (id: string, trigger: HTMLElement | null) => void;
  close: () => void;
  /** Called by the drawer *after* the dialog has actually closed. See `restoreFocus` below. */
  restoreFocus: () => void;
}

const EvidenceContext = createContext<EvidenceContextValue | null>(null);

export function EvidenceProvider({ evidence, children }: { evidence: EvidenceSet; children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpenId(null), []);

  /**
   * Return focus to the number that was asked about.
   *
   * Split from `close` because of the ordering: while the dialog is still open it is modal, and a
   * modal dialog makes the rest of the document inert — so focusing the trigger from `close` was
   * silently refused and the caret ended up on `<body>`. The drawer calls this *after* `close()` on
   * the element has run, which is the first moment the trigger can take focus again.
   */
  const restoreFocus = useCallback(() => {
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, []);

  const open = useCallback((id: string, trigger: HTMLElement | null) => {
    // The ref is written here, not inside the updater: a state updater has to be pure, StrictMode
    // double-invokes it, and concurrent rendering may re-base it. Clearing is left to
    // `restoreFocus`, so the trigger is released on every close path.
    triggerRef.current = trigger;
    setOpenId((current) => (current === id ? null : id));
  }, []);

  const value = useMemo<EvidenceContextValue>(
    () => ({ evidence, openId, open, close, restoreFocus }),
    [evidence, openId, open, close, restoreFocus],
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
      // The served attribute is what `rendered-html.test.mjs` reads to prove the page wires exactly
      // the readings `LANDING_EVIDENCE_IDS` says it does.
      data-ev={id}
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
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const openId = context?.openId ?? null;
  const restoreFocus = context?.restoreFocus;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (openId && !dialog.open) {
      dialog.showModal();
      // `showModal()` would otherwise focus the close button, which announces the way out before
      // the answer. Focusing the container instead reads the dialog's name first.
      dialog.focus();
    } else if (!openId && dialog.open) {
      dialog.close();
      // Only now is the rest of the document non-inert and able to take focus.
      restoreFocus?.();
    }
  }, [openId, restoreFocus]);

  const record = openId ? context?.evidence.byId[openId] : undefined;
  const tier = record ? EVIDENCE_TIER_PRESENTATION[record.tier] : undefined;

  return (
    // A modal `<dialog>` is an interactive element that the rule does not model, so it reads the
    // backdrop handler as a click on inert markup. The keyboard route it wants already exists and
    // is the native one: Escape fires `cancel`, handled below.
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */
    <dialog
      ref={dialogRef}
      className="evidence-drawer"
      aria-labelledby={titleId}
      tabIndex={-1}
      // Escape fires `cancel`. Closing the element directly here would leave React's state saying
      // the drawer is open, so the request is routed through the same `close` the button uses.
      onCancel={(event) => {
        event.preventDefault();
        context?.close();
      }}
      // Unreachable while `onCancel` intercepts Escape and no `<form method="dialog">` exists, but
      // it goes live the moment any of that changes — and by the time this fires the element is
      // already closed, so the effect's close branch cannot restore focus for it.
      onClose={() => {
        if (context?.openId) context.close();
        context?.restoreFocus();
      }}
      // A modal dialog's backdrop dispatches its click on the dialog itself, so this is the
      // click-outside path — but a press that *starts* on a child and releases past the edge
      // reports the same target, and so does the drawer's own scrollbar. Requiring the press to
      // have begun on the backdrop too is what stops drag-selecting the FORMULA row from closing
      // the drawer and losing the selection.
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressedBackdrop.current) context?.close();
        pressedBackdrop.current = false;
      }}
    >
      {record && tier && context ? (
        <>
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
        </>
      ) : null}
    </dialog>
  );
}
