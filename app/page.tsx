import Link from "next/link";

const previewProjects = [
  { name: "northstar-api", state: "Active", ci: "Passing", tone: "good" },
  { name: "signal-canvas", state: "Maintenance", ci: "Pending", tone: "warn" },
  { name: "archive-kit", state: "Paused", ci: "Not configured", tone: "muted" },
] as const;

const capabilities = [
  {
    number: "01",
    title: "Contribution signals",
    body: "Profile, streak, activity, and language cards built from bounded, explicit data contracts.",
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

        <div className="atlas-preview" aria-label="Clearly labelled synthetic CommitAtlas preview">
          <div className="preview-glow" />
          <div className="preview-label"><span /> Synthetic preview</div>
          <article className="profile-card" id="cards">
            <header>
              <div>
                <p className="card-kicker">Developer atlas</p>
                <h2>octocat</h2>
              </div>
              <span className="freshness"><i /> Demo data</span>
            </header>
            <div className="metric-grid">
              <div><strong>412</strong><span>Contributions</span></div>
              <div><strong>61</strong><span>Pull requests</span></div>
              <div><strong>24</strong><span>Repositories</span></div>
            </div>
            <div className="activity" aria-label="Synthetic contribution activity illustration">
              {[34, 48, 28, 62, 45, 78, 56, 88, 67, 94, 74, 100, 82, 96, 76, 92].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <footer><span>Illustrative 90-day activity</span><strong>Source <small>synthetic</small></strong></footer>
          </article>

          <article className="projects-card" id="projects">
            <header>
              <div><p className="card-kicker">Project signals</p><h2>Portfolio status</h2></div>
              <span className="project-count">3 projects</span>
            </header>
            <div className="project-list">
              {previewProjects.map((project) => (
                <div className="project-row" key={project.name}>
                  <span className={`status-dot ${project.tone}`} aria-hidden="true" />
                  <div><strong>{project.name}</strong><span>{project.state}</span></div>
                  <span className={`ci-pill ${project.tone}`}>{project.ci}</span>
                  <span className="row-arrow" aria-hidden="true">↗</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

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
