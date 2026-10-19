# Portfolio

My personal site: games, software, research and résumé.
Live at https://jacksonchangmurray-cmyk.github.io/Portfolio/

Plain HTML, CSS and JavaScript. No build step: edit a file, push, and GitHub Pages updates in a minute or two.

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
