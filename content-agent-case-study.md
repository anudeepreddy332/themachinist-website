# Content-Agent: Building an AI System That Researches, Fact-Checks, and Publishes Technical Articles

*A production LangGraph case study in grounding, evaluation, and human-in-the-loop publishing.*

*Agentic AI · The Machinist*

Type in a topic, press Enter, and watch an article get researched, drafted, fact-checked against real sources, scored, reviewed by a human at two separate gates, rendered into site-ready HTML, and published live. The whole run costs less than a cent and finishes in minutes. Nothing reaches the website that a person did not read first, and nothing gets pushed to production without a human running the final command.

---

## TL;DR

**Content-agent is a single-agent LangGraph pipeline that writes grounded technical articles for themachinist.org.** It retrieves sources, drafts only what those sources support, verifies every claim, scores itself, pauses for a human to approve the content, renders HTML, pauses again for a human to approve the layout, and merges the result through git. It runs as an authenticated FastAPI service inside a non-root Docker container, deployed on EC2 behind Caddy with automatic TLS. The hard part was never the plumbing. It was getting the agent to stop making things up, and proving that it had.

---

## The Problem: An Agent That Writes Confident Fiction

Ask any large language model to write a technical article and it will give you something that reads well. That is exactly the danger. It reads well whether or not the facts are real.

A model writing about, say, multi-agent systems will happily state a specific benchmark number, attribute a result to a paper, or describe an algorithm's failure mode in precise detail. Some of that is true. Some of it is invented. The fluent sentences look identical either way. For a personal blog that publishes under my own name, that is not acceptable. A single fabricated claim, confidently worded, is worse than no article at all.

So the goal was never "generate articles." Generating articles is easy and mostly useless. The goal was: **generate articles where every substantive claim can be traced back to a real source, and prove it with measurement, not vibes.**

That turned out to be a much deeper problem than I expected, and chasing it down is the real story of this project.

---

## Where This Came From: Three Earlier Agents

Content-agent builds on three earlier agents. Each one taught a lesson the next needed.

**The CLI agent.** A basic query-response loop. The lesson: a raw loop with control flow buried in conditionals cannot pursue a goal across steps, and gives you no way to see what it is doing mid-run.

**The RAG knowledge agent.** This added retrieval over a private knowledge base. The lesson: retrieval quality is a first-class concern. A retriever that looks fine on easy questions can quietly fail on the hard ones, and you only find out if you measure recall against a real test set.

**The code-fix agent.** A goal-directed LangGraph state machine that executes a broken script, diagnoses the failure, patches it, and retries, with a human approval step. It fixed 95% of a 20-script test set. The lesson that mattered most: **exit code zero is not correctness.** Code can run cleanly and still be wrong. You need a separate evaluator whose only job is to judge whether the result is actually right.

Content-agent inherited all three. It needed goal-directed control flow (from the code-fix agent), retrieval that was provably healthy (from the knowledge agent), and above all a verifier that judged correctness rather than trusting that fluent output meant true output (the code-fix lesson, applied to facts instead of code).

---

## What Content-Agent Does

The agent takes a topic and an editorial intent. It produces a publish-ready HTML article for themachinist.org, optionally merged into the website's git repository. Between those two points, it runs seven nodes in a fixed graph, pausing twice for a human.

Think of it like a newsroom with a strict fact-checking desk. A writer drafts the piece, but before anything prints, a checker goes through every factual claim and marks which ones are actually supported by the reporting. An editor reads the draft and signs off on the content. A layout person sets the page. The editor signs off again on how it looks. Only then does it go to the press, and even then, a person has to physically start the press. The agent automates the writer, the checker, and the layout person. The two editor sign-offs and the press start stay human, on purpose.

---

## Architecture: The Pipeline

The whole system is a directed graph. Each node is a function that reads the shared state and returns an update to it. Each edge is a transition, some unconditional, some routed by a decision function.

