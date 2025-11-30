<script>
  const links = [
    { href: '/demo', label: 'Demo' },
    { href: '/docs', label: 'Docs' }
  ];
</script>

<svelte:head>
  <title>kota-yata/moqtail</title>
  <meta name="description" content="Moqtail — a library for MoQT-based media streaming." />
</svelte:head>

<section class="text-center py-12">
  <div class="flex items-center justify-center gap-3">
    <img src="/sql.webp" alt="Moqtail logo" class="h-10 w-10 rounded" />
    <h1 class="text-4xl font-semibold tracking-tight">kota-yata/moqtail</h1>
  </div>
  <p class="text-gray-600 mt-2 mb-6">MoQT Publisher/Subscriber library</p>
  <nav class="flex gap-3 justify-center">
    {#each links as l}
      <a class="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100" href={l.href}
        >{l.label}</a
      >
    {/each}
  </nav>
  </section>

<section class="max-w-3xl mx-auto mt-8">
  <h2 class="text-2xl font-semibold">kota-yata/moqtail</h2>
  <p class="mt-3">
    kota-yata/moqtail provides simple publisher/subscriber components and utilities for experimenting with
    Media over QUIC Transport (MoQT) in the browser.
  </p>
  <ul class="list-disc pl-6 mt-3">
    <li>Try the live <a class="text-blue-600 hover:underline" href="/demo">demo</a>.</li>
    <li>Read the <a class="text-blue-600 hover:underline" href="/docs">documentation</a> to integrate it.</li>
  </ul>
</section>