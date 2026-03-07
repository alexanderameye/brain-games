<script lang="ts">
    import { page } from "$app/state";

    import "/src/styles/reset.css";
    import "/src/styles/style.css";
    import "/src/styles/utils.css";

    let { children } = $props();
</script>

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
    <div class="title">
        {#if page.url.pathname.endsWith("dissociation")}
            <span>Dissociation</span>
        {:else if page.url.pathname.endsWith("short-term-memory")}
            <span>ATC Memory</span>
        {/if}
    </div>
    <div style="width:80px"></div>
</header>

{@render children()}

<style>
    header {
        background: white;
        border-bottom: 1.5px solid #ddd;
        padding: 0 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 100;
    }

    .btn-back {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 14px 8px;
        font-size: 13px;
        font-weight: 700;
        color: #888;
        text-decoration: none;
        width: 80px;
        transition: color 0.1s;
    }

    .btn-back:hover {
        color: black;
    }

    .title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        font-weight: 800;
        padding: 16px 0;
        letter-spacing: -0.01em;
    }
</style>
