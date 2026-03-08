<script lang="ts">
    import { progress } from "$lib/stores.svelte";
    import {
        generateQuiz,
        scoreQuiz,
        TOTAL_QUESTIONS,
        QUESTION_SECS,
        type Question,
        type QuizResult,
        type FVal,
    } from "$lib/games/trigquiz";

    // ── Phase ─────────────────────────────────────────────────────────────────
    type Phase = "intro" | "question" | "feedback" | "done";
    let phase = $state<Phase>("intro");

    // ── Game state ─────────────────────────────────────────────────────────────
    let questions = $state<Question[]>([]);
    let qIndex = $state(0);
    let results = $state<QuizResult[]>([]);
    let chosen = $state<FVal | null>(null); // what user picked this question
    let qStartTime = $state(0);

    // ── Timer ──────────────────────────────────────────────────────────────────
    let timeLeft = $state(QUESTION_SECS);
    let timerHandle = $state<ReturnType<typeof setInterval> | null>(null);

    // ── Derived ───────────────────────────────────────────────────────────────
    const current = $derived(questions[qIndex] ?? null);
    const allRuns = $derived(progress.get("trigquiz"));
    const bestRun = $derived(
        allRuns.length
            ? allRuns.reduce((b, r) => (r.score > b.score ? r : b))
            : null,
    );

    // Score for done screen
    const doneScore = $derived(allRuns.at(-1)?.score ?? 0);
    const doneAccuracy = $derived(allRuns.at(-1)?.accuracy ?? 0);

    // ── Game flow ──────────────────────────────────────────────────────────────
    function startGame() {
        questions = generateQuiz();
        qIndex = 0;
        results = [];
        phase = "question";
        startTimer();
    }

    function startTimer() {
        clearInterval(timerHandle!);
        timeLeft = QUESTION_SECS;
        qStartTime = Date.now();
        chosen = null;

        timerHandle = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(timerHandle!);
                submitAnswer(null); // timed out
            }
        }, 1000);
    }

    function submitAnswer(pick: FVal | null) {
        clearInterval(timerHandle!);
        if (phase !== "question") return;

        const rt = pick !== null ? Date.now() - qStartTime : null;
        const correct = pick !== null && pick.key === current!.answer.key;

        chosen = pick;
        results = [
            ...results,
            { question: current!, chosen: pick, correct, rt },
        ];
        phase = "feedback";
    }

    function finishGame() {
        const score = scoreQuiz(results);
        const totalQ = results.length;
        const totalCorrect = results.filter((r) => r.correct).length;
        const accuracy = Math.round((totalCorrect / totalQ) * 100);

        progress.add("trigquiz", {
            correct: totalCorrect,
            total: totalQ,
            accuracy,
            score,
            avgRt: null,
        });

        phase = "done";
    }

    function nextQuestion() {
        if (qIndex + 1 >= TOTAL_QUESTIONS) {
            finishGame();
        } else {
            qIndex++;
            phase = "question";
            startTimer();
        }
    }

    // ── Cleanup ────────────────────────────────────────────────────────────────
    $effect(() => () => clearInterval(timerHandle!));

    // ── Render helpers ─────────────────────────────────────────────────────────
    // Type label colours
    function typeColor(q: Question) {
        return {
            sin: "#4B7BE8",
            cos: "#22C55E",
            tan: "#F97316",
            degToRad: "#8B5CF6",
            radToDeg: "#EC4899",
        }[q.type];
    }

    function typeTag(q: Question) {
        return {
            sin: "sin",
            cos: "cos",
            tan: "tan",
            degToRad: "deg → rad",
            radToDeg: "rad → deg",
        }[q.type];
    }

    // Is a choice the correct answer?
    function isCorrect(c: FVal) {
        return current !== null && c.key === current.answer.key;
    }
    // After submission: was this the picked wrong one?
    function isWrong(c: FVal) {
        return phase === "feedback" && chosen?.key === c.key && !isCorrect(c);
    }
    // After submission: is this the right one to highlight?
    function isRight(c: FVal) {
        return phase === "feedback" && isCorrect(c);
    }
</script>

