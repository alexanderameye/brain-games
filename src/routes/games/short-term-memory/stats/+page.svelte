<script lang="ts">
    import { progress } from "$lib/stores.svelte";
    import type { RunResult } from "$lib/games/dissociation.js";

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

    // ── Day grouping ──────────────────────────────────────────────────────────
    // Groups runs by calendar day and builds open/high/low/close per day.
    function dayKey(ts: number): string {
        const d = new Date(ts);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }

    interface DayCandle {
        date: number; // timestamp of first run that day
        open: number; // first run
        close: number; // last run
        high: number;
        low: number;
        runs: RunResult[];
    }

    function groupByDay(
        getValue: (r: RunResult) => number | null,
    ): DayCandle[] {
        const map = new Map<
            string,
            { date: number; vals: number[]; runs: RunResult[] }
        >();
        for (const run of runs) {
            const v = getValue(run);
            if (v === null) continue;
            const key = dayKey(run.date);
            if (!map.has(key))
                map.set(key, { date: run.date, vals: [], runs: [] });
            map.get(key)!.vals.push(v);
            map.get(key)!.runs.push(run);
        }
        return [...map.values()].map(({ date, vals, runs }) => ({
            date,
            open: vals[0],
            close: vals[vals.length - 1],
            high: Math.max(...vals),
            low: Math.min(...vals),
            runs,
        }));
    }

    // ── Chart constants ───────────────────────────────────────────────────────
    const W = 600,
        H = 180;
    const PAD = { top: 16, right: 16, bottom: 32, left: 48 };
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const CANDLE_W = 12; // max body width; scales down when many candles

    interface CandleChart {
        candles: Array<{
            x: number;
            yHigh: number;
            yLow: number;
            yOpen: number;
            yClose: number;
            up: boolean; // close >= open
            day: DayCandle;
        }>;
        yTicks: number[];
        yMin: number;
        yMax: number;
    }

    function buildCandleChart(
        getValue: (r: RunResult) => number | null,
    ): CandleChart | null {
        const days = groupByDay(getValue);
        if (days.length < 1) return null;

        const allVals = days.flatMap((d) => [d.high, d.low]);
        const rawMin = Math.min(...allVals);
        const rawMax = Math.max(...allVals);
        const range = rawMax - rawMin || 1;

        // Nice round ticks
        const magnitude = Math.pow(10, Math.floor(Math.log10(range)));
        const step = Math.ceil(range / 4 / magnitude) * magnitude || 1;
        const yMin = Math.floor(rawMin / step) * step;
        const yMax = Math.ceil(rawMax / step) * step;
        const yTicks: number[] = [];
        for (let t = yMin; t <= yMax; t += step) yTicks.push(t);

        const yScale = (v: number) =>
            PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

        const xStep = days.length > 1 ? innerW / (days.length - 1) : innerW / 2;
        const xOf = (i: number) =>
            days.length > 1 ? PAD.left + i * xStep : PAD.left + innerW / 2;

        const candles = days.map((day, i) => ({
            x: xOf(i),
            yHigh: yScale(day.high),
            yLow: yScale(day.low),
            yOpen: yScale(day.open),
            yClose: yScale(day.close),
            up: day.close >= day.open,
            day,
        }));

        return { candles, yTicks, yMin, yMax };
    }

    const scoreChart = $derived(buildCandleChart((r) => r.score));
    const accuracyChart = $derived(buildCandleChart((r) => r.accuracy));
    const rtChart = $derived(buildCandleChart((r) => r.avgRt ?? null));

    // ── Tooltip ───────────────────────────────────────────────────────────────
    interface TooltipData {
        x: number;
        y: number;
        day: DayCandle;
        unit: string;
        fmt: (v: number) => string;
    }
    let tooltip = $state<TooltipData | null>(null);

    function showTooltip(
        e: MouseEvent,
        day: DayCandle,
        unit: string,
        fmt: (v: number) => string,
    ) {
        const svg = (e.target as Element)
            .closest("svg")!
            .getBoundingClientRect();
        tooltip = {
            x: e.clientX - svg.left,
            y: e.clientY - svg.top - 12,
            day,
            unit,
            fmt,
        };
    }

    function hideTooltip() {
        tooltip = null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
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

    function candleWidth(n: number): number {
        // Shrink candle body when there are many days
        return Math.max(4, Math.min(CANDLE_W, Math.floor(innerW / (n * 1.8))));
    }

    function yLabel(chart: CandleChart, tick: number): number {
        return (
            PAD.top +
            innerH -
            ((tick - chart.yMin) / (chart.yMax - chart.yMin)) * innerH
        );
    }
</script>

<svelte:head>
    <title>Dissociation · Stats</title>
</svelte:head>

<div class="page">
    {#if !hasData}
        <div class="empty">
            <p>No runs yet — play the game first!</p>
            <a href="/dissociation" class="btn-primary rounded padded"
                >Play now</a
            >
        </div>
    {:else}
        <!-- ── Overview ───────────────────────────────────────────────────────── -->
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
                    <span class="summary-lbl">Avg response time</span>
                </div>
            </div>
        </section>

        <!-- ── Score candlestick ──────────────────────────────────────────────── -->
        {#if scoreChart}
            {@const cw = candleWidth(scoreChart.candles.length)}
            <section class="section">
                <h2 class="section-title">
                    Score
                    <span class="section-note"
                        >one candle per day · open→close body · high/low wicks</span
                    >
                </h2>
                <div class="chart-wrap">
                    <svg width="100%" viewBox="0 0 {W} {H}" class="chart-svg">
                        <!-- Grid + y-axis -->
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
                        <!-- Candles -->
                        {#each scoreChart.candles as c}
                            <!-- Wick -->
                            <line
                                x1={c.x}
                                y1={c.yHigh}
                                x2={c.x}
                                y2={c.yLow}
                                stroke={c.up ? "#22C55E" : "#EF4444"}
                                stroke-width="1.5"
                            />
                            <!-- Body — min 2px height so single-run days show clearly -->
                            {@const bodyTop = Math.min(c.yOpen, c.yClose)}
                            {@const bodyHeight = Math.max(
                                2,
                                Math.abs(c.yClose - c.yOpen),
                            )}
                            <rect
                                x={c.x - cw / 2}
                                y={bodyTop}
                                width={cw}
                                height={bodyHeight}
                                fill={c.up ? "#22C55E" : "#EF4444"}
                                style="cursor:pointer"
                                onmouseenter={(e) =>
                                    showTooltip(e, c.day, "pts", (v) =>
                                        v.toLocaleString(),
                                    )}
                                onmouseleave={hideTooltip}
                            />
                        {/each}
                        <!-- X labels -->
                        {#each scoreChart.candles as c, i}
                            {#if i === 0 || i === scoreChart.candles.length - 1 || i % Math.max(1, Math.floor(scoreChart.candles.length / 5)) === 0}
                                <text
                                    x={c.x}
                                    y={H - 6}
                                    text-anchor="middle"
                                    font-size="10"
                                    fill="#aaa">{formatDate(c.day.date)}</text
                                >
                            {/if}
                        {/each}
                    </svg>
                    {#if tooltip}
                        <div
                            class="tooltip"
                            style="left:{tooltip.x}px; top:{tooltip.y}px"
                        >
                            <strong>{formatDate(tooltip.day.date)}</strong>
                            <span
                                >High: <b>{tooltip.fmt(tooltip.day.high)}</b>
                                {tooltip.unit}</span
                            >
                            <span
                                >Low: <b>{tooltip.fmt(tooltip.day.low)}</b>
                                {tooltip.unit}</span
                            >
                            <span
                                >Open: {tooltip.fmt(tooltip.day.open)}
                                {tooltip.unit}</span
                            >
                            <span
                                >Close: {tooltip.fmt(tooltip.day.close)}
                                {tooltip.unit}</span
                            >
                            <span class="tt-muted"
                                >{tooltip.day.runs.length} run{tooltip.day.runs
                                    .length > 1
                                    ? "s"
                                    : ""} that day</span
                            >
                        </div>
                    {/if}
                </div>
            </section>
        {/if}

        <!-- ── Accuracy candlestick ───────────────────────────────────────────── -->
        {#if accuracyChart}
            {@const cw = candleWidth(accuracyChart.candles.length)}
            <section class="section">
                <h2 class="section-title">Accuracy</h2>
                <div class="chart-wrap">
                    <svg width="100%" viewBox="0 0 {W} {H}" class="chart-svg">
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
                        {#each accuracyChart.candles as c}
                            <line
                                x1={c.x}
                                y1={c.yHigh}
                                x2={c.x}
                                y2={c.yLow}
                                stroke={c.up ? "#22C55E" : "#EF4444"}
                                stroke-width="1.5"
                            />
                            {@const bodyTop = Math.min(c.yOpen, c.yClose)}
                            {@const bodyHeight = Math.max(
                                2,
                                Math.abs(c.yClose - c.yOpen),
                            )}
                            <rect
                                x={c.x - cw / 2}
                                y={bodyTop}
                                width={cw}
                                height={bodyHeight}
                                fill={c.up ? "#22C55E" : "#EF4444"}
                                style="cursor:pointer"
                                onmouseenter={(e) =>
                                    showTooltip(e, c.day, "%", (v) =>
                                        v.toString(),
                                    )}
                                onmouseleave={hideTooltip}
                            />
                        {/each}
                        {#each accuracyChart.candles as c, i}
                            {#if i === 0 || i === accuracyChart.candles.length - 1 || i % Math.max(1, Math.floor(accuracyChart.candles.length / 5)) === 0}
                                <text
                                    x={c.x}
                                    y={H - 6}
                                    text-anchor="middle"
                                    font-size="10"
                                    fill="#aaa">{formatDate(c.day.date)}</text
                                >
                            {/if}
                        {/each}
                    </svg>
                    {#if tooltip}
                        <div
                            class="tooltip"
                            style="left:{tooltip.x}px; top:{tooltip.y}px"
                        >
                            <strong>{formatDate(tooltip.day.date)}</strong>
                            <span
                                >High: <b>{tooltip.fmt(tooltip.day.high)}</b>
                                {tooltip.unit}</span
                            >
                            <span
                                >Low: <b>{tooltip.fmt(tooltip.day.low)}</b>
                                {tooltip.unit}</span
                            >
                            <span
                                >Open: {tooltip.fmt(tooltip.day.open)}
                                {tooltip.unit}</span
                            >
                            <span
                                >Close: {tooltip.fmt(tooltip.day.close)}
                                {tooltip.unit}</span
                            >
                            <span class="tt-muted"
                                >{tooltip.day.runs.length} run{tooltip.day.runs
                                    .length > 1
                                    ? "s"
                                    : ""} that day</span
                            >
                        </div>
                    {/if}
                </div>
            </section>
        {/if}

        <!-- ── Response time candlestick ──────────────────────────────────────── -->
        {#if rtChart}
            {@const cw = candleWidth(rtChart.candles.length)}
            <section class="section">
                <h2 class="section-title">
                    Avg response time
                    <span class="section-note"
                        >lower = faster · green = improved</span
                    >
                </h2>
                <div class="chart-wrap">
                    <svg width="100%" viewBox="0 0 {W} {H}" class="chart-svg">
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
                        {#each rtChart.candles as c}
                            <!-- For RT, "up" (close > open) means got slower — color inverted -->
                            {@const improved = c.close <= c.open}
                            <line
                                x1={c.x}
                                y1={c.yHigh}
                                x2={c.x}
                                y2={c.yLow}
                                stroke={improved ? "#22C55E" : "#EF4444"}
                                stroke-width="1.5"
                            />
                            {@const bodyTop = Math.min(c.yOpen, c.yClose)}
                            {@const bodyHeight = Math.max(
                                2,
                                Math.abs(c.yClose - c.yOpen),
                            )}
                            <rect
                                x={c.x - cw / 2}
                                y={bodyTop}
                                width={cw}
                                height={bodyHeight}
                                fill={improved ? "#22C55E" : "#EF4444"}
                                style="cursor:pointer"
                                onmouseenter={(e) =>
                                    showTooltip(e, c.day, "ms", (v) =>
                                        v.toString(),
                                    )}
                                onmouseleave={hideTooltip}
                            />
                        {/each}
                        {#each rtChart.candles as c, i}
                            {#if i === 0 || i === rtChart.candles.length - 1 || i % Math.max(1, Math.floor(rtChart.candles.length / 5)) === 0}
                                <text
                                    x={c.x}
                                    y={H - 6}
                                    text-anchor="middle"
                                    font-size="10"
                                    fill="#aaa">{formatDate(c.day.date)}</text
                                >
                            {/if}
                        {/each}
                    </svg>
                    {#if tooltip}
                        <div
                            class="tooltip"
                            style="left:{tooltip.x}px; top:{tooltip.y}px"
                        >
                            <strong>{formatDate(tooltip.day.date)}</strong>
                            <span
                                >Fastest: <b>{tooltip.fmt(tooltip.day.low)}</b>
                                {tooltip.unit}</span
                            >
                            <span
                                >Slowest: <b>{tooltip.fmt(tooltip.day.high)}</b>
                                {tooltip.unit}</span
                            >
                            <span
                                >First: {tooltip.fmt(tooltip.day.open)}
                                {tooltip.unit}</span
                            >
                            <span
                                >Last: {tooltip.fmt(tooltip.day.close)}
                                {tooltip.unit}</span
                            >
                            <span class="tt-muted"
                                >{tooltip.day.runs.length} run{tooltip.day.runs
                                    .length > 1
                                    ? "s"
                                    : ""} that day</span
                            >
                        </div>
                    {/if}
                </div>
            </section>
        {/if}

        <!-- ── Run history table ───────────────────────────────────────────────── -->
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
                                <td class="date-cell">
                                    {formatDate(run.date)}
                                    <span class="time"
                                        >{formatTime(run.date)}</span
                                    >
                                </td>
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

        <!-- ── Clear ──────────────────────────────────────────────────────────── -->
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

    .section {
        margin-bottom: 40px;
    }

    .section-title {
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 14px;
        display: flex;
        align-items: baseline;
        gap: 10px;
        flex-wrap: wrap;
    }

    .section-note {
        font-size: 11px;
        font-weight: 600;
        color: #aaa;
        text-transform: none;
        letter-spacing: 0;
    }

    /* ── Summary ──────────────────────────────────────────────────────────── */
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
        position: relative;
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
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 3px;
        transform: translate(-50%, -100%);
        white-space: nowrap;
        z-index: 10;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .tooltip strong {
        font-size: 13px;
        font-weight: 800;
        margin-bottom: 2px;
    }

    .tt-muted {
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

    /* ── Buttons ──────────────────────────────────────────────────────────── */
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
