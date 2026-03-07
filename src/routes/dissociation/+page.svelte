<script lang="ts">
    import { progress } from "$lib/stores.svelte.js";
    import {
        generateRules,
        generateShapes,
        correctAnswer,
        ruleLabel,
    } from "$lib/games/dissociation.js";
    import { onMount } from "svelte";

    // ── Phase: 'rules' | 'playing' | 'results' ───────────────────────────────
    let phase = $state("rules");
    let rules = $state(generateRules());

    // Playing state
    let shapes = $state([]);
    let idx = $state(0);
    let visible = $state(false);
    let transitioning = $state(false);
    let feedback = $state(null); // null | 'correct' | 'wrong' | 'miss'
    let trials = $state([]);
    let startTime = $state(0);

    let visTimer = null;
    let outTimer = null;

    // ── Derived ───────────────────────────────────────────────────────────────
    let allRuns = $derived(progress.get("dissociation"));
    let lastRun = $derived(allRuns.at(-1) ?? null);
    let bestRun = $derived(
        allRuns.length
            ? allRuns.reduce((b, r) => (r.score > b.score ? r : b))
            : null,
    );
    let isNewPB = $derived(
        allRuns.length > 1 &&
            lastRun &&
            bestRun &&
            lastRun.date === bestRun.date,
    );
    let chartRuns = $derived(allRuns.slice(-8));
    let chartMax = $derived(
        chartRuns.length ? Math.max(...chartRuns.map((r) => r.score), 1) : 1,
    );

    // ── Game flow ─────────────────────────────────────────────────────────────

    function startGame() {
        shapes = generateShapes();
        idx = 0;
        trials = [];
        feedback = null;
        transitioning = false;
        phase = "playing";
        setTimeout(showShape, 400);
    }

    function showShape() {
        feedback = null;
        transitioning = false;
        visible = true;
        startTime = Date.now();

        visTimer = setTimeout(() => {
            visible = false;
            // Auto-miss after another 1.5 s if no response
            outTimer = setTimeout(() => {
                if (!transitioning) respond(null);
            }, 1500);
        }, 500);
    }

    function respond(dir) {
        if (phase !== "playing" || transitioning) return;
        transitioning = true;
        clearTimeout(visTimer);
        clearTimeout(outTimer);
        visible = false;

        const rt = dir !== null ? Date.now() - startTime : null;
        const shape = shapes[idx];
        const correct = dir === correctAnswer(shape, rules);

        feedback = dir === null ? "miss" : correct ? "correct" : "wrong";
        trials = [...trials, { shape, dir, correct, rt }];
        idx++;

        if (idx >= shapes.length) {
            setTimeout(finish, 700);
        } else {
            setTimeout(showShape, 700);
        }
    }

    function finish() {
        const nCorrect = trials.filter((t) => t.correct).length;
        const rts = trials
            .filter((t) => t.correct && t.rt !== null)
            .map((t) => t.rt);
        const avgRt = rts.length
            ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length)
            : null;
        const score = Math.round(
            trials.reduce((sum, t) => {
                if (!t.correct || t.rt === null) return sum;
                return sum + Math.max(0, 1000 - t.rt);
            }, 0),
        );

        progress.add("dissociation", {
            correct: nCorrect,
            total: trials.length,
            accuracy: Math.round((nCorrect / trials.length) * 100),
            avgRt,
            score,
        });

        phase = "results";
    }

    function playAgain() {
        clearTimeout(visTimer);
        clearTimeout(outTimer);
        rules = generateRules();
        feedback = null;
        transitioning = false;
        visible = false;
        phase = "rules";
    }

    // ── Keyboard ──────────────────────────────────────────────────────────────

    function onKeydown(e) {
        if (phase !== "playing") return;
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            respond("left");
        }
        if (e.key === "ArrowRight") {
            e.preventDefault();
            respond("right");
        }
    }

    $effect(() => {
        window.addEventListener("keydown", onKeydown);
        return () => {
            window.removeEventListener("keydown", onKeydown);
            clearTimeout(visTimer);
            clearTimeout(outTimer);
        };
    });
</script>

