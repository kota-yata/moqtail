<script lang="ts">
  export let key: string;
  export let defaultVal: string;
</script>

<div class="w-full flex items-center justify-center">
  <label class="text-sm text-gray-700" for="val">{key}</label>
  <input class="ml-2 w-1/2 max-w-[300px]" type="text" name="val" bind:value={defaultVal} />
</div>