<!-- ═══ INTRO ════════════════════════════════════════════════════════════════ -->
{#if phase === "intro"}
    <div class="center-wrap">
        <div class="card flex-col gap-large">
            <div class="flex-col gap-small">
                <h2>Trig Quiz</h2>
                <p>
                    Unit circle values — sin, cos, tan, and radian conversions.
                </p>
            </div>

            <!-- Preview of question types -->
            <div class="type-grid">
                {#each [{ label: "sin(45°)", sub: "= √2/2", color: "#4B7BE8" }, { label: "cos(120°)", sub: "= −1/2", color: "#22C55E" }, { label: "tan(60°)", sub: "= √3", color: "#F97316" }, { label: "90° → rad", sub: "= π/2", color: "#8B5CF6" }, { label: "π/3 → °", sub: "= 60°", color: "#EC4899" }] as ex}
                    <div
                        class="type-pill"
                        style:border-color={ex.color}
                        style:color={ex.color}
                    >
                        <span class="pill-q">{ex.label}</span>
                        <span class="pill-a">{ex.sub}</span>
                    </div>
                {/each}
            </div>

            <div class="rule-list flex-col gap-small">
                <div class="rule-row">
                    <span class="rule-dot"></span><span
                        ><strong>{TOTAL_QUESTIONS} questions</strong>, multiple
                        choice (A–D)</span
                    >
                </div>
                <div class="rule-row">
                    <span class="rule-dot"></span><span
                        ><strong>{QUESTION_SECS} seconds</strong> per question</span
                    >
                </div>
                <div class="rule-row">
                    <span class="rule-dot"></span><span
                        >Faster answers score more points</span
                    >
                </div>
                <div class="rule-row">
                    <span class="rule-dot"></span><span
                        >All angles on the unit circle</span
                    >
                </div>
            </div>

            {#if allRuns.length > 0}
                {@const last = allRuns.at(-1)!}
                <div class="prev-best flex-row justify-content:space-between">
                    <span
                        >Last: {last.accuracy}% · {last.score.toLocaleString()} pts</span
                    >
                    {#if bestRun}<span
                            >Best: <strong
                                >{bestRun.score.toLocaleString()} pts</strong
                            ></span
                        >{/if}
                </div>
            {/if}

            <button class="primary rounded padded" onclick={startGame}
                >Start</button
            >
        </div>
    </div>

    <!-- ═══ QUESTION / FEEDBACK ══════════════════════════════════════════════════ -->
{:else if (phase === "question" || phase === "feedback") && current}
    <div class="game-wrap flex-col gap-medium">
        <!-- Progress + timer -->
        <div class="top-bar flex-col gap-small">
            <div
                class="flex-row justify-content:space-between align-items:center"
            >
                <span class="q-counter">{qIndex + 1} / {TOTAL_QUESTIONS}</span>
                <span
                    class="type-badge"
                    style:background={typeColor(current) + "22"}
                    style:color={typeColor(current)}
                >
                    {typeTag(current)}
                </span>
                <span class="time-label" class:urgent={timeLeft <= 3}
                    >{timeLeft}s</span
                >
            </div>
            <div class="timer-track">
                <div
                    class="timer-fill"
                    class:timer-blue={timeLeft > 3}
                    class:timer-red={timeLeft <= 3}
                    style:width="{(timeLeft / QUESTION_SECS) * 100}%"
                ></div>
            </div>
        </div>

        <!-- Question card -->
        <div class="question-card" style:border-color={typeColor(current)}>
            {@render Frac({ val: current.prompt, big: true })}
        </div>

        <!-- Choices -->
        <div class="choices-grid">
            {#each current.choices as choice, i}
                {@const label = ["A", "B", "C", "D"][i]}
                <button
                    class="choice-btn"
                    class:choice-correct={isRight(choice)}
                    class:choice-wrong={isWrong(choice)}
                    class:choice-dim={phase === "feedback" &&
                        !isRight(choice) &&
                        !isWrong(choice)}
                    disabled={phase === "feedback"}
                    onclick={() => submitAnswer(choice)}
                >
                    <span class="choice-label">{label}</span>
                    <span class="choice-val"
                        >{@render Frac({ val: choice })}</span
                    >
                </button>
            {/each}
        </div>

        <!-- Feedback bar + Next -->
        {#if phase === "feedback"}
            {@const last = results.at(-1)!}
            <div class="feedback-row flex-row gap-small align-items:center">
                <div
                    class="feedback-bar"
                    class:fb-correct={last.correct}
                    class:fb-wrong={!last.correct && last.chosen !== null}
                    class:fb-timeout={last.chosen === null}
                >
                    {#if last.correct}
                        ✓ Correct{last.rt !== null ? ` · ${last.rt}ms` : ""}
                    {:else if last.chosen !== null}
                        ✗ Wrong — answer: <strong
                            >{@render Frac({ val: current.answer })}</strong
                        >
                    {:else}
                        ⏱ Time's up — answer: <strong
                            >{@render Frac({ val: current.answer })}</strong
                        >
                    {/if}
                </div>
                <button class="next-btn" onclick={nextQuestion}>
                    {qIndex + 1 >= TOTAL_QUESTIONS ? "Results" : "Next"} →
                </button>
            </div>
        {/if}
    </div>
{/if}

<!-- ═══ DONE ══════════════════════════════════════════════════════════════════ -->
{#if phase === "done"}
    {@const totalCorrect = results.filter((r) => r.correct).length}
    {@const pct = Math.round((totalCorrect / TOTAL_QUESTIONS) * 100)}
    <div class="center-wrap">
        <div class="card flex-col gap-large">
            <div
                class="flex-col align-items:center gap-small"
                style="text-align:center"
            >
                <span style="font-size:48px; line-height:1"
                    >{pct >= 90 ? "🌟" : pct >= 70 ? "🎯" : "💪"}</span
                >
                <h2>
                    {pct >= 90
                        ? "Perfect!"
                        : pct >= 70
                          ? "Well done!"
                          : "Keep practising!"}
                </h2>
                <p style="color:#888">
                    {totalCorrect} of {TOTAL_QUESTIONS} correct
                </p>
            </div>

            <!-- Metrics -->
            <div class="metrics-row flex-row">
                <div class="metric flex-col align-items:center gap-small">
                    <strong
                        style:color={pct >= 80
                            ? "#16A34A"
                            : pct >= 60
                              ? "#F59E0B"
                              : "#EF4444"}>{pct}%</strong
                    >
                    <span class="metric-lbl">Accuracy</span>
                </div>
                <div class="metric-div"></div>
                <div class="metric flex-col align-items:center gap-small">
                    <strong style="color:#4B7BE8"
                        >{doneScore.toLocaleString()}</strong
                    >
                    <span class="metric-lbl">Score</span>
                </div>
                <div class="metric-div"></div>
                <div class="metric flex-col align-items:center gap-small">
                    <strong
                        >{results.filter((r) => r.chosen !== null)
                            .length}/{TOTAL_QUESTIONS}</strong
                    >
                    <span class="metric-lbl">Answered</span>
                </div>
            </div>

            <!-- Per-question breakdown -->
            <div class="flex-col gap-small">
                <span class="breakdown-title">Breakdown</span>
                <div class="breakdown-grid">
                    {#each results as r, i}
                        <div
                            class="breakdown-row flex-row align-items:center gap-small"
                        >
                            <span class="breakdown-num">{i + 1}</span>
                            <span class="breakdown-prompt"
                                >{@render Frac({
                                    val: r.question.prompt,
                                })}</span
                            >
                            <span class="bd-eq">=</span>
                            <span
                                class="breakdown-ans"
                                class:bd-correct={r.correct}
                                class:bd-wrong={!r.correct}
                            >
                                {@render Frac({ val: r.question.answer })}
                            </span>
                            {#if !r.correct && r.chosen}
                                <span class="bd-given"
                                    >({@render Frac({ val: r.chosen })})</span
                                >
                            {:else if !r.correct && !r.chosen}
                                <span class="bd-given">(time)</span>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>

            {#if bestRun && allRuns.length > 1 && doneScore >= bestRun.score}
                <p
                    class="secondary outlined rounded padded"
                    style="text-align:center"
                >
                    🏆 New personal best!
                </p>
            {:else if bestRun && allRuns.length > 1}
                <p style="text-align:center; font-size:13px; color:#aaa">
                    Best: <strong>{bestRun.score.toLocaleString()} pts</strong>
                    · {bestRun.accuracy}%
                </p>
            {/if}

            <div class="flex-col gap-small">
                <button class="primary rounded padded" onclick={startGame}
                    >Play Again</button
                >
                <a href="/" class="btn-secondary rounded padded">Home</a>
            </div>
        </div>
    </div>
{/if}

<!-- ── Fraction renderer component ───────────────────────────────────────── -->
{#snippet Frac({ val, big = false }: { val: FVal; big?: boolean })}
    {#if val.bot}
        <span class="frac" class:frac-big={big}>
            <span class="frac-top">{val.top}</span>
            <span class="frac-line"></span>
            <span class="frac-bot">{val.bot}</span>
        </span>
    {:else}
        <span class="frac-whole" class:frac-big={big}>{val.top}</span>
    {/if}
{/snippet}

<style>
    button {
        border: 0;
    }

    .center-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 57px);
        padding: 24px 16px 60px;
    }

    .card {
        width: 100%;
        max-width: 480px;
        padding: 24px 20px;
        background: white;
        border: 1.5px solid #ddd;
    }

    .game-wrap {
        min-height: calc(100vh - 57px);
        padding: 20px 16px 40px;
        max-width: 520px;
        margin: 0 auto;
        width: 100%;
    }

    /* ── Top bar ────────────────────────────────────────────────────────── */
    .top-bar {
        width: 100%;
    }

    .q-counter {
        font-size: 13px;
        font-weight: 700;
        color: #888;
        font-variant-numeric: tabular-nums;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        width: 60px;
    }

    .type-badge {
        font-size: 11px;
        font-weight: 800;
        padding: 3px 8px;
        border-radius: 99px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .time-label {
        font-size: 13px;
        font-weight: 800;
        color: #888;
        font-variant-numeric: tabular-nums;
        width: 60px;
        text-align: right;
        transition: color 0.2s;
    }
    .time-label.urgent {
        color: #ef4444;
    }

    .timer-track {
        width: 100%;
        height: 4px;
        background: #e5e5e5;
        border-radius: 99px;
        overflow: hidden;
    }
    .timer-fill {
        height: 100%;
        border-radius: 99px;
        transition: width 1s linear;
    }
    .timer-blue {
        background: #4b7be8;
    }
    .timer-red {
        background: #ef4444;
    }

    /* ── Question card ──────────────────────────────────────────────────── */
    .question-card {
        width: 100%;
        border: 2.5px solid #ddd;
        border-radius: var(--radius-sm);
        padding: 28px 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100px;
        background: white;
    }

    /* ── Choices ────────────────────────────────────────────────────────── */
    .choices-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        width: 100%;
    }

    .choice-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 14px;
        border: 2px solid #ddd !important;
        border-radius: var(--radius-sm);
        background: white;
        cursor: pointer;
        font-family: inherit;
        font-size: 14px;
        font-weight: 700;
        transition:
            background 0.08s,
            border-color 0.08s;
        text-align: left;
    }

    .choice-btn:not(:disabled):hover {
        background: #f5f5f5;
        border-color: #bbb !important;
    }
    .choice-btn:disabled {
        cursor: default;
    }

    .choice-btn.choice-correct {
        background: #dcfce7 !important;
        border-color: #22c55e !important;
    }
    .choice-btn.choice-wrong {
        background: #fee2e2 !important;
        border-color: #ef4444 !important;
    }
    .choice-btn.choice-dim {
        opacity: 0.4;
    }

    .choice-label {
        font-size: 11px;
        font-weight: 900;
        color: #aaa;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        flex-shrink: 0;
        width: 16px;
    }

    .choice-val {
        display: flex;
        align-items: center;
    }

    /* ── Feedback bar ───────────────────────────────────────────────────── */
    .feedback-bar {
        width: 100%;
        padding: 12px 14px;
        border-radius: var(--radius-sm);
        font-size: 13px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }

    .feedback-row {
        width: 100%;
        align-items: stretch;
    }

    .fb-correct {
        background: #dcfce7;
        color: #16a34a;
    }
    .fb-wrong {
        background: #fee2e2;
        color: #dc2626;
    }
    .fb-timeout {
        background: #fef9c3;
        color: #92400e;
    }

    .next-btn {
        flex-shrink: 0;
        padding: 12px 18px;
        background: black;
        color: white;
        font-size: 13px;
        font-weight: 800;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-family: inherit;
        white-space: nowrap;
        transition: opacity 0.1s;
    }
    .next-btn:hover {
        opacity: 0.8;
    }

    /* ── Fraction rendering ─────────────────────────────────────────────── */
    .frac {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        vertical-align: middle;
        gap: 1px;
        line-height: 1;
    }

    .frac-top,
    .frac-bot {
        font-size: 0.75em;
        font-weight: 800;
        line-height: 1.1;
    }

    .frac-line {
        width: 100%;
        height: 1.5px;
        background: currentColor;
        border-radius: 1px;
        min-width: 14px;
    }

    .frac-whole {
        font-size: 1em;
        font-weight: 800;
        vertical-align: middle;
    }

    /* Big variants for the question card */
    .frac-big .frac-top,
    .frac-big .frac-bot {
        font-size: 1.1em;
    }

    .frac-big .frac-line {
        height: 2px;
    }

    span.frac-big.frac-whole {
        font-size: 1.6em;
    }
    span.frac.frac-big {
        gap: 2px;
    }

    /* Scale up the question card prompt further */
    .question-card .frac-whole {
        font-size: 1.8em;
    }
    .question-card .frac-top,
    .question-card .frac-bot {
        font-size: 1.1em;
    }
    .question-card .frac-line {
        height: 2px;
    }

    /* ── Intro ──────────────────────────────────────────────────────────── */
    .type-grid {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .type-pill {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border: 1.5px solid;
        border-radius: var(--radius-sm);
        font-size: 13px;
    }

    .pill-q {
        font-weight: 700;
    }
    .pill-a {
        font-weight: 900;
        font-size: 14px;
    }

    .rule-list {
        padding: 12px;
        background: #f9f9f9;
        border-radius: var(--radius-sm);
    }

    .rule-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        font-weight: 500;
    }

    .rule-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #4b7be8;
        flex-shrink: 0;
    }

    .prev-best {
        font-size: 12px;
        color: #888;
        border-top: 1px solid #eee;
        padding-top: 12px;
    }

    /* ── Results ────────────────────────────────────────────────────────── */
    .metrics-row {
        border: 1px solid #ddd;
        border-radius: var(--radius-sm);
        overflow: hidden;
    }
    .metric {
        flex: 1;
        padding: 16px 8px;
        text-align: center;
    }
    .metric-div {
        width: 1px;
        background: #ddd;
        flex-shrink: 0;
    }
    .metric-lbl {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #aaa;
    }

    .breakdown-title {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #aaa;
    }

    .breakdown-grid {
        border: 1px solid #ddd;
        border-radius: var(--radius-sm);
        overflow: hidden;
    }

    .breakdown-row {
        padding: 8px 12px;
        border-bottom: 1px solid #f0f0f0;
        flex-wrap: wrap;
    }
    .breakdown-row:last-child {
        border-bottom: none;
    }

    .breakdown-num {
        font-size: 11px;
        font-weight: 700;
        color: #bbb;
        width: 16px;
        flex-shrink: 0;
    }

    .breakdown-prompt {
        font-size: 13px;
        font-weight: 700;
        flex: 1;
        min-width: 100px;
    }

    .bd-eq {
        font-size: 12px;
        color: #bbb;
    }

    .breakdown-ans {
        font-size: 13px;
        font-weight: 800;
    }
    .bd-correct {
        color: #16a34a;
    }
    .bd-wrong {
        color: #dc2626;
    }

    .bd-given {
        font-size: 11px;
        color: #aaa;
        margin-left: 2px;
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
        text-align: center;
    }
    .btn-secondary:hover {
        background: #f5f5f5;
    }

    @media (max-width: 400px) {
        .choices-grid {
            grid-template-columns: 1fr;
        }
        .choice-btn {
            padding: 14px 12px;
        }
    }
</style>
