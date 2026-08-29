/**
 * Bundled copies of the fixed probe payloads. The neighbouring SVG files are
 * the reviewable fixture source; the route test pins these strings to those
 * files byte-for-byte so a bundler-safe import cannot drift silently.
 */
export const MOTION_PROBES = {
  "css-breathe": `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120" role="img" aria-labelledby="title desc">
  <title id="title">CSS breathe probe</title>
  <desc id="desc">A permanent reading with a looping CSS emphasis ring.</desc>
  <style>
    @keyframes breathe { 0%,100% { transform: scale(1); opacity: .05; } 50% { transform: scale(1.18); opacity: 1; } }
    .ring { transform-box: fill-box; transform-origin: center; animation: breathe 2s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .ring { animation: none !important; } }
  </style>
  <rect width="360" height="120" fill="#11110f"/>
  <text x="24" y="28" fill="#edf0e2" font-family="system-ui,sans-serif" font-size="15">CSS BREATHE · loop</text>
  <circle cx="180" cy="73" r="26" fill="#58e6be"/>
  <circle class="ring" cx="180" cy="73" r="37" fill="none" stroke="#58e6be" stroke-width="4"/>
  <text x="180" y="78" fill="#11110f" font-family="system-ui,sans-serif" font-size="17" font-weight="700" text-anchor="middle">72</text>
</svg>
`,
  "css-enter": `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120" role="img" aria-labelledby="title desc">
  <title id="title">CSS enter probe</title>
  <desc id="desc">A readable baseline and a labelled panel that enters upward after a short delay.</desc>
  <style>
    @keyframes enter { from { transform: translateY(12px); } to { transform: translateY(0); } }
    .enter { transform-box: fill-box; transform-origin: center; animation: enter 380ms ease-out 60ms; }
    @media (prefers-reduced-motion: reduce) { .enter { animation: none !important; } }
  </style>
  <rect width="360" height="120" fill="#11110f"/>
  <path d="M24 94H336" stroke="#7d836f" stroke-width="2"/>
  <text x="24" y="28" fill="#edf0e2" font-family="system-ui,sans-serif" font-size="15">CSS ENTER · fill none + delay</text>
  <g class="enter">
    <rect x="86" y="46" width="188" height="36" rx="4" fill="#d9ff4a"/>
    <text x="180" y="69" fill="#11110f" font-family="system-ui,sans-serif" font-size="14" font-weight="700" text-anchor="middle">READABLE AT ZERO</text>
  </g>
</svg>
`,
  "css-from-state-control": `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120" role="img" aria-labelledby="title desc">
  <title id="title">CSS from-state control</title>
  <desc id="desc">A readable static baseline with an opacity-from-zero CSS animation using fill mode both.</desc>
  <style>
    @keyframes reveal { from { opacity: 0; } to { opacity: 1; } }
    .control { animation: reveal 1.2s ease-out 120ms both; }
    @media (prefers-reduced-motion: reduce) { .control { animation: none !important; } }
  </style>
  <rect width="360" height="120" fill="#11110f"/>
  <text x="24" y="28" fill="#edf0e2" font-family="system-ui,sans-serif" font-size="15">CONTROL · opacity 0 + fill both</text>
  <rect x="24" y="52" width="312" height="38" rx="4" fill="#2a2c24"/>
  <text x="180" y="77" fill="#edf0e2" font-family="system-ui,sans-serif" font-size="14" text-anchor="middle">STATIC BASELINE IS READABLE</text>
  <g class="control">
    <rect x="111" y="57" width="138" height="28" rx="3" fill="#ff7a45"/>
    <text x="180" y="77" fill="#11110f" font-family="system-ui,sans-serif" font-size="13" font-weight="700" text-anchor="middle">ANIMATED LAYER</text>
  </g>
</svg>
`,
  "css-offset-path": `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120" role="img" aria-labelledby="title desc">
  <title id="title">CSS offset path probe</title>
  <desc id="desc">A readable route with a CSS offset-path marker.</desc>
  <style>
    @keyframes flow { to { offset-distance: 100%; } }
    .marker { offset-path: path('M 35 84 C 105 36 244 36 325 84'); offset-rotate: 0deg; animation: flow 2s linear infinite; }
    @media (prefers-reduced-motion: reduce) { .marker { animation: none !important; } }
  </style>
  <rect width="360" height="120" fill="#11110f"/>
  <text x="24" y="25" fill="#edf0e2" font-family="system-ui,sans-serif" font-size="15">CSS offset-path</text>
  <path d="M35 84C105 36 244 36 325 84" fill="none" stroke="#58e6be" stroke-opacity=".4" stroke-width="4"/>
  <circle class="marker" cx="35" cy="84" r="8" fill="#ffd166"/>
  <text x="180" y="109" fill="#a9c1d5" font-family="system-ui,sans-serif" font-size="11" text-anchor="middle">ROUTE IS PRESENT AT ZERO</text>
</svg>
`,
  "css-plot": `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120" role="img" aria-labelledby="title desc">
  <title id="title">CSS plot probe</title>
  <desc id="desc">A pre-drawn trace remains readable while a CSS stroke-dashoffset trace loops over it.</desc>
  <style>
    @keyframes plot { to { stroke-dashoffset: 0; } }
    .plot { stroke-dasharray: 420; stroke-dashoffset: 420; animation: plot 2s linear infinite; }
    @media (prefers-reduced-motion: reduce) { .plot { animation: none !important; } }
  </style>
  <rect width="360" height="120" fill="#11110f"/>
  <text x="24" y="25" fill="#edf0e2" font-family="system-ui,sans-serif" font-size="15">CSS PLOT · stroke-dashoffset</text>
  <path d="M24 92L70 76 104 86 142 50 184 69 224 42 274 60 336 34" fill="none" stroke="#58e6be" stroke-opacity=".25" stroke-width="5"/>
  <path class="plot" d="M24 92L70 76 104 86 142 50 184 69 224 42 274 60 336 34" fill="none" stroke="#58e6be" stroke-width="5"/>
  <text x="336" y="108" fill="#a9c1d5" font-family="system-ui,sans-serif" font-size="11" text-anchor="end">TRACE PRESENT AT ZERO</text>
</svg>
`,
  "reduced-motion-control": `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120" role="img" aria-labelledby="title desc">
  <title id="title">Reduced motion source control</title>
  <desc id="desc">A static source selected only by the reduced-motion picture source.</desc>
  <rect width="360" height="120" fill="#11110f"/>
  <rect x="24" y="34" width="312" height="58" rx="4" fill="#ffd166"/>
  <text x="180" y="61" fill="#11110f" font-family="system-ui,sans-serif" font-size="15" font-weight="700" text-anchor="middle">REDUCED MOTION</text>
  <text x="180" y="80" fill="#11110f" font-family="system-ui,sans-serif" font-size="12" text-anchor="middle">STATIC SOURCE SELECTED</text>
</svg>
`,
  "smil-animate-motion": `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120" role="img" aria-labelledby="title desc">
  <title id="title">SMIL animateMotion probe</title>
  <desc id="desc">A readable route with a moving SMIL marker.</desc>
  <rect width="360" height="120" fill="#11110f"/>
  <text x="24" y="25" fill="#edf0e2" font-family="system-ui,sans-serif" font-size="15">SMIL animateMotion</text>
  <path d="M35 84C105 36 244 36 325 84" fill="none" stroke="#58e6be" stroke-opacity=".4" stroke-width="4"/>
  <circle r="8" fill="#ffd166">
    <animateMotion dur="2s" repeatCount="indefinite" path="M35 84C105 36 244 36 325 84"/>
  </circle>
  <text x="180" y="109" fill="#a9c1d5" font-family="system-ui,sans-serif" font-size="11" text-anchor="middle">ROUTE IS PRESENT AT ZERO</text>
</svg>
`,
  "smil-plot": `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120" role="img" aria-labelledby="title desc">
  <title id="title">SMIL plot probe</title>
  <desc id="desc">A pre-drawn trace remains readable while SMIL animates stroke dash offset.</desc>
  <rect width="360" height="120" fill="#11110f"/>
  <text x="24" y="25" fill="#edf0e2" font-family="system-ui,sans-serif" font-size="15">SMIL animate · stroke-dashoffset</text>
  <path d="M24 92L70 76 104 86 142 50 184 69 224 42 274 60 336 34" fill="none" stroke="#58e6be" stroke-opacity=".25" stroke-width="5"/>
  <path d="M24 92L70 76 104 86 142 50 184 69 224 42 274 60 336 34" fill="none" stroke="#58e6be" stroke-width="5" stroke-dasharray="420" stroke-dashoffset="420">
    <animate attributeName="stroke-dashoffset" from="420" to="0" dur="2s" repeatCount="indefinite"/>
  </path>
  <text x="336" y="108" fill="#a9c1d5" font-family="system-ui,sans-serif" font-size="11" text-anchor="end">TRACE PRESENT AT ZERO</text>
</svg>
`,
  "smil-transform": `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120" role="img" aria-labelledby="title desc">
  <title id="title">SMIL transform probe</title>
  <desc id="desc">A readable compass rose with a looping animateTransform arm.</desc>
  <rect width="360" height="120" fill="#11110f"/>
  <text x="24" y="25" fill="#edf0e2" font-family="system-ui,sans-serif" font-size="15">SMIL animateTransform</text>
  <circle cx="180" cy="73" r="34" fill="none" stroke="#7d836f" stroke-width="3"/>
  <path d="M180 38V108M145 73H215" stroke="#7d836f" stroke-width="2"/>
  <g>
    <path d="M180 42L187 77H173Z" fill="#ffd166"/>
    <animateTransform attributeName="transform" type="rotate" from="0 180 73" to="360 180 73" dur="2s" repeatCount="indefinite"/>
  </g>
  <text x="180" y="113" fill="#a9c1d5" font-family="system-ui,sans-serif" font-size="11" text-anchor="middle">COMPASS IS PRESENT AT ZERO</text>
</svg>
`,
} as const;
