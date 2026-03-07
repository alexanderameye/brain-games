<script lang="ts">
    import { progress } from "$lib/stores.svelte";

    const games = [
        {
            id: "dissociation",
            href: "/games/dissociation",
            statsHref: "/dissociation/stats",
            title: "Dissociation",
            description: "Rules switch based on shape properties. ",
            color: "var(--blue)",
        },
        {
            id: "short-term-memory",
            href: "/games/short-term-memory",
            statsHref: "/short-term-memory/stats",
            title: "Short term memory",

            description: "Train short term memory",
            color: "var(--green)",
        },
    ];

    function getStats(gameId: string) {
        const results = progress.get(gameId);
        if (!results.length) return null;
        const last = results[results.length - 1];
        const best = results.reduce(
            (b, r) => (r.score > b.score ? r : b),
            results[0],
        );
        return { last, best, plays: results.length };
    }
</script>

<svelte:head>
    <title>Pilot Training</title>
</svelte:head>

<div class="page">
    <header>
        <h1>Pilot Training</h1>
        <p>Games to train for pilot exam</p>
    </header>
    <main>
        <div class="grid">
            {#each games as game}
                {@const stats = getStats(game.id)}
                <article
                    class="card padded flex-col justify-content:space-between"
                >
                    <div class="game-description">
                        <h3>{game.title}</h3>
                        <p>{game.description}</p>

                        {#if stats}
                            <div class="stats-row">
                                <div class="stat">
                                    <span class="sv"
                                        >{stats.last.accuracy}%</span
                                    >
                                    <span class="sl">Last accuracy</span>
                                </div>
                                <div class="divider"></div>
                                <div class="stat">
                                    <span class="sv"
                                        >{stats.best.score.toLocaleString()}</span
                                    >
                                    <span class="sl">Best score</span>
                                </div>
                                <div class="divider"></div>
                                <div class="stat">
                                    <span class="sv">{stats.plays}</span>
                                    <span class="sl">Plays</span>
                                </div>
                            </div>
                        {/if}
                    </div>

                    <div class="flex-row gap-small">
                        <a
                            href={game.href}
                            class="btn-play"
                            style:background={game.color}
                        >
                            Play
                        </a>

                        <a
                            href={game.statsHref}
                            class="btn-stats"
                            title="View stats"
                        >
                            <svg
                                width="15"
                                height="15"
                                viewBox="0 0 15 15"
                                fill="none"
                            >
                                <rect
                                    x="1"
                                    y="8"
                                    width="3"
                                    height="6"
                                    rx="1"
                                    fill="currentColor"
                                />
                                <rect
                                    x="6"
                                    y="5"
                                    width="3"
                                    height="9"
                                    rx="1"
                                    fill="currentColor"
                                />
                                <rect
                                    x="11"
                                    y="2"
                                    width="3"
                                    height="12"
                                    rx="1"
                                    fill="currentColor"
                                />
                            </svg>
                            Stats
                        </a>
                    </div>
                </article>
            {/each}
        </div>
    </main>
</div>

<style lang="scss">
    .page {
        min-height: 100vh;
    }

    header {
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        padding: 1rem;
        position: sticky;
        top: 0;
        z-index: 100;
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
    }

    header h1 {
        font-size: 22px;
        font-weight: 900;
        letter-spacing: -0.02em;
        line-height: 1.1;
    }

    main {
        max-width: 960px;
        margin: 0 auto;
        padding: 44px 24px 80px;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 20px;
    }

    .card {
        background: white;
        border: 2px solid black;
        overflow: hidden;
    }

    .card .game-description {
        h3 {
            font-size: 18px;
            font-weight: 800;
            margin-bottom: 7px;
            letter-spacing: -0.01em;
        }

        p {
            font-size: 13.5px;
            color: var(--text-muted);
            line-height: 1.6;
            margin-bottom: 16px;
            font-weight: 500;
        }
    }

    .stats-row {
        display: flex;
        align-items: center;
        background: var(--bg);
        border-radius: var(--radius-sm);
        padding: 12px 8px;
        margin-bottom: 14px;
    }

    .stat {
        flex: 1;
        text-align: center;
    }

    .sv {
        display: block;
        font-size: 16px;
        font-weight: 900;
        letter-spacing: -0.02em;
    }

    .sl {
        display: block;
        font-size: 10px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-top: 2px;
        font-weight: 700;
    }

    .divider {
        width: 1px;
        height: 28px;
        background: var(--border);
        flex-shrink: 0;
    }

    .btn-play {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 16px;
        color: white;
        font-size: 15px;
        font-weight: 800;
        text-decoration: none;
        transition: opacity 0.12s;
    }

    .btn-play:hover {
        opacity: 0.88;
    }

    .btn-stats {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 12px 14px;
        border: 2px solid black;
        font-size: 13px;
        font-weight: 700;
        text-decoration: none;
        color: inherit;
        white-space: nowrap;
        transition: background 0.1s;
    }

    .btn-stats:hover {
        background: #f5f5f5;
    }

    .coming-badge {
        padding: 10px;
        text-align: center;
        font-size: 13px;
        font-weight: 700;
        color: var(--text-faint);
        background: var(--bg);
        border-radius: var(--radius-sm);
    }

    @media (max-width: 600px) {
        main {
            padding: 28px 16px 60px;
        }
        .grid {
            grid-template-columns: 1fr;
        }
    }
</style>