```
retrieve -> draft -> verify -> reflect -> [route: draft | hitl]
  -> hitl  (GATE 1, CONTENT) -> [approve -> html_gen | feedback -> draft | reject -> END]
  -> html_gen -> hitl_html  (GATE 2, LAYOUT, content frozen)
       -> [approve -> git | request_changes -> html_revise -> hitl_html | reject -> END]
  -> git -> END
```

Here is what each stage does.

**retrieve.** Runs first. It searches the web through Tavily across three fixed query angles, deduplicates by URL, and queries a Qdrant knowledge base of evergreen ML concepts. If the first web pass comes back thin or low-scoring, it re-runs with a forced cache refresh. Retrieval freshness turned out to be the single largest lever on grounding quality, so this gate matters.

**draft.** Generates a four-section article (problem framing, technical deep-dive, code, takeaways) with DeepSeek. The key design choice: the draft reads the retrieved sources and is instructed to assert specific claims only where a source supports them, and to generalize otherwise. This is "cite or generalize," the heart of the grounding fix described below.

**verify.** Extracts every factual claim and scores it against the retrieved sources as verified, weak, or unverified, with a confidence. This is the fact-checking desk: a separate LLM call with its own prompt, isolated from the draft so the writer cannot grade its own homework.

**reflect.** The agent scores its own draft from 1 to 10 on structure, depth, grounding, and clarity. Advisory only. Language models inflate their own grades, so reflection never gets to be the hard gate.

**route after reflect.** Force a rewrite if grounding is below a hard floor of 0.60, or if the reflection score is below 7 and grounding is below 0.75. Otherwise move to the human. Stop revising once iterations hit the ceiling of 2 or the cost gate trips.

**hitl (Gate 1, content).** The first human gate. A reviewer sees the full draft, a claim-by-claim grounding table, the reflection score, and any warnings, then approves, sends feedback (which routes back to draft), or rejects. Once approved, the content is frozen.

**html_gen.** Renders the approved content into themachinist.org-compliant HTML. Three of the four sections render deterministically in Python; only the technical deep-dive goes through an LLM. The output is validated for required structure before moving on.

**hitl_html (Gate 2, layout).** The second human gate, reviewing only how the page looks. Content is frozen here. Change requests go to a single temperature-zero pass, and a word-multiset guard discards any revision that changes more than two visible words, so a layout edit can never silently alter the text.

**git.** Writes the HTML into the website repository on a feature branch, diffs against main, tags before merging when an existing article changes, and merges locally with no fast-forward. It never pushes. More on that below, because it is the most important safety property in the project.

### The Stack

| Layer | Choice | Why |
|---|---|---|
| Orchestration | LangGraph (single agent) | Explicit state machine, every transition named and inspectable |
| Generation | DeepSeek API | Strong, cheap; 120s timeout with tenacity retries, SDK retries disabled so they do not stack |
| Web retrieval | Tavily | 7-day cache with a score-gated freshness refresh |
| Knowledge base | Qdrant + BM25 + RRF over all-MiniLM-L6-v2 | Dense plus keyword, fused by reciprocal rank fusion |
| Service | FastAPI + SqliteSaver | Durable, resumable human-in-the-loop behind bearer auth |
| Publish | GitPython, Netlify | Local merge, human push, static deploy |
| Container | Docker, non-root | uid 10001, embedding model baked at build time |
| Edge | Caddy + sslip.io | Automatic TLS without manual certs or a purchased domain |
| Registry | Docker Hub | Build once on a fast machine, pull on the small VM |
| Tracing | LangSmith | Cross-node traces with per-call token usage and cost |

### Why ChromaDB Became Qdrant

The knowledge base did not start on Qdrant. The first version used ChromaDB, which is a fine choice for a notebook prototype. It stopped being the right choice once the project needed to run benchmarks and behave like production infrastructure.

ChromaDB showed problems with concurrent writes under benchmark loads, which is exactly the situation where a retrieval backend has to stay reliable. Qdrant fixed that and brought three things that mattered for where this project was going: payload filtering, so retrieval can be constrained by metadata rather than vector similarity alone; a clean fit with a Docker-based production setup, running as its own network-isolated service instead of an embedded library; and a scroll API that handles larger collections without loading everything into memory at once.

