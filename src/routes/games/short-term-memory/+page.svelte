<script lang="ts">
    import { onMount } from "svelte";
    import { progress } from "$lib/stores.svelte";
    import {
        generateSeries,
        parseInput,
        checkAnswer,
        TOTAL_SERIES,
        PARAM_META,
        type Series,
        type SeriesResult,
        type ParamKey,
    } from "$lib/games/short-term-memory";

    // ── Phase ─────────────────────────────────────────────────────────────────
    type Phase = "intro" | "memorize" | "recall" | "series-feedback" | "done";
    let phase = $state<Phase>("intro");

    // ── Game state ────────────────────────────────────────────────────────────
    let seriesIndex = $state(0);
    let currentSeries = $state<Series | null>(null);
    let answers = $state<Partial<Record<ParamKey, string>>>({});
    let submitted = $state<Set<ParamKey>>(new Set());
    let results = $state<SeriesResult[]>([]);

    // ── Per-series timers ──────────────────────────────────────────────────────
    const MEMORIZE_SECS = 10;
    const RECALL_SECS = 30;

    let memorizeLeft = $state(MEMORIZE_SECS);
    let recallLeft = $state(RECALL_SECS);
    let timerHandle = $state<ReturnType<typeof setInterval> | null>(null);

    // ── Input ─────────────────────────────────────────────────────────────────
    let inputValue = $state("");
    let inputEl = $state<HTMLInputElement | null>(null);
    let inputError = $state<string | null>(null);
    let keyFlash = $state<Partial<Record<ParamKey, "correct" | "wrong">>>({});

    // ── Derived ───────────────────────────────────────────────────────────────
    let remaining = $derived(
        currentSeries
            ? currentSeries.missing.filter((k) => !submitted.has(k))
            : [],
    );

    let allRuns = $derived(progress.get("atcmemory"));
    let bestRun = $derived(
        allRuns.length
            ? allRuns.reduce((b, r) => (r.score > b.score ? r : b))
            : null,
    );

    // ── Game flow ─────────────────────────────────────────────────────────────
    function startGame() {
        seriesIndex = 0;
        results = [];
        startSeries(0);
    }

    function startSeries(idx: number) {
        const s = generateSeries(idx);
        currentSeries = s;
        answers = {};
        submitted = new Set();
        keyFlash = {};
        inputValue = "";
        inputError = null;
        memorizeLeft = MEMORIZE_SECS;
        phase = "memorize";

        clearInterval(timerHandle!);
        timerHandle = setInterval(() => {
            memorizeLeft--;
            if (memorizeLeft <= 0) {
                clearInterval(timerHandle!);
                beginRecall();
            }
        }, 1000);
    }

    function beginRecall() {
        phase = "recall";
        recallLeft = RECALL_SECS;
        setTimeout(() => inputEl?.focus(), 50);

        clearInterval(timerHandle!);
        timerHandle = setInterval(() => {
            recallLeft--;
            if (recallLeft <= 0) {
                clearInterval(timerHandle!);
                advanceSeries(); // time's up — auto-advance, unanswered = skipped
            }
        }, 1000);
    }

    function submitInput() {
        const raw = inputValue.trim();
        if (!raw) return;

        const parsed = parseInput(raw);

        if (!parsed) {
            inputError = "Format: letter + value  e.g. A3100";
            return;
        }

        const { key, value } = parsed;

        if (!currentSeries!.missing.includes(key)) {
            inputError = `${key} is not missing — enter ${remaining.map((k) => PARAM_META[k].label[0] + "?").join(", ")}`;
            return;
        }

        if (submitted.has(key)) {
            inputError = `${PARAM_META[key].label} already answered`;
            return;
        }

        const expected = currentSeries!.params.find(
            (p) => p.key === key,
        )!.value;
        const ok = checkAnswer(value, expected);

        answers = { ...answers, [key]: value };
        submitted = new Set([...submitted, key]);
        keyFlash = { ...keyFlash, [key]: ok ? "correct" : "wrong" };
        inputValue = "";
        inputError = null;

        // Flash then clear
        setTimeout(() => {
            keyFlash = { ...keyFlash, [key]: undefined as any };
        }, 800);

        // All missing answered?
        const newRemaining = currentSeries!.missing.filter(
            (k) => !submitted.has(k) && k !== key,
        );
        if (newRemaining.length === 0) {
            advanceSeries();
        }
    }

    function advanceSeries() {
        // Record result
        const s = currentSeries!;
        const correct: ParamKey[] = [];
        const wrong: ParamKey[] = [];
        const skipped: ParamKey[] = [];

        for (const key of s.missing) {
            const input = answers[key] ?? null;
            if (input === null) {
                skipped.push(key);
            } else if (
                checkAnswer(input, s.params.find((p) => p.key === key)!.value)
            ) {
                correct.push(key);
            } else {
                wrong.push(key);
            }
        }

        results = [
            ...results,
            {
                series: s,
                answers: answers as Record<ParamKey, string | null>,
                correct,
                wrong,
                skipped,
            },
        ];

        clearInterval(timerHandle!); // stop recall timer if still running
        phase = "series-feedback";
        setTimeout(() => {
            if (seriesIndex + 1 >= TOTAL_SERIES) {
                finishGame();
            } else {
                seriesIndex++;
                startSeries(seriesIndex);
            }
        }, 900);
    }

    function finishGame() {
        clearInterval(timerHandle!);
        phase = "done";

        const totalMissing = results.flatMap((r) => r.series.missing).length;
        const totalCorrect = results.flatMap((r) => r.correct).length;
        const accuracy =
            totalMissing > 0
                ? Math.round((totalCorrect / totalMissing) * 100)
                : 0;

        // Score: 100 pts per correct answer, bonus for difficulty
        const score = results.reduce((sum, r, i) => {
            return sum + r.correct.length * (100 + i * 10);
        }, 0);

        progress.add("atcmemory", {
            correct: totalCorrect,
            total: totalMissing,
            accuracy,
            score,
            avgRt: null,
        });
    }

    // ── Keyboard ──────────────────────────────────────────────────────────────
    function onKeydown(e: KeyboardEvent) {
        if (phase === "recall" && e.key === "Enter") {
            e.preventDefault();
            submitInput();
        }
    }

    $effect(() => {
        window.addEventListener("keydown", onKeydown);
        return () => {
            window.removeEventListener("keydown", onKeydown);
            clearInterval(timerHandle!);
        };
    });

    // ── Helpers ───────────────────────────────────────────────────────────────
    function paramColor(key: ParamKey) {
        return { F: "#4B7BE8", A: "#22C55E", H: "#F97316", S: "#8B5CF6" }[key];
    }

    function lastResult() {
        return results[results.length - 1] ?? null;
    }

    const allRuns2 = $derived(progress.get("atcmemory"));
    const doneMissing = $derived(
        results.flatMap((r) => r.series.missing).length,
    );
    const doneCorrect = $derived(results.flatMap((r) => r.correct).length);
    const doneAccuracy = $derived(
        doneMissing > 0 ? Math.round((doneCorrect / doneMissing) * 100) : 0,
    );
    const doneLastScore = $derived(allRuns2.at(-1));
