<script lang="ts">
    import { progress } from "$lib/stores.svelte.js";
    import {
        generateRules,
        generateShapes,
        correctAnswer,
        groupLabel,
        subRuleLabel,
        type Rules,
        type Shape,
        type Trial,
        type Direction,
    } from "$lib/games/dissociation.js";
    import { ArrowLeft, ArrowRight } from "@lucide/svelte";
    import { onMount } from "svelte";

    import squareEmptyBlue from "$lib/assets/shapes/blue_empty_square.svg";
    import squareEmptyOrange from "$lib/assets/shapes/orange_empty_square.svg";
    import squareFilledBlue from "$lib/assets/shapes/blue_filled_square.svg";
    import squareFilledOrange from "$lib/assets/shapes/orange_filled_square.svg";
    import triangleEmptyBlue from "$lib/assets/shapes/blue_empty_triangle.svg";
    import triangleEmptyOrange from "$lib/assets/shapes/orange_empty_triangle.svg";
    import triangleFilledBlue from "$lib/assets/shapes/blue_filled_triangle.svg";
    import triangleFilledOrange from "$lib/assets/shapes/orange_filled_triangle.svg";

    import iconCorrect from "$lib/assets/icons/true.svg";
    import iconWrong from "$lib/assets/icons/false.svg";
    import iconMiss from "$lib/assets/icons/late.svg";

    const shapeAssets: Record<string, string> = {
        "square-empty-blue": squareEmptyBlue,
        "square-empty-orange": squareEmptyOrange,
        "square-filled-blue": squareFilledBlue,
        "square-filled-orange": squareFilledOrange,
        "triangle-empty-blue": triangleEmptyBlue,
        "triangle-empty-orange": triangleEmptyOrange,
        "triangle-filled-blue": triangleFilledBlue,
        "triangle-filled-orange": triangleFilledOrange,
    };

    function shapeUrl(s: Shape): string {
        return shapeAssets[`${s.type}-${s.fill}-${s.color}`];
    }

    // ── Phase ─────────────────────────────────────────────────────────────────
    let phase = $state<"rules" | "playing" | "results">("rules");
    // Initialised in onMount — Math.random() on server != client, would cause flash
    let rules = $state<Rules | null>(null);
    onMount(() => {
        rules = generateRules();
    });

    // ── Playing state ─────────────────────────────────────────────────────────
    let shapes = $state<Shape[]>([]);
    let idx = $state(0);
    let visible = $state(false);
    let transitioning = $state(false);
    let feedback = $state<"correct" | "wrong" | "miss" | null>(null);
    let trials = $state<Trial[]>([]);
    let startTime = $state(0);
    let visTimer: ReturnType<typeof setTimeout> | null = null;
    let outTimer: ReturnType<typeof setTimeout> | null = null;

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
            outTimer = setTimeout(() => {
                if (!transitioning) respond(null);
            }, 1500);
        }, 500);
    }

    function respond(dir: Direction | null) {
        if (phase !== "playing" || transitioning) return;
        transitioning = true;
        clearTimeout(visTimer!);
        clearTimeout(outTimer!);
        visible = false;
        const rt = dir !== null ? Date.now() - startTime : null;
        const shape = shapes[idx];
        const correct = dir === correctAnswer(shape, rules!);
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
            .map((t) => t.rt as number);
        const avgRt = rts.length
            ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length)
            : null;
        // 300 base pts for every correct answer + up to 700 speed pts.
        // Correct at 0ms → 1000pts. Correct at 1000ms+ → 300pts (accuracy still rewarded).
        const score = Math.round(
            trials.reduce((sum, t) => {
                if (!t.correct || t.rt === null) return sum;
                return (
                    sum + 300 + Math.max(0, Math.round(700 * (1 - t.rt / 1000)))
                );
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
        clearTimeout(visTimer!);
        clearTimeout(outTimer!);
        rules = generateRules();
        feedback = null;
        transitioning = false;
        visible = false;
        phase = "rules";
    }

    // ── Keyboard ──────────────────────────────────────────────────────────────
    function onKeydown(e: KeyboardEvent) {
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
            clearTimeout(visTimer!);
            clearTimeout(outTimer!);
        };
    });
</script>