The migration was not taken on faith. I re-ran the retrieval evaluation against the same 35-query adversarial golden set after switching backends and confirmed that recall at 3 held at 1.0. The backend changed underneath; the retrieval quality did not move. After the migration, ChromaDB was removed entirely, since nothing imported it anymore.

---

## The Grounding Investigation

This is the part I am proudest of, because it is where the project stopped being a build and became an investigation. The first working version produced articles that read beautifully and were full of claims I could not verify. The obvious move would have been to tweak prompts until the output looked better. Instead I treated it as a measurement problem and ran experiments.

### First, exonerate the verifier

Before blaming the writer, I had to rule out the checker. Maybe grounding looked low because the verifier was too strict and marking true claims as unverified. So I built a golden fixture: twelve fixed claims, hand-labeled, covering verbatim matches, paraphrases, absent claims, and outright false ones, each crossed with substantive versus generic. The verifier scored these against a known source.

It got 8 out of 8 on the ground-truth set, including paraphrased-but-correct claims, with high confidence. The verifier was not the problem. I also checked retrieval the same way, with a 35-query adversarial set spanning easy, medium, hard, multi-hop, and out-of-scope questions. Recall at 3 was 1.0. The knowledge base was not the problem either.

With both the checker and the retriever cleared, the cause had to be the writer.

### The trap: optimizing the wrong number

The naive metric for grounding is the unverified rate (UVR): what fraction of claims could not be verified. Lower is better. So why not just minimize it?

Because minimizing UVR rewards vagueness. The cheapest way to drive unverified claims to zero is to stop making specific claims at all. An article that says "neural networks can be effective in some situations" has a wonderful UVR and is worth nothing. I caught this early and **voided UVR-alone as an objective.**

What replaced it is SV, substantive verified claims: a count of specific, technically meaningful claims that actually checked out against sources. SV is the primary quality metric. UVR is kept only as a guardrail (it must stay at or below 0.15), and any change that improves UVR by going vague triggers a mandatory co-condition: SV must not drop. You cannot win by saying less. You can only win by saying more true things.

### Source-aware drafting

The root cause turned out to be over-claiming by substitution. The original draft node ran before retrieval and never saw the sources. So it wrote from the model's memory, producing confident specifics that no retrieved source backed up. When I made drafting source-aware (retrieve first, then draft, with an explicit instruction to cite or generalize), the worst offender, a multi-agent-systems topic, went from a UVR of 0.63 to 0.22 with its SV up 253%. The draft was finally writing about what it had actually found, not what it vaguely remembered.

### Killing the blind re-roll

The original revision loop, when grounding was bad, simply threw the draft away and generated a fresh one from scratch, hoping for better luck. I tested this against a smarter loop that fed the previous draft's unverified claims back in with instructions to ground them, generalize them, or cut them.

The blind re-roll was not just weaker. It was actively worse than doing nothing. On healthy topics it made grounding regress: one topic went from 0.170 to 0.270 unverified, another from 0.275 to 0.341. Rolling the dice again on a draft that was already fine just gave the model another chance to over-claim. The blind re-roll was removed. Revision now always carries forward a specific, claim-level grounding report.

### Why the iteration ceiling stays at 2

Later I tested raising the maximum revision count above 2 to chase higher grounding. It failed for a clean reason: a higher ceiling cannot help drafts that never trigger a revision in the first place, and on the drafts that do revise, the extra passes traded SV for vagueness. They lowered the unverified rate by making claims blander, which is exactly the failure mode SV exists to catch. The ceiling stays at 2.

> The thread running through all of this: it is easy to make an automated writer look more grounded by making it say less. The entire metric design exists to make that cheat impossible, so the only way to score better is to actually be better.

---

## Three Bugs That Taught Me Something

Every one of these passed at least one test before I caught it. That is the lesson in all three: a green checkmark is evidence, not proof.

### The chained-assignment telemetry bug

