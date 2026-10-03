
test("scene delivery honors README backend policy for flow and none twins", async () => temporary(async root => {
  const flow = { ...fixture, id: "static-flow-policy", render(model, context) {
    const motion = svg.compileSceneMotion(context, [{
      primitive: "flow", target: "decoration", decorative: true,
      params: { points: [[0, 0], [20, 10], [40, 0]] },
    }], { target: "github-readme" });
    const binding = motion.bindings[0];
    const base = fixture.render.call(this, model, context);
    return base.replace("</svg>", `${motion.style}<g id="${binding.id}" class="${binding.className}" aria-hidden="true"><circle cx="80" cy="80" r="2"/>${binding.children}</g></svg>`);
  } };
  svg.registerScene(flow);
  assert.equal(svg.MOTION_BACKEND_DEFAULTS["github-readme"], "smil");
  for (const motion of ["ambient", "none"]) {
    const result = await staticApi.generateStaticFromSnapshot({ root, snapshot, config: config({
      cards: ["profile"], scenes: [flow.id], motion,
      themes: [{ theme: "paper", outputDir: "assets/commitatlas/light" }],
    }) });
    for (const target of [result, ...result.variants]) {
      const output = await readFile(path.join(target.outputDir, `scene-${flow.id}.svg`), "utf8");
      if (motion === "ambient") assert.match(output, /<animateMotion\b/, "README policy must not discard flow as unsupported CSS");
      else assert.doesNotMatch(output, /<animate|<style/, "none twin remains static");
    }
  }
}));

test("scene delivery accepts its engine byte budget and cleans owned large scenes", async () => temporary(async root => {
  const large = { ...fixture, id: "static-large-budget", render(model, context) {
    return fixture.render.call(this, model, context).replace("</svg>", `${" ".repeat(100 * 1024)}</svg>`);
  } };
  svg.registerScene(large);
  const result = await staticApi.generateStaticFromSnapshot({ root, snapshot, config: config({
    cards: ["profile"], scenes: [large.id],
    themes: [{ theme: "paper", outputDir: "assets/commitatlas/light" }],
  }) });
  for (const target of [result, ...result.variants]) {
    const artifact = target.manifest.artifacts.find(item => item.path === `scene-${large.id}.svg`);
    assert.ok(artifact.bytes > 96 * 1024 && artifact.bytes <= svg.SCENE_MOTION_BUDGET.bytes);
    const body = await readFile(path.join(target.outputDir, artifact.path));
    assert.equal(body.length, artifact.bytes);
    assert.equal(hash(body), artifact.sha256);
  }
  await staticApi.generateStaticFromSnapshot({ root, snapshot, config: config({
    cards: ["profile"], themes: [{ theme: "paper", outputDir: "assets/commitatlas/light" }],
  }) });
  for (const target of [result, ...result.variants]) {
    await assert.rejects(readFile(path.join(target.outputDir, `scene-${large.id}.svg`)), { code: "ENOENT" });
  }
}));

test("scene delivery still refuses over-budget scenes before publishing any theme", async () => temporary(async root => {
  const oversized = { ...fixture, id: "static-excessive-budget", render(model, context) {
    return fixture.render.call(this, model, context).replace("</svg>", `${" ".repeat(svg.SCENE_MOTION_BUDGET.bytes)}</svg>`);
  } };
  svg.registerScene(oversized);
  await assert.rejects(staticApi.generateStaticFromSnapshot({ root, snapshot, config: config({
    cards: ["profile"], scenes: [oversized.id],
  }) }), /budget/i);
  assert.deepEqual(await readdir(root), []);
}));