<!-- ═══ RULES ════════════════════════════════════════════════════════════════ -->
{#if phase === "rules"}
    <div id="instructions">
        <div class="shapes">
            <img src={triangleFilledOrange} />
            <img src={squareEmptyBlue} />
            <img src={squareFilledOrange} />
            <img src={triangleEmptyBlue} />
        </div>
        <div class="instruction-card">
            {#if !rules}<div style="min-height:300px"></div>{:else}
                <div class="header">
                    <h2>How to play</h2>
                    <p>
                        See <strong>30 shapes</strong> for
                        <strong>0.5 s</strong> each. Press left or right based on
                        the following two rules.
                    </p>
                </div>

                <div class="rule-grid">
                    {#each ["A", "B"] as const as group}
                        {@const rule =
                            group === "A" ? rules.groupA : rules.groupB}
                        <div class="rule-box flex-col gap-medium">
                            <strong>{groupLabel(rules!, group)}</strong>
                            <div class="flex-col gap-small">
                                <div
                                    class="flex-row align-items:center gap-small"
                                >
                                    <span class="key-badge">←</span>
                                    <span>{subRuleLabel(rule, "left")}</span>
                                </div>
                                <div
                                    class="flex-row align-items:center gap-small"
                                >
                                    <span class="key-badge">→</span>
                                    <span>{subRuleLabel(rule, "right")}</span>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <p
                    class="secondary outlined rounded padded"
                    style="text-align:center; font-size:0.9rem;"
                >
                    Faster correct answers score more points!
                </p>

                <button class="primary rounded padded wide" onclick={startGame}>
                    Start
                </button>
            {/if}
        </div>
    </div>

    <!-- ═══ PLAYING ══════════════════════════════════════════════════════════════ -->
{:else if phase === "playing"}
    <div id="game" class="game-wrap flex-col align-items:center gap-medium">
        <div class="flex-row align-items:center gap-medium" style="width:100%">
            <div class="progress-track">
                <div
                    class="progress-fill"
                    style:width="{(idx / shapes.length) * 100}%"
                ></div>
            </div>
            <span
                style="font-size:13px; white-space:nowrap; font-variant-numeric:tabular-nums"
            >
                {idx}/{shapes.length}
            </span>
        </div>

        <div
            class="arena"
            class:arena-correct={feedback === "correct"}
            class:arena-wrong={feedback === "wrong"}
            class:arena-miss={feedback === "miss"}
        >
            {#if visible && idx < shapes.length}
                {@const s = shapes[idx]}
                <div class="shape-pop">
                    <img
                        src={shapeUrl(s)}
                        alt="{s.fill} {s.color} {s.type}"
                        width="140"
                        height="140"
                    />
                </div>
            {:else if feedback === "correct"}
                <img src={iconCorrect} alt="Correct" class="fb-icon" />
            {:else if feedback === "wrong"}
                <img src={iconWrong} alt="Wrong" class="fb-icon" />
            {:else if feedback === "miss"}
                <img src={iconMiss} alt="Miss" class="fb-icon" />
            {:else}
                <span class="arena-dot"></span>
            {/if}
        </div>

        <div class="actions">
            <div class="buttons">
                <button class="primary rounded" onclick={() => respond("left")}>
                    <ArrowLeft size={20} /> Left
                </button>
                <button
                    class="primary rounded"
                    onclick={() => respond("right")}
                >
                    Right <ArrowRight size={20} />
                </button>
            </div>

            <div class="reminder flex-col gap-small">
                {#each ["A", "B"] as const as group}
                    {@const rule =
                        group === "A" ? rules!.groupA : rules!.groupB}
                    <div
                        class="flex-row align-items:center gap-small"
                        style="font-size:13px"
                    >
                        <strong style="min-width:88px"
                            >{groupLabel(rules!, group)}</strong
                        >
                        <span>← {subRuleLabel(rule, "left")}</span>
                        <span style="color:#bbb">·</span>
                        <span>→ {subRuleLabel(rule, "right")}</span>
                    </div>
                {/each}
            </div>
        </div>
    </div>

    <!-- ═══ RESULTS ══════════════════════════════════════════════════════════════ -->
{:else if phase === "results" && lastRun}
    <div class="center-wrap">
        <div class="flex-col gap-large" style="max-width:460px; width:100%">
            <div class="flex-col align-items:center gap-small">
                <span style="font-size:48px; line-height:1">
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
                <p style="color:#888">
                    {lastRun.correct} of {lastRun.total} correct
                </p>
            </div>

            <div
                class="metrics flex-row"
                style="border:1px solid #ddd; border-radius:var(--radius-sm); overflow:hidden"
            >
                <div class="metric flex-col align-items:center gap-small">
                    <strong
                        style:color={lastRun.accuracy >= 80
                            ? "var(--green-dark)"
                            : lastRun.accuracy >= 60
                              ? "var(--yellow)"
                              : "var(--red)"}
                    >
                        {lastRun.accuracy}%
                    </strong>
                    <span class="metric-lbl">Accuracy</span>
                </div>
                <div style="width:1px; background:#ddd; flex-shrink:0"></div>
                <div class="metric flex-col align-items:center gap-small">
                    <strong>{lastRun.avgRt ?? "—"}<small>ms</small></strong>
                    <span class="metric-lbl">Avg response</span>
                </div>
                <div style="width:1px; background:#ddd; flex-shrink:0"></div>
                <div class="metric flex-col align-items:center gap-small">
                    <strong style="color:var(--blue)"
                        >{lastRun.score.toLocaleString()}</strong
                    >
                    <span class="metric-lbl">Score</span>
                </div>
            </div>

            {#if allRuns.length > 1}
                <p
                    class="secondary outlined rounded padded"
                    style="text-align:center"
                >
                    {#if isNewPB}
                        🏆 New personal best!
                    {:else if bestRun}
                        Best: <strong
                            >{bestRun.score.toLocaleString()} pts</strong
                        >
                        · {bestRun.accuracy}%
                    {/if}
                </p>
            {/if}

            {#if chartRuns.length >= 2}
                <div class="flex-col gap-small">
                    <span class="chart-label">Last {chartRuns.length} runs</span
                    >
                    <div class="chart">
                        {#each chartRuns as run, i}
                            <div
                                class="bar-col flex-col align-items:center"
                                title="{run.score} pts — {run.accuracy}%"
                            >
                                <div
                                    class="bar"
                                    class:bar-last={i === chartRuns.length - 1}
                                    style:height="{Math.max(
                                        4,
                                        (run.score / chartMax) * 56,
                                    )}px"
                                ></div>
                                <span style="font-size:9px; color:#aaa"
                                    >{run.accuracy}%</span
                                >
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <div class="flex-col gap-small">
                <button class="primary rounded padded wide" onclick={playAgain}
                    >Play Again</button
                >
                <a href="/" class="btn-secondary rounded padded wide">Home</a>
            </div>
        </div>
    </div>
{/if}

<style lang="scss">
    #instructions {
        background-color: var(--off);
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 57px);
        padding: 24px 16px 60px;

        .shapes {
            position: absolute;
            top: 0rem;
            height: 50%;

            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 0.4rem;
            width: 100%;

            img {
                width: 6rem;
                height: 6rem;
            }
        }

        .instruction-card {
            position: absolute;
            bottom: 0;

            display: flex;
            flex-direction: column;
            gap: 1rem;

            border-top-left-radius: 2rem;
            border-top-right-radius: 2rem;

            padding: 2rem;
            background: var(--light);

            .header {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                margin-bottom: 1rem;
            }

            .rule-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }

            .rule-box {
                border: 1.5px solid var(--outline);
                border-radius: 0.4rem;
                padding: 14px;
            }

            button {
                border: 0;
            }
        }
    }

    #game {
        .actions {
            position: absolute;
            bottom: 0;

            display: flex;
            flex-direction: column;
            gap: 1rem;

            border-top-left-radius: 2rem;
            border-top-right-radius: 2rem;

            padding: 2rem;
            background: var(--light);
            width: 100%;
        }

        .buttons {
            display: flex;
            flex-direction: row;
            gap: 1rem;

            button {
                border: 0;

                flex: 1;
                padding: 1rem;
                font-size: 1.4rem;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
        }
    }

    .wide {
        width: 100%;
    }

    .key-badge {
        border: 1.5px solid #ccc;
        border-radius: 4px;
        padding: 1px 6px;
        font-size: 13px;
        font-weight: 700;
        flex-shrink: 0;
    }

    /* Playing */
    .game-wrap {
        min-height: calc(100vh - 65px);
        padding: 28px 20px 48px;
        max-width: 520px;
        margin: 0 auto;
        width: 100%;
        background-color: var(--off);
    }

    .progress-track {
        flex: 1;
        height: 6px;
        background: var(--light);
        border-radius: 99px;
        overflow: hidden;
    }
    .progress-fill {
        height: 100%;
        background: var(--blue);
        border-radius: 99px;
        transition: width 0.3s ease;
    }

    .arena {
        width: 240px;
        height: 240px;
        border-radius: 0.8em;

        background-color: var(--light);
        display: flex;
        align-items: center;
        justify-content: center;
        transition:
            background 0.15s ease,
            border-color 0.15s ease;
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
            transform: scale(0.5);
            opacity: 0;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
    }

    .fb-icon {
        width: 80px;
        height: 80px;
        animation: popIn 0.16s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    .arena-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ddd;
    }

    .reminder {
        background-color: var(--light);
        border-radius: 0.8rem;
        padding: 10px 14px;
        width: 100%;
        max-width: 380px;
    }

    /* Results */
    .metric {
        flex: 1;
        padding: 16px 8px;
        text-align: center;
    }

    .metric-lbl {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #aaa;
    }

    .chart-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #aaa;
    }

    .chart {
        display: flex;
        flex-direction: row;
        align-items: flex-end;
        gap: 4px;
        height: 72px;
        border: 1px solid #ddd;
        border-radius: var(--radius-sm);
        padding: 6px 6px 0;
    }

    .bar-col {
        flex: 1;
        justify-content: flex-end;
        gap: 3px;
    }
    .bar {
        width: 100%;
        background: var(--blue-mid);
        border-radius: 3px 3px 0 0;
        min-height: 4px;
    }
    .bar.bar-last {
        background: var(--blue);
    }

    .btn-secondary {
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1.5px solid #ddd;
        text-decoration: none;
        color: inherit;
        font-weight: 600;
        font-family: inherit;
        background: none;
        cursor: pointer;
        transition: background 0.1s;
    }

    .btn-secondary:hover {
        background: #f5f5f5;
    }

    @media (max-width: 480px) {
        .rule-grid {
            grid-template-columns: 1fr;
        }
        .arena {
            width: 200px;
            height: 200px;
        }
    }
</style>
