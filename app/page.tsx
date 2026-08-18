const previewProjects = [
  { name: "northstar-api", state: "Active", ci: "Passing", tone: "good" },
  { name: "signal-canvas", state: "Maintenance", ci: "Running", tone: "warn" },
  { name: "archive-kit", state: "Paused", ci: "Not configured", tone: "muted" },
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
          <a href="https://github.com/Chris0Jeky/CommitAtlas">GitHub <span aria-hidden="true">↗</span></a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Open-source GitHub portfolio toolkit</p>
          <h1>Your GitHub work,<br /><em>mapped clearly.</em></h1>
          <p className="lede">
            Beautiful contribution cards meet a project dashboard that shows what is
            active, what is healthy, and where people should go next.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#studio">Build your atlas <span aria-hidden="true">→</span></a>
            <a className="button button-secondary" href="#cards">Explore cards</a>
          </div>
          <ul className="trust-list" aria-label="Product principles">
            <li><span aria-hidden="true">✓</span> Public by default</li>
            <li><span aria-hidden="true">✓</span> Honest freshness</li>
            <li><span aria-hidden="true">✓</span> Live or static</li>
          </ul>
        </div>

        <div className="atlas-preview" aria-label="CommitAtlas card and project dashboard preview">
          <div className="preview-glow" />
          <article className="profile-card" id="cards">
            <header>
              <div>
                <p className="card-kicker">Developer atlas</p>
                <h2>octocat</h2>
              </div>
              <span className="freshness"><i /> Updated 8m ago</span>
            </header>
            <div className="metric-grid">
              <div><strong>1,284</strong><span>Contributions</span></div>
              <div><strong>86</strong><span>Pull requests</span></div>
              <div><strong>24</strong><span>Repositories</span></div>
            </div>
            <div className="activity" aria-label="Contribution activity preview">
              {[34, 48, 28, 62, 45, 78, 56, 88, 67, 94, 74, 100, 82, 96, 76, 92].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <footer><span>90-day activity</span><strong>+18% <small>vs prior period</small></strong></footer>
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

      <section className="studio-strip" id="studio" aria-labelledby="studio-title">
        <div>
          <p className="eyebrow"><span /> Start with a GitHub handle</p>
          <h2 id="studio-title">One toolkit. Every signal.</h2>
        </div>
        <form className="handle-form">
          <label htmlFor="handle">GitHub username</label>
          <div>
            <span aria-hidden="true">@</span>
            <input id="handle" name="handle" defaultValue="octocat" autoComplete="off" />
            <button type="submit">Preview <span aria-hidden="true">→</span></button>
          </div>
        </form>
      </section>
    </main>
  );
}
