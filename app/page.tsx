import Link from "next/link";
import { LandingCardShowcase, LandingHeroCard } from "./card-showcase";

const capabilities = [
  {
    number: "01",
    title: "Contribution signals",
    body: "Profile, streak, breakdown, rhythm, activity, and language cards built from bounded, explicit data contracts.",
  },
  {
    number: "02",
    title: "Project health",
    body: "Declared lifecycle, CI freshness, releases, and the destinations people actually need.",
  },
  {
    number: "03",
    title: "Truthful by design",
    body: "Unavailable and stale remain visible states. CommitAtlas never paints uncertainty green.",
  },
] as const;

export default function Home() {
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="CommitAtlas home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>CommitAtlas</span>
        </a>
        <div className="nav-links">
          <a href="#cards">Cards</a>
          <a href="#projects">Projects</a>
          <a href="/studio">Studio</a>
          <a href="https://github.com/Chris0Jeky/CommitAtlas">GitHub <span aria-hidden="true">↗</span></a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Open-source GitHub portfolio toolkit</p>
          <h1>Your GitHub work,<br /><em>mapped clearly.</em></h1>
          <p className="lede">
            Beautiful contribution cards meet an operational project dashboard: what is active,
            what is healthy, how fresh the evidence is, and where people should go next.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/studio">Build your atlas <span aria-hidden="true">→</span></Link>
            <a className="button button-secondary" href="#cards">Explore the system</a>
          </div>
          <ul className="trust-list" aria-label="Product principles">
            <li><span aria-hidden="true">✓</span> Public by default</li>
            <li><span aria-hidden="true">✓</span> Honest freshness</li>
            <li><span aria-hidden="true">✓</span> Live or static</li>
          </ul>
        </div>

        <LandingHeroCard />
      </section>

      <LandingCardShowcase />

      <section className="capability-section" aria-labelledby="capability-title">
        <div className="section-heading">
          <p className="eyebrow"><span /> One source of portfolio truth</p>
          <h2 id="capability-title">Signals with somewhere to go.</h2>
          <p>README-ready summaries up front. A useful, keyboard-friendly dashboard behind them.</p>
        </div>
        <div className="capability-grid">
          {capabilities.map((capability) => (
            <article key={capability.number}>
              <span>{capability.number}</span>
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="studio-strip" aria-labelledby="studio-title">
        <div>
          <p className="eyebrow"><span /> Configure without guesswork</p>
          <h2 id="studio-title">One toolkit. Every signal.</h2>
          <p>Choose live public data or a clearly marked synthetic preview, then copy only the cards you want.</p>
        </div>
        <Link className="button button-primary" href="/studio">Open the Studio <span aria-hidden="true">→</span></Link>
      </section>

      <footer className="site-footer">
        <a className="brand" href="#top"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>CommitAtlas</a>
        <p>Open source. Source-backed. Built for portfolios that stay useful.</p>
        <a href="https://github.com/Chris0Jeky/CommitAtlas">View source <span aria-hidden="true">↗</span></a>
      </footer>
    </main>
  );
}
