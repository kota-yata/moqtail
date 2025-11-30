<script>
  import '../app.css';
</script>

<div class="min-h-screen flex flex-col">
  <header class="border-b px-4 py-3">
    <nav class="flex items-center gap-4 text-sm">
      <a class="text-gray-700 hover:text-gray-900" href="/">Home</a>
      <a class="text-gray-700 hover:text-gray-900" href="/demo">Demo</a>
      <a class="text-gray-700 hover:text-gray-900" href="/docs">Docs</a>
    </nav>
  </header>
  <main class="flex-1 w-full max-w-screen-xl mx-auto p-4">
    <slot />
  </main>
  <footer class="flex items-center justify-center py-4 bg-gray-200 text-sm text-gray-700">
    <p>Kota Yatagai</p>
  </footer>
</div>
