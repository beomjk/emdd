<script lang="ts">
  let {
    message,
    visible,
  }: {
    message: string;
    visible: boolean;
  } = $props();
</script>

{#if visible}
  <div class="toast" role="status">
    {message}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 8px 16px;
    background: var(--toast-bg);
    color: var(--toast-color);
    border-radius: 4px;
    font-size: 13px;
    z-index: 100;
    animation: toast-in 0.3s ease-out;
  }
  @keyframes toast-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
