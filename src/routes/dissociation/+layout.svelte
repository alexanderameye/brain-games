<script>
    import { ArrowLeft } from "@lucide/svelte";

    let { children } = $props();
</script>

<svelte:head>
    <title>Dissociation</title>
</svelte:head>

<header class="flex-row align-items:center justify-content:space-between">
    <a href="/" class="flex-row align-items:center gap-small">
        <ArrowLeft size={14} />
        Home
    </a>
    <h1>Dissociation</h1>
</header>

{@render children()}

<style lang="scss">
    header {
        background: var(--light);
        border-bottom: 2px solid var(--dark);
        padding: 1rem 1rem;
        position: sticky;
        top: 0;

        a {
            color: black;
        }

        h1 {
            font-size: 17px;
        }
    }
</style>
