(() => {
  const TOTAL_SEC = 67;
  let currentSec = 61;
  let playing = true;
  let timer = null;
  let toastTimer = null;

  const BANK = [
    {
      id: 1,
      stem: "下图遮住了 ( ) 只兔子。",
      opts: ["A. 1", "B. 2", "C. 3"],
      type: "单选题",
    },
    {
      id: 2,
      stem: "57后面的第四个数是几？",
      opts: ["A. 60", "B. 61", "C. 62"],
      type: "单选题",
    },
    {
      id: 3,
      stem: "小明有 12 支铅笔，送给同学 5 支，还剩几支？",
      opts: ["A. 6", "B. 7", "C. 8"],
      type: "单选题",
    },
    {
      id: 4,
      stem: "下列哪个图形是三角形？",
      opts: ["A. □", "B. △", "C. ○"],
      type: "单选题",
    },
  ];

  const inserted = [];

  const $ = (sel) => document.querySelector(sel);

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function fmt(sec) {
    const s = Math.max(0, Math.min(TOTAL_SEC, Math.floor(sec)));
    return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  }

  function syncTime() {
    const timeEl = $("#mk-time");
    const bar = $("#mk-progress-bar");
    if (timeEl) timeEl.textContent = `${fmt(currentSec)} / ${fmt(TOTAL_SEC)}`;
    if (bar) bar.style.width = `${(currentSec / TOTAL_SEC) * 100}%`;
  }

  function setPlaying(next) {
    playing = next;
    const icon = $("#mk-play-icon");
    if (icon) icon.textContent = playing ? "❚❚" : "▶";
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (playing) {
      timer = setInterval(() => {
        if (currentSec >= TOTAL_SEC) {
          currentSec = TOTAL_SEC;
          setPlaying(false);
          syncTime();
          return;
        }
        currentSec += 1;
        syncTime();
      }, 1000);
    }
  }

  function showToast(msg) {
    const el = $("#mk-toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 1800);
  }

  function renderInserted() {
    const list = $("#mk-ex-list");
    const empty = $("#mk-ex-empty");
    if (!list) return;
    if (!inserted.length) {
      list.innerHTML = "";
      if (empty) {
        list.appendChild(empty);
        empty.hidden = false;
      }
      return;
    }
    if (empty) empty.hidden = true;
    list.innerHTML = inserted
      .map(
        (item) => `<div class="mk-ex-item" data-ex-id="${item.uid}">
        <div class="mk-ex-item__time">${fmt(item.at)}</div>
        <div class="mk-ex-item__title">${item.stem}</div>
        <div class="mk-ex-item__ops">
          <button type="button" data-remove-ex="${item.uid}">移除</button>
        </div>
      </div>`
      )
      .join("");
  }

  function renderBank() {
    const list = $("#mk-pick-list");
    if (!list) return;
    const used = new Set(inserted.map((x) => x.id));
    list.innerHTML = BANK.map((q) => {
      const done = used.has(q.id);
      return `<div class="mk-q">
        <div class="mk-q__stem">${q.stem}</div>
        <div class="mk-q__opts">${q.opts.map((o) => `<div>${o}</div>`).join("")}</div>
        <div class="mk-q__foot">
          <span class="mk-q__type">${q.type}</span>
          <button type="button" class="mk-q__insert${done ? " is-done" : ""}" data-insert-q="${q.id}" ${
        done ? "disabled" : ""
      }>${done ? "已插入" : "插入"}</button>
        </div>
      </div>`;
    }).join("");
  }

  function openPick() {
    setPlaying(false);
    renderBank();
    const modal = $("#mk-pick-modal");
    if (modal) modal.hidden = false;
  }

  function closePick() {
    const modal = $("#mk-pick-modal");
    if (modal) modal.hidden = true;
  }

  function initTitle() {
    const params = new URLSearchParams(location.search);
    const title = params.get("title") || "wmv: 儿童歌曲 - 小龙人";
    const el = $("#mk-video-title");
    if (el) el.textContent = title;
    document.title = `空中课堂 · ${title}`;
  }

  function bind() {
    $("#mk-play")?.addEventListener("click", () => setPlaying(!playing));
    $("#mk-insert-btn")?.addEventListener("click", openPick);
    $("#mk-save-btn")?.addEventListener("click", () => {
      showToast(inserted.length ? `已保存，共插入 ${inserted.length} 道习题` : "已保存（暂未插入习题）");
    });
    $("#mk-side-toggle")?.addEventListener("click", () => {
      $("#mk-side")?.classList.toggle("is-collapsed");
    });

    document.querySelectorAll("[data-close-pick]").forEach((el) => {
      el.addEventListener("click", closePick);
    });

    $("#mk-pick-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-insert-q]");
      if (!btn || btn.disabled) return;
      const id = Number(btn.dataset.insertQ);
      const q = BANK.find((item) => item.id === id);
      if (!q) return;
      inserted.push({
        uid: `${id}-${Date.now()}`,
        id: q.id,
        stem: q.stem,
        at: currentSec,
      });
      inserted.sort((a, b) => a.at - b.at);
      renderInserted();
      renderBank();
      showToast(`已在 ${fmt(currentSec)} 插入习题`);
    });

    $("#mk-ex-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove-ex]");
      if (!btn) return;
      const uid = btn.dataset.removeEx;
      const idx = inserted.findIndex((x) => x.uid === uid);
      if (idx >= 0) inserted.splice(idx, 1);
      renderInserted();
    });
  }

  initTitle();
  syncTime();
  renderInserted();
  bind();
  setPlaying(true);
})();
