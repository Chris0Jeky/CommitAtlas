import Link from "next/link";
import { buildStudioRouteUrl, type StudioCardKind, type StudioRouteOptions } from "./studio/studio-urls";

const LANDING_PROJECTS = [
  { repo: "Hello-World", lifecycle: "active" },
  { repo: "Spoon-Knife", lifecycle: "maintenance" },
];

const LANDING_OPTIONS: StudioRouteOptions = {
  owner: "octocat",
  theme: "ember",
  demo: true,
  days: 365,
  motion: "subtle",
  layout: "wide",
  projects: LANDING_PROJECTS,
};

const CARD_META: Readonly<Record<StudioCardKind, { title: string; purpose: string; width: number; height: number; span: "full" | "half" }>> = {
  atlas: {
    title: "Developer atlas",
    purpose: "A responsive overview of contribution rhythm, activity, languages, and project health.",
    width: 860,
    height: 380,
    span: "full",
  },
  profile: {
    title: "Profile snapshot",
    purpose: "Public repository, follower, contribution, and star signals at a glance.",
    width: 720,
    height: 190,
    span: "half",
  },
  streak: {
    title: "Contribution streak",
    purpose: "Current and longest observed streaks with an honest history boundary.",
    width: 720,
    height: 180,
    span: "half",
  },
  activity: {
    title: "Activity map",
    purpose: "A compact calendar view of public contribution density over time.",
    width: 720,
    height: 220,
    span: "full",
  },
  languages: {
    title: "Language mix",
    purpose: "Public repository-language distribution, presented without proficiency claims.",
    width: 720,
    height: 230,
    span: "half",
  },
  projects: {
    title: "Project signals",
    purpose: "Declared lifecycle and project signals for Hello-World and Spoon-Knife.",
    width: 720,
    height: 158,
    span: "half",
  },
};

const CARD_KINDS: readonly StudioCardKind[] = ["atlas", "profile", "streak", "activity", "languages", "projects"];

function cardUrl(kind: StudioCardKind): string {
  return buildStudioRouteUrl(kind, LANDING_OPTIONS);
}

export function LandingHeroCard() {
  const url = cardUrl("atlas");

  return (
    <div className="landing-hero-card" aria-label="Synthetic CommitAtlas atlas preview">
      <div className="landing-hero-card__label"><span aria-hidden="true" /> Synthetic demo · live SVG route</div>
      <a className="landing-hero-card__media" href={url} aria-label="Open the synthetic Developer atlas SVG">
        {/* Dynamic SVG endpoints already return the exact vector asset; image optimisation would proxy it unnecessarily. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} width={860} height={380} alt="Synthetic demo: Developer atlas for octocat" fetchPriority="high" />
      </a>
      <div className="landing-hero-card__footer">
        <span>Real rendered card · no GitHub calls</span>
        <a href={url}>Open SVG <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  );
}

export function LandingCardShowcase() {
  return (
    <section className="card-showcase" id="cards" aria-labelledby="card-showcase-title">
      <div className="showcase-heading">
        <div>
          <p className="eyebrow"><span /> A card for every signal</p>
          <h2 id="card-showcase-title">See the whole toolkit.</h2>
          <p>Every preview below is a real SVG response from the same routes your README can use.</p>
        </div>
        <div className="showcase-note">
          <strong>Synthetic demo</strong>
          <span>Safe, deterministic octocat data. No GitHub calls are made to render this page.</span>
        </div>
      </div>

      <div className="card-showcase-grid">
        {CARD_KINDS.map((kind) => {
          const meta = CARD_META[kind];
          const url = cardUrl(kind);
          return (
            <article className={`showcase-card showcase-card--${meta.span}`} id={kind === "projects" ? "projects" : undefined} key={kind}>
              <header>
                <div>
                  <p className="showcase-card__kicker">CommitAtlas card</p>
                  <h3>{meta.title}</h3>
                  <p>{meta.purpose}</p>
                </div>
                <span className="showcase-card__badge">Synthetic demo</span>
              </header>
              <a className="showcase-card__media" href={url} aria-label={`Open the synthetic ${meta.title} SVG`}>
                {/* Dynamic SVG endpoints already return the exact vector asset; image optimisation would proxy it unnecessarily. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} width={meta.width} height={meta.height} alt={`Synthetic demo: ${meta.title} for octocat`} loading={kind === "atlas" ? "eager" : "lazy"} />
              </a>
              <footer>
                <span>Rendered from public-safe fixture data</span>
                <a href={url}>Open SVG <span aria-hidden="true">↗</span></a>
              </footer>
            </article>
          );
        })}
      </div>

      <p className="showcase-actions"><Link href="/studio">Configure your own set <span aria-hidden="true">→</span></Link><span>·</span><a href="https://github.com/Chris0Jeky/CommitAtlas">View source <span aria-hidden="true">↗</span></a></p>
    </section>
  );
}
