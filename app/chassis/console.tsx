import Link from "next/link";
import ThemeSwitch from "./theme-switch";
import { SOURCE_REPOSITORY } from "@/lib/site";

/**
 * The console header strip.
 *
 * `▼` is the chassis header marker and the `REF:` chip names the revision the surface was built
 * from, so a screenshot of any page carries enough to say which design it came from. Navigation
 * lives in the same strip rather than in a second bar: the chassis has one horizontal rule at the
 * top of the page, and a second one would break the survey rhythm the whole grid is measured on.
 */
export function ConsoleHeader({
  section,
  reference,
  links,
}: {
  section: string;
  reference: string;
  links: readonly { href: string; label: string; external?: true }[];
}) {
  return (
    <header className="console shell" role="banner">
      <div className="console-left">
        <Link className="console-title" href="/">
          <span aria-hidden="true">▼</span> CommitAtlas <span aria-hidden="true">{"//"}</span> {section}
        </Link>
        <span className="ref console-hide-sm">REF: {reference}</span>
      </div>
      <div className="console-right">
        <nav aria-label="Primary navigation" className="console-right">
          {links.map((link) => (
            link.external
              ? <a key={link.href} href={link.href}>{link.label} <span aria-hidden="true">↗</span></a>
              : <Link key={link.href} href={link.href}>{link.label}</Link>
          ))}
        </nav>
        <ThemeSwitch />
      </div>
    </header>
  );
}

export const LANDING_LINKS = [
  { href: "#capabilities", label: "Capabilities" },
  { href: "#cards", label: "Examples" },
  { href: "/studio", label: "Studio" },
  { href: SOURCE_REPOSITORY, label: "GitHub", external: true },
] as const;

export const STUDIO_LINKS = [
  { href: "/", label: "Overview" },
  { href: "#configure", label: "Configure" },
  { href: "#preview", label: "Preview" },
  { href: SOURCE_REPOSITORY, label: "GitHub", external: true },
] as const;

/**
 * The trust strip and barcode that close every page.
 *
 * The right-hand line states the reduced-motion contract in the product's own voice, because it is
 * a promise about the page the reader is looking at rather than a note for developers.
 */
export function ChassisFooter({ note }: { note: string }) {
  return (
    <footer className="site-footer shell">
      <p>✓ Public by default &nbsp; ✓ Honest freshness &nbsp; ✓ Live or static</p>
      <span className="barcode" aria-hidden="true" />
      <p>
        {note} · <a href={SOURCE_REPOSITORY}>View source <span aria-hidden="true">↗</span></a>
      </p>
    </footer>
  );
}
