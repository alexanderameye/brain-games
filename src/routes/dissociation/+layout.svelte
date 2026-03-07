<script>
    let { children } = $props();
</script>

<svelte:head>
    <title>Dissociation</title>
</svelte:head>

<header>
    <a href="/" class="btn-back">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
                d="M11 3.5L5.5 9 11 14.5"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
        Back
    </a>
    <div class="game-title">
        <span>🔄</span>
        <span>Dissociation</span>
    </div>
    <div class="spacer"></div>
</header>

{@render children()}

<style>
    header {
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        padding: 0 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: var(--shadow-sm);
        position: sticky;
        top: 0;
        z-index: 100;
    }

    .btn-back {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 14px;
        border-radius: var(--radius-sm);
        color: var(--text-muted);
        font-size: 14px;
        font-weight: 700;
        text-decoration: none;
        width: 80px;
        transition:
            background 0.12s,
            color 0.12s;
    }

    .btn-back:hover {
        background: var(--bg);
        color: var(--text);
    }

    .game-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 17px;
        font-weight: 800;
        padding: 18px 0;
        letter-spacing: -0.01em;
    }

    .spacer {
        width: 80px;
    }
</style>
