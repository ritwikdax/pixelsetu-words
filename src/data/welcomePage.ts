export const WELCOME_PAGE_TITLE = 'Welcome'

export const WELCOME_PAGE_HTML = `
<p>This notebook lives in your browser. Pages stay on this device. This page is a tour — edit it, delete it, or start a new one with <code>Ctrl + Alt + N</code>.</p>

<h2>Type, then Tab</h2>
<p>Keep typing. A faint ghost word appears after you finish a word — press <strong>Tab</strong> to take it. After two letters, a popover lists completions; use arrows and Enter.</p>

<h2>Slash commands</h2>
<p>On an empty line, type <code>/</code> for headings, lists, quotes, code, to-dos, dividers, calendars, and API blocks. Type <code>/h1</code>, <code>/calendar</code>, or <code>/curl</code> to filter.</p>

<h1>Heading 1</h1>
<h2>Heading 2</h2>
<h3>Heading 3</h3>
<p>Plain paragraph. Mix <strong>bold</strong>, <em>italic</em>, <s>strikethrough</s>, and <code>inline code</code>. Links: <a href="https://tiptap.dev" class="editor-link" rel="noopener noreferrer" target="_blank">tiptap.dev</a>. Soft break next —<br>this stays in the same block.</p>

<blockquote><p>Quotes hold a line you want to remember. Insert with <code>/quote</code> or <code>Ctrl + Shift + B</code>.</p></blockquote>

<h2>Lists and to-dos</h2>
<ul>
  <li><p>Bullet — <code>/bullet</code> or <code>Ctrl + Shift + 8</code></p></li>
  <li><p>Nested ideas still belong in one list</p></li>
</ul>
<ol>
  <li><p>Numbered — <code>/numbered</code> or <code>Ctrl + Shift + 7</code></p></li>
  <li><p>Good for steps you will follow in order</p></li>
</ol>
<ul data-type="taskList" class="todo-list">
  <li data-type="taskItem" data-checked="true" class="todo-item"><p>Check off a task</p></li>
  <li data-type="taskItem" data-checked="false" class="todo-item"><p>Add another with <code>/todo</code></p></li>
  <li data-type="taskItem" data-checked="false" class="todo-item"><p>Try a new theme with <code>Ctrl + K</code> then <code>Ctrl + T</code></p></li>
</ul>

<h2>Code</h2>
<p>Inline <code>const n = 1</code> or a highlighted block via <code>/code</code> or <code>Ctrl + Alt + C</code>.</p>
<pre><code class="language-javascript">function greet(name) {
  return 'hello, ' + name
}
</code></pre>

<h2>Color chips</h2>
<p>Paste a CSS color and a swatch appears: #2563eb, tomato, rgb(45, 212, 191).</p>

<h2>Emoji</h2>
<p>Type <code>:smile:</code> or <code>:partyparrot:</code> — or <code>::</code> to open the picker. Animated GIF: <img src="https://cultofthepartyparrot.com/parrots/hd/parrot.gif" class="emoji-gif" alt="partyparrot" loading="lazy" draggable="false" /></p>

<hr>

<h2>Agents</h2>
<p>Type <code>@</code> to mention an agent, then a prompt, then Space or Enter to run. Bro is the general one; weather, calculator, and time are specialists. A Gemini API key is stored locally — set it in the terminal with <code>gemini --set-key</code>.</p>
<p>Mentions look like this: <span data-agent-mention="" data-agent-id="bro" data-active="false"></span> <span data-agent-mention="" data-agent-id="weather" data-active="false"></span> <span data-agent-mention="" data-agent-id="calculator" data-active="false"></span> <span data-agent-mention="" data-agent-id="time" data-active="false"></span></p>
<p>After a run, the answer lands in a locked block. Hover to delete, double-click to edit.</p>
<div class="agent-output" data-agent-output-block="" data-agent-output="true" data-agent-running="false" data-agent-locked="true" data-agent-thoughts="Picked a short welcome.&#10;No tools needed.">Hi — I am Bro. Ask me to calculate, look up weather, fetch a URL, or edit this note.</div>
<p>Ask Bro to GET a link — <code>@bro</code> get https://jsonplaceholder.typicode.com/todos/1 — and the JSON lands as a card or table, not a raw dump.</p>
<div data-http-result="" data-content-type="application/json" data-body="{&quot;userId&quot;:1,&quot;id&quot;:1,&quot;title&quot;:&quot;Buy milk&quot;,&quot;completed&quot;:false}"></div>
<div data-http-result="" data-content-type="application/json" data-body="[{&quot;id&quot;:1,&quot;name&quot;:&quot;Ada Lovelace&quot;,&quot;role&quot;:&quot;Engineer&quot;},{&quot;id&quot;:2,&quot;name&quot;:&quot;Grace Hopper&quot;,&quot;role&quot;:&quot;Scientist&quot;}]"></div>
<p></p>

<h2>Calendar</h2>
<p>Insert <code>/calendar</code>. The current month is selected — press Enter to drop it in. Only month and year change; the dates stay read-only. Today is marked when you are looking at this month.</p>
<div data-calendar-block="" data-month="8" data-year="2026" data-configured="true"></div>
<p></p>

<h2>API request</h2>
<p>Insert <code>/curl</code> to try an HTTP call from the page. This one is already pointed at a public JSON example — press Send.</p>
<div data-curl-block="" data-method="GET" data-url="https://jsonplaceholder.typicode.com/todos/1" data-headers="{}" data-body="" data-configured="true"></div>
<p></p>

<h2>Pages, theme, terminal</h2>
<ul>
  <li><p><strong>Pages</strong> — <code>Ctrl + Alt + N</code> new, <code>Ctrl + Alt + W</code> close, <code>Ctrl + Alt + T</code> rename. <code>Ctrl + I</code> cycles portrait, landscape, fullscreen. <code>Ctrl + Alt + [ / ]</code> moves between pages.</p></li>
  <li><p><strong>Theme</strong> — <code>Ctrl + K</code> then <code>Ctrl + T</code>, or <code>theme ocean</code> in the terminal.</p></li>
  <li><p><strong>Terminal</strong> — <code>Ctrl + \`</code>. Try <code>help</code>, <code>ls</code>, <code>export md</code>, <code>neofetch</code>.</p></li>
  <li><p><strong>Shortcuts</strong> — <code>Ctrl + K</code> then <code>Ctrl + S</code>.</p></li>
  <li><p><strong>Save / export</strong> — autosave is on; <code>Ctrl + S</code> flashes saved. Export markdown or PDF from the terminal.</p></li>
</ul>

<h2>What to try first</h2>
<ul data-type="taskList" class="todo-list">
  <li data-type="taskItem" data-checked="false" class="todo-item"><p>Type a sentence and accept a ghost suggestion with Tab</p></li>
  <li data-type="taskItem" data-checked="false" class="todo-item"><p>Insert a heading with <code>/</code></p></li>
  <li data-type="taskItem" data-checked="false" class="todo-item"><p>Open the theme picker and try Matcha or Ember</p></li>
  <li data-type="taskItem" data-checked="false" class="todo-item"><p>Set a Gemini key, then run <code>@time</code> what time is it</p></li>
  <li data-type="taskItem" data-checked="false" class="todo-item"><p>Create a blank page and write something of your own</p></li>
</ul>
<p></p>
`.trim()
