<script lang="ts">
    import "/src/styles/reset.css";
    import "/src/styles/style.css";
    import "/src/styles/utils.css";

    let { children } = $props();
</script>

{@render children()}