The pipeline records latency per node. For a long time, the knowledge-base retrieval latency looked alarming, and I nearly went hunting for a Qdrant performance problem. Two things were wrong. First, a chained assignment in the telemetry code recorded the web latency under the knowledge-base field, so the number was not even measuring what its name claimed. Second, the one genuinely slow reading came from a diagnostic probe that loaded the embedding model a second time into a local variable, while the real singleton stayed cold. The "slow Qdrant" was a model load in disguise.

Warm queries were actually 29 to 33 milliseconds. Qdrant was fine the whole time. **The lesson: a telemetry field can be broken at birth, and a measurement bug will happily masquerade as a system bug until you check that the number measures what its label says.** I added a warmup step so steady-state latency is what gets recorded, and a telemetry check that asserts field correctness, not just field presence.

### The rm -f that deleted articles

The rollback script was supposed to undo a publish. An early version ended with a manual `rm -f` of the article file. It passed its first test, so I trusted it.

It was wrong. There are two kinds of rollback: undoing a brand-new article (where deleting the file is correct) and undoing an edit to an existing article (where the correct outcome is restoring the previous version, and the file must stay). The `rm -f` deleted the file in both cases. On a modification rollback it destroyed content that should have been restored. The reason it "passed once" was a coincidence in the test article that happened to make the wrong behavior look right.

I rebuilt the script from git's actual revert semantics: revert the publish merge commit, which restores the prior version content-for-content, and never manually delete anything. **The lesson: a rollback that silently deletes an edited article is worse than no rollback at all, and correctness has to be derived from how the tool actually works, not from one run that happened to look fine.**

### The filename suffix that broke republishing

To avoid clobbering local debug copies, the HTML generator gave each run's archived file a unique suffix. That suffix leaked into the filename that the git node writes into the website repository. The effect was subtle and bad: every republish of the same topic produced a new filename, so git always saw a brand-new file, the "changed file" code path that tags before merging was never reachable, and the public URL of an article changed every single time it was updated.

The fix was to make the published filename always the canonical slug, and let the local archive keep its own unique name where it belongs. **The lesson: a local convenience leaking into production semantics is its own bug class.** A name that only mattered for avoiding a debug-file collision had quietly taken over the publishing logic.

---

## The Freeze Sprint: Making It Production-Grade

Once the grounding work was locked, I gave myself a hard deadline to turn a working pipeline into a deployed, hardened system. This was a sequence of milestones, each with an explicit exit gate.

- **Input sanitization.** The topic becomes a slug, which becomes a filename and a git branch and tag name. That path has to be safe under any automated entry point. Slug generation is allowlist-based by construction, with tests for path traversal, git-ref injection, and a null-byte fuzz case.
- **Failure-injection tests.** Five real fault modes: DeepSeek auth failure (must propagate, never get swallowed), DeepSeek timeout and rate limit (exactly three retry attempts, then reraise), Tavily empty or erroring, Qdrant down, and malformed model JSON. Each path is exercised and asserted, so the system degrades instead of crashing.
- **CI gates.** Two tiers. A free per-push tier runs fatal-tier lint and the full mocked suite at zero API cost. A secret-gated tier runs the real grounding gates: the golden verifier fixture with an enforced threshold, and a benchmark that fails the build if any run's unverified rate exceeds 0.15.
- **Durable human-in-the-loop.** The centerpiece. The graph is compiled with a SqliteSaver checkpointer, so a paused human gate persists the entire run state to disk. A reviewer can return later, even after the process restarts, and resume from exactly where it paused, through approve, reject, and feedback endpoints behind bearer auth.
- **Containerization.** A non-root image (uid 10001) with the embedding model baked in at build time so the first run is fast. A production compose file runs the app alongside a network-isolated Qdrant that has no host port and is reachable only inside the compose network. Secrets are injected at runtime, never baked in.
- **Publish validation and rollback.** The git automation was validated against a fork, never production, exercising both the new-article and changed-article paths, the rollback script, and one supervised real publish.

---

## Post-Freeze: The Live Demo and the Second Gate

After the freeze, three pieces of work turned a command-line tool into something you can actually watch run in a browser.