</script>

<!-- ═══ INTRO ═══════════════════════════════════════════════════════════════ -->
{#if phase === "intro"}
    <div id="instructions">
        <div class="instruction-card">
            <div class="flex-col gap-small">
                <h2>ATC Memory</h2>
                <p>
                    Memorise 4 aeronautical parameters, then recall the ones
                    that disappear.
                </p>
            </div>

            <div class="flex-col gap-small">
                <div class="param-demo flex-row gap-medium">
                    {#each [["F", "Frequency", "11825"], ["A", "Altitude", "3100"], ["H", "Heading", "014"], ["S", "Speed", "250"]] as [k, l, v]}
                        <div
                            class="param-tile flex-col gap-small"
                            style:border-color={paramColor(k as ParamKey)}
                        >
                            <span
                                class="param-key"
                                style:color={paramColor(k as ParamKey)}
                                >{k}</span
                            >
                            <span class="param-val">{v}</span>
                            <span class="param-lbl">{l}</span>
                        </div>
                    {/each}
                </div>
                <p class="hint">Some vanish — type them back in any order.</p>
                <div class="example-box flex-col gap-small">
                    <span class="example-label">Example input</span>
                    <div class="flex-row gap-small">
                        <span class="input-chip">A3100 ↵</span>
                        <span class="input-chip">H014 ↵</span>
                    </div>
                </div>
            </div>

            <div class="flex-col gap-small rule-list">
                <div class="rule-row">
                    <span class="rule-dot"></span>
                    <span><strong>10 series</strong>, 4 parameters each</span>
                </div>
                <div class="rule-row">
                    <span class="rule-dot"></span>
                    <span><strong>40 seconds</strong> total — be fast</span>
                </div>
                <div class="rule-row">
                    <span class="rule-dot"></span>
                    <span
                        ><strong>1 → 3</strong> missing params, difficulty rises</span
                    >
                </div>
            </div>

            {#if allRuns2.length > 0}
                {@const last = allRuns2[allRuns2.length - 1]}
                <div class="prev-best flex-row justify-content:space-between">
                    <span>Last: {last.accuracy}% · {last.score} pts</span>
                    {#if bestRun}
                        <span>Best: <strong>{bestRun.score} pts</strong></span>
                    {/if}
                </div>
            {/if}

            <button class="primary rounded padded" onclick={startGame}>
                Start
            </button>
        </div>
    </div>

    <!-- ═══ MEMORIZE ════════════════════════════════════════════════════════════ -->
{:else if phase === "memorize" && currentSeries}
    <div class="game-wrap flex-col gap-medium">
        <div class="top-bar flex-col gap-small">
            <div
                class="flex-row justify-content:space-between align-items:center"
            >
                <span class="series-label"
                    >Series {seriesIndex + 1} / {TOTAL_SERIES}</span
                >
                <span class="phase-clock" class:urgent={memorizeLeft <= 3}
                    >Memorise · {memorizeLeft}s</span
                >
            </div>
            <div class="timer-track">
                <div
                    class="timer-fill timer-fill-blue"
                    style:width="{(memorizeLeft / 10) * 100}%"
                ></div>
            </div>
        </div>

        <div class="params-grid">
            {#each currentSeries.params as param}
                <div
                    class="param-card flex-col gap-small"
                    style:border-color={paramColor(param.key)}
                >
                    <div
                        class="flex-row justify-content:space-between align-items:center"
                    >
                        <span
                            class="param-card-key"
                            style:color={paramColor(param.key)}
                            >{param.key}</span
                        >
                        <span class="param-card-label">{param.label}</span>
                    </div>
                    <span class="param-card-val">{param.value}</span>
                </div>
            {/each}
        </div>
    </div>

    <!-- ═══ RECALL ══════════════════════════════════════════════════════════════ -->
{:else if (phase === "recall" || phase === "series-feedback") && currentSeries}
    <div class="game-wrap flex-col gap-medium">
        <div class="top-bar flex-col gap-small">
            <div
                class="flex-row justify-content:space-between align-items:center"
            >
                <span class="series-label"
                    >Series {seriesIndex + 1} / {TOTAL_SERIES}</span
                >
                <span class="phase-clock" class:urgent={recallLeft <= 10}
                    >Recall · {recallLeft}s</span
                >
            </div>
            <div class="timer-track">
                <div
                    class="timer-fill"
                    class:timer-fill-red={recallLeft <= 10}
                    class:timer-fill-blue={recallLeft > 10}
                    style:width="{(recallLeft / 30) * 100}%"
                ></div>
            </div>
        </div>

        <div class="params-grid">
            {#each currentSeries.params as param}
                {@const isMissing = currentSeries.missing.includes(param.key)}
                {@const isSubmitted = submitted.has(param.key)}
                {@const flash = keyFlash[param.key]}
                <div
                    class="param-card flex-col gap-small"
                    class:param-missing={isMissing && !isSubmitted}
                    class:param-correct={flash === "correct" ||
                        (isSubmitted &&
                            checkAnswer(answers[param.key] ?? "", param.value))}
                    class:param-wrong={flash === "wrong" ||
                        (isSubmitted &&
                            !checkAnswer(
                                answers[param.key] ?? "",
                                param.value,
                            ))}
                    style:border-color={flash === "correct" ||
                    (isSubmitted &&
                        checkAnswer(answers[param.key] ?? "", param.value))
                        ? "#22C55E"
                        : flash === "wrong" ||
                            (isSubmitted &&
                                !checkAnswer(
                                    answers[param.key] ?? "",
                                    param.value,
                                ))
                          ? "#EF4444"
                          : isMissing
                            ? "#ddd"
                            : paramColor(param.key)}
                >
                    <div
                        class="flex-row justify-content:space-between align-items:center"
                    >
                        <span
                            class="param-card-key"
                            style:color={paramColor(param.key)}
                            >{param.key}</span
                        >
                        <span class="param-card-label">{param.label}</span>
                    </div>

                    {#if !isMissing}
                        <span class="param-card-val">{param.value}</span>
                    {:else if isSubmitted}
                        <span class="param-card-val">{answers[param.key]}</span>
                    {:else}
                        <span class="param-card-val param-blank">?</span>
                    {/if}
                </div>
            {/each}
        </div>

        <!-- Input area -->
        {#if phase === "recall"}
            <div class="input-area flex-col gap-small">
                <div class="input-prompt flex-row gap-small align-items:center">
                    <span>Still needed:</span>
                    {#each remaining as key}
                        <span class="needed-badge" style:color={paramColor(key)}
                            >{key} — {PARAM_META[key].label}</span
                        >
                    {/each}
                </div>

                <div class="input-row flex-row gap-small">
                    <input
                        bind:this={inputEl}
                        bind:value={inputValue}
                        placeholder="e.g. A3100"
                        class="recall-input"
                        class:input-err={inputError}
                        autocomplete="off"
                        autocorrect="off"
                        autocapitalize="characters"
                        spellcheck="false"
                        oninput={() => (inputError = null)}
                    />
                    <button
                        class="primary rounded submit-btn"
                        onclick={submitInput}
                    >
                        Enter ↵
                    </button>
                </div>

                {#if inputError}
                    <p class="error-msg">{inputError}</p>
                {/if}
            </div>
        {/if}
    </div>
{/if}

<!-- ═══ DONE ═════════════════════════════════════════════════════════════ -->
{#if phase === "done"}
    <div class="center-wrap">
        <div class="flex-col gap-large card">
            <div
                class="flex-col align-items:center gap-small"
                style="text-align:center"
            >
                <span style="font-size:48px; line-height:1">
                    {doneAccuracy >= 90
                        ? "🌟"
                        : doneAccuracy >= 70
                          ? "🎯"
                          : "💪"}
                </span>
                <h2>
                    {doneAccuracy >= 90
                        ? "Excellent!"
                        : doneAccuracy >= 70
                          ? "Good recall!"
                          : "Keep training!"}
                </h2>
                <p style="color:#888">
                    {doneCorrect} of {doneMissing} recalled correctly
                </p>
            </div>

            <!-- Summary metrics -->
            <div class="metrics-row flex-row">
                <div class="metric flex-col align-items:center gap-small">
                    <strong
                        style:color={doneAccuracy >= 80
                            ? "#16A34A"
                            : doneAccuracy >= 60
                              ? "#F59E0B"
                              : "#EF4444"}
                    >
                        {doneAccuracy}%
                    </strong>
                    <span class="metric-lbl">Accuracy</span>
                </div>
                <div class="metric-div"></div>
                <div class="metric flex-col align-items:center gap-small">
                    <strong style="color:#4B7BE8"
                        >{doneLastScore?.score.toLocaleString()}</strong
                    >
                    <span class="metric-lbl">Score</span>
                </div>
                <div class="metric-div"></div>
                <div class="metric flex-col align-items:center gap-small">
                    <strong>{results.length}/{TOTAL_SERIES}</strong>
                    <span class="metric-lbl">Series done</span>
                </div>
            </div>

            <!-- Per-series breakdown -->
            <div class="flex-col gap-small">
                <span class="breakdown-title">Series breakdown</span>
                <div class="breakdown-grid">
                    {#each results as r, i}
                        <div
                            class="breakdown-row flex-row align-items:center gap-small"
                        >
                            <span class="breakdown-num">{i + 1}</span>
                            <div
                                class="flex-row gap-small"
                                style="flex:1; flex-wrap:wrap"
                            >
                                {#each r.series.missing as key}
                                    {@const isCorrect = r.correct.includes(key)}
                                    {@const expected = r.series.params.find(
                                        (p) => p.key === key,
                                    )!.value}
                                    {@const given = r.answers[key]}
                                    <span
                                        class="breakdown-chip"
                                        class:chip-correct={isCorrect}
                                        class:chip-wrong={!isCorrect}
                                    >
                                        {key}{expected}
                                        {#if !isCorrect && given}
                                            <span class="chip-given"
                                                >({given})</span
                                            >
                                        {:else if !isCorrect && !given}
                                            <span class="chip-given"
                                                >(missed)</span
                                            >
                                        {/if}
                                    </span>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>

            {#if bestRun && doneLastScore && doneLastScore.score >= bestRun.score && allRuns2.length > 1}
                <p
                    class="secondary outlined rounded padded"
                    style="text-align:center"
                >
                    🏆 New personal best!
                </p>
            {:else if bestRun && allRuns2.length > 1}
                <p style="text-align:center; font-size:13px; color:#aaa">
                    Best: <strong>{bestRun.score} pts</strong> · {bestRun.accuracy}%
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

<style>
    button {
        border: 0;
    }

    #instructions {
        background-color: var(--off);
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 57px);
        padding: 24px 16px 60px;
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
    }

    .game-wrap {
        min-height: calc(100vh - 57px);
        padding: 20px 16px 60px;
        max-width: 520px;
        margin: 0 auto;
        width: 100%;
    }

    /* ── Top bar ────────────────────────────────────────────────────────── */
    .top-bar {
        width: 100%;
    }

    .series-label {
        font-size: 13px;
        font-weight: 700;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .phase-label {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #bbb;
    }

    .phase-clock {
        font-size: 13px;
        font-weight: 800;
        color: #888;
        font-variant-numeric: tabular-nums;
        transition: color 0.2s;
    }

    .phase-clock.urgent {
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

    .timer-fill-blue {
        background: #4b7be8;
    }
    .timer-fill-red {
        background: #ef4444;
    }

    /* ── Param grid ─────────────────────────────────────────────────────── */
    .params-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        width: 100%;
    }

    .param-card {
        border: 2px solid #ddd;
        border-radius: var(--radius-sm);
        padding: 14px 12px;
        transition:
            background 0.15s,
            border-color 0.15s;
    }

    .param-card.param-missing {
        background: #fafafa;
    }
    .param-card.param-correct {
        background: #f0fdf4;
    }
    .param-card.param-wrong {
        background: #fef2f2;
    }

    .param-card-key {
        font-size: 20px;
        font-weight: 900;
        line-height: 1;
    }

    .param-card-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #aaa;
    }

    .param-card-val {
        font-size: 26px;
        font-weight: 900;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
    }

    .param-blank {
        color: #ddd;
        font-size: 32px;
    }

    /* ── Demo tiles (intro) ─────────────────────────────────────────────── */
    .param-demo {
        justify-content: space-between;
    }

    .param-tile {
        flex: 1;
        border: 2px solid;
        border-radius: var(--radius-sm);
        padding: 10px 8px;
        align-items: center;
        text-align: center;
    }

    .param-key {
        font-size: 18px;
        font-weight: 900;
        line-height: 1;
    }
    .param-val {
        font-size: 15px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
    }
    .param-lbl {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #aaa;
    }

    /* ── Hints ──────────────────────────────────────────────────────────── */
    .hint {
        font-size: 13px;
        color: #888;
    }

    .example-box {
        background: #f9f9f9;
        border: 1px solid #eee;
        border-radius: var(--radius-sm);
        padding: 10px 12px;
    }

    .example-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #bbb;
    }

    .input-chip {
        background: white;
        border: 1.5px solid #ddd;
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 13px;
        font-weight: 700;
        font-family: monospace;
    }

    .missing-hint {
        flex-wrap: wrap;
    }

    .missing-badge {
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 99px;
    }

    /* ── Rules (intro) ──────────────────────────────────────────────────── */
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

    /* ── Input area ─────────────────────────────────────────────────────── */
    .input-area {
        width: 100%;
        max-width: 380px;
        margin: 0 auto;
    }

    .input-prompt {
        font-size: 12px;
        font-weight: 600;
        color: #888;
        flex-wrap: wrap;
    }

    .needed-badge {
        font-size: 12px;
        font-weight: 800;
    }

    .input-row {
        align-items: stretch;
    }

    .recall-input {
        flex: 1;
        border: 2px solid #ddd;
        border-radius: var(--radius-sm);
        padding: 14px 14px;
        font-size: 22px;
        font-weight: 800;
        font-family: monospace;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        outline: none;
        transition: border-color 0.1s;
        -webkit-appearance: none;
    }

    .recall-input:focus {
        border-color: #4b7be8;
    }
    .recall-input.input-err {
        border-color: #ef4444;
    }

    .submit-btn {
        padding: 14px 18px;
        font-size: 14px;
        font-weight: 800;
        white-space: nowrap;
    }

    .error-msg {
        font-size: 12px;
        color: #ef4444;
        font-weight: 600;
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

    .breakdown-chip {
        font-size: 12px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 4px;
        font-family: monospace;
    }

    .chip-correct {
        background: #dcfce7;
        color: #16a34a;
    }
    .chip-wrong {
        background: #fee2e2;
        color: #dc2626;
    }

    .chip-given {
        font-weight: 500;
        font-size: 11px;
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
        .param-card-val {
            font-size: 22px;
        }
        .param-demo {
            gap: 6px;
        }
    }
</style>