<!-- ═══════════════════ RULES PHASE ════════════════════════════════════════ -->
{#if phase === "rules"}
    <div class="center-wrap">
        <div class="card rules-card">
            <div class="rules-hero">
                <span class="rules-hero-icon">🔄</span>
                <h2>How to Play</h2>
                <p>
                    You'll see <strong>30 shapes</strong> flash for
                    <strong>0.5 s</strong>
                    each.<br />
                    Use the two rules below to press ← or →.
                </p>
            </div>

            <div class="rule-grid">
                <div class="rule-box empty-box">
                    <div class="rule-box-header">
                        <span class="rule-icon outline-demo"></span>
                        <span>If <strong>EMPTY</strong></span>
                    </div>
                    <div class="rule-choices">
                        <div class="choice">
                            <span class="key-badge">←</span>{ruleLabel(
                                rules.empty,
                                "left",
                            )}
                        </div>
                        <div class="choice-sep">or</div>
                        <div class="choice">
                            <span class="key-badge">→</span>{ruleLabel(
                                rules.empty,
                                "right",
                            )}
                        </div>
                    </div>
                </div>

                <div class="rule-box filled-box">
                    <div class="rule-box-header">
                        <span class="rule-icon filled-demo"></span>
                        <span>If <strong>FILLED</strong></span>
                    </div>
                    <div class="rule-choices">
                        <div class="choice">
                            <span class="key-badge">←</span>{ruleLabel(
                                rules.filled,
                                "left",
                            )}
                        </div>
                        <div class="choice-sep">or</div>
                        <div class="choice">
                            <span class="key-badge">→</span>{ruleLabel(
                                rules.filled,
                                "right",
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div class="tip-bar">
                ⚡ Speed matters — respond as fast as you can!
            </div>

            <button class="btn-primary wide" onclick={startGame}>
                Start — 30 shapes
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M4 2.5l11 6.5L4 15.5V2.5z" fill="currentColor" />
                </svg>
            </button>
        </div>
    </div>

    <!-- ═══════════════════ PLAYING PHASE ══════════════════════════════════════ -->
{:else if phase === "playing"}
    <div class="game-wrap">
        <div class="progress-row">
            <div class="progress-track">
                <div
                    class="progress-fill"
                    style:width="{(idx / shapes.length) * 100}%"
                ></div>
            </div>
            <span class="progress-label">{idx}/{shapes.length}</span>
        </div>

        <div
            class="arena"
            class:arena-correct={feedback === "correct"}
            class:arena-wrong={feedback === "wrong"}
            class:arena-miss={feedback === "miss"}
        >
            {#if visible && idx < shapes.length}
                {@const s = shapes[idx]}
                {@const fill =
                    s.fill === "filled"
                        ? s.color === "blue"
                            ? "#4B7BE8"
                            : "#F97316"
                        : "none"}
                {@const stroke = s.color === "blue" ? "#4B7BE8" : "#F97316"}
                <div class="shape-pop">
                    <svg width="170" height="170" viewBox="0 0 200 200">
                        {#if s.type === "square"}
                            <rect
                                x="38"
                                y="38"
                                width="124"
                                height="124"
                                rx="14"
                                {fill}
                                {stroke}
                                stroke-width={s.fill === "empty" ? 9 : 0}
                            />
                        {:else}
                            <polygon
                                points="100,28 172,172 28,172"
                                {fill}
                                {stroke}
                                stroke-width={s.fill === "empty" ? 9 : 0}
                                stroke-linejoin="round"
                            />
                        {/if}
                    </svg>
                </div>
            {:else if feedback === "correct"}
                <div class="fb-icon correct-icon">✓</div>
            {:else if feedback === "wrong"}
                <div class="fb-icon wrong-icon">✗</div>
            {:else if feedback === "miss"}
                <div class="fb-icon miss-icon">?</div>
            {:else}
                <div class="arena-dot"></div>
            {/if}
        </div>

        <div class="reminder">
            <div class="reminder-row">
                <span class="reminder-badge outline-badge">Empty</span>
                ← {ruleLabel(rules.empty, "left")}
                <span class="sep">·</span>
                → {ruleLabel(rules.empty, "right")}
            </div>
            <div class="reminder-row">
                <span class="reminder-badge filled-badge">Filled</span>
                ← {ruleLabel(rules.filled, "left")}
                <span class="sep">·</span>
                → {ruleLabel(rules.filled, "right")}
            </div>
        </div>

        <div class="resp-row">
            <button class="btn-resp" onclick={() => respond("left")}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path
                        d="M18 11H4M4 11l7-7M4 11l7 7"
                        stroke="currentColor"
                        stroke-width="2.4"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
                Left
            </button>
            <button class="btn-resp" onclick={() => respond("right")}>
                Right
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path
                        d="M4 11h14M18 11l-7-7M18 11l-7 7"
                        stroke="currentColor"
                        stroke-width="2.4"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            </button>
        </div>

        <p class="kb-hint">← → arrow keys also work</p>
    </div>

    <!-- ═══════════════════ RESULTS PHASE ══════════════════════════════════════ -->
{:else if phase === "results" && lastRun}
    <div class="center-wrap">
        <div class="card results-card">
            <div class="res-hero">
                <span class="res-emoji">
                    {lastRun.accuracy >= 90
                        ? "🌟"
                        : lastRun.accuracy >= 70
                          ? "🎯"
                          : "💪"}
                </span>
                <h2>
                    {lastRun.accuracy >= 90
                        ? "Excellent!"
                        : lastRun.accuracy >= 70
                          ? "Good job!"
                          : "Keep going!"}
                </h2>
                <p>{lastRun.correct} of {lastRun.total} correct</p>
            </div>

            <div class="metrics">
                <div class="metric">
                    <span
                        class="metric-val"
                        style:color={lastRun.accuracy >= 80
                            ? "var(--green-dark)"
                            : lastRun.accuracy >= 60
                              ? "var(--yellow)"
                              : "var(--red)"}
                    >
                        {lastRun.accuracy}%
                    </span>
                    <span class="metric-lbl">Accuracy</span>
                </div>
                <div class="metric-div"></div>
                <div class="metric">
                    <span class="metric-val"
                        >{lastRun.avgRt ?? "—"}<small>ms</small></span
                    >
                    <span class="metric-lbl">Avg response</span>
                </div>
                <div class="metric-div"></div>
                <div class="metric">
                    <span class="metric-val" style:color="var(--blue)"
                        >{lastRun.score.toLocaleString()}</span
                    >
                    <span class="metric-lbl">Score</span>
                </div>
            </div>

            {#if allRuns.length > 1}
                <div class="pb-row" class:pb-new={isNewPB}>
                    {#if isNewPB}
                        🏆 New personal best!
                    {:else if bestRun}
                        Best: <strong
                            >{bestRun.score.toLocaleString()} pts</strong
                        >
                        · {bestRun.accuracy}% accuracy
                    {/if}
                </div>
            {/if}

            {#if chartRuns.length >= 2}
                <div class="history">
                    <p class="history-label">Last {chartRuns.length} runs</p>
                    <div class="chart">
                        {#each chartRuns as run, i}
                            <div
                                class="bar-col"
                                title="{run.score} pts — {run.accuracy}%"
                            >
                                <div
                                    class="bar"
                                    class:bar-last={i === chartRuns.length - 1}
                                    style:height="{Math.max(
                                        6,
                                        (run.score / chartMax) * 72,
                                    )}px"
                                ></div>
                                <span class="bar-label">{run.accuracy}%</span>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <div class="res-actions">
                <button class="btn-primary wide" onclick={playAgain}
                    >Play Again</button
                >
                <a href="/" class="btn-secondary wide">Home</a>
            </div>
        </div>
    </div>
{/if}

<style>
    /* ── Layout ───────────────────────────────────────────────────────────── */

    .center-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 65px);
        padding: 40px 20px 80px;
    }

    .card {
        background: var(--surface);
        border-radius: var(--radius-lg);
        border: 1px solid var(--border);
        box-shadow: var(--shadow-md);
        width: 100%;
        max-width: 520px;
    }

    /* ── Rules ───────────────────────────────────────────────────────────── */

    .rules-card {
        padding: 32px 28px 28px;
    }

    .rules-hero {
        text-align: center;
        margin-bottom: 28px;
    }

    .rules-hero-icon {
        font-size: 44px;
        display: block;
        margin-bottom: 12px;
    }

    .rules-hero h2 {
        font-size: 26px;
        font-weight: 900;
        letter-spacing: -0.02em;
        margin-bottom: 10px;
    }

    .rules-hero p {
        font-size: 14.5px;
        color: var(--text-muted);
        line-height: 1.65;
        font-weight: 500;
    }

    .rule-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 18px;
    }

    .rule-box {
        border-radius: var(--radius);
        padding: 16px;
        border: 2px solid transparent;
    }

    .empty-box {
        background: #f0f5ff;
        border-color: #c8d8f8;
    }
    .filled-box {
        background: #fff4ed;
        border-color: #fdd6b5;
    }

    .rule-box-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 12px;
    }

    .rule-icon {
        width: 18px;
        height: 18px;
        display: inline-block;
        border-radius: 3px;
        flex-shrink: 0;
    }

    .outline-demo {
        border: 2.5px solid var(--blue);
    }
    .filled-demo {
        background: var(--orange);
    }

    .rule-choices {
        display: flex;
        flex-direction: column;
        gap: 7px;
    }

    .choice {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
    }

    .choice-sep {
        font-size: 11px;
        color: var(--text-faint);
        text-align: center;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .key-badge {
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: 5px;
        padding: 2px 7px;
        font-size: 13px;
        font-weight: 800;
        flex-shrink: 0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .tip-bar {
        background: #fffbeb;
        border: 1.5px solid #fde68a;
        border-radius: var(--radius-sm);
        padding: 11px 14px;
        font-size: 13.5px;
        font-weight: 600;
        color: #92400e;
        margin-bottom: 20px;
        text-align: center;
    }

    /* ── Playing ─────────────────────────────────────────────────────────── */

    .game-wrap {
        min-height: calc(100vh - 65px);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 28px 20px 48px;
        max-width: 600px;
        margin: 0 auto;
        width: 100%;
    }

    .progress-row {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        margin-bottom: 28px;
    }

    .progress-track {
        flex: 1;
        height: 8px;
        background: var(--bg-subtle);
        border-radius: 99px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: var(--blue);
        border-radius: 99px;
        transition: width 0.35s ease;
    }

    .progress-label {
        font-size: 13px;
        font-weight: 700;
        color: var(--text-muted);
    }

    .arena {
        width: 260px;
        height: 260px;
        border-radius: var(--radius-lg);
        background: var(--surface);
        border: 2px solid var(--border);
        box-shadow: var(--shadow-md);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 24px;
        transition:
            background 0.18s ease,
            border-color 0.18s ease;
        flex-shrink: 0;
    }

    .arena-correct {
        background: var(--green-light);
        border-color: #86efac;
    }
    .arena-wrong {
        background: var(--red-light);
        border-color: #fca5a5;
    }
    .arena-miss {
        background: #fef9c3;
        border-color: #fde047;
    }

    .shape-pop {
        animation: popIn 0.14s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    @keyframes popIn {
        from {
            transform: scale(0.55);
            opacity: 0;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
    }

    .fb-icon {
        font-size: 64px;
        font-weight: 900;
        animation: popIn 0.16s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        line-height: 1;
    }

    .correct-icon {
        color: var(--green-dark);
    }
    .wrong-icon {
        color: var(--red-dark);
    }
    .miss-icon {
        color: #b45309;
    }

    .arena-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--border);
    }

    .reminder {
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin-bottom: 28px;
        background: var(--surface);
        border: 1.5px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 12px 16px;
        width: 100%;
        max-width: 360px;
    }

    .reminder-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        flex-wrap: wrap;
    }

    .reminder-badge {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 3px 8px;
        border-radius: 99px;
        flex-shrink: 0;
    }

    .outline-badge {
        background: var(--blue-light);
        color: var(--blue);
        border: 1.5px solid var(--blue-mid);
    }
    .filled-badge {
        background: var(--orange-light);
        color: var(--orange);
        border: 1.5px solid #fdba74;
    }

    .sep {
        color: var(--text-faint);
    }

    .resp-row {
        display: flex;
        gap: 16px;
        width: 100%;
        max-width: 400px;
    }

    .btn-resp {
        flex: 1;
        padding: 16px 12px;
        border-radius: var(--radius);
        background: var(--blue);
        color: white;
        font-size: 17px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        box-shadow: 0 3px 12px rgba(75, 123, 232, 0.35);
    }

    .btn-resp:hover {
        background: var(--blue-dark);
        transform: translateY(-2px);
        box-shadow: 0 5px 18px rgba(75, 123, 232, 0.45);
    }

    .kb-hint {
        margin-top: 14px;
        font-size: 12px;
        color: var(--text-faint);
        font-weight: 600;
    }

    /* ── Results ─────────────────────────────────────────────────────────── */

    .results-card {
        padding: 32px 28px 28px;
    }

    .res-hero {
        text-align: center;
        margin-bottom: 28px;
    }

    .res-emoji {
        font-size: 52px;
        display: block;
        margin-bottom: 10px;
    }

    .res-hero h2 {
        font-size: 28px;
        font-weight: 900;
        letter-spacing: -0.03em;
        margin-bottom: 6px;
    }

    .res-hero p {
        font-size: 14px;
        color: var(--text-muted);
        font-weight: 600;
    }

    .metrics {
        display: flex;
        align-items: center;
        background: var(--bg);
        border-radius: var(--radius);
        padding: 20px 12px;
        margin-bottom: 16px;
    }

    .metric {
        flex: 1;
        text-align: center;
    }

    .metric-val {
        display: block;
        font-size: 24px;
        font-weight: 900;
        letter-spacing: -0.03em;
        line-height: 1.1;
    }

    .metric-val small {
        font-size: 14px;
        font-weight: 700;
    }

    .metric-lbl {
        display: block;
        font-size: 11px;
        color: var(--text-muted);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-top: 4px;
    }

    .metric-div {
        width: 1px;
        height: 40px;
        background: var(--border);
        flex-shrink: 0;
    }

    .pb-row {
        text-align: center;
        padding: 10px 16px;
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-weight: 700;
        background: var(--bg-subtle);
        color: var(--text-muted);
        margin-bottom: 20px;
    }

    .pb-row.pb-new {
        background: #fef9c3;
        color: #92400e;
        border: 1.5px solid #fde68a;
    }

    .history {
        margin-bottom: 24px;
    }

    .history-label {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        margin-bottom: 10px;
    }

    .chart {
        display: flex;
        align-items: flex-end;
        gap: 6px;
        height: 88px;
        padding: 8px 8px 0;
        background: var(--bg);
        border-radius: var(--radius-sm);
        border: 1px solid var(--border);
    }

    .bar-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        height: 100%;
    }

    .bar {
        width: 100%;
        background: var(--blue-mid);
        border-radius: 4px 4px 0 0;
        min-height: 6px;
    }
    .bar.bar-last {
        background: var(--blue);
    }

    .bar-label {
        font-size: 9.5px;
        font-weight: 700;
        color: var(--text-muted);
    }

    .res-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    /* ── Shared ──────────────────────────────────────────────────────────── */

    .btn-primary {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        padding: 13px 24px;
        border-radius: var(--radius-sm);
        background: var(--blue);
        color: white;
        font-size: 16px;
        font-weight: 800;
        box-shadow: 0 3px 12px rgba(75, 123, 232, 0.3);
        letter-spacing: -0.01em;
    }

    .btn-primary:hover {
        background: var(--blue-dark);
        transform: translateY(-1px);
    }

    .btn-secondary {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 13px 24px;
        border-radius: var(--radius-sm);
        background: var(--bg);
        color: var(--text-muted);
        font-size: 16px;
        font-weight: 700;
        border: 1.5px solid var(--border);
        text-decoration: none;
        transition:
            background 0.12s,
            color 0.12s;
    }

    .btn-secondary:hover {
        background: var(--bg-subtle);
        color: var(--text);
    }

    .wide {
        width: 100%;
    }

    @media (max-width: 480px) {
        .rule-grid {
            grid-template-columns: 1fr;
        }
        .rules-card,
        .results-card {
            padding: 24px 18px 22px;
        }
        .arena {
            width: 220px;
            height: 220px;
        }
    }
</style>
