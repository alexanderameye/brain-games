<script>
    import { progress } from "$lib/stores.svelte.js";

    const games = [
        {
            id: "dissociation",
            href: "/dissociation",
            title: "Dissociation",
            emoji: "🔄",
            tag: "Cognitive Flexibility",
            description:
                "Rules switch based on shape properties. Can you keep up?",
            color: "#4B7BE8",
            bg: "#EBF0FD",
            available: true,
        },
    ];

    function getStats(gameId) {
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
        <div class="header-inner">
            <div class="brand">
                <div class="brand-text">
                    <h1>Pilot Training</h1>
                    <p>Games to train for pilot exam</p>
                </div>
            </div>
        </div>
    </header>

    <main>
        <div class="section-head">
            <h2>All Games</h2>
        </div>

        <div class="grid">
            {#each games as game}
                {@const stats = game.available ? getStats(game.id) : null}
                <article class="card" class:dimmed={!game.available}>
                    <div class="card-top" style:background={game.bg}>
                        <span class="card-emoji">{game.emoji}</span>
                        <span class="tag" style:color={game.color}
                            >{game.tag}</span
                        >
                    </div>

                    <div class="card-body">
                        <h3>{game.title}</h3>
                        <p class="desc">{game.description}</p>

                        {#if game.available}
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

                            <a
                                href={game.href}
                                class="btn-play"
                                style:background={game.color}
                            >
                                {stats ? "Play Again" : "Play Now"}
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                >
                                    <path
                                        d="M4 2.5l9 5.5-9 5.5V2.5z"
                                        fill="currentColor"
                                    />
                                </svg>
                            </a>
                        {:else}
                            <div class="coming-badge">Coming soon</div>
                        {/if}
                    </div>
                </article>
            {/each}
        </div>
    </main>
</div>

<style>
    .page {
        min-height: 100vh;
    }

    header {
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        padding: 0 24px;
        position: sticky;
        top: 0;
        z-index: 100;
        box-shadow: var(--shadow-sm);
    }

    .header-inner {
        max-width: 960px;
        margin: 0 auto;
        padding: 18px 0;
    }

    .brand {
        display: flex;
        align-items: center;
        gap: 14px;
    }

    .brain-icon {
        font-size: 38px;
        line-height: 1;
    }

    .brand-text h1 {
        font-size: 22px;
        font-weight: 900;
        color: var(--text);
        letter-spacing: -0.02em;
        line-height: 1.1;
    }

    .brand-text p {
        font-size: 13px;
        color: var(--text-muted);
        margin-top: 2px;
        font-weight: 500;
    }

    main {
        max-width: 960px;
        margin: 0 auto;
        padding: 44px 24px 80px;
    }

    .section-head {
        margin-bottom: 28px;
    }

    .section-head h2 {
        font-size: 28px;
        font-weight: 900;
        letter-spacing: -0.02em;
    }

    .section-head p {
        font-size: 14px;
        color: var(--text-muted);
        margin-top: 5px;
        font-weight: 500;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 20px;
    }

    .card {
        background: var(--surface);
        border-radius: var(--radius);
        overflow: hidden;
        box-shadow: var(--shadow);
        border: 1px solid var(--border);
        transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
    }

    .card:hover {
        transform: translateY(-3px);
        box-shadow: var(--shadow-lg);
    }

    .card.dimmed {
        opacity: 0.55;
        pointer-events: none;
    }

    .card-top {
        padding: 22px 20px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .card-emoji {
        font-size: 34px;
        line-height: 1;
    }

    .tag {
        font-size: 10.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        background: rgba(255, 255, 255, 0.72);
        padding: 4px 11px;
        border-radius: 99px;
    }

    .card-body {
        padding: 18px 20px 20px;
    }

    .card-body h3 {
        font-size: 18px;
        font-weight: 800;
        margin-bottom: 7px;
        letter-spacing: -0.01em;
    }

    .desc {
        font-size: 13.5px;
        color: var(--text-muted);
        line-height: 1.6;
        margin-bottom: 16px;
        font-weight: 500;
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
        color: var(--text);
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
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 12px 16px;
        border-radius: var(--radius-sm);
        color: white;
        font-size: 15px;
        font-weight: 800;
        text-decoration: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transition:
            opacity 0.12s,
            transform 0.12s,
            box-shadow 0.12s;
    }

    .btn-play:hover {
        opacity: 0.92;
        transform: translateY(-1px);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
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
