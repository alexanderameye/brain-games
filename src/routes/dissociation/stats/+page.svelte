<script lang="ts">
    import { progress } from "$lib/stores.svelte";
    import type { RunResult } from "$lib/games/dissociation.js";
    import { browser } from "$app/environment";

    const runs = $derived(progress.get("dissociation"));
    const hasData = $derived(runs.length > 0);

    // ── Aggregates ────────────────────────────────────────────────────────────
    const totalPlays = $derived(runs.length);
    const bestScore = $derived(
        hasData ? Math.max(...runs.map((r) => r.score)) : 0,
    );
    const bestAccuracy = $derived(
        hasData ? Math.max(...runs.map((r) => r.accuracy)) : 0,
    );
    const avgAccuracy = $derived(
        hasData
            ? Math.round(runs.reduce((s, r) => s + r.accuracy, 0) / runs.length)
            : 0,
    );
    const fastestRt = $derived(
        hasData
            ? Math.min(...runs.filter((r) => r.avgRt).map((r) => r.avgRt!))
            : 0,
    );
    const avgRt = $derived(
        hasData
            ? Math.round(
                  runs
                      .filter((r) => r.avgRt)
                      .reduce((s, r) => s + r.avgRt!, 0) /
                      runs.filter((r) => r.avgRt).length,
              )
            : 0,
    );

    // ── Chart helpers ─────────────────────────────────────────────────────────
    const W = 600,
        H = 160,
        PAD = { top: 12, right: 12, bottom: 32, left: 44 };
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    type ChartLine = {
        points: string;
        area: string;
        dots: { x: number; y: number; run: RunResult }[];
        yMin: number;
        yMax: number;
        yTicks: number[];
    };

    function buildChart(
        getValue: (r: RunResult) => number | null,
    ): ChartLine | null {
        const valid = runs.filter((r) => getValue(r) !== null);
        if (valid.length < 2) return null;
        const vals = valid.map((r) => getValue(r) as number);
        const yMin = Math.min(...vals);
        const yMax = Math.max(...vals);
        const range = yMax - yMin || 1;

        // Nice tick values
        const step =
            Math.ceil(range / 4 / 100) * 100 ||
            Math.ceil(range / 4 / 10) * 10 ||
            1;
        const tickMin = Math.floor(yMin / step) * step;
        const tickMax = Math.ceil(yMax / step) * step;
        const yTicks: number[] = [];
        for (let t = tickMin; t <= tickMax; t += step) yTicks.push(t);

        const xScale = (i: number) =>
            PAD.left + (i / (valid.length - 1)) * innerW;
        const yScale = (v: number) =>
            PAD.top + innerH - ((v - tickMin) / (tickMax - tickMin)) * innerH;

        const dots = valid.map((run, i) => ({
            x: xScale(i),
            y: yScale(getValue(run) as number),
            run,
        }));

        const ptStr = dots.map((d) => `${d.x},${d.y}`).join(" ");
        const area = `${PAD.left},${PAD.top + innerH} ${ptStr} ${PAD.left + innerW},${PAD.top + innerH}`;

        return {
            points: ptStr,
            area,
            dots,
            yMin: tickMin,
            yMax: tickMax,
            yTicks,
        };
    }

    const scoreChart = $derived(buildChart((r) => r.score));
    const accuracyChart = $derived(buildChart((r) => r.accuracy));
    const rtChart = $derived(buildChart((r) => r.avgRt ?? null));

    // ── Tooltip ───────────────────────────────────────────────────────────────
    let tooltip = $state<{
        x: number;
        y: number;
        run: RunResult;
        label: string;
    } | null>(null);

    function showTooltip(e: MouseEvent, run: RunResult, label: string) {
        const rect = (e.target as Element)
            .closest("svg")!
            .getBoundingClientRect();
        const svgEl = (e.target as Element).closest("svg")!;
        const svgRect = svgEl.getBoundingClientRect();
        tooltip = {
            x: e.clientX - svgRect.left,
            y: e.clientY - svgRect.top - 10,
            run,
            label,
        };
    }

    function hideTooltip() {
        tooltip = null;
    }

    // ── Format helpers ─────────────────────────────────────────────────────────
    function formatDate(ts: number) {
        return new Date(ts).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
        });
    }

    function formatTime(ts: number) {
        return new Date(ts).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    // ── Y-axis label ──────────────────────────────────────────────────────────
    function yLabel(chart: ChartLine, tick: number) {
        const y =
            PAD.top +
            innerH -
            ((tick - chart.yMin) / (chart.yMax - chart.yMin)) * innerH;
        return y;
    }
</script>

<svelte:head>
    <title>Dissociation · Stats</title>
</svelte:head>

<div class="page">
    {#if !hasData}
        <div class="empty">
            <p>No runs yet. Play the game first!</p>
            <a href="/dissociation" class="btn-primary rounded padded"
                >Play now</a
            >
        </div>
    {:else}
        <!-- ── Summary cards ───────────────────────────────────────────────── -->
        <section class="section">
            <h2 class="section-title">Overview</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <span class="summary-val">{totalPlays}</span>
                    <span class="summary-lbl">Total plays</span>
                </div>
                <div class="summary-card highlight">
                    <span class="summary-val">{bestScore.toLocaleString()}</span
                    >
                    <span class="summary-lbl">Best score</span>
                </div>
                <div class="summary-card">
                    <span class="summary-val">{bestAccuracy}%</span>
                    <span class="summary-lbl">Best accuracy</span>
                </div>
                <div class="summary-card">
                    <span class="summary-val">{avgAccuracy}%</span>
                    <span class="summary-lbl">Avg accuracy</span>
                </div>
                <div class="summary-card">
                    <span class="summary-val">{fastestRt}<small>ms</small></span
                    >
                    <span class="summary-lbl">Fastest response</span>
                </div>
                <div class="summary-card">
                    <span class="summary-val">{avgRt}<small>ms</small></span>
                    <span class="summary-lbl">Avg response</span>
                </div>
            </div>
        </section>

        <!-- ── Score chart ─────────────────────────────────────────────────── -->
        {#if scoreChart}
            <section class="section">
                <h2 class="section-title">Score over time</h2>
                <div class="chart-wrap" style="position:relative">
                    <svg width="100%" viewBox="0 0 {W} {H}" class="chart-svg">
                        <defs>
                            <linearGradient
                                id="score-grad"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stop-color="#4B7BE8"
                                    stop-opacity="0.15"
                                />
                                <stop
                                    offset="100%"
                                    stop-color="#4B7BE8"
                                    stop-opacity="0"
                                />
                            </linearGradient>
                        </defs>
                        <!-- Grid lines -->
                        {#each scoreChart.yTicks as tick}
                            {@const y = yLabel(scoreChart, tick)}
                            <line
                                x1={PAD.left}
                                y1={y}
                                x2={PAD.left + innerW}
                                y2={y}
                                stroke="#e5e5e5"
                                stroke-width="1"
                            />
                            <text
                                x={PAD.left - 6}
                                y={y + 4}
                                text-anchor="end"
                                font-size="10"
                                fill="#aaa">{tick.toLocaleString()}</text
                            >
                        {/each}
                        <!-- Area + line -->
                        <polygon
                            points={scoreChart.area}
                            fill="url(#score-grad)"
                        />
                        <polyline
                            points={scoreChart.points}
                            fill="none"
                            stroke="#4B7BE8"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                        <!-- Dots -->
                        {#each scoreChart.dots as d}
                            <circle
                                cx={d.x}
                                cy={d.y}
                                r="4"
                                fill="#4B7BE8"
                                stroke="white"
                                stroke-width="2"
                                style="cursor:pointer"
                                onmouseenter={(e) =>
                                    showTooltip(e, d.run, "Score")}
                                onmouseleave={hideTooltip}
                            />
                        {/each}
                        <!-- X axis labels — show first, last, and every ~4th -->
                        {#each scoreChart.dots as d, i}
                            {#if i === 0 || i === scoreChart.dots.length - 1 || i % Math.max(1, Math.floor(scoreChart.dots.length / 6)) === 0}
                                <text
                                    x={d.x}
                                    y={H - 6}
                                    text-anchor="middle"
                                    font-size="10"
                                    fill="#aaa">{formatDate(d.run.date)}</text
                                >
                            {/if}
                        {/each}
                    </svg>
                    {#if tooltip}
                        <div
                            class="tooltip"
                            style="left:{tooltip.x}px; top:{tooltip.y}px"
                        >
                            <strong
                                >{tooltip.run.score.toLocaleString()} pts</strong
                            >
                            <span>{tooltip.run.accuracy}% accuracy</span>
                            <span>{tooltip.run.avgRt ?? "—"}ms avg</span>
                            <span class="tt-date"
                                >{formatDate(tooltip.run.date)}
                                {formatTime(tooltip.run.date)}</span
                            >
                        </div>
                    {/if}
                </div>
            </section>
        {/if}

        <!-- ── Accuracy chart ──────────────────────────────────────────────── -->
        {#if accuracyChart}
            <section class="section">
                <h2 class="section-title">Accuracy over time</h2>
                <div class="chart-wrap" style="position:relative">
                    <svg width="100%" viewBox="0 0 {W} {H}" class="chart-svg">
                        <defs>
                            <linearGradient
                                id="acc-grad"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stop-color="#22C55E"
                                    stop-opacity="0.15"
                                />
                                <stop
                                    offset="100%"
                                    stop-color="#22C55E"
                                    stop-opacity="0"
                                />
                            </linearGradient>
                        </defs>
                        {#each accuracyChart.yTicks as tick}
                            {@const y = yLabel(accuracyChart, tick)}
                            <line
                                x1={PAD.left}
                                y1={y}
                                x2={PAD.left + innerW}
                                y2={y}
                                stroke="#e5e5e5"
                                stroke-width="1"
                            />
                            <text
                                x={PAD.left - 6}
                                y={y + 4}
                                text-anchor="end"
                                font-size="10"
                                fill="#aaa">{tick}%</text
                            >
                        {/each}
                        <polygon
                            points={accuracyChart.area}
                            fill="url(#acc-grad)"
                        />
                        <polyline
                            points={accuracyChart.points}
                            fill="none"
                            stroke="#22C55E"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                        {#each accuracyChart.dots as d}
                            <circle
                                cx={d.x}
                                cy={d.y}
                                r="4"
                                fill="#22C55E"
                                stroke="white"
                                stroke-width="2"
                                style="cursor:pointer"
                                onmouseenter={(e) =>
                                    showTooltip(e, d.run, "Accuracy")}
                                onmouseleave={hideTooltip}
                            />
                        {/each}
                        {#each accuracyChart.dots as d, i}
                            {#if i === 0 || i === accuracyChart.dots.length - 1 || i % Math.max(1, Math.floor(accuracyChart.dots.length / 6)) === 0}
                                <text
                                    x={d.x}
                                    y={H - 6}
                                    text-anchor="middle"
                                    font-size="10"
                                    fill="#aaa">{formatDate(d.run.date)}</text
                                >
                            {/if}
                        {/each}
                    </svg>
                    {#if tooltip}
                        <div
                            class="tooltip"
                            style="left:{tooltip.x}px; top:{tooltip.y}px"
                        >
                            <strong>{tooltip.run.accuracy}%</strong>
                            <span>{tooltip.run.score.toLocaleString()} pts</span
                            >
                            <span>{tooltip.run.avgRt ?? "—"}ms avg</span>
                            <span class="tt-date"
                                >{formatDate(tooltip.run.date)}
                                {formatTime(tooltip.run.date)}</span
                            >
                        </div>
                    {/if}
                </div>
            </section>
        {/if}

        <!-- ── Response time chart ─────────────────────────────────────────── -->
        {#if rtChart}
            <section class="section">
                <h2 class="section-title">
                    Avg response time over time <span class="section-note"
                        >(lower = faster)</span
                    >
                </h2>
                <div class="chart-wrap" style="position:relative">
                    <svg width="100%" viewBox="0 0 {W} {H}" class="chart-svg">
                        <defs>
                            <linearGradient
                                id="rt-grad"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stop-color="#F97316"
                                    stop-opacity="0.15"
                                />
                                <stop
                                    offset="100%"
                                    stop-color="#F97316"
                                    stop-opacity="0"
                                />
                            </linearGradient>
                        </defs>
                        {#each rtChart.yTicks as tick}
                            {@const y = yLabel(rtChart, tick)}
                            <line
                                x1={PAD.left}
                                y1={y}
                                x2={PAD.left + innerW}
                                y2={y}
                                stroke="#e5e5e5"
                                stroke-width="1"
                            />
                            <text
                                x={PAD.left - 6}
                                y={y + 4}
                                text-anchor="end"
                                font-size="10"
                                fill="#aaa">{tick}ms</text
                            >
                        {/each}
                        <polygon points={rtChart.area} fill="url(#rt-grad)" />
                        <polyline
                            points={rtChart.points}
                            fill="none"
                            stroke="#F97316"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                        {#each rtChart.dots as d}
                            <circle
                                cx={d.x}
                                cy={d.y}
                                r="4"
                                fill="#F97316"
                                stroke="white"
                                stroke-width="2"
                                style="cursor:pointer"
                                onmouseenter={(e) =>
                                    showTooltip(e, d.run, "Response time")}
                                onmouseleave={hideTooltip}
                            />
                        {/each}
                        {#each rtChart.dots as d, i}
                            {#if i === 0 || i === rtChart.dots.length - 1 || i % Math.max(1, Math.floor(rtChart.dots.length / 6)) === 0}
                                <text
                                    x={d.x}
                                    y={H - 6}
                                    text-anchor="middle"
                                    font-size="10"
                                    fill="#aaa">{formatDate(d.run.date)}</text
                                >
                            {/if}
                        {/each}
                    </svg>
                    {#if tooltip}
                        <div
                            class="tooltip"
                            style="left:{tooltip.x}px; top:{tooltip.y}px"
                        >
                            <strong>{tooltip.run.avgRt ?? "—"}ms</strong>
                            <span>{tooltip.run.accuracy}% accuracy</span>
                            <span>{tooltip.run.score.toLocaleString()} pts</span
                            >
                            <span class="tt-date"
                                >{formatDate(tooltip.run.date)}
                                {formatTime(tooltip.run.date)}</span
                            >
                        </div>
                    {/if}
                </div>
            </section>
        {/if}

        <!-- ── Run history table ───────────────────────────────────────────── -->
        <section class="section">
            <h2 class="section-title">Run history</h2>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Date</th>
                            <th>Score</th>
                            <th>Accuracy</th>
                            <th>Correct</th>
                            <th>Avg RT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each [...runs].reverse() as run, i}
                            {@const isBest = run.score === bestScore}
                            <tr class:best-row={isBest}>
                                <td class="num">{runs.length - i}</td>
                                <td class="date-cell"
                                    >{formatDate(run.date)}<span class="time"
                                        >{formatTime(run.date)}</span
                                    ></td
                                >
                                <td class="score-cell">
                                    {run.score.toLocaleString()}
                                    {#if isBest}<span class="badge">best</span
                                        >{/if}
                                </td>
                                <td>
                                    <div class="acc-bar-wrap">
                                        <div
                                            class="acc-bar"
                                            style:width="{run.accuracy}%"
                                            style:background={run.accuracy >= 80
                                                ? "#22C55E"
                                                : run.accuracy >= 60
                                                  ? "#F59E0B"
                                                  : "#EF4444"}
                                        ></div>
                                        <span>{run.accuracy}%</span>
                                    </div>
                                </td>
                                <td>{run.correct}/{run.total}</td>
                                <td
                                    >{run.avgRt ?? "—"}{run.avgRt
                                        ? "ms"
                                        : ""}</td
                                >
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </section>

        <!-- ── Clear data ──────────────────────────────────────────────────── -->
        <section class="section">
            <button
                class="btn-danger"
                onclick={() => {
                    if (
                        confirm(
                            "Clear all dissociation stats? This cannot be undone.",
                        )
                    ) {
                        progress.clear("dissociation");
                    }
                }}
            >
                Clear all stats
            </button>
        </section>
    {/if}
</div>

<style>
    .page {
        max-width: 760px;
        margin: 0 auto;
        padding: 32px 24px 80px;
    }

    .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 80px 0;
        text-align: center;
        color: #aaa;
    }

    /* ── Sections ─────────────────────────────────────────────────────────── */
    .section {
        margin-bottom: 40px;
    }

    .section-title {
        font-size: 14px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 14px;
        display: flex;
        align-items: baseline;
        gap: 8px;
    }

    .section-note {
        font-size: 11px;
        font-weight: 600;
        color: #aaa;
        text-transform: none;
        letter-spacing: 0;
    }

    /* ── Summary grid ─────────────────────────────────────────────────────── */
    .summary-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
    }

    .summary-card {
        border: 1.5px solid #ddd;
        padding: 14px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .summary-card.highlight {
        border-color: #4b7be8;
        background: #ebf0fd;
    }

    .summary-val {
        font-size: 22px;
        font-weight: 900;
        letter-spacing: -0.03em;
        line-height: 1;
    }

    .summary-val small {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0;
    }

    .summary-lbl {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #999;
    }

    /* ── Charts ───────────────────────────────────────────────────────────── */
    .chart-wrap {
        border: 1.5px solid #ddd;
        overflow: visible;
    }

    .chart-svg {
        display: block;
    }

    .tooltip {
        position: absolute;
        background: white;
        border: 1.5px solid #ddd;
        padding: 8px 10px;
        font-size: 12px;
        font-weight: 600;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 2px;
        transform: translate(-50%, -100%);
        white-space: nowrap;
        z-index: 10;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .tooltip strong {
        font-size: 14px;
    }

    .tt-date {
        color: #aaa;
        font-size: 10px;
        margin-top: 2px;
    }

    /* ── Table ────────────────────────────────────────────────────────────── */
    .table-wrap {
        overflow-x: auto;
        border: 1.5px solid #ddd;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
    }

    th {
        text-align: left;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #999;
        padding: 10px 12px;
        border-bottom: 1.5px solid #ddd;
        white-space: nowrap;
    }

    td {
        padding: 10px 12px;
        border-bottom: 1px solid #f0f0f0;
        vertical-align: middle;
    }

    tr:last-child td {
        border-bottom: none;
    }

    tr.best-row {
        background: #ebf0fd;
    }

    .num {
        color: #bbb;
        font-size: 11px;
    }

    .date-cell {
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .time {
        font-size: 10px;
        color: #bbb;
    }

    .score-cell {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
    }

    .badge {
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: #4b7be8;
        color: white;
        padding: 1px 5px;
        border-radius: 3px;
    }

    .acc-bar-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .acc-bar {
        height: 6px;
        border-radius: 3px;
        min-width: 2px;
        max-width: 80px;
    }

    /* ── Actions ──────────────────────────────────────────────────────────── */
    .btn-primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #4b7be8;
        color: white;
        text-decoration: none;
        font-weight: 700;
        font-size: 14px;
    }

    .btn-danger {
        font-size: 12px;
        font-weight: 700;
        color: #ef4444;
        background: none;
        border: 1.5px solid #ef4444;
        padding: 8px 14px;
        cursor: pointer;
        font-family: inherit;
        transition:
            background 0.1s,
            color 0.1s;
    }

    .btn-danger:hover {
        background: #ef4444;
        color: white;
    }

    @media (max-width: 520px) {
        .summary-grid {
            grid-template-columns: repeat(2, 1fr);
        }
        .page {
            padding: 20px 14px 60px;
        }
    }
</style>