**The second HITL gate.** The original pipeline had one human gate, for content. I split review into two: content first, then layout, with content frozen at the second gate. The layout gate routes change requests to a single temperature-zero revision pass that can only touch markup. The content-freeze guard mechanically discards any "layout" edit that drifts the text by more than two words. This means a reviewer can fix how an article looks with zero risk of changing what it says.

**The index auto-update.** Every successful publish patches a card into the website's homepage learning log, in place on republish, and excluded from the diff that decides the tag-versus-no-tag publish path so the distinction still holds.

**The interactive front-end.** A self-contained single-page app, vanilla JavaScript with server-sent events, served by the same FastAPI app. You enter a topic and watch each node complete in real time. Both human gates appear inline: the content gate shows the draft and the grounding table, the layout gate shows the rendered HTML in a frame. A publish button does the final go-live. Critically, this streaming surface was added without touching the existing pipeline. The graph runs exactly as before. The UI is a new way to observe it, not a new way to run it.

---

## Validation and Quality Gates

Nothing here is self-reported. Every quality claim has an enforcing check behind it.

- **Golden verifier fixture.** Twelve hand-labeled claims. The check exits with a failure code if grounding accuracy drops below 11 of 12 or specificity below 10 of 12. This is the cheap, fast regression guard, and it runs automatically on every pull request.
- **Benchmark gate.** Runs 20 topics through the real pipeline and fails outright if any run errors or any run's unverified rate exceeds 0.15. This is the comprehensive guard, run on demand because it spends real money.
- **Telemetry correctness check.** Asserts that every required field is present and internally consistent: attribution counts sum to the claim count, every claim has a source kind, every knowledge-base result carries its chunk index. Reconstructability is a contract, not a hope.
- **Failure-injection suite.** The five fault modes above, all mocked, all at zero cost, all asserting the exact degradation behavior.
- **Fork-based publish validation.** The git automation is only ever tested against a fork of the website. Production is never the test environment.

The full test suite is 62 tests, runs at zero API cost because everything external is mocked, and finishes in under ten seconds.

---

## The Publish-Safety Posture

This deserves its own section, because it is the single design decision I am most deliberate about.

**The git node does a local merge only. It never pushes.** There is no code path inside it that calls `git push`. I have grepped for it specifically. The agent can research, draft, verify, render, and merge a finished article into a local branch, and then it stops. Going live, the actual push to the remote that triggers the public deploy, is a separate command that a human runs.

When I added a cloud publish button to the demo, this property had to survive. It did, because the button is a separate, explicitly human-triggered endpoint that only succeeds after both human gates have already passed and the git node has already done its local merge. The push lives in its own place, gated behind everything else. Adding a go-live button extended what the system can do without weakening the rule that a person, not the agent, decides when something goes public.

This is not a limitation I am working around. It is the safeguard, and it is intentional. An automated writer that can publish to the open internet on its own is exactly the thing I do not want to build.

---

## Observability and Monitoring

Every run is reconstructable after the fact.

- **Structured logs.** Every node logs JSON to stdout through a shared logger, tagged with the run ID. In a container, stdout is the log sink.
- **Per-run telemetry.** Each run writes a JSON record with the full grounding report, the retrieved sources, per-iteration metrics (so a two-pass revision is fully reconstructable, not just its final draft), claim attribution, cost, tokens, per-node latency, and any non-fatal errors.
- **Prompt-hash versioning.** Every prompt file is content-hashed at startup, and the hash is stamped into every telemetry record. This matters more than it sounds: changing a prompt silently re-baselines every quality metric, because grounding numbers are only comparable across runs that used the same verifier prompt. The hash makes that comparability visible and impossible to forget.
- **Claim-level attribution.** Every verified claim is resolved back against the actual retrieved set and tagged as web, knowledge-base, or neither. A claim the verifier cited that does not resolve to anything retrieved is a hallucinated-citation signal, surfaced rather than hidden.
- **LangSmith tracing.** When credentials are present, the DeepSeek client is wrapped so every model call becomes a traced run with token usage and real per-call cost attached. This gives cross-node trace visualization and a latency breakdown that the stdout logs alone do not.

