/* ============================================================
   Visual editor
   Add ?edit to the address (jacksonchangmurray.com/?edit) to
   change the site right on the page, then press Publish.
   Publishing saves to GitHub with a token you paste once.
   The token is kept only in this browser.
   ============================================================ */

(() => {
  // Where the site's code lives on GitHub
  const REPO = "jacksonchangmurray-cmyk/Portfolio";
  const BRANCH = "main";
  const API = `https://api.github.com/repos/${REPO}`;
  const TOKEN_KEY = "portfolio-editor-token";

  // Text you can click and type into
  const TEXT = [
    ".hero-top > span", ".hero-line", ".hero-intro",
    ".label", ".statement", ".about-text", ".facts dt", ".facts dd",
    ".section-title", ".section-intro",
    ".project h3", ".project-meta dt", ".project-meta dd", ".project-info > p",
    ".study-abstract", ".study-meta dt", ".study-meta dd",
    ".marquee-track > span",
    ".group-title", ".row-year", ".row h4", ".row-body > p",
    ".contact-title .line-inner", ".contact-text",
    "a.u",
  ].join(", ");

  // Repeating pieces you can move, copy and delete
  const BLOCKS = [
    ".project", ".study", ".demo", ".row",
    ".facts > div", ".project-meta > div", ".study-meta > div",
    ".marquee-track > span", ".project-links > a", ".study-links > a", ".socials > li",
  ].join(", ");

  const main = document.querySelector("main");
  const pending = new Map(); // repo path -> base64 file waiting to upload
  let sha = "";              // version of index.html we started from, to notice edits made elsewhere
  let dirty = false;
  let hovered = null;
  let selected = null;

  const store = {
    get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
    set: (key, value) => { try { localStorage.setItem(key, value); } catch {} },
    remove: (key) => { try { localStorage.removeItem(key); } catch {} },
  };
  const token = () => store.get(TOKEN_KEY);

  const h = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  };
  const make = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  /* ---------- Editor chrome ---------- */

  document.documentElement.classList.add("editing");

  const bar = make(`
    <div class="ed-bar" role="toolbar" aria-label="Editor">
      <span class="ed-dot"></span>
      <strong>Editor</strong>
      <span class="ed-status" aria-live="polite">Loading…</span>
      <button class="ed-btn" type="button" data-act="exit">Exit</button>
      <button class="ed-btn ed-primary" type="button" data-act="publish" disabled>Publish</button>
    </div>`);

  const panelEl = make(`<aside class="ed-panel" aria-label="Editor panel"><div class="ed-panel-body"></div></aside>`);

  const blockbar = make(`
    <div class="ed-blockbar" hidden>
      <button type="button" data-act="up" title="Move up" aria-label="Move up">↑</button>
      <button type="button" data-act="down" title="Move down" aria-label="Move down">↓</button>
      <button type="button" data-act="dup" title="Duplicate" aria-label="Duplicate">⧉</button>
      <button type="button" data-act="del" title="Delete" aria-label="Delete">✕</button>
    </div>`);

  const signin = make(`
    <dialog class="ed-dialog" aria-labelledby="ed-signin-title">
      <h2 id="ed-signin-title">Sign in to publish</h2>
      <p>Publishing saves your changes to GitHub. Paste a token that can edit the <b>Portfolio</b> repository.
        It's stored only in this browser, so don't do this on a shared computer.</p>
      <ol>
        <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → New fine-grained token</a>.</li>
        <li>Name it <b>Portfolio editor</b>. Under <b>Repository access</b>, choose <b>Only select repositories</b> → <b>Portfolio</b>.</li>
        <li>Under <b>Permissions → Repository permissions</b>, set <b>Contents</b> to <b>Read and write</b>.</li>
        <li>Click <b>Generate token</b>, copy it and paste it below.</li>
      </ol>
      <input type="password" placeholder="github_pat_…" autocomplete="off" spellcheck="false" aria-label="GitHub token">
      <p class="ed-dialog-error" aria-live="polite"></p>
      <div class="ed-row">
        <button class="ed-btn" type="button" data-act="cancel">Cancel</button>
        <button class="ed-btn ed-primary" type="button" data-act="signin">Sign in</button>
      </div>
    </dialog>`);

  document.body.append(bar, panelEl, blockbar, signin);

  const statusEl = bar.querySelector(".ed-status");
  const publishBtn = bar.querySelector('[data-act="publish"]');
  const body = panelEl.querySelector(".ed-panel-body");

  function status(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle("ed-error", isError);
  }

  function changed() {
    dirty = true;
    publishBtn.classList.add("ed-ready");
    status("Unpublished changes");
  }

  /* ---------- Side panel ---------- */

  function panel(title, items) {
    body.replaceChildren(h("h2", "ed-title", title), ...items);
  }

  function field(label, value, onInput, placeholder = "") {
    const wrap = h("label", "ed-field");
    const input = h("input");
    input.type = "text";
    input.value = value || "";
    input.placeholder = placeholder;
    input.addEventListener("input", () => {
      onInput(input.value.trim());
      changed();
    });
    wrap.append(h("span", "", label), input);
    return wrap;
  }

  function textField(label, el) {
    return field(label, el.textContent.trim(), (value) => {
      el.textContent = value;
      tidy(el);
    });
  }

  function fileField(label, accept, onFile) {
    const wrap = h("label", "ed-field ed-file");
    const input = h("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        await onFile(file);
      } catch (err) {
        status(err.message, true);
      }
    });
    wrap.append(h("span", "", label), input);
    return wrap;
  }

  function checkbox(label, checked, onChange) {
    const wrap = h("label", "ed-check");
    const input = h("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => {
      onChange(input.checked);
      changed();
    });
    wrap.append(input, h("span", "", label));
    return wrap;
  }

  function action(label, onClick) {
    const button = h("button", "ed-btn", label);
    button.type = "button";
    button.addEventListener("click", onClick);
    return button;
  }

  const note = (text) => h("p", "ed-note", text);

  function select(el) {
    selected?.classList.remove("ed-selected");
    selected = el;
    el?.classList.add("ed-selected");
  }

  function showHelp() {
    select(null);
    const items = [
      note("Click any text on the page and type to change it."),
      note("Hover over a project, research entry, demo, skill or list item to move it ↑ ↓, duplicate ⧉ or delete ✕ it."),
      note("Click a link, an image area, a demo, a research title or the résumé button to edit it here."),
      note("Press Publish when you're done. The live site updates about a minute later."),
    ];
    if (token()) {
      items.push(action("Sign out of GitHub", () => {
        store.remove(TOKEN_KEY);
        showHelp();
        status("Signed out");
      }));
    }
    panel("Editing your site", items);
  }

  /* ---------- Text editing ---------- */

  function makeEditable(root) {
    root.querySelectorAll(TEXT).forEach((el) => {
      if (el.closest("button")) return; // text inside buttons is edited in the panel
      el.contentEditable = "true";
      el.spellcheck = true;
    });
    // Counts like (03) update themselves
    root.querySelectorAll(".section-title sup").forEach((el) => { el.contentEditable = "false"; });
  }

  // Grey "[placeholder]" text turns normal once you replace it
  function tidy(el) {
    if (!el) return;
    [el, ...el.querySelectorAll(".placeholder")].forEach((node) => {
      if (node.classList.contains("placeholder") && !/\[.*\]/.test(node.textContent)) {
        node.classList.remove("placeholder");
      }
    });
  }

  main.addEventListener("input", (e) => {
    tidy(e.target.closest?.('[contenteditable="true"]'));
    changed();
  });

  main.addEventListener("keydown", (e) => {
    if (!e.target.isContentEditable) return;
    if (e.key === "Enter") e.preventDefault(); // one line per box keeps the layout tidy
    if (e.key === "Escape") {
      e.target.blur();
      showHelp();
    }
  });

  // Paste as plain text so outside formatting doesn't sneak in
  main.addEventListener("paste", (e) => {
    if (!e.target.closest?.('[contenteditable="true"]')) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain").replace(/\s*\n+\s*/g, " ");
    document.execCommand("insertText", false, text);
  });

  // Links, demos and research titles open in the panel instead of doing their normal thing
  main.addEventListener("click", (e) => {
    const demo = e.target.closest("button.demo"); // linked demos are edited as links
    const head = e.target.closest(".study-head");
    const link = e.target.closest("a");
    const media = e.target.closest(".project-media");
    if (demo || head || link) e.preventDefault();

    if (demo) return editDemo(demo);
    if (head) return editStudy(head.closest(".study"));
    if (link?.classList.contains("contact-email")) return editEmail(link);
    if (link?.classList.contains("btn")) return editResume(link);
    if (link) return editLink(link);
    if (media) return editMedia(media);
    if (!e.target.closest('[contenteditable="true"]')) showHelp();
  }, true);

  /* ---------- Move, duplicate, delete ---------- */

  main.addEventListener("pointermove", (e) => hover(e.target.closest(BLOCKS)));
  main.addEventListener("pointerdown", (e) => hover(e.target.closest(BLOCKS)));
  main.addEventListener("pointerleave", (e) => {
    if (!blockbar.contains(e.relatedTarget)) hover(null);
  });
  addEventListener("resize", placeBlockbar);

  function hover(block) {
    if (block === hovered) return;
    hovered = block;
    placeBlockbar();
  }

  function placeBlockbar() {
    blockbar.hidden = !hovered;
    if (!hovered) return;
    const rect = hovered.getBoundingClientRect();
    blockbar.style.top = `${rect.top + scrollY + 8}px`;
    blockbar.style.left = `${Math.max(8, rect.right + scrollX - blockbar.offsetWidth - 8)}px`;
  }

  blockbar.addEventListener("click", (e) => {
    const act = e.target.closest("button")?.dataset.act;
    if (!act || !hovered) return;
    if (act === "up") move(hovered, -1);
    if (act === "down") move(hovered, 1);
    if (act === "dup") duplicate(hovered);
    if (act === "del") removeBlock(hovered);
  });

  const peers = (block) => [...block.parentElement.children].filter((el) => el.matches(BLOCKS));

  // A skill and the dot after it travel together
  const unit = (block) =>
    block.matches(".marquee-track > span") && block.nextElementSibling?.tagName === "I"
      ? [block, block.nextElementSibling]
      : [block];

  function move(block, dir) {
    const list = peers(block);
    const other = list[list.indexOf(block) + dir];
    if (!other) return;
    if (dir < 0) other.before(...unit(block));
    else unit(other).at(-1).after(...unit(block));
    afterStructureChange(block);
  }

  function duplicate(block) {
    const nodes = unit(block);
    const gap = block.previousSibling?.nodeType === Node.TEXT_NODE ? block.previousSibling.textContent : "";
    const copies = nodes.map((node) => node.cloneNode(true));
    nodes.at(-1).after(document.createTextNode(gap), ...copies);
    afterStructureChange(copies[0]);
  }

  function removeBlock(block) {
    if (peers(block).length === 1) {
      status("Keep at least one of these. Edit it instead.", true);
      return;
    }
    const before = block.previousSibling;
    if (before?.nodeType === Node.TEXT_NODE && !before.textContent.trim()) before.remove();
    unit(block).forEach((node) => node.remove());
    afterStructureChange(null);
  }

  function afterStructureChange(block) {
    renumber();
    changed();
    hovered = block;
    placeBlockbar();
  }

  // Keep "(03)" counts and project numbers in step with what's on the page
  function renumber() {
    const pad = (n) => String(n).padStart(2, "0");
    const count = (selector) => main.querySelectorAll(selector).length;
    const setCount = (id, n) => {
      const sup = main.querySelector(`#${id} .section-title sup`);
      if (sup) sup.textContent = `(${pad(n)})`;
    };
    setCount("research", count(".study"));
    setCount("work", count(".project"));
    setCount("demos", count(".demo"));
    main.querySelectorAll(".project-num").forEach((el, i) => { el.textContent = pad(i + 1); });
    const total = main.querySelector(".work-total");
    if (total) total.textContent = pad(count(".project"));
  }

  /* ---------- Panel editors ---------- */

  function editLink(link) {
    select(link);
    panel("Link", [
      field("Web address", link.getAttribute("href"), (value) => link.setAttribute("href", value || "#"), "https://…"),
      note("Change the link's words right on the page."),
    ]);
  }

  function editEmail(link) {
    select(link);
    const textNode = [...link.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    panel("Email", [
      field("Your email address", (link.getAttribute("href") || "").replace(/^mailto:/, ""), (value) => {
        link.setAttribute("href", `mailto:${value}`);
        if (textNode) textNode.textContent = `${value} `;
      }, "you@example.com"),
    ]);
  }

  function editResume(link) {
    select(link);
    panel("Résumé", [
      fileField("Upload your résumé (PDF)", "application/pdf", async (file) => {
        await queue("resume.pdf", file);
        link.setAttribute("href", "resume.pdf");
        status("Résumé ready. Press Publish to put it online.");
      }),
      note("It replaces resume.pdf when you publish, so the Download PDF button always gets the newest one."),
    ]);
  }

  function editStudy(study) {
    select(study);
    const head = study.querySelector(".study-head");
    const part = (selector) => study.querySelector(selector);
    panel("Research entry", [
      textField("Year", part(".study-year")),
      textField("Title", part(".study-title")),
      textField("Lab, program or venue", part(".study-venue")),
      checkbox("Show details when the page loads", study.classList.contains("open"), (on) => {
        study.classList.toggle("open", on);
        head.setAttribute("aria-expanded", on);
      }),
      note("Edit the summary, details and links right on the page."),
    ]);
  }

  function editDemo(demo) {
    select(demo);
    panel("Demo", [
      textField("Title", demo.querySelector(".demo-title")),
      textField("Tag", demo.querySelector(".demo-tag")),
      field("Video: YouTube link or file path", currentVideo(demo), (value) => setVideo(demo, value),
        "https://youtu.be/… or videos/clip.mp4"),
      fileField("…or upload a video file (MP4 or WebM, under 25 MB)", "video/mp4,video/webm", async (file) => {
        if (file.size > 25 * 1024 * 1024) throw new Error("That video is over 25 MB. Upload it to YouTube and paste the link instead.");
        const path = `videos/${stamp()}-${slug(file.name)}.${extension(file.name, "mp4")}`;
        await queue(path, file);
        setVideo(demo, path);
        editDemo(demo);
        status("Video ready. Press Publish to put it online.");
      }),
      ...imageFields(demo.querySelector(".demo-media"), "cover image", () => editDemo(demo)),
    ]);
  }

  function editMedia(media) {
    select(media);
    panel("Image", imageFields(media, "screenshot", () => editMedia(media)));
  }

  function currentVideo(demo) {
    if (demo.dataset.youtube) return `https://youtu.be/${demo.dataset.youtube}`;
    return demo.dataset.video || "";
  }

  function setVideo(demo, value) {
    const id = youtubeId(value);
    delete demo.dataset.youtube;
    delete demo.dataset.video;
    if (id) demo.dataset.youtube = id;
    else if (value) demo.dataset.video = value;
  }

  function youtubeId(value) {
    const match = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    if (match) return match[1];
    return /^[\w-]{11}$/.test(value) ? value : "";
  }

  /* ---------- Images ---------- */

  function imageFields(media, label, refresh) {
    const img = media.querySelector(".media-inner img");
    const items = [fileField(img ? `Replace ${label}` : `Add a ${label}`, "image/*", async (file) => {
      await setImage(media, file);
      refresh();
      status("Image ready. Press Publish to put it online.");
    })];
    if (img) {
      items.push(field("Short description (for screen readers)", img.alt, (value) => { img.alt = value; }));
      items.push(action("Remove image", () => {
        removeImage(media);
        changed();
        refresh();
      }));
    }
    return items;
  }

  async function setImage(media, file) {
    const { blob, ext } = await shrinkImage(file);
    const path = `images/${stamp()}-${slug(file.name)}.${ext}`;
    await queue(path, blob);
    const inner = media.querySelector(".media-inner");
    forgetImage(inner.querySelector("img"));
    inner.classList.remove("media-placeholder");
    const img = document.createElement("img");
    img.alt = "";
    img.src = URL.createObjectURL(blob);
    img.dataset.edSrc = path; // swapped for the real path when publishing
    inner.replaceChildren(img);
  }

  function removeImage(media) {
    const inner = media.querySelector(".media-inner");
    forgetImage(inner.querySelector("img"));
    inner.classList.add("media-placeholder");
    inner.replaceChildren(h("span", "mono", "Image"));
  }

  function forgetImage(img) {
    if (!img?.dataset.edSrc) return;
    pending.delete(img.dataset.edSrc);
    URL.revokeObjectURL(img.src);
  }

  // Big photos get scaled down so the site stays fast
  async function shrinkImage(file) {
    const ext = extension(file.name, "jpg");
    if (/gif|svg/.test(file.type)) return { blob: file, ext };
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && file.size < 1.5 * 1024 * 1024) return { blob: file, ext };
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
      return { blob, ext: blob.type.split("/")[1] || "png" };
    } catch {
      return { blob: file, ext };
    }
  }

  /* ---------- Files waiting to upload ---------- */

  const stamp = () => Date.now().toString(36);
  const slug = (name) =>
    name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file";
  const extension = (name, fallback) => {
    const ext = (name.split(".").pop() || "").toLowerCase();
    return /^[a-z0-9]{2,5}$/.test(ext) ? ext.replace("jpeg", "jpg") : fallback;
  };

  const readBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  async function queue(path, blob) {
    pending.set(path, await readBase64(blob));
    changed();
  }

  /* ---------- GitHub ---------- */

  async function gh(path, { method = "GET", body: payload } = {}, allowMissing = false) {
    const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const res = await fetch(API + path, {
      method,
      headers,
      body: payload && JSON.stringify(payload),
      cache: "no-store",
    });
    if (allowMissing && res.status === 404) return null;
    if (!res.ok) {
      let message = res.statusText;
      try { message = (await res.json()).message || message; } catch {}
      if (res.status === 401) message = "GitHub didn't accept the token. Sign in again.";
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  const fromBase64 = (b64) =>
    new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

  const toBase64 = (text) => {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };

  // The saved file with only its <main> section swapped for what's on screen
  function buildSource(saved) {
    const open = saved.match(/<main\b[^>]*>/);
    const end = saved.lastIndexOf("</main>");
    if (!open || end < 0) throw new Error("Couldn't find the main section in index.html.");
    const start = open.index + open[0].length;
    return saved.slice(0, start) + cleanMain() + saved.slice(end);
  }

  // A copy of the page content without any editor leftovers
  function cleanMain() {
    // A detached document, so rewriting image paths doesn't start downloads
    const copy = document.implementation.createHTMLDocument("").importNode(main, true);
    copy.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
    copy.querySelectorAll("[spellcheck]").forEach((el) => el.removeAttribute("spellcheck"));
    copy.querySelectorAll("[style]").forEach((el) => el.removeAttribute("style"));
    copy.querySelectorAll("[inert]").forEach((el) => el.removeAttribute("inert"));
    copy.querySelectorAll(".demo-zoom > video").forEach((el) => el.remove());
    copy.querySelectorAll("img[data-ed-src]").forEach((img) => {
      img.setAttribute("src", img.dataset.edSrc);
      img.removeAttribute("data-ed-src");
    });
    copy.querySelectorAll("[class]").forEach((el) => {
      [...el.classList].filter((c) => c.startsWith("ed-")).forEach((c) => el.classList.remove(c));
      if (!el.classList.length) el.removeAttribute("class");
    });
    const name = copy.querySelector(".hero-name");
    if (name) {
      const lines = [...name.querySelectorAll(".hero-line")].map((line) => line.textContent.trim());
      name.setAttribute("aria-label", lines.join(" "));
    }
    return copy.innerHTML;
  }

  /* ---------- Sign in ---------- */

  function signIn() {
    return new Promise((resolve) => {
      const input = signin.querySelector("input");
      const error = signin.querySelector(".ed-dialog-error");
      input.value = "";
      error.textContent = "";

      const finish = (ok) => {
        cleanup();
        if (signin.open) signin.close();
        resolve(ok);
      };

      const submit = async () => {
        const value = input.value.trim();
        if (!value) return;
        error.textContent = "Checking…";
        const res = await fetch(API, {
          headers: { Authorization: `Bearer ${value}`, Accept: "application/vnd.github+json" },
          cache: "no-store",
        }).catch(() => null);
        if (!res?.ok) {
          error.textContent = "GitHub didn't accept that token. Make sure you copied all of it and gave it access to the Portfolio repository.";
          return;
        }
        store.set(TOKEN_KEY, value);
        finish(true);
      };

      const onClick = (e) => {
        const act = e.target.closest("button")?.dataset.act;
        if (act === "signin") submit();
        if (act === "cancel") finish(false);
      };
      const onKey = (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        submit();
      };
      const onCancel = () => finish(false);

      function cleanup() {
        signin.removeEventListener("click", onClick);
        signin.removeEventListener("cancel", onCancel);
        input.removeEventListener("keydown", onKey);
      }

      signin.addEventListener("click", onClick);
      signin.addEventListener("cancel", onCancel);
      input.addEventListener("keydown", onKey);
      signin.showModal();
      input.focus();
    });
  }

  /* ---------- Publish ---------- */

  async function publish() {
    if (!token() && !(await signIn())) return;
    publishBtn.disabled = true;
    try {
      status("Publishing…");
      renumber();
      const latest = await gh(`/contents/index.html?ref=${BRANCH}`);
      if (latest.sha !== sha && !confirm(
        "The site was changed somewhere else after this editor opened. Publishing will replace the page content with what's on screen. Continue?"
      )) {
        status("Not published");
        return;
      }

      let n = 0;
      for (const [path, content] of pending) {
        status(`Uploading file ${++n} of ${pending.size}…`);
        const existing = await gh(`/contents/${path}?ref=${BRANCH}`, {}, true);
        await gh(`/contents/${path}`, {
          method: "PUT",
          body: { message: `Upload ${path} from the visual editor`, content, branch: BRANCH, ...(existing && { sha: existing.sha }) },
        });
      }

      status("Saving the page…");
      const html = buildSource(fromBase64(latest.content));
      const saved = await gh("/contents/index.html", {
        method: "PUT",
        body: { message: "Update site content from the visual editor", content: toBase64(html), sha: latest.sha, branch: BRANCH },
      });

      sha = saved.content.sha;
      pending.clear();
      dirty = false;
      publishBtn.classList.remove("ed-ready");
      status("Published. The live site updates in about a minute.");
    } catch (err) {
      if (err.status === 401 || err.status === 403) store.remove(TOKEN_KEY);
      status(`Couldn't publish: ${err.message}`, true);
    } finally {
      publishBtn.disabled = false;
    }
  }

  bar.addEventListener("click", (e) => {
    const act = e.target.closest("button")?.dataset.act;
    if (act === "publish") publish();
    if (act === "exit" && (!dirty || confirm("Leave the editor? Changes you haven't published will be lost."))) {
      dirty = false;
      location.href = location.pathname;
    }
  });

  addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  /* ---------- Start ---------- */

  // Always edit the latest saved version, not whatever this page loaded from cache
  async function start() {
    try {
      let file;
      try {
        file = await gh(`/contents/index.html?ref=${BRANCH}`);
      } catch (err) {
        if (err.status !== 401 || !token()) throw err;
        store.remove(TOKEN_KEY); // an old token stopped working; read without it
        file = await gh(`/contents/index.html?ref=${BRANCH}`);
      }
      sha = file.sha;
      const saved = new DOMParser().parseFromString(fromBase64(file.content), "text/html");
      main.innerHTML = saved.querySelector("main").innerHTML;
      makeEditable(main);
      publishBtn.disabled = false;
      status("Ready");
      showHelp();
    } catch (err) {
      status(`Couldn't load the site from GitHub: ${err.message}`, true);
    }
  }

  showHelp();
  start();
})();
