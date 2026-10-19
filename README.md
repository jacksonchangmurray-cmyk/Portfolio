# Portfolio

My personal site: games, software, research and résumé.
Live at https://jacksonchangmurray.com

Plain HTML, CSS and JavaScript. No build step: edit a file, push, and GitHub Pages updates in a minute or two.

## Visual editor

Go to **https://jacksonchangmurray.com/?edit** to change the site right on the page.

- **Text:** click any text and type. Grey `[placeholder]` text turns normal once you replace it.
- **Lists:** hover over a project, research entry, demo, résumé row, skill or link to move it ↑ ↓, duplicate ⧉ or delete ✕ it. Counts like "(03)" update themselves.
- **Links, images and videos:** click a link, an image area, a demo, a research title or the résumé button, and edit it in the side panel. Large photos are scaled down automatically.
- **Publish:** saves to GitHub. The live site updates about a minute later (a hard refresh, Ctrl+Shift+R, may be needed to see it).

The first time you publish, the editor asks for a GitHub token:

1. Open [New fine-grained token](https://github.com/settings/personal-access-tokens/new).
2. Name it "Portfolio editor". Under **Repository access**, pick **Only select repositories → Portfolio**.
3. Under **Permissions → Repository permissions**, set **Contents** to **Read and write**.
4. Generate it, copy it and paste it into the editor.

The token is saved only in that browser. Use **Sign out of GitHub** in the editor panel, or revoke the token on GitHub, to remove access. Anyone can open `?edit` and try things out, but nothing is published without your token.

The editor changes what's inside `<main>` in `index.html`. For the header, footer, colors or animations, edit the files directly.

## Editing content

Everything you'll want to change is in `index.html`. Search for `EDIT` and you'll find a comment above each spot. Grey text on the page means "replace me".

| Section | What to change |
| --- | --- |
| Hero | The one-line intro under your name |
| About | The big intro paragraph (words in `<em>` show in italics), quick facts |
| Research | One `<li class="study">` per paper, poster or project. Add `open` to its class to show the details from the start |
| Projects | One `<article class="project">` per project. The counter updates itself |
| Demos | One `<button class="demo">` per demo, with `data-video="videos/clip.mp4"` or `data-youtube="VIDEO_ID"` |
| Skills band | The two scrolling rows. Keep an `<i></i>` after each skill |
| Résumé | Experience, education, awards, skills. Put your PDF in this folder as `resume.pdf` |
| Contact | Your email (in two places) and profile links |

## Adding images and videos

1. Make an `images` folder (and a `videos` folder for demo clips) next to `index.html`.
2. Swap the placeholder for your file. Each section's `EDIT` comment shows the exact line to paste.
3. Keep videos short (10 to 30 seconds) and under about 10 MB so the page stays fast. For anything longer, upload to YouTube and use `data-youtube`.

## Changing the look

- Colors and fonts are at the top of `styles.css`. Changing `--accent` recolors every orange detail.
- Animations live in `script.js`, one function per effect, each with a short comment.

## Previewing locally

From this folder:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Credits

Smooth scrolling by [Lenis](https://github.com/darkroomengineering/lenis), animation by [GSAP](https://gsap.com). Fonts: Inter Tight, Instrument Serif and JetBrains Mono from Google Fonts.