What is deliberately not built: automated alerting and dashboards. Uptime is a manual check, a free HTTP monitor pointed at the health endpoint, set up by hand and documented in the runbook. For a single-operator system that is watched while it runs, that is an honest scope choice, not an oversight. It is written down as exactly that.

---

## Current State

The system is live. The demo runs on an EC2 instance behind Caddy, which handles TLS automatically, with the public URL provided by sslip.io so no real domain is needed. The app container has no public port of its own; Caddy is the only thing facing the internet.

The build strategy was not the first plan. Building the image directly on the EC2 box failed: the instance ran out of disk space partway through, because the image bakes in PyTorch and the embedding model, and those layers are large. The fix was to move the heavy work off the box. Build the ARM image once on a local machine, push it to Docker Hub, and have EC2 only ever pull the finished image. That solved the disk problem outright and made deployments faster and more repeatable, because the slow model-baking step happens once on capable hardware instead of on every deploy.

A full run, end to end, costs a fraction of a cent. The live rehearsal that took an article from topic to published, through both gates, retrieved 10 web sources, scored 0.773 grounding across 28 claims, and cost $0.0066.

### Known Limitations

I keep these first-class, written down rather than discovered later.

| Limitation | What it means | Status |
|---|---|---|
| Registry not rehydrated on restart | A paused run's HTTP-visible state is lost if the process restarts, though the underlying checkpoint survives on disk. Drain reviews before restarting. | Accepted, post-freeze fix scoped |
| Tag-based rollback window | The tag-based rollback keeps the newest five publish tags. The revert-based rollback does not depend on tags and is unbounded. | Accepted |
| Local merge, human push | The agent never pushes. Every live publish needs a human command. | Intentional safeguard, not a gap |
| Single-worker throughput | One run computes at a time. Fine for one-article-at-a-time editorial use. | Accepted for current scope |

These are also exactly the things that would need to change for a multi-tenant, always-on version: per-tenant identity instead of one shared token, rate limiting and spend caps, horizontal scale instead of a single worker on a single box, and automated alerting. None of them block a supervised single-operator demo. All of them would be required before letting strangers run it unattended. Knowing precisely which is which is part of the point.

---

## What I Learned

**Fluency is not truth, and the gap between them is invisible.** The entire project exists because a well-written false claim looks identical to a well-written true one. You cannot eyeball your way out of this. You need a separate verifier and a metric that cannot be gamed.

**Pick a metric that cannot be cheated, then try to cheat it.** Unverified-rate looked like the obvious grounding metric and was actively harmful, because the easy way to improve it was to say nothing specific. Designing SV as a substantive-claim count with a no-vagueness co-condition took longer than any prompt change and mattered far more.

**A passing test is evidence, not proof.** All three of the bugs that taught me the most had passed a check before I caught them. The rollback script deleted articles after passing its first run. The telemetry recorded the wrong number under the right label. Re-deriving correctness from how a thing actually works, rather than trusting one green result, is the habit that separates a demo from a system.

**Keep the human where the stakes are.** Two gates and a human-only push are not friction to be optimized away. They are the design. The agent does the labor; a person owns the decision to publish.

**Disclose your limits.** The fastest way to lose trust in a system is to hide what it cannot do. Every limitation here is written down, scoped, and labeled as either an accepted trade-off or a deliberate safeguard.

---

## Bottom Line

Most "AI writes articles" demos stop at fluent output. This one starts there and spends all of its effort on the question that actually matters: is any of it true, and can you prove it?

The answer is a pipeline where every substantive claim is checked against a real source, where the quality metric is built so that the only way to score higher is to be more correct rather than more vague, where two humans review the work and a third action (the push) is reserved for a person, and where every run leaves behind enough telemetry to reconstruct exactly what happened. It is deployed, authenticated, containerized, and live, with its limits written down honestly rather than hidden.

It proves something specific: that an LLM system can be made trustworthy not by hoping the model behaves, but by measuring whether it did, and by keeping a human at every point where the stakes are real.

---

View the code on GitHub: https://github.com/anudeepreddy332/content-agent
