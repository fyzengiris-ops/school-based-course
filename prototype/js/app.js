/**
 * 校本课原型框架 — 终端切换 / PC 身份切换 / 教师课程列表
 */
(function () {
  const state = {
    terminal: "pc", // pc | pad
    role: "jiaowu", // teacher | jiaowu
    pcPage: "module", // home | module
    padPage: "home", // home | xiaoben | jingxuan | course-detail | course-ware | course-hw | course-hw-grade | course-hw-report | course-hw-detail | course-hw-status
    jwNav: "manage", // manage | lib | publish | learners | learners-import | learners-add | learn-data
    publishStep: 1, // 1 | 2
  };

  const PROTO_STORE_KEY = "xb-proto-v085";
  let persistTimer = null;
  let persistReady = false;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function loadProtoState() {
    try {
      return JSON.parse(localStorage.getItem(PROTO_STORE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function schedulePersist() {
    if (!persistReady) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persistProtoState, 120);
  }

  function snapshotPublishForm() {
    return {
      name: $("#jw-pub-name")?.value || "",
      grade: $("#jw-pub-grade")?.value || "",
      subject: $("#jw-pub-subject")?.value || "",
      lessons: $("#jw-pub-lessons")?.value || "",
      intro: $("#jw-pub-intro")?.value || "",
      learnMode: document.querySelector('input[name="jw-learn-mode"]:checked')?.value || "order",
      learnSub: document.querySelector('input[name="jw-learn-sub"]:checked')?.value || "video",
      progress: document.querySelector('input[name="jw-progress"]:checked')?.value || "lock",
      hwCheck: document.querySelector('input[name="jw-hw-check"]:checked')?.value || "self",
    };
  }

  function applyPublishSnapshot(form) {
    if (!form) return;
    const nameInput = $("#jw-pub-name");
    if (nameInput) {
      nameInput.value = form.name || "";
      syncPublishNameCount(nameInput);
    }
    if ($("#jw-pub-grade") && form.grade) $("#jw-pub-grade").value = form.grade;
    if ($("#jw-pub-subject") && form.subject) $("#jw-pub-subject").value = form.subject;
    if ($("#jw-pub-lessons")) $("#jw-pub-lessons").value = form.lessons || "";
    if ($("#jw-pub-intro")) $("#jw-pub-intro").value = form.intro || "";
    const learnMode = document.querySelector(`input[name="jw-learn-mode"][value="${form.learnMode || "order"}"]`);
    if (learnMode) learnMode.checked = true;
    const learnSub = document.querySelector(`input[name="jw-learn-sub"][value="${form.learnSub || "video"}"]`);
    if (learnSub) learnSub.checked = true;
    const sub = $("#jw-learn-sub");
    if (sub) sub.hidden = form.learnMode === "free";
    const progress = document.querySelector(`input[name="jw-progress"][value="${form.progress || "lock"}"]`);
    if (progress) progress.checked = true;
    const hw = document.querySelector(`input[name="jw-hw-check"][value="${form.hwCheck || "self"}"]`);
    if (hw) hw.checked = true;
  }

  function persistProtoState() {
    if (!persistReady) return;
    try {
      const payload = {
        terminal: state.terminal,
        role: state.role,
        pcPage: state.pcPage,
        padPage: state.padPage,
        padXbSubject,
        padXbCourseId,
        padXbHwStep,
        padXbHwStatus,
        jwNav: state.jwNav,
        publishStep: state.publishStep,
        editingPublishId,
        publishMode,
        scheduleMode,
        scheduleDirty,
        manageListSeq,
        manageCourseList,
        scheduleUnitSeq,
        scheduleUnits,
        learnersCourseId,
        learnDataCourseId,
        learnDataCourseIds,
        learnersByCourse,
        removedLearnersByCourse,
        devicesByCourse,
        removedDevicesByCourse,
        learnersMaintainModeByCourse,
        addCourseVideos: ADD_COURSE_VIDEOS,
        publishForm: snapshotPublishForm(),
      };
      localStorage.setItem(PROTO_STORE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota / private mode */
    }
  }

  function setTerminal(terminal) {
    state.terminal = terminal;
    document.body.dataset.terminal = terminal;

    $$(".seg__btn[data-terminal]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.terminal === terminal);
    });

    $$(".view").forEach((view) => {
      view.classList.toggle("is-active", view.dataset.view === terminal);
    });

    const stage = $(".stage");
    if (stage) stage.dataset.terminal = terminal;

    closeRoleMenu();
    closeDiffDrawer();
    closeLightbox();
    updateDiffNotes();
    schedulePersist();
  }

  function setRole(role) {
    const stayOnModule = state.pcPage === "module";
    state.role = role;

    $$(".pc-role-panel").forEach((panel) => {
      panel.hidden = panel.dataset.role !== role;
    });

    $$(".role-menu__item[data-role]").forEach((item) => {
      item.classList.toggle("is-current", item.dataset.role === role);
    });

    closeRoleMenu();
    closeDiffDrawer();
    closeLightbox();
    updateDiffNotes();

    // 详情页内切换：直接进入对应身份的列表页；首页切换：回对应身份首页
    if (stayOnModule) openPcModule();
    else showPcHome();
    schedulePersist();
  }

  function resetRoleMenuPosition(menu) {
    if (!menu) return;
    menu.style.position = "";
    menu.style.top = "";
    menu.style.right = "";
    menu.style.left = "";
    menu.classList.remove("role-menu--fixed");
  }

  function openRoleMenu(anchorEl) {
    const menu = $(".role-menu");
    const backdrop = $(".backdrop");
    if (!menu) return;
    if (anchorEl && anchorEl.closest("[data-role-switch]")) {
      const trigger = anchorEl.closest("[data-role-switch]");
      const rect = trigger.getBoundingClientRect();
      menu.classList.add("role-menu--fixed");
      menu.style.position = "fixed";
      menu.style.top = `${Math.round(rect.bottom + 6)}px`;
      menu.style.right = `${Math.round(window.innerWidth - rect.right)}px`;
      menu.style.left = "auto";
      backdrop?.classList.add("is-high");
    } else {
      resetRoleMenuPosition(menu);
      backdrop?.classList.remove("is-high");
    }
    menu.classList.add("is-open");
    backdrop?.classList.add("is-open");
  }

  function closeRoleMenu() {
    const menu = $(".role-menu");
    menu?.classList.remove("is-open");
    resetRoleMenuPosition(menu);
    $(".backdrop")?.classList.remove("is-open", "is-high");
  }

  function hideModulePages() {
    $("#pc-teacher-lib")?.classList.remove("is-active");
    $("#pc-jiaowu-lib")?.classList.remove("is-active");
  }

  function showPcHome() {
    state.pcPage = "home";
    hideModulePages();
    $$(".pc-role-panel").forEach((panel) => {
      panel.hidden = panel.dataset.role !== state.role;
    });
    schedulePersist();
  }

  function openPcModule() {
    state.pcPage = "module";
    closeRoleMenu();
    $$(".pc-role-panel").forEach((p) => (p.hidden = true));
    hideModulePages();

    if (state.role === "teacher") {
      $("#pc-teacher-lib")?.classList.add("is-active");
    } else {
      $("#pc-jiaowu-lib")?.classList.add("is-active");
      setJiaowuNav(state.jwNav || "manage");
      if (state.jwNav === "publish") {
        setPublishStep(state.publishStep || 1);
        applyScheduleModeUI();
      }
      if (
        state.jwNav === "learners" ||
        state.jwNav === "learners-import" ||
        state.jwNav === "learners-add"
      ) {
        renderLearnersTable();
      }
      if (state.jwNav === "learn-data") {
        renderLearnDataPage();
      }
    }
    refreshCourseViews();
    schedulePersist();
  }

  let padXbSubject = "语文";
  let padXbCourseId = null;
  let padXbHwStep = 0;
  let padXbHwStatus = "unsubmitted"; // unsubmitted | pending | graded
  let padXbDetailFrom = "report"; // report | hw
  let padXbFocusLesson = "l1";

  const PAD_XB_SUBJECTS = ["语文", "数学", "英语", "科学", "综合"];

  const PAD_XB_COURSES = {
    语文: [
      {
        id: "yu-1",
        title: "一年级语文基础巩固训练营",
        tag: "school",
        tagLabel: "校本",
        cover: "./assets/pad/covers/cover-school-1.svg",
        validTo: "2027-10-15",
        learned: 2,
        total: 8,
      },
      {
        id: "yu-2",
        title: "校本阅读拓展 · 四季与自然",
        tag: "mix",
        tagLabel: "混排",
        cover: "./assets/pad/covers/cover-mix-1.svg",
        validTo: "2027-06-30",
        learned: 0,
        total: 5,
      },
      {
        id: "yu-3",
        title: "古诗词诵读专项",
        tag: "school",
        tagLabel: "校本",
        cover: "./assets/pad/covers/cover-school-3.svg",
        validTo: "2026-12-31",
        learned: 5,
        total: 5,
        expired: true,
      },
    ],
    数学: [
      {
        id: "shu-1",
        title: "三年级数学计算专项",
        tag: "school",
        tagLabel: "校本",
        cover: "./assets/pad/covers/cover-school-2.svg",
        validTo: "2027-10-15",
        learned: 1,
        total: 6,
      },
      {
        id: "shu-2",
        title: "图形与空间校本课",
        tag: "mix",
        tagLabel: "混排",
        cover: "./assets/pad/covers/cover-mix-1.svg",
        validTo: "2027-08-20",
        learned: 0,
        total: 4,
      },
    ],
    英语: [
      {
        id: "en-1",
        title: "二年级英语口语校本营",
        tag: "school",
        tagLabel: "校本",
        cover: "./assets/pad/covers/cover-school-1.svg",
        validTo: "2027-10-15",
        learned: 3,
        total: 10,
      },
      {
        id: "en-2",
        title: "Unit 词汇巩固课",
        tag: "live",
        tagLabel: "直播",
        cover: "./assets/pad/covers/cover-live-1.svg",
        validTo: "2027-03-01",
        learned: 0,
        total: 3,
      },
    ],
    科学: [
      {
        id: "sci-1",
        title: "四年级科学探究校本课",
        tag: "school",
        tagLabel: "校本",
        cover: "./assets/pad/covers/cover-school-2.svg",
        validTo: "2027-10-15",
        learned: 0,
        total: 7,
      },
    ],
    综合: [],
  };

  function setPadPortrait(on) {
    $(".pad-device")?.classList.toggle("is-portrait", !!on);
  }

  function hidePadXbCoursePage() {
    $("#pad-xb-course")?.setAttribute("hidden", "");
    $("#pad-xb-ware")?.setAttribute("hidden", "");
    $("#pad-xb-hw")?.setAttribute("hidden", "");
    $("#pad-xb-hw-grade")?.setAttribute("hidden", "");
    $("#pad-xb-hw-report")?.setAttribute("hidden", "");
    $("#pad-xb-hw-detail")?.setAttribute("hidden", "");
    $("#pad-xb-hw-status")?.setAttribute("hidden", "");
    setPadPortrait(false);
  }

  function hidePadXbOverlayPages() {
    $("#pad-xb-ware")?.setAttribute("hidden", "");
    $("#pad-xb-hw")?.setAttribute("hidden", "");
    $("#pad-xb-hw-grade")?.setAttribute("hidden", "");
    $("#pad-xb-hw-report")?.setAttribute("hidden", "");
    $("#pad-xb-hw-detail")?.setAttribute("hidden", "");
    $("#pad-xb-hw-status")?.setAttribute("hidden", "");
  }

  function setPadCourseTab(tabKey) {
    const key = tabKey || "notes";
    $$("[data-pad-course-tab]").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.padCourseTab === key);
    });
    $$("[data-pad-course-panel]").forEach((panel) => {
      const active = panel.dataset.padCoursePanel === key;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    const fab = $("#pad-xb-course-add-note");
    if (fab) fab.hidden = key !== "notes";
  }

  function findPadXbCourse(courseId) {
    const id = String(courseId || "");
    for (const subject of PAD_XB_SUBJECTS) {
      const hit = (PAD_XB_COURSES[subject] || []).find((item) => String(item.id) === id);
      if (hit) return { ...hit, subject };
    }
    return null;
  }

  function showPadHome() {
    state.padPage = "home";
    padXbCourseId = null;
    $("#pad-inner")?.classList.remove("is-active");
    $("#pad-xb-home")?.setAttribute("hidden", "");
    hidePadXbCoursePage();
    $("#pad-inner-placeholder")?.setAttribute("hidden", "");
    $("#pad-home")?.removeAttribute("hidden");
    schedulePersist();
  }

  function renderPadXbSubjects() {
    const nav = $("#pad-xb-subjects");
    if (!nav) return;
    nav.innerHTML = PAD_XB_SUBJECTS.map(
      (subject) =>
        `<button type="button" class="xb-pad-home__subject${
          subject === padXbSubject ? " is-active" : ""
        }" data-pad-xb-subject="${escapeAttr(subject)}">${escapeAttr(subject)}</button>`
    ).join("");
  }

  function renderPadXbCourses() {
    const grid = $("#pad-xb-course-grid");
    const empty = $("#pad-xb-empty");
    const list = PAD_XB_COURSES[padXbSubject] || [];
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    grid.innerHTML = list
      .map((course, index) => {
        const ratio =
          course.total > 0
            ? Math.min(100, Math.round((course.learned / course.total) * 100))
            : 0;
        const cover =
          course.cover || "./assets/pad/covers/cover-school-1.svg";
        const pin =
          padXbSubject === PAD_XB_SUBJECTS[0] && index === 0
            ? `<span class="proto-diff-pin proto-diff-pin--cover" data-diff-pin="pad-course-list" role="button" tabindex="0" title="查看此处改动说明">改</span>`
            : "";
        return `<button type="button" class="xb-pad-course" data-pad-xb-course="${escapeAttr(
          course.id
        )}">
          <div class="xb-pad-course__cover">
            <img class="xb-pad-course__cover-img" src="${escapeAttr(cover)}" alt="" />
            ${pin}
          </div>
          <div class="xb-pad-course__body">
            <span class="xb-pad-course__title">${escapeAttr(course.title)}</span>
            <div class="xb-pad-course__progress">
              <span class="xb-pad-course__progress-text">已学：${course.learned}/${
          course.total
        }节</span>
              <span class="xb-pad-course__bar"><span class="xb-pad-course__bar-fill" style="width:${ratio}%"></span></span>
            </div>
          </div>
        </button>`;
      })
      .join("");
  }

  function renderPadXbHome() {
    renderPadXbSubjects();
    renderPadXbCourses();
  }

  function resetPadXbHomeworkState() {
    padXbHwStep = 0;
    padXbHwStatus = "unsubmitted";
    padXbFocusLesson = "l1";
    renderPadXbHwCard();
    renderPadXbCourseCatalog();
  }

  function getPadXbPaperCatalogAction() {
    if (padXbHwStatus === "pending") {
      return { label: "去批改", kind: "grade" };
    }
    if (padXbHwStatus === "graded") {
      return { label: "查看报告", kind: "report" };
    }
    return { label: "去提交", kind: "answer" };
  }

  function openPadModule(kind) {
    state.padPage = kind;
    padXbCourseId = null;
    resetPadXbHomeworkState();
    $("#pad-home")?.setAttribute("hidden", "");
    const inner = $("#pad-inner");
    if (!inner) return;
    inner.classList.add("is-active");

    const xbHome = $("#pad-xb-home");
    const placeholder = $("#pad-inner-placeholder");
    hidePadXbCoursePage();

    if (kind === "xiaoben") {
      placeholder?.setAttribute("hidden", "");
      xbHome?.removeAttribute("hidden");
      renderPadXbHome();
      schedulePersist();
      return;
    }

    xbHome?.setAttribute("hidden", "");
    placeholder?.removeAttribute("hidden");
    $("#pad-inner-title").textContent = "精选资源";
    $("#pad-inner-desc").textContent =
      "由原「课程中心」改名。小节/章节等内容结构不变，本迭代主要为入口更名。";
    schedulePersist();
  }

  const PAD_XB_LESSONS = [
    {
      id: "l1",
      status: "done",
      statusLabel: "已学完",
      title: "第1节 wmv：儿童歌曲 - 小龙人",
      meta: "总时长:1分7秒 | 老师01 | 点播",
      papers: [
        {
          title: "2026-10-14 【验证公式图片压缩】数学试卷04",
          mode: "button",
          label: "查看报告",
          kind: "report",
        },
      ],
      wares: [{ title: "《第一组 感受自然》试卷(学生用卷)(2)", action: "去学习" }],
      card: {
        status: "已批改",
        statusTone: "success",
        title: "2026-10-14 【验证公式图片压缩】...",
        time: "提交时间: 2026年10月16日 10:59",
        mark: "4分",
        actions: [
          { label: "报告", kind: "report" },
          { label: "查看", kind: "view" },
        ],
      },
    },
    {
      id: "l2",
      status: "learning",
      statusLabel: "学习中",
      title: "第2节 wmv：儿童歌曲 - 小龙人",
      metaHtml: "上次已看至:<em>0分3秒</em>/1分7秒 | 累计时长:0分3秒 | 老师01 | 点播",
      papers: [
        {
          title: "2026-10-14 【验证公式图片压缩】数学试卷04",
          mode: "text",
          label: "待批改",
        },
      ],
      wares: [],
      card: {
        status: "待批改",
        statusTone: "success",
        title: "2026-10-14 【验证公式图片压缩】...",
        time: "提交时间: 2026年10月16日 11:01",
        mark: "3分",
        action: "去批改",
        actionKind: "grade",
      },
    },
    {
      id: "l3",
      status: "todo",
      statusLabel: "待学习",
      title: "第3节 预习报告第3题",
      meta: "总时长:4秒 | 老师01 | 点播",
      papers: [
        {
          title: "验证错题挑题重组题干完整性",
          mode: "button",
          label: "去提交",
          kind: "answer",
        },
      ],
      wares: [],
      card: {
        status: "未提交",
        statusTone: "danger",
        title: "验证错题挑题重组题干完整性",
        time: "提交时间: --",
        percent: "--%",
        action: "答题",
        actionKind: "answer",
      },
    },
  ];

  const PAD_XB_HW_STEPS = [
    { src: "./assets/pad/ref-hw-q1.png", alt: "题目1", next: true, prev: false },
    { src: "./assets/pad/ref-hw-q2.png", alt: "题目2", next: true, prev: true },
    { src: "./assets/pad/ref-hw-q3.png", alt: "题目3", next: true, prev: true, submit: true },
    { src: "./assets/pad/ref-hw-submitted.png", alt: "题目提交后", next: false, prev: false, done: true },
  ];

  const PAD_XB_HW_CARD = {
    unsubmitted: {
      status: "未提交",
      statusTone: "danger",
      title: "2026-10-14 【验证公式图片压缩】...",
      time: "提交时间: --",
      percent: "--%",
      action: "答题",
      actionKind: "answer",
    },
    pending: {
      status: "待批改",
      statusTone: "muted",
      title: "2026-10-14 【验证公式图片压缩】...",
      time: "提交时间: 2026年10月15日 17:11",
      mark: "4分",
      action: "去批改",
      actionKind: "grade",
    },
    graded: {
      status: "已批改",
      statusTone: "success",
      title: "2026-10-14 【验证公式图片压缩】...",
      time: "提交时间: 2026年10月15日 17:11",
      mark: "33分",
      actions: [
        { label: "报告", kind: "report" },
        { label: "查看", kind: "view" },
      ],
    },
  };

  function padXbClockIcon() {
    return `<span class="xb-pad-course-lesson__clock" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="13" height="13">
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.3" />
        <path d="M8 4.5V8l2.4 1.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      </svg>
    </span>`;
  }

  function padXbLockIcon() {
    return `<span class="xb-pad-course-lesson__lock" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="14" height="14">
        <rect x="3.5" y="7" width="9" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3" />
        <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      </svg>
    </span>`;
  }

  function getPadXbFocusLesson() {
    return PAD_XB_LESSONS.find((item) => item.id === padXbFocusLesson) || PAD_XB_LESSONS[0];
  }

  function renderPadXbLessonBlock(lesson) {
    const learning = lesson.status === "learning";
    const todo = lesson.status === "todo";
    const done = lesson.status === "done";
    const badgeClass = learning
      ? "xb-pad-course-lesson__badge xb-pad-course-lesson__badge--learning"
      : todo
        ? "xb-pad-course-lesson__badge xb-pad-course-lesson__badge--todo"
        : done
          ? "xb-pad-course-lesson__badge xb-pad-course-lesson__badge--done"
          : "xb-pad-course-lesson__badge";
    const metaHtml = lesson.metaHtml || escapeAttr(lesson.meta || "");
    const papers = (lesson.papers || [])
      .map((paper) => {
        const actionHtml =
          paper.mode === "text"
            ? `<span class="xb-pad-course-resource__plain">${escapeAttr(paper.label || "")}</span>`
            : `<button type="button" class="xb-pad-course-resource__action" data-pad-hw-action="${escapeAttr(
                paper.kind || "answer"
              )}">${escapeAttr(paper.label || "")}</button>`;
        return `<div class="xb-pad-course-resource">
          <div class="xb-pad-course-resource__main">
            <span class="xb-pad-course-resource__title">${escapeAttr(paper.title)}</span>
            <span class="xb-pad-course-resource__tag">试卷</span>
          </div>
          ${actionHtml}
        </div>`;
      })
      .join("");
    const wares = (lesson.wares || [])
      .map(
        (ware) => `<div class="xb-pad-course-resource" data-pad-open-ware="1">
          <div class="xb-pad-course-resource__main">
            <span class="xb-pad-course-resource__title">${escapeAttr(ware.title)}</span>
            <span class="xb-pad-course-resource__tag">课件</span>
          </div>
          <button type="button" class="xb-pad-course-resource__action" data-pad-open-ware="1">${escapeAttr(
            ware.action || "去学习"
          )}</button>
        </div>`
      )
      .join("");
    return `<div class="xb-pad-course-block${
      lesson.id === padXbFocusLesson ? " is-current" : ""
    }" data-pad-focus="${escapeAttr(lesson.id)}">
      <div class="xb-pad-course-lesson${learning ? " is-learning" : ""}${todo ? " is-todo" : ""}${
        done ? " is-done" : ""
      }">
        <div class="xb-pad-course-lesson__main">
          <div class="xb-pad-course-lesson__row">
            <span class="${badgeClass}">${escapeAttr(lesson.statusLabel || "")}</span>
            <span class="xb-pad-course-lesson__name">${escapeAttr(lesson.title)}</span>
          </div>
          <div class="xb-pad-course-lesson__sub">
            ${padXbClockIcon()}
            <span>${metaHtml}</span>
          </div>
        </div>
      </div>
      ${papers}
      ${wares}
    </div>`;
  }

  function renderPadXbCourseCatalog() {
    const listEl = $("#pad-xb-course-catalog");
    if (!listEl) return;
    listEl.innerHTML = `<div class="xb-pad-course-catalog__unit">第1章 默认单元</div>${PAD_XB_LESSONS.map(
      renderPadXbLessonBlock
    ).join("")}`;
  }

  function setPadXbFocusLesson(lessonId) {
    if (!PAD_XB_LESSONS.some((item) => item.id === lessonId)) return;
    padXbFocusLesson = lessonId;
    $$("[data-pad-focus]").forEach((el) => {
      el.classList.toggle("is-current", el.dataset.padFocus === lessonId);
    });
    renderPadXbHwCard();
  }

  function renderPadXbCoursePage(course) {
    const title = course?.title || "自适应学习2";
    const grade = course?.grade || "一年级";
    const learnMode = course?.learnMode || "按课时顺序解锁（按视频进度解锁）";
    const lastLesson = course?.lastLesson || "第1节wmv: 儿童歌曲 - 小龙人";
    const titleEl = $("#pad-xb-course-title");
    const metaEl = $("#pad-xb-course-meta");
    const lastEl = $("#pad-xb-course-last");
    if (titleEl) titleEl.textContent = title;
    if (metaEl) {
      metaEl.innerHTML = `<span>适合年级：${escapeAttr(grade)}</span><span class="xb-pad-course-info__sep">|</span><span>学习方式：${escapeAttr(
        learnMode
      )}</span>`;
    }
    if (lastEl) lastEl.textContent = `最近学习到：${lastLesson}`;
    renderPadXbCourseCatalog();
  }

  function ensurePadXbCourseId() {
    if (padXbCourseId) return true;
    const fallback = findPadXbCourse("yu-1") || findPadXbCourse((PAD_XB_COURSES["语文"] || [])[0]?.id);
    if (fallback) {
      padXbCourseId = fallback.id;
      return true;
    }
    showToast("未找到课程");
    return false;
  }

  function openPadXbCourse(courseId, options = {}) {
    const course = findPadXbCourse(courseId);
    if (!course) {
      showToast("未找到课程");
      return;
    }
    padXbCourseId = course.id;
    state.padPage = "course-detail";
    $("#pad-home")?.setAttribute("hidden", "");
    $("#pad-inner-placeholder")?.setAttribute("hidden", "");
    $("#pad-xb-home")?.setAttribute("hidden", "");
    hidePadXbOverlayPages();
    setPadPortrait(false);
    const inner = $("#pad-inner");
    inner?.classList.add("is-active");
    renderPadXbCoursePage(course);
    renderPadXbHwCard();
    setPadCourseTab(options.tab || "notes");
    $("#pad-xb-course")?.removeAttribute("hidden");
    schedulePersist();
  }

  function openPadXbCourseware() {
    if (!preparePadXbInnerPage("course-ware", false)) return;
    $("#pad-xb-ware")?.removeAttribute("hidden");
    schedulePersist();
  }

  function backPadXbCourseware() {
    if (padXbCourseId) {
      openPadXbCourse(padXbCourseId, { tab: "ware" });
      return;
    }
    openPadModule("xiaoben");
  }

  function renderPadXbHwCard() {
    const host = $("#pad-xb-hw-card");
    if (!host) return;
    const lesson = getPadXbFocusLesson();
    const data = lesson?.card;
    if (!data) {
      host.innerHTML = "";
      return;
    }
    const status = lesson.id;
    const markHtml = data.mark
      ? `<span class="xb-pad-course-hw-card__mark" aria-hidden="true">${escapeAttr(data.mark)}</span>`
      : "";
    const percentHtml =
      data.percent != null
        ? `<span class="xb-pad-course-hw-card__score">${escapeAttr(data.percent)}</span>`
        : "";
    let actionsHtml = "";
    if (data.actions) {
      actionsHtml = `<div class="xb-pad-course-hw-card__actions">${data.actions
        .map(
          (item) =>
            `<button type="button" class="xb-pad-course-hw-card__ghost" data-pad-hw-action="${escapeAttr(
              item.kind
            )}">${escapeAttr(item.label)}</button>`
        )
        .join("")}</div>`;
    } else if (data.action) {
      actionsHtml = `<button type="button" class="xb-pad-course-hw-card__action" data-pad-hw-action="${escapeAttr(
        data.actionKind || "answer"
      )}">${escapeAttr(data.action)}</button>`;
    }
    host.innerHTML = `<article class="xb-pad-course-hw-card is-${escapeAttr(status)}">
      <div class="xb-pad-course-hw-card__top">
        <div class="xb-pad-course-hw-card__meta">
          <span class="xb-pad-course-hw-card__author">zfy</span>
          <span class="xb-pad-course-hw-card__tag">学生自批</span>
        </div>
        <span class="xb-pad-course-hw-card__status is-${escapeAttr(data.statusTone || "danger")}">${escapeAttr(
          data.status
        )}</span>
      </div>
      <div class="xb-pad-course-hw-card__body">
        <div class="xb-pad-course-hw-card__main">
          <div class="xb-pad-course-hw-card__mid">
            <span class="xb-pad-course-hw-card__title">${escapeAttr(data.title)}</span>
            ${percentHtml}
          </div>
          <div class="xb-pad-course-hw-card__time">${escapeAttr(data.time)}</div>
        </div>
        ${markHtml}
      </div>
      <div class="xb-pad-course-hw-card__foot">${actionsHtml}</div>
    </article>`;
  }

  function renderPadXbHwStep() {
    const step = PAD_XB_HW_STEPS[padXbHwStep] || PAD_XB_HW_STEPS[0];
    const img = $("#pad-xb-hw-img");
    const page = $("#pad-xb-hw");
    if (img) {
      img.src = step.src;
      img.alt = step.alt || "作业题目";
    }
    if (page) page.classList.toggle("is-done", !!step.done);
    setPadPortrait(!!step.done);
  }

  function openPadXbHomework(stepIndex = 0) {
    padXbHwStep = Math.max(0, Math.min(Number(stepIndex) || 0, PAD_XB_HW_STEPS.length - 1));
    if (!preparePadXbInnerPage("course-hw", false)) return;
    renderPadXbHwStep();
    $("#pad-xb-hw")?.removeAttribute("hidden");
    schedulePersist();
  }

  function openPadXbHwGrade() {
    if (!preparePadXbInnerPage("course-hw-grade", true)) return;
    $("#pad-xb-hw-grade")?.removeAttribute("hidden");
    schedulePersist();
  }

  function returnPadXbHwTab(nextStatus) {
    if (nextStatus) padXbHwStatus = nextStatus;
    renderPadXbHwCard();
    renderPadXbCourseCatalog();
    if (padXbCourseId) {
      openPadXbCourse(padXbCourseId, { tab: "hw" });
      return;
    }
    openPadModule("xiaoben");
  }

  function backPadXbHomework() {
    const step = PAD_XB_HW_STEPS[padXbHwStep] || PAD_XB_HW_STEPS[0];
    if (step.done) {
      returnPadXbHwTab("pending");
      return;
    }
    returnPadXbHwTab();
  }

  function padXbHwNext() {
    if (padXbHwStep >= PAD_XB_HW_STEPS.length - 1) return;
    padXbHwStep += 1;
    renderPadXbHwStep();
    schedulePersist();
  }

  function padXbHwPrev() {
    if (padXbHwStep <= 0) return;
    padXbHwStep -= 1;
    renderPadXbHwStep();
    schedulePersist();
  }

  function padImgPagePos(page, e) {
    if (!page || page.hasAttribute("hidden")) return null;
    const rect = page.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function setPadImgPageCursor(page, clickable) {
    if (!page) return;
    page.style.cursor = clickable ? "pointer" : "default";
  }

  function getPadXbHwHotspot(x, y, step) {
    if (step.done) {
      if (y <= 0.1 && x <= 0.35) return "back";
      if (y >= 0.365 && y <= 0.45 && x >= 0.28 && x <= 0.72) return "skip-grade";
      if (y >= 0.295 && y < 0.365 && x >= 0.18 && x <= 0.82) return "self-grade";
      return null;
    }
    if (y <= 0.1 && x <= 0.22) return "back";
    if (y < 0.84) return null;
    if (step.prev && step.next) {
      if (x >= 0.62) return "next";
      if (x >= 0.42) return "prev";
      return null;
    }
    if (step.next && x >= 0.45) return "next";
    return null;
  }

  function getPadXbHwGradeHotspot(x, y) {
    if (y <= 0.1 && x <= 0.35) return "back";
    if (y >= 0.82 && x >= 0.68) return "finish";
    return null;
  }

  function getPadXbWareHotspot(x, y) {
    if (y <= 0.12 && x <= 0.12) return "back";
    return null;
  }

  function handlePadXbHwPageClick(e) {
    const page = $("#pad-xb-hw");
    const pos = padImgPagePos(page, e);
    if (!pos) return;
    const step = PAD_XB_HW_STEPS[padXbHwStep] || PAD_XB_HW_STEPS[0];
    const hit = getPadXbHwHotspot(pos.x, pos.y, step);
    if (!hit) return;

    if (step.done) {
      if (hit === "back" || hit === "skip-grade") {
        returnPadXbHwTab("pending");
        return;
      }
      if (hit === "self-grade") {
        if (padXbHwStatus === "unsubmitted") padXbHwStatus = "pending";
        openPadXbHwGrade();
      }
      return;
    }

    if (hit === "back") {
      returnPadXbHwTab();
      return;
    }
    if (hit === "next") {
      padXbHwNext();
      return;
    }
    if (hit === "prev") {
      padXbHwPrev();
    }
  }

  function handlePadXbHwPageMove(e) {
    const page = $("#pad-xb-hw");
    const pos = padImgPagePos(page, e);
    if (!pos) {
      setPadImgPageCursor(page, false);
      return;
    }
    const step = PAD_XB_HW_STEPS[padXbHwStep] || PAD_XB_HW_STEPS[0];
    setPadImgPageCursor(page, !!getPadXbHwHotspot(pos.x, pos.y, step));
  }

  function handlePadXbHwGradeClick(e) {
    const page = $("#pad-xb-hw-grade");
    const pos = padImgPagePos(page, e);
    if (!pos) return;
    const hit = getPadXbHwGradeHotspot(pos.x, pos.y);
    if (hit === "back") {
      returnPadXbHwTab("pending");
      return;
    }
    if (hit === "finish") {
      returnPadXbHwTab("graded");
    }
  }

  function handlePadXbHwGradeMove(e) {
    const page = $("#pad-xb-hw-grade");
    const pos = padImgPagePos(page, e);
    if (!pos) {
      setPadImgPageCursor(page, false);
      return;
    }
    setPadImgPageCursor(page, !!getPadXbHwGradeHotspot(pos.x, pos.y));
  }

  function handlePadXbWareClick(e) {
    if (e.target.closest("#pad-xb-ware-back")) {
      backPadXbCourseware();
      return;
    }
    const page = $("#pad-xb-ware");
    const pos = padImgPagePos(page, e);
    if (!pos) return;
    if (getPadXbWareHotspot(pos.x, pos.y) === "back") {
      backPadXbCourseware();
    }
  }

  function handlePadXbWareMove(e) {
    const page = $("#pad-xb-ware");
    if (e.target.closest("#pad-xb-ware-back")) {
      setPadImgPageCursor(page, true);
      return;
    }
    const pos = padImgPagePos(page, e);
    if (!pos) {
      setPadImgPageCursor(page, false);
      return;
    }
    setPadImgPageCursor(page, !!getPadXbWareHotspot(pos.x, pos.y));
  }

  function preparePadXbInnerPage(padPage, portrait) {
    if (!ensurePadXbCourseId()) return false;
    state.padPage = padPage;
    $("#pad-home")?.setAttribute("hidden", "");
    $("#pad-inner-placeholder")?.setAttribute("hidden", "");
    $("#pad-xb-home")?.setAttribute("hidden", "");
    $("#pad-xb-course")?.setAttribute("hidden", "");
    hidePadXbOverlayPages();
    const inner = $("#pad-inner");
    inner?.classList.add("is-active");
    setPadPortrait(!!portrait);
    return true;
  }

  function openPadXbHwReport() {
    if (!preparePadXbInnerPage("course-hw-report", false)) return;
    $("#pad-xb-hw-report")?.removeAttribute("hidden");
    schedulePersist();
  }

  function openPadXbHwDetail(from) {
    padXbDetailFrom = from === "hw" ? "hw" : "report";
    if (!preparePadXbInnerPage("course-hw-detail", false)) return;
    $("#pad-xb-hw-detail")?.removeAttribute("hidden");
    schedulePersist();
  }

  function openPadXbHwStatus() {
    if (!preparePadXbInnerPage("course-hw-status", false)) return;
    $("#pad-xb-hw-status")?.removeAttribute("hidden");
    schedulePersist();
  }

  function getPadXbReportHotspot(x, y) {
    if (y <= 0.1 && x <= 0.14) return "back";
    // 题目分析：题目圆点区域
    if (y >= 0.5 && y <= 0.9 && x >= 0.05 && x <= 0.95) return "question";
    return null;
  }

  function getPadXbDetailHotspot(x, y) {
    if (y <= 0.1 && x <= 0.14) return "back";
    // 右上角表格式 icon → 答题情况
    if (y <= 0.11 && x >= 0.9) return "status";
    return null;
  }

  function getPadXbStatusHotspot(x, y) {
    // 弹层右上角关闭
    if (y >= 0.12 && y <= 0.22 && x >= 0.8 && x <= 0.92) return "close";
    // 顶栏返回（背景页）
    if (y <= 0.1 && x <= 0.14) return "back";
    return null;
  }

  function handlePadXbHwReportClick(e) {
    if (e.target.closest(".xb-pad-hw-tip")) return;
    const page = $("#pad-xb-hw-report");
    const pos = padImgPagePos(page, e);
    if (!pos) return;
    const hit = getPadXbReportHotspot(pos.x, pos.y);
    if (hit === "back") {
      returnPadXbHwTab("graded");
      return;
    }
    if (hit === "question") {
      openPadXbHwDetail();
    }
  }

  function handlePadXbHwReportMove(e) {
    const page = $("#pad-xb-hw-report");
    const pos = padImgPagePos(page, e);
    if (!pos) {
      setPadImgPageCursor(page, false);
      return;
    }
    setPadImgPageCursor(page, !!getPadXbReportHotspot(pos.x, pos.y));
  }

  function handlePadXbHwDetailClick(e) {
    if (e.target.closest(".xb-pad-hw-tip")) return;
    const page = $("#pad-xb-hw-detail");
    const pos = padImgPagePos(page, e);
    if (!pos) return;
    const hit = getPadXbDetailHotspot(pos.x, pos.y);
    if (hit === "back") {
      if (padXbDetailFrom === "hw") {
        returnPadXbHwTab("graded");
        return;
      }
      openPadXbHwReport();
      return;
    }
    if (hit === "status") {
      openPadXbHwStatus();
    }
  }

  function handlePadXbHwDetailMove(e) {
    const page = $("#pad-xb-hw-detail");
    if (e.target.closest(".xb-pad-hw-tip")) {
      setPadImgPageCursor(page, true);
      return;
    }
    const pos = padImgPagePos(page, e);
    if (!pos) {
      setPadImgPageCursor(page, false);
      return;
    }
    setPadImgPageCursor(page, !!getPadXbDetailHotspot(pos.x, pos.y));
  }

  function handlePadXbHwStatusClick(e) {
    if (e.target.closest(".xb-pad-hw-tip")) return;
    const page = $("#pad-xb-hw-status");
    const pos = padImgPagePos(page, e);
    if (!pos) return;
    const hit = getPadXbStatusHotspot(pos.x, pos.y);
    if (hit === "close" || hit === "back") {
      openPadXbHwDetail();
    }
  }

  function handlePadXbHwStatusMove(e) {
    const page = $("#pad-xb-hw-status");
    if (e.target.closest(".xb-pad-hw-tip")) {
      setPadImgPageCursor(page, true);
      return;
    }
    const pos = padImgPagePos(page, e);
    if (!pos) {
      setPadImgPageCursor(page, false);
      return;
    }
    setPadImgPageCursor(page, !!getPadXbStatusHotspot(pos.x, pos.y));
  }

  function handlePadXbHwCardAction(kind) {
    if (kind === "answer") {
      openPadXbHomework(0);
      return;
    }
    if (kind === "grade") {
      openPadXbHwGrade();
      return;
    }
    if (kind === "report") {
      openPadXbHwReport();
      return;
    }
    if (kind === "view") {
      openPadXbHwDetail("hw");
    }
  }

  function backPadXbCourseToList() {
    openPadModule("xiaoben");
  }

  function restorePadView() {
    if (state.padPage === "course-hw-status" && padXbCourseId) {
      openPadXbHwStatus();
      return;
    }
    if (state.padPage === "course-hw-detail" && padXbCourseId) {
      openPadXbHwDetail();
      return;
    }
    if (state.padPage === "course-hw-report" && padXbCourseId) {
      openPadXbHwReport();
      return;
    }
    if (state.padPage === "course-hw-grade" && padXbCourseId) {
      openPadXbHwGrade();
      return;
    }
    if (state.padPage === "course-hw" && padXbCourseId) {
      openPadXbHomework(padXbHwStep);
      return;
    }
    if (state.padPage === "course-ware" && padXbCourseId) {
      openPadXbCourseware();
      return;
    }
    if (state.padPage === "course-detail" && padXbCourseId) {
      openPadXbCourse(padXbCourseId);
      return;
    }
    if (state.padPage === "xiaoben" || state.padPage === "jingxuan") {
      openPadModule(state.padPage);
      return;
    }
    showPadHome();
  }

  /**
   * 按「终端 × 身份」维护改动对照。
   * items[] 可继续追加：每项 = 一张原页截图 + 对应改动说明。
   */
  const DIFF_NOTES = {
    "pc:teacher": {
      label: "PC · 老师",
      title: "相对原点播课改动 · 老师",
      items: [
        {
          id: "pc-teacher-lib",
          src: "./assets/ref/pc-teacher-course-list.png",
          caption: "原教师端课程列表",
          changes: [
            { text: "左上角的 icon 和名称需要进行更换；", kind: "rename" },
            { text: "左侧的导航栏去掉；", kind: "remove" },
            { text: "右侧面板左上角的【点播库】文案去掉；", kind: "remove" },
            "除此之外，老师在这个项目里的所有操作能力，均和原点播课能力保持一致。",
          ],
        },
        {
          id: "pc-teacher-video",
          src: "./assets/ref/pc-teacher-video-preview.png",
          caption: "原点播课视频预览（校本课视频预览）",
          changes: [
            {
              text: "左上角的 icon 和「空中课堂」，需要更换为校本课和对应的 icon。",
              kind: "rename",
            },
          ],
        },
        {
          id: "pc-teacher-make",
          src: "./assets/ref/pc-teacher-make-note.png",
          caption: "原制作视频页（制作视频1）",
          changes: [
            {
              text: "左上角的 icon 和「空中课堂」，需要更换为校本课和对应的 icon。",
              kind: "rename",
            },
          ],
        },
      ],
    },
    "pc:jiaowu": {
      label: "PC · 教务",
      title: "相对原点播课改动 · 教务",
      items: [
        {
          id: "pc-jw-lib",
          src: "./assets/ref/pc-jiaowu-course-list.png",
          caption: "原教务端点播课列表",
          changes: [
            { text: "左上角的 icon 和名称需要与教师端一致进行更换；", kind: "rename" },
            {
              text: "左侧导航仅保留「点播库」「课程管理」，并分别改名为「课程库」「课程管理」；",
              kind: "rename",
            },
            {
              text: "课程库详情页改动",
              children: [
                { text: "右侧面板左上角的【点播库】文案去掉；", kind: "remove" },
                { text: "审核通过的数据，原来的【打包】操作按钮去掉；", kind: "remove" },
                "其余能力和教务身份原来在点播库tab栏的能力全部保持一致。",
              ],
            },
          ],
        },
        {
          id: "pc-jw-manage",
          src: "./assets/ref/pc-jiaowu-vod-list.png",
          caption: "原点播课列表",
          changes: [
            "左上角 icon 和名称、左侧导航，与课程库一致；",
            {
              text: "课程管理详情页改动",
              children: [
                { text: "右侧面板左上角【课程管理】标题去掉；", kind: "remove" },
                {
                  text: "右上角【学习设置】【切换成旧版本】去掉，保留【发布课程】；",
                  kind: "remove",
                },
                { text: "筛选区【开课日期】去掉；", kind: "remove" },
                { text: "【直播课 / 点播课 / 课程包组合】tab 栏去掉；", kind: "remove" },
                {
                  text: "课程信息仅保留封面和名称：封面角标（如「点播」）和价格（如 ¥0）去掉；",
                  kind: "remove",
                },
                { text: "列表【开课日期】列去掉；", kind: "remove" },
                { text: "操作列【分享】去掉；", kind: "remove" },
                { text: "【报名人数】字段调整为【学习人数】；", kind: "rename" },
                { text: "【上课名单】字段调整为【学习名单】。", kind: "rename" },
              ],
            },
          ],
        },
        {
          id: "pc-jw-publish",
          src: "./assets/ref/pc-jiaowu-publish-basic.png",
          caption: "原发布课程-基本信息",
          changes: [
            { text: "面包屑【发布混排课】调整为【发布课程】；", kind: "rename" },
            {
              text: "课程信息模块改动",
              children: [
                {
                  text: "【学习有效期】【直播录播课程时间】【课程老师】去掉；",
                  kind: "remove",
                },
                { text: "新增【总课时数】（必填），可输入正整数；", kind: "add" },
              ],
            },
            { text: "整块【课程费用】【课程报名】去掉；", kind: "remove" },
            {
              text: "其他模块改动",
              children: [
                { text: "【点播课进度条】调整为【视频进度条】；", kind: "rename" },
                {
                  text: "学习方式、视频进度条说明气泡去掉文案中的「学员」；",
                  kind: "rename",
                },
                { text: "作业批改仅保留【学生自批】（其余批改方式去掉）；", kind: "remove" },
                { text: "【直播课实时巡课】【直播课课程录像】去掉。", kind: "remove" },
              ],
            },
          ],
        },
        {
          id: "pc-jw-publish-confirm",
          src: "./assets/ref/pc-jiaowu-publish-confirm-original.png",
          caption: "原发布确认弹窗（基本信息【立即发布】/ 排课【发布】共用，红框去掉）",
          changes: [
            {
              text: "去掉底部灰色小字「当前直播课单价已低于底价15.0元」；",
              kind: "remove",
            },
            "其余保留：标题「确定发布此课程吗？」及【取消】【确定】按钮。",
          ],
        },
        {
          id: "pc-jw-schedule",
          src: "./assets/ref/pc-jiaowu-schedule-empty.png",
          caption: "原排课-空数据",
          changes: [
            { text: "面包屑【发布混排课】调整为【发布课程】；", kind: "rename" },
            {
              text: "去掉提示文案「对课时进行的修改，发布后均会同步给所有已报名学生，请您谨慎修改！」；",
              kind: "remove",
            },
            { text: "去掉【助教设置】【设置结课认证】按钮；", kind: "remove" },
            "其余能力保持不变：步骤条、【添加单元】、空态引导、【上一步】【保存并退出】【发布】。",
          ],
        },
        {
          id: "pc-jw-unit",
          src: "./assets/ref/pc-jiaowu-schedule-unit.png",
          caption: "原排课-单元",
          changes: [
            {
              text: "去掉批量导入功能，原因是原批量导入功能主要是导入课程名称。",
              kind: "remove",
            },
            {
              text: "去掉添加课程时选择点播课和直播课的操作按钮，调整为点击后，直接进入到添加点播课的页面。",
              kind: "rename",
            },
          ],
        },
        {
          id: "pc-jw-add-course",
          src: "./assets/ref/pc-jiaowu-add-course-original.png",
          caption: "原添加课程弹窗（红框去掉）",
          changes: [
            { text: "去掉【授课老师】字段；", kind: "remove" },
            { text: "去掉【课程类型】字段；", kind: "remove" },
            {
              text: "去掉【开播时间】及相关提示「在该时间前学员无法观看视频」；",
              kind: "remove",
            },
            "其余保留：标题【添加课程】、【选择课程视频】双栏选择区、【取消】【确定】。",
          ],
        },
        {
          id: "pc-jw-lesson-row",
          src: "./assets/ref/pc-jiaowu-lesson-row-original.png",
          caption: "原排课课时行（红框去掉）",
          changes: [
            {
              text: "课时信息去掉「老师姓名」和「课程类型」（上一步添加课程弹窗已去掉对应设置项）；",
              kind: "remove",
            },
            {
              text: "去掉右侧编辑 icon（原会重新打开添加课程弹窗编辑开播时间、视频类型、授课教师，相关字段已去掉）；",
              kind: "remove",
            },
            "其余保留：第N节标题、时长、删除、拖拽排序。",
          ],
        },
        {
          id: "pc-jw-schedule-edit",
          src: "./assets/ref/pc-jiaowu-schedule-edit-original.png",
          caption: "原已上架课程【排课】编辑页（红框去掉）",
          changes: [
            {
              text: "去掉顶部提示「对课时进行的修改，发布后均会同步给所有已报名学生，请您谨慎修改！」；",
              kind: "remove",
            },
            { text: "去掉【助教设置】【设置结课认证】；", kind: "remove" },
            { text: "单元行去掉【批量导入】；", kind: "remove" },
            {
              text: "课时信息去掉「老师姓名」「课程类型」；",
              kind: "remove",
            },
            {
              text: "课时行去掉编辑 icon；",
              kind: "remove",
            },
            "底部为【取消】【发布】：默认【发布】置灰，仅当本页数据有增、删操作后才高亮可点。",
          ],
        },
        {
          id: "pc-jw-modify",
          src: "./assets/ref/pc-jiaowu-modify-basic-original.png",
          caption: "原列表【修改】进入的基本信息页（字段对齐校本课发布页）",
          changes: [
            {
              text: "中间字段与已实现的【发布课程】基础信息保持一致：去掉【学习有效期】【直播课程时间】【课程老师】、整块【课程费用】【课程报名】；作业批改仅保留【学生自批】；【点播课进度条】改为【视频进度条】等（同发布页）；",
              kind: "remove",
            },
            { text: "无顶部步骤条；面包屑为【课程管理 > 基本信息】；", kind: "rename" },
            { text: "【年级学科】置灰不可编辑；", kind: "rename" },
            "底部为【取消】【保存】。",
          ],
        },
        {
          id: "pc-jw-off",
          src: "./assets/ref/pc-jiaowu-off-confirm-original.png",
          caption: "原列表【下架】确认弹窗（橙框文案调整）",
          changes: [
            {
              text: "提示文案由「下架后，已报名的学生可继续上课，未报名的学生将不可再购课」调整为「下架后，学生将不可查看」；",
              kind: "rename",
            },
            "其余保留：标题「确认将课程下架吗？」、【以后不再弹窗提醒，直接下架】勾选、【取消】【下架】。",
          ],
        },
        {
          id: "pc-jw-learners",
          src: "./assets/ref/pc-jiaowu-learners-empty.png",
          caption: "原上课名单-空数据",
          changes: [
            { text: "面包屑【上课名单】调整为【学习名单】；", kind: "rename" },
            { text: "筛选区【状态】【账号状态】去掉；", kind: "remove" },
            {
              text: "去掉注释「注：已移除的学生，若要重新上课，需手动恢复。」；",
              kind: "remove",
            },
            { text: "列表【联系电话】【所属学校】列去掉；", kind: "remove" },
            { text: "【报名时间】调整为【添加时间】；", kind: "rename" },
            { text: "操作列【移除】调整为绿色；", kind: "rename" },
            { text: "【批量移除】按钮常态为红色描边。", kind: "rename" },
          ],
        },
        {
          id: "pc-jw-import",
          src: "./assets/ref/pc-jiaowu-learners-import-original.png",
          caption: "原学习名单【批量导入】页（橙框改名 / 后续页去掉）",
          extraShots: [
            {
              src: "./assets/ref/pc-jiaowu-import-restore-original.png",
              caption: "原再次导入已被移除学生时的恢复提示弹窗（红框去掉 / 橙框改名）",
            },
            {
              src: "./assets/ref/pc-jiaowu-import-settle-original.png",
              caption: "原【开始导入】后的结算页（整页去掉）",
            },
            {
              src: "./assets/ref/pc-jiaowu-import-pay-success-original.png",
              caption: "原结算提交后的支付成功页（整页去掉）",
            },
          ],
          changes: [
            {
              text: "面包屑【上课名单】调整为【学习名单】；",
              kind: "rename",
            },
            {
              text: "若导入名单中含已被移除的学生，仍保留「学习名单是否恢复」校验弹窗：标题与正文中的【上课名单】改为【学习名单】，【购买】改为【导入】；去掉「或者取消勾选移除人员后继续购买」；",
              kind: "rename",
            },
            {
              text: "线上原流程：【开始导入】→（若有移除人员则恢复弹窗）→ 结算页 →【提交订单】→ 支付成功页 → 返回名单；本项目去掉结算页与支付成功页，确认导入后直接回到学习名单并 toast「导入成功」；",
              kind: "remove",
            },
            "其余步骤与按钮逻辑保持不变：上传文件常态高亮、上传后置灰；【开始导入】常态置灰、上传文件后高亮（演示默认已上传态）。",
          ],
        },
        {
          id: "pc-jw-add-learner",
          src: "./assets/ref/pc-jiaowu-add-learner-original.png",
          caption: "原学习名单【添加学生】页（橙框改名 / 后续页去掉）",
          extraShots: [
            {
              src: "./assets/ref/pc-jiaowu-add-learner-restore-original.png",
              caption: "原再次添加已被移除学生时的恢复提示弹窗（红框去掉 / 橙框改名）",
            },
            {
              src: "./assets/ref/pc-jiaowu-add-learner-settle-original.png",
              caption: "原【添加】后的结算页（整页去掉）",
            },
            {
              src: "./assets/ref/pc-jiaowu-add-learner-pay-success-original.png",
              caption: "原结算提交后的支付成功页（整页去掉）",
            },
          ],
          changes: [
            {
              text: "面包屑【上课名单】调整为【学习名单】；",
              kind: "rename",
            },
            {
              text: "若添加名单中含已被移除的学生，仍保留「学习名单是否恢复」校验弹窗：标题与正文中的【上课名单】改为【学习名单】，【购买】改为【导入】；去掉「或者取消勾选移除人员后继续购买」；",
              kind: "rename",
            },
            {
              text: "线上原流程：【添加】→（若有移除人员则恢复弹窗）→ 结算页 →【提交订单】→ 支付成功页 → 返回名单；本项目去掉结算页与支付成功页，确认添加后直接回到学习名单并 toast「添加成功」；",
              kind: "remove",
            },
            "其余能力与交互保持不变：添加方式（本校学生 / 分层班学生 / 输入乐号）、选择学员双栏、【添加】【取消】。",
          ],
        },
        {
          id: "pc-jw-export",
          src: "./assets/ref/pc-jiaowu-learner-export-filename.png",
          caption: "原导出文件命名（橙框改名 / 红框去掉）",
          changes: [
            {
              text: "导出文件名中【上课名单】调整为【学习名单】；",
              kind: "rename",
            },
            {
              text: "导出文件名去掉「导出」二字；最终命名为「课程名称+学科+学习名单」，例如「自适应性学习语文学习名单」。",
              kind: "remove",
            },
          ],
        },
        {
          id: "pc-jw-learn-data",
          src: "./assets/ref/pc-jiaowu-learn-data-summary.png",
          caption: "原学习数据-汇总",
          extraShots: [
            {
              src: "./assets/ref/pc-jiaowu-learn-data-tip-avg-ratio.png",
              caption: "原【生均学习时长比例】说明气泡（橙框改名）",
            },
            {
              src: "./assets/ref/pc-jiaowu-learn-data-tip-learn-rate.png",
              caption: "原【学习完成率】说明气泡（橙框改名）",
            },
            {
              src: "./assets/ref/pc-jiaowu-learn-data-tip-hw-rate.png",
              caption: "原【作业完成率】说明气泡（橙框改名）",
            },
            {
              src: "./assets/ref/pc-jiaowu-learn-data-class-dim.png",
              caption: "原【班级】维度汇总表（红框去掉 / 橙框改名，字段同课程维度）",
            },
            {
              src: "./assets/ref/pc-jiaowu-learn-data-detail-1.png",
              caption: "原【学生明细】页左段（红框去掉）",
            },
            {
              src: "./assets/ref/pc-jiaowu-learn-data-detail-2.png",
              caption: "原【学生明细】页右段（红框去掉）",
            },
            {
              src: "./assets/ref/pc-jiaowu-learn-data-gc-cascade.png",
              caption: "原【年级/班级】级联筛选（去掉学校层级）",
            },
            {
              src: "./assets/ref/pc-jiaowu-learn-data-tip-total-duration.png",
              caption: "原【总课程时长】说明气泡（保留）",
            },
            {
              src: "./assets/ref/pc-jiaowu-learn-data-tip-study-duration.png",
              caption: "原【累计学习时长】说明气泡（保留）",
            },
            {
              src: "./assets/ref/pc-jiaowu-learn-data-tip-study-progress.png",
              caption: "原【学习进度】说明气泡（去掉「点播」）",
            },
            {
              src: "./assets/ref/pc-jiaowu-learn-data-tip-hw-status.png",
              caption: "原【作业完成情况】说明气泡（去掉「点播」）",
            },
          ],
          changes: [
            {
              text: "辅助信息【报名人数】调整为【学习人数】；",
              kind: "rename",
            },
            { text: "汇总统计查看维度去掉【学科】；", kind: "remove" },
            { text: "汇总查看维度保留【学校】【班级】（去掉【学科】），顺序为【学校】【班级】；", kind: "rename" },
            {
              text: "学校维度表头去掉【学校】名称列、【总课时数】，并去掉【点播课】分类表头（本项目无直播/点播类型区分）；",
              kind: "remove",
            },
            {
              text: "班级维度字段与学校维度一致，仅在【学生数】前增加【班级】列；同样去掉原【总课时数】与【点播课】分类，【课时数】改为【总课时数】，【生均学习时长比例】后移，并保留【作业完成率】；",
              kind: "rename",
            },
            { text: "原【课时数】调整为【总课时数】；", kind: "rename" },
            {
              text: "【生均学习时长比例】调整到【已上架课时数】后面；",
              kind: "rename",
            },
            {
              text: "在【学习完成率】后新增【作业完成率】；",
              kind: "add",
            },
            {
              text: "【生均学习时长比例】说明调整为「各学生总课时/已上架课时总时长的平均值」；",
              kind: "rename",
            },
            {
              text: "【学习完成率】说明调整为「视频观看时长达到90%的课时数/已上架课时数*100%」（去掉「点播」）；",
              kind: "rename",
            },
            {
              text: "【作业完成率】说明调整为「已完成作业数/作业总数*100%」；",
              kind: "rename",
            },
            {
              text: "汇总统计【查看详情】进入【学生明细】：课程维度进入时【年级/班级】定位「全部」；班级维度进入时选中对应班级；",
              kind: "add",
            },
            {
              text: "学生明细表去掉【学校】【总体学习进度】列，并去掉【点播课】分类表头；",
              kind: "remove",
            },
            {
              text: "学生明细表在【班级】列后保留【学科】列（单课程 / 多课程一致）；",
              kind: "add",
            },
            {
              text: "学生明细筛选区在【年级/班级】后增加【学科】下拉（默认「全部」，选项来自当前查看课程）；",
              kind: "add",
            },
            {
              text: "【年级/班级】筛选去掉学校层级，仅保留年级、班级两级；",
              kind: "remove",
            },
            {
              text: "学生明细【总课程时长】【累计学习时长】说明文案保持与线上一致；",
              kind: "rename",
            },
            {
              text: "【学习进度】说明去掉「点播」，调整为「视频观看时长达到90%的课时数/已上架课时数」；",
              kind: "rename",
            },
            {
              text: "【作业完成情况】说明去掉「点播」，调整为「已完成作业数 / 作业总数」；",
              kind: "rename",
            },
            {
              text: "课程管理勾选多门课后【查看数据】进入多课程统计：标题为「多课程统计 - 课程名1、课程名2…」；汇总维度先与单课程一致（学校/班级），学生明细与单课程一致。",
              kind: "add",
            },
          ],
        },
        {
          id: "pc-jw-learn-multi",
          src: "./assets/ref/pc-jiaowu-multi-course-data.png",
          caption: "原多课程数据",
          changes: [
            {
              text: "将【学科】维度，文案给调整为【课程】。",
              kind: "rename",
            },
            "其他列的字段信息和本期单课程查看保持一致。",
          ],
        },
      ],
    },
    pad: {
      label: "PAD",
      title: "相对原点播课改动 · PAD",
      items: [
        {
          id: "pad-home",
          src: "./assets/pad-student-home.png",
          caption: "原学生 PAD 首页（宫格含「预习」「更多」等）",
          changes: [
            {
              text: "首页底图更换为最新学生 PAD 截图；",
              kind: "rename",
            },
            {
              text: "在「更多」图标右侧新增【校本课】入口（青绿渐变圆角图标 + 书桌书本符号，风格对齐宫格）；保留原【预习】不改名。",
              kind: "add",
            },
          ],
        },
        {
          id: "pad-course-list",
          src: "./assets/pad/ref-course-list.png",
          caption: "原点播课课程列表（我的课程）",
          changes: [
            {
              text: "校本课课程列表按此原图的卡片结构对照。",
              kind: "rename",
            },
            {
              text: "去掉卡片上的【有效期至】以及「已过期」标识。",
              kind: "remove",
            },
            {
              text: "去掉课程类型的标签。",
              kind: "remove",
            },
          ],
        },
        {
          id: "pad-course-validity",
          src: "./assets/pad/ref-course-detail.png",
          caption: "原点播课课程详情（含课程有效时间）",
          changes: [
            {
              text: "课程信息行去掉【课程有效时间】。",
              kind: "remove",
            },
            "课程详情页的其他功能、操作、交互，完全和点播课查看视频保持一致。",
          ],
        },
        {
          id: "pad-answer-analysis",
          src: "./assets/pad/ref-hw-answer-detail.png",
          caption: "原点播课答题详情（答案解析为空）",
          changes: [
            {
              text: "本次需要做逻辑调整：支持点播课作业在完成批改后，可直接查看这份作业的答案解析。",
              kind: "add",
            },
          ],
        },
        {
          id: "pad-class-avg",
          src: "./assets/pad/ref-hw-answer-status.png",
          caption: "原点播课答题情况（班级平均分）",
          changes: [
            {
              text: "「班级平均分」后增加警示标识。悬停说明：当前统计的是课程包内学生平均分，不是行政班，需确认该字段是去掉、改文案、加提示，还是暂不处理。",
              kind: "add",
            },
          ],
        },
      ],
      emptyText: "PAD 端可按身份继续追加多张原页截图及对应改动说明。",
    },
  };

  function getDiffKey() {
    if (state.terminal === "pad") return "pad";
    return `pc:${state.role}`;
  }

  function getDiffData() {
    return DIFF_NOTES[getDiffKey()] || DIFF_NOTES.pad;
  }

  function closeDiffDrawer() {
    const drawer = $("#proto-diff-drawer");
    if (drawer) drawer.hidden = true;
  }

  function openDiffDrawer(focusId) {
    updateDiffNotes();
    const drawer = $("#proto-diff-drawer");
    if (drawer) drawer.hidden = false;
    $$(".proto-diff-card.is-focus").forEach((card) => card.classList.remove("is-focus"));
    if (!focusId) return;
    const card = document.querySelector(`[data-diff-id="${focusId}"]`);
    if (!card) return;
    card.classList.add("is-focus");
    card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function closeLightbox() {
    const box = $("#proto-lightbox");
    if (!box) return;
    box.hidden = true;
    const img = $("#proto-lightbox-img");
    if (img) img.removeAttribute("src");
  }

  function changeKindClass(kind) {
    if (kind === "remove") return "proto-diff-kind proto-diff-kind--remove";
    if (kind === "rename") return "proto-diff-kind proto-diff-kind--rename";
    if (kind === "add") return "proto-diff-kind proto-diff-kind--add";
    return "";
  }

  function changeKindRank(line) {
    const kind = line && typeof line === "object" ? line.kind : "";
    if (kind === "remove") return 0;
    if (kind === "rename") return 1;
    if (kind === "add") return 2;
    return 3;
  }

  function sortChangeLines(changes) {
    return (changes || []).slice().sort((a, b) => changeKindRank(a) - changeKindRank(b));
  }

  function renderChangeLine(line) {
    if (line && typeof line === "object") {
      const cls = changeKindClass(line.kind);
      const kids = sortChangeLines(line.children).map(renderChangeLine).join("");
      return `<li class="${cls}">${line.text || ""}${
        kids ? `<ol class="proto-diff-sublist">${kids}</ol>` : ""
      }</li>`;
    }
    return `<li>${line}</li>`;
  }

  function renderChangeItems(changes) {
    return sortChangeLines(changes).map(renderChangeLine).join("");
  }

  let lightboxState = { shots: [], index: 0, changes: [] };

  function renderLightboxShot() {
    const box = $("#proto-lightbox");
    const img = $("#proto-lightbox-img");
    const cap = $("#proto-lightbox-caption");
    const list = $("#proto-lightbox-list");
    const prev = $("#proto-lightbox-prev");
    const next = $("#proto-lightbox-next");
    const shots = lightboxState.shots || [];
    const shot = shots[lightboxState.index];
    if (!box || !img || !shot) return;
    const total = shots.length;
    const multi = total > 1;
    img.src = shot.src;
    img.alt = shot.caption || "原点播课截图大图";
    if (cap) {
      cap.textContent = multi
        ? `${shot.caption || "原页截图"}（${lightboxState.index + 1}/${total}）`
        : shot.caption || "";
    }
    if (list) {
      const lines = lightboxState.changes || [];
      list.innerHTML = lines.length
        ? renderChangeItems(lines)
        : `<li class="proto-lightbox__list-empty">暂无改动说明</li>`;
    }
    if (prev) {
      prev.hidden = !multi;
      prev.disabled = lightboxState.index <= 0;
    }
    if (next) {
      next.hidden = !multi;
      next.disabled = lightboxState.index >= total - 1;
    }
    box.hidden = false;
  }

  function stepLightbox(delta) {
    const total = lightboxState.shots.length;
    if (total < 2) return;
    const nextIndex = lightboxState.index + delta;
    if (nextIndex < 0 || nextIndex >= total) return;
    lightboxState.index = nextIndex;
    renderLightboxShot();
  }

  function openLightbox(src, caption, changes, shots, startIndex) {
    const list = shots && shots.length ? shots : [{ src, caption: caption || "原页截图" }];
    const index = Number.isFinite(startIndex) ? startIndex : 0;
    lightboxState = {
      shots: list,
      index: Math.min(Math.max(index, 0), list.length - 1),
      changes: changes || [],
    };
    renderLightboxShot();
  }

  function getDiffItemShots(item) {
    const shots = [{ src: item.src, caption: item.caption || "原页截图" }];
    (item.extraShots || []).forEach((shot) => {
      if (shot?.src) shots.push({ src: shot.src, caption: shot.caption || item.caption || "原页截图" });
    });
    return shots;
  }

  function renderDiffCards(data) {
    const wrap = $("#proto-diff-cards");
    if (!wrap) return;
    const items = data.items || [];
    if (!items.length) {
      wrap.innerHTML = `<div class="proto-diff-empty">${data.emptyText || "暂无改动说明"}</div>`;
      return;
    }
    wrap.innerHTML = items
      .map((item, index) => {
        const changes = renderChangeItems(item.changes);
        const shots = getDiffItemShots(item);
        const thumbs = shots
          .map(
            (shot, shotIndex) => `<button type="button" class="proto-diff-card__thumb" data-shot-index="${index}" data-shot-sub="${shotIndex}" title="点击查看大图">
            <img src="${shot.src}" alt="${shot.caption || "原页截图"}" />
            <span class="proto-diff-card__thumb-tip">${
              shots.length > 1 ? `图${shotIndex + 1} · 点击查看大图` : "点击查看大图"
            }</span>
          </button>`
          )
          .join("");
        return `<article class="proto-diff-card${shots.length > 1 ? " proto-diff-card--multi" : ""}" data-diff-id="${
          item.id || `diff-${index}`
        }">
          <div class="proto-diff-card__thumbs">${thumbs}</div>
          <div class="proto-diff-card__meta">
            <h3><span class="proto-diff-card__no">${index + 1}</span>${item.caption || `原页截图 ${index + 1}`}</h3>
            <ol class="proto-diff-card__list">${changes}</ol>
          </div>
        </article>`;
      })
      .join("");
  }

  function findDiffPinItem(pinId) {
    const items = getDiffData().items || [];
    const index = items.findIndex((item) => item.id === pinId);
    if (index < 0) return null;
    return { item: items[index], index };
  }

  function syncDiffPinLabels(root) {
    const pins =
      root && root.nodeType === 1 && root.matches?.("[data-diff-pin]")
        ? [root]
        : Array.from((root || document).querySelectorAll?.("[data-diff-pin]") || []);
    pins.forEach((pin) => {
      const found = findDiffPinItem(pin.dataset.diffPin || "");
      pin.textContent = found ? `改${found.index + 1}` : "改";
    });
  }

  function ensureDiffPinTip() {
    let tip = $("#proto-diff-pin-tip");
    if (tip) return tip;
    tip = document.createElement("div");
    tip.id = "proto-diff-pin-tip";
    tip.className = "proto-diff-pin-tip";
    tip.hidden = true;
    document.body.appendChild(tip);
    return tip;
  }

  let pinTipTimer = null;

  function cancelHideDiffPinTip() {
    if (!pinTipTimer) return;
    clearTimeout(pinTipTimer);
    pinTipTimer = null;
  }

  function hideDiffPinTip() {
    cancelHideDiffPinTip();
    const tip = $("#proto-diff-pin-tip");
    if (tip) tip.hidden = true;
  }

  function scheduleHideDiffPinTip() {
    cancelHideDiffPinTip();
    pinTipTimer = setTimeout(() => {
      pinTipTimer = null;
      const tip = $("#proto-diff-pin-tip");
      if (tip) tip.hidden = true;
    }, 220);
  }

  function isDiffPinTipZone(node) {
    if (!node || !node.closest) return false;
    return !!(node.closest("[data-diff-pin]") || node.closest("#proto-diff-pin-tip"));
  }

  function showDiffPinTip(pin) {
    cancelHideDiffPinTip();
    const found = findDiffPinItem(pin.dataset.diffPin || "");
    if (!found) return;
    const tip = ensureDiffPinTip();
    const changes = renderChangeItems(found.item.changes);
    tip.innerHTML = `<p class="proto-diff-pin-tip__title">改${found.index + 1} ${escapeAttr(
      found.item.caption || ""
    )}</p><ol class="proto-diff-card__list">${
      changes || `<li>暂无改动说明</li>`
    }</ol>`;
    tip.hidden = false;
    const pinRect = pin.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let left = pinRect.right + 8;
    let top = pinRect.top;
    if (left + tipRect.width > window.innerWidth - 8) left = pinRect.left - tipRect.width - 8;
    if (top + tipRect.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - tipRect.height - 8);
    if (left < 8) left = 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function openDiffPin(pinId) {
    const found = findDiffPinItem(pinId);
    hideDiffPinTip();
    if (!found) {
      openDiffDrawer(pinId);
      return;
    }
    const shots = getDiffItemShots(found.item);
    const shot = shots[0];
    if (!shot) {
      openDiffDrawer(pinId);
      return;
    }
    openLightbox(shot.src, shot.caption, found.item.changes, shots, 0);
  }

  function updateDiffNotes() {
    const data = getDiffData();
    const tag = $("#proto-diff-tag");
    const title = $("#proto-diff-title");
    if (tag) tag.textContent = data.label;
    if (title) title.textContent = data.title;
    renderDiffCards(data);
    syncDiffPinLabels();
  }

  function bindDiffNotes() {
    document.addEventListener(
      "click",
      (e) => {
        const pin = e.target.closest("[data-diff-pin]");
        if (!pin) return;
        e.preventDefault();
        e.stopPropagation();
        openDiffPin(pin.dataset.diffPin || "");
      },
      true
    );
    document.addEventListener("mouseover", (e) => {
      const pin = e.target.closest?.("[data-diff-pin]");
      if (pin) {
        showDiffPinTip(pin);
        return;
      }
      if (e.target.closest?.("#proto-diff-pin-tip")) cancelHideDiffPinTip();
    });
    document.addEventListener("mouseout", (e) => {
      const inZone = e.target.closest?.("[data-diff-pin]") || e.target.closest?.("#proto-diff-pin-tip");
      if (!inZone) return;
      if (isDiffPinTipZone(e.relatedTarget)) return;
      scheduleHideDiffPinTip();
    });
    const pinObserver = new MutationObserver((records) => {
      const needsSync = records.some((record) =>
        Array.from(record.addedNodes).some(
          (node) =>
            node.nodeType === 1 &&
            (node.matches?.("[data-diff-pin]") || node.querySelector?.("[data-diff-pin]"))
        )
      );
      if (needsSync) syncDiffPinLabels();
    });
    pinObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener(
      "scroll",
      (e) => {
        if (e.target?.closest?.("#proto-diff-pin-tip")) return;
        hideDiffPinTip();
      },
      true
    );
    window.addEventListener("resize", hideDiffPinTip);
    $("#proto-diff-open")?.addEventListener("click", () => openDiffDrawer());
    $$("[data-close-diff]").forEach((el) => {
      el.addEventListener("click", closeDiffDrawer);
    });
    $("#proto-diff-cards")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-shot-index]");
      if (!btn) return;
      const data = getDiffData();
      const item = (data.items || [])[Number(btn.dataset.shotIndex)];
      if (!item) return;
      const shots = getDiffItemShots(item);
      const shot = shots[Number(btn.dataset.shotSub) || 0] || shots[0];
      if (!shot) return;
      openLightbox(shot.src, shot.caption, item.changes, shots, Number(btn.dataset.shotSub) || 0);
    });
    $$("[data-close-lightbox]").forEach((el) => {
      el.addEventListener("click", closeLightbox);
    });
    $("#proto-lightbox-prev")?.addEventListener("click", () => stepLightbox(-1));
    $("#proto-lightbox-next")?.addEventListener("click", () => stepLightbox(1));
    document.addEventListener("keydown", (e) => {
      const box = $("#proto-lightbox");
      if (!box || box.hidden) return;
      if (e.key === "ArrowLeft") stepLightbox(-1);
      if (e.key === "ArrowRight") stepLightbox(1);
    });
  }

  function bind() {
    $$(".seg__btn[data-terminal]").forEach((btn) => {
      btn.addEventListener("click", () => setTerminal(btn.dataset.terminal));
    });

    $$(".pc-role-hotspot").forEach((hot) => {
      hot.addEventListener("click", (e) => {
        e.stopPropagation();
        const menu = $(".role-menu");
        if (menu?.classList.contains("is-open")) closeRoleMenu();
        else openRoleMenu();
      });
    });

    $$("[data-role-switch]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const menu = $(".role-menu");
        if (menu?.classList.contains("is-open")) closeRoleMenu();
        else openRoleMenu(btn);
      });
    });

    $$(".role-menu__item[data-role]").forEach((item) => {
      item.addEventListener("click", () => setRole(item.dataset.role));
    });

    $(".backdrop")?.addEventListener("click", closeRoleMenu);

    $$("[data-action='open-pc-module']").forEach((el) => {
      el.addEventListener("click", openPcModule);
    });

    $("#pc-back")?.addEventListener("click", showPcHome);
    $("#pc-jiaowu-back")?.addEventListener("click", showPcHome);

    $$("[data-action='open-pad-xiaoben']").forEach((el) => {
      el.addEventListener("click", () => openPadModule("xiaoben"));
    });

    $$("[data-action='open-pad-jingxuan']").forEach((el) => {
      el.addEventListener("click", () => openPadModule("jingxuan"));
    });

    $$("[data-pad-back]").forEach((el) => {
      el.addEventListener("click", showPadHome);
    });

    $("#pad-xb-subjects")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pad-xb-subject]");
      if (!btn) return;
      padXbSubject = btn.dataset.padXbSubject || "语文";
      renderPadXbHome();
      schedulePersist();
    });

    $("#pad-xb-course-grid")?.addEventListener("click", (e) => {
      const card = e.target.closest("[data-pad-xb-course]");
      if (!card) return;
      openPadXbCourse(card.dataset.padXbCourse || "");
    });

    $("#pad-xb-course-back")?.addEventListener("click", backPadXbCourseToList);
    $("#pad-xb-course-continue")?.addEventListener("click", () => {
      showToast("继续学习（原型示意）");
    });
    $("#pad-xb-course-cache")?.addEventListener("click", () => {
      showToast("缓存课程（原型示意）");
    });
    $("#pad-xb-course-add-note")?.addEventListener("click", () => {
      showToast("添加笔记（原型示意）");
    });
    $$("[data-pad-course-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        setPadCourseTab(tab.dataset.padCourseTab || "notes");
      });
    });

    $("#pad-xb-course")?.addEventListener("click", (e) => {
      const focusBlock = e.target.closest("[data-pad-focus]");
      if (focusBlock) setPadXbFocusLesson(focusBlock.dataset.padFocus || "l1");
      if (e.target.closest("[data-pad-open-ware]")) {
        openPadXbCourseware();
        return;
      }
      const hwAction = e.target.closest("[data-pad-hw-action]");
      if (hwAction) {
        handlePadXbHwCardAction(hwAction.dataset.padHwAction || "answer");
        return;
      }
      const actionBtn = e.target.closest("[data-pad-resource-action]");
      if (!actionBtn) return;
      showToast(`${actionBtn.dataset.padResourceAction || "操作"}（原型示意）`);
    });

    $("#pad-xb-ware")?.addEventListener("click", handlePadXbWareClick);
    $("#pad-xb-ware")?.addEventListener("mousemove", handlePadXbWareMove);
    $("#pad-xb-ware")?.addEventListener("mouseleave", () => setPadImgPageCursor($("#pad-xb-ware"), false));
    $("#pad-xb-hw")?.addEventListener("click", handlePadXbHwPageClick);
    $("#pad-xb-hw")?.addEventListener("mousemove", handlePadXbHwPageMove);
    $("#pad-xb-hw")?.addEventListener("mouseleave", () => setPadImgPageCursor($("#pad-xb-hw"), false));
    $("#pad-xb-hw-grade")?.addEventListener("click", handlePadXbHwGradeClick);
    $("#pad-xb-hw-grade")?.addEventListener("mousemove", handlePadXbHwGradeMove);
    $("#pad-xb-hw-grade")?.addEventListener("mouseleave", () => setPadImgPageCursor($("#pad-xb-hw-grade"), false));
    $("#pad-xb-hw-report")?.addEventListener("click", handlePadXbHwReportClick);
    $("#pad-xb-hw-report")?.addEventListener("mousemove", handlePadXbHwReportMove);
    $("#pad-xb-hw-report")?.addEventListener("mouseleave", () => setPadImgPageCursor($("#pad-xb-hw-report"), false));
    $("#pad-xb-hw-detail")?.addEventListener("click", handlePadXbHwDetailClick);
    $("#pad-xb-hw-detail")?.addEventListener("mousemove", handlePadXbHwDetailMove);
    $("#pad-xb-hw-detail")?.addEventListener("mouseleave", () => setPadImgPageCursor($("#pad-xb-hw-detail"), false));
    $("#pad-xb-hw-status")?.addEventListener("click", handlePadXbHwStatusClick);
    $("#pad-xb-hw-status")?.addEventListener("mousemove", handlePadXbHwStatusMove);
    $("#pad-xb-hw-status")?.addEventListener("mouseleave", () => setPadImgPageCursor($("#pad-xb-hw-status"), false));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!$("#proto-lightbox")?.hidden) {
          closeLightbox();
          return;
        }
        if (!$("#proto-diff-drawer")?.hidden) {
          closeDiffDrawer();
          return;
        }
        if ($("#jw-review-modal")?.classList.contains("is-open")) {
          closeReviewModal();
          return;
        }
        if ($("#xb-edit-modal")?.classList.contains("is-open")) {
          closeEditModal();
          return;
        }
        if ($("#xb-move-modal")?.classList.contains("is-open")) {
          closeMoveModal();
          return;
        }
        if ($("#xb-audit-modal")?.classList.contains("is-open")) {
          closeAuditModal();
          return;
        }
        if ($("#xb-withdraw-modal")?.classList.contains("is-open")) {
          closeWithdrawModal();
          return;
        }
        if ($("#xb-submit-modal")?.classList.contains("is-open")) {
          closeSubmitModal();
          return;
        }
        if ($("#xb-del-modal")?.classList.contains("is-open")) {
          closeDelModal();
          return;
        }
        if ($("#jw-manage-del-modal")?.classList.contains("is-open")) {
          closeManageDelModal();
          return;
        }
        if ($("#jw-learner-remove-modal")?.classList.contains("is-open")) {
          closeLearnerRemoveModal();
          return;
        }
        if ($("#jw-learners-mode-modal")?.classList.contains("is-open")) {
          closeLearnersModeConfirmModal();
          return;
        }
        if ($("#jw-student-detail-modal")?.classList.contains("is-open")) {
          closeStudentDetailModal();
          return;
        }
        if ($("#jw-publish-now-modal")?.classList.contains("is-open")) {
          closePublishNowModal();
          return;
        }
        if ($("#jw-manage-off-modal")?.classList.contains("is-open")) {
          closeManageOffModal();
          return;
        }
        if ($("#jw-import-restore-modal")?.classList.contains("is-open")) {
          closeImportRestoreModal();
          return;
        }
        if ($("#jw-add-course-modal")?.classList.contains("is-open")) {
          closeAddCourseModal();
          return;
        }
        if ($("#xb-cw-modal")?.classList.contains("is-open")) {
          closeCwModal();
          return;
        }
        if ($("#xb-hw-modal")?.classList.contains("is-open")) {
          closeHwModal();
          return;
        }
        if ($("#xb-pick-modal")?.classList.contains("is-open")) {
          closePickModal();
          return;
        }
        closeAddModal();
        closeRoleMenu();
      }
    });

    bindDiffNotes();
    updateDiffNotes();
    bindTeacherListChecks();
    bindJiaowuLib();
    bindPublishPage();
    bindAddModal();
    bindPickModal();
    bindHwModal();
    bindCwModal();
    bindDelModal();
    bindManageDelModal();
    bindPublishNowModal();
    bindManageOffModal();
    bindLearnersPage();
    bindAddCourseModal();
    bindSubmitModal();
    bindWithdrawModal();
    bindAuditModal();
    bindReviewModal();
    bindGroupAndMove();
    bindEditModal();
  }

  const PREVIEW = {
    video: "https://www.letaoedu.com/page/lt/weike/preview?cwId=42290&_t=1791535954387",
    paper: "https://www.letaoedu.com/proxy/paper/auth/common/paper/view.htm?paperId=4978646",
    courseware: "https://www.letaoedu.com/proxy/beike/auth/common/courseware/preview.htm?coursewareId=9220909",
  };

  function makePageUrl(videoName) {
    return `./make.html?title=${encodeURIComponent(videoName || "未命名视频")}`;
  }

  function escapeHref(url) {
    return String(url).replace(/&/g, "&amp;");
  }

  function openExternalUrl(url) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  let courseListSeq = 1;
  const courseList = [
    {
      id: courseListSeq++,
      subject: "语文",
      stageSubject: "小学语文",
      videoName: "avi: 03 jmeter的两种录制方法",
      groupName: "",
      maker: "zfy",
      homeworks: [],
      coursewares: [],
      audit: "无",
      createdAt: "2026-10-10 10:01:58",
      updatedAt: "2026-10-10 10:01:58",
      status: "reviewing",
      action: "移动",
      auditRecords: [],
    },
    {
      id: courseListSeq++,
      subject: "语文",
      stageSubject: "小学语文",
      videoName: "大字",
      groupName: "",
      maker: "zfy",
      homeworks: [],
      coursewares: [],
      audit: "无",
      createdAt: "2026-10-09 17:06:33",
      updatedAt: "2026-10-10 09:19:05",
      status: "passed",
      action: "移动",
      auditRecords: [
        {
          time: "2026-10-10 09:19:05",
          reviewer: "zfy",
          opinion: "无",
          result: "pass",
        },
      ],
    },
    {
      id: courseListSeq++,
      subject: "语文",
      stageSubject: "小学语文",
      videoName: "wmv: 儿童歌曲 - 小龙人",
      groupName: "",
      maker: "zfy",
      homeworks: [
        { key: "seed-hw-1", name: "2026-09-24化学试卷", paperIndex: 0 },
        { key: "seed-hw-2", name: "化学题", paperIndex: 1 },
      ],
      coursewares: [
        { key: "seed-cw-1", name: "《第一组 感受自然》试卷(学生版)", cwIndex: 3 },
        { key: "seed-cw-2", name: "《第一组 感受自然》课件", cwIndex: 4 },
      ],
      audit: "视频不达标",
      createdAt: "2026-10-09 16:52:14",
      updatedAt: "2026-10-10 09:17:50",
      status: "rejected",
      action: "制作",
      auditRecords: [
        {
          time: "2026-10-10 09:17:50",
          reviewer: "zfy",
          opinion: "视频不达标",
          result: "reject",
        },
      ],
    },
  ];

  let manageListSeq = 1;
  const manageCourseList = [
    {
      id: manageListSeq++,
      title: "一年级语文基础巩固训练营",
      tags: ["vod"],
      grade: "一年级",
      subject: "语文",
      lessons: 12,
      learners: 36,
      publishedAt: "2026-09-12",
      status: "on",
    },
    {
      id: manageListSeq++,
      title: "小学数学思维拓展（上）",
      tags: ["vod", "insert"],
      grade: "三年级",
      subject: "数学",
      lessons: 8,
      learners: 28,
      publishedAt: "2026-09-20",
      status: "on",
    },
    {
      id: manageListSeq++,
      title: "英语绘本精读 · 自然拼读入门",
      tags: ["live"],
      grade: "二年级",
      subject: "英语",
      lessons: 10,
      learners: 19,
      publishedAt: "2026-10-01",
      status: "on",
    },
    {
      id: manageListSeq++,
      title: "科学探究小实验合集",
      tags: ["vod"],
      grade: "四年级",
      subject: "科学",
      lessons: 6,
      learners: 15,
      publishedAt: "2026-10-05",
      status: "off",
    },
    {
      id: manageListSeq++,
      title: "自适应测试",
      tags: ["vod"],
      grade: "一年级",
      subject: "语文",
      lessons: null,
      learners: null,
      publishedAt: null,
      status: "draft",
    },
  ];

  function refreshCourseViews() {
    renderCourseTable();
    renderJiaowuTable();
    renderManageTable();
  }

  function manageEmptyText(value) {
    if (value === null || value === undefined || value === "" || value === "—") {
      return `<span class="jw-empty">--</span>`;
    }
    return escapeAttr(String(value));
  }

  function manageStatusHtml(status) {
    if (status === "on") return `<span class="jw-status jw-status--on">已上架</span>`;
    if (status === "off") return `<span class="jw-status jw-status--off">已下架</span>`;
    return `<span class="jw-status jw-status--draft">待发布</span>`;
  }

  function buildManageOpHtml(row) {
    if (row.status === "draft") {
      return `<div class="jw-manage-ops">
        <button type="button" class="jw-link" data-manage-op="继续编辑">继续编辑</button>
        <button type="button" class="jw-link" data-manage-op="删除">删除</button>
      </div>`;
    }
    const moreBtn = `<div class="jw-manage-more">
        <button type="button" class="jw-manage-more__btn" data-manage-more aria-label="更多操作">⋯</button>
        <div class="jw-manage-more__menu" hidden>
          ${
            row.status === "off"
              ? `<button type="button" data-manage-op="学习数据">学习数据</button>
                 <button type="button" data-manage-op="修改">修改</button>`
              : `<button type="button" data-manage-op="学习数据">学习数据</button>
                 <button type="button" data-manage-op="下架">下架</button>
                 <button type="button" data-manage-op="删除">删除</button>
                 <button type="button" data-manage-op="修改">修改</button>`
          }
        </div>
      </div>`;
    if (row.status === "off") {
      return `<div class="jw-manage-ops">
        <button type="button" class="jw-link" data-manage-op="排课">排课</button>
        <button type="button" class="jw-link" data-manage-op="学习名单">学习名单</button>
        <button type="button" class="jw-link" data-manage-op="上架">上架</button>
        ${moreBtn}
      </div>`;
    }
    return `<div class="jw-manage-ops">
      <button type="button" class="jw-link" data-manage-op="排课">排课</button>
      <button type="button" class="jw-link" data-manage-op="学习名单">学习名单</button>
      ${moreBtn}
    </div>`;
  }

  function renderManageTable() {
    const tbody = $("#jw-manage-tbody");
    const countEl = $("#jw-manage-record-count");
    if (!tbody) return;
    tbody.innerHTML = manageCourseList
      .map(
        (row) => `<tr data-manage-id="${row.id}">
          <td class="col-check"><input class="xb-check" type="checkbox" aria-label="选择行" /></td>
          <td class="col-minfo">
            <div class="jw-course-cell">
              <span class="jw-course-thumb jw-course-thumb--placeholder" aria-hidden="true"></span>
              <div class="jw-course-meta">
                <div class="jw-course-title" title="${escapeAttr(row.title)}">${escapeAttr(row.title)}</div>
              </div>
            </div>
          </td>
          <td class="col-grade">${escapeAttr(row.grade)}</td>
          <td class="col-subject">${escapeAttr(row.subject)}</td>
          <td class="col-lessons">${manageEmptyText(row.lessons)}</td>
          <td class="col-learners">${manageEmptyText(row.learners)}</td>
          <td class="col-publish">${manageEmptyText(row.publishedAt)}</td>
          <td class="col-mstatus">${manageStatusHtml(row.status)}</td>
          <td class="col-maction">${buildManageOpHtml(row)}</td>
        </tr>`
      )
      .join("");
    if (countEl) countEl.textContent = `共${manageCourseList.length}条记录`;
    syncManageChecks();
    schedulePersist();
  }

  function syncManageChecks() {
    const checkAll = $("#jw-manage-check-all");
    const rows = $$("#jw-manage-tbody .xb-check");
    const checkedCount = rows.filter((c) => c.checked).length;
    if (checkAll) {
      checkAll.checked = rows.length > 0 && checkedCount === rows.length;
      checkAll.indeterminate = checkedCount > 0 && checkedCount < rows.length;
    }
    const viewBtn = $("#jw-view-data-btn");
    if (viewBtn) {
      const multiSelected = checkedCount >= 2;
      viewBtn.disabled = !multiSelected;
      viewBtn.classList.toggle("xb-btn--muted", !multiSelected);
    }
  }

  let learnersCourseId = null;
  let learnDataCourseId = null;
  let learnDataCourseIds = [];
  const learnersByCourse = {};
  const removedLearnersByCourse = {};
  const devicesByCourse = {};
  const removedDevicesByCourse = {};
  const learnersMaintainModeByCourse = {};
  let learnersListKeyword = "";
  let addDeviceMatchedSerial = null;
  let pendingLearnersMaintainMode = null;

  function isLearnersDeviceMode() {
    if (learnersCourseId == null) return false;
    return learnersMaintainModeByCourse[learnersKey(learnersCourseId)] === "device";
  }

  function getLearnersMaintainMode() {
    return isLearnersDeviceMode() ? "device" : "person";
  }

  function getCurrentLearnersRosterCount() {
    if (learnersCourseId == null) return 0;
    return isLearnersDeviceMode()
      ? getDevicesForCourse(learnersCourseId).length
      : getLearnersForCourse(learnersCourseId).length;
  }

  function clearCurrentLearnersRosterData() {
    if (learnersCourseId == null) return;
    if (isLearnersDeviceMode()) {
      getDevicesForCourse(learnersCourseId).length = 0;
      getRemovedDevicesForCourse(learnersCourseId).length = 0;
    } else {
      getLearnersForCourse(learnersCourseId).length = 0;
      getRemovedLearnersForCourse(learnersCourseId).length = 0;
    }
    syncCourseLearnerCount(learnersCourseId);
  }

  function applyLearnersMaintainMode(mode) {
    if (learnersCourseId == null) return;
    const next = mode === "device" ? "device" : "person";
    learnersMaintainModeByCourse[learnersKey(learnersCourseId)] = next;
    learnersListKeyword = "";
    const keywordInput = $("#jw-learners-keyword");
    if (keywordInput) keywordInput.value = "";
    addDeviceMatchedSerial = null;
    syncLearnersMaintainModeUI();
    renderLearnersTable();
    schedulePersist();
  }

  function openLearnersModeConfirmModal(mode) {
    pendingLearnersMaintainMode = mode === "device" ? "device" : "person";
    const modal = $("#jw-learners-mode-modal");
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeLearnersModeConfirmModal() {
    const modal = $("#jw-learners-mode-modal");
    if (!modal) return;
    pendingLearnersMaintainMode = null;
    modal.classList.remove("is-open");
    modal.hidden = true;
    // 取消时把切换按钮状态回正
    syncLearnersMaintainModeUI();
  }

  function confirmLearnersMaintainModeSwitch() {
    if (learnersCourseId == null || !pendingLearnersMaintainMode) {
      closeLearnersModeConfirmModal();
      return;
    }
    const next = pendingLearnersMaintainMode;
    clearCurrentLearnersRosterData();
    pendingLearnersMaintainMode = null;
    const modal = $("#jw-learners-mode-modal");
    if (modal) {
      modal.classList.remove("is-open");
      modal.hidden = true;
    }
    applyLearnersMaintainMode(next);
    showToast("已更换名单维护方式");
  }

  function setLearnersMaintainMode(mode) {
    if (learnersCourseId == null) return;
    const next = mode === "device" ? "device" : "person";
    if (next === getLearnersMaintainMode()) return;
    if (getCurrentLearnersRosterCount() === 0) {
      applyLearnersMaintainMode(next);
      return;
    }
    openLearnersModeConfirmModal(next);
  }

  function isLearnDataMulti() {
    return learnDataCourseIds.length > 1;
  }

  function getLearnDataCourses() {
    const ids = learnDataCourseIds.length
      ? learnDataCourseIds
      : learnDataCourseId != null
        ? [learnDataCourseId]
        : [];
    return ids
      .map((id) => manageCourseList.find((item) => item.id === id))
      .filter(Boolean);
  }

  function getLearnDataLearnersMerged() {
    const courses = getLearnDataCourses();
    const byLehao = new Map();
    courses.forEach((course) => {
      getLearnersForCourse(course.id).forEach((student) => {
        const key = String(student.lehao || student.id);
        if (!byLehao.has(key)) byLehao.set(key, { ...student });
      });
    });
    return Array.from(byLehao.values());
  }

  function getSelectedManageCourseIds() {
    return $$("#jw-manage-tbody tr[data-manage-id]")
      .filter((tr) => tr.querySelector(".xb-check")?.checked)
      .map((tr) => Number(tr.dataset.manageId))
      .filter((id) => Number.isFinite(id));
  }

  function learnersKey(courseId) {
    return String(courseId);
  }

  function getLearnersForCourse(courseId) {
    const key = learnersKey(courseId);
    if (!learnersByCourse[key]) learnersByCourse[key] = [];
    return learnersByCourse[key];
  }

  function getRemovedLearnersForCourse(courseId) {
    const key = learnersKey(courseId);
    if (!removedLearnersByCourse[key]) removedLearnersByCourse[key] = [];
    return removedLearnersByCourse[key];
  }

  function getDevicesForCourse(courseId) {
    const key = learnersKey(courseId);
    if (!devicesByCourse[key]) devicesByCourse[key] = [];
    return devicesByCourse[key];
  }

  function getRemovedDevicesForCourse(courseId) {
    const key = learnersKey(courseId);
    if (!removedDevicesByCourse[key]) removedDevicesByCourse[key] = [];
    return removedDevicesByCourse[key];
  }

  function upsertDevice(list, device) {
    const idx = list.findIndex(
      (item) => String(item.serial) === String(device.serial) || Number(item.id) === Number(device.id)
    );
    if (idx >= 0) list[idx] = { ...list[idx], ...device };
    else list.push(device);
  }

  function resolveLearnersCourseId() {
    if (learnersCourseId != null) return learnersCourseId;
    const title = ($("#jw-import-course-name")?.textContent || "").trim();
    if (title && title !== "—") {
      const byTitle = manageCourseList.find((item) => item.title === title);
      if (byTitle) return byTitle.id;
    }
    const onShelf = manageCourseList.find((item) => item.status === "on" || item.status === "off");
    return onShelf ? onShelf.id : null;
  }

  function upsertLearner(list, student) {
    const idx = list.findIndex(
      (item) => String(item.lehao) === String(student.lehao) || Number(item.id) === Number(student.id)
    );
    if (idx >= 0) list[idx] = { ...list[idx], ...student };
    else list.push(student);
  }

  function syncCourseLearnerCount(courseId) {
    const course = manageCourseList.find((item) => item.id === courseId);
    if (!course) return;
    const deviceMode = learnersMaintainModeByCourse[learnersKey(courseId)] === "device";
    course.learners = deviceMode
      ? getDevicesForCourse(courseId).length
      : getLearnersForCourse(courseId).length;
  }

  function syncLearnersMaintainModeUI() {
    const mode = getLearnersMaintainMode();
    const isDevice = mode === "device";
    $$("[data-learners-mode]").forEach((btn) => {
      const active = btn.dataset.learnersMode === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    $$("[data-learners-person-only]").forEach((el) => {
      el.hidden = isDevice;
    });
    $$("[data-learners-thead]").forEach((row) => {
      row.hidden = row.dataset.learnersThead !== mode;
    });
    const keywordLabel = $("#jw-learners-keyword-label");
    const keywordInput = $("#jw-learners-keyword");
    if (keywordLabel) keywordLabel.textContent = isDevice ? "序列号:" : "学生:";
    if (keywordInput) {
      keywordInput.placeholder = isDevice ? "请输入序列号" : "乐号/姓名";
      keywordInput.setAttribute("aria-label", isDevice ? "序列号" : "学生");
    }
    const addBtn = $("#jw-learners-add-btn");
    if (addBtn) {
      addBtn.textContent = isDevice ? "添加设备" : "添加学生";
      addBtn.dataset.learnersAct = isDevice ? "添加设备" : "添加学生";
    }
    const step3 = $("#jw-import-step3-title");
    if (step3) step3.textContent = isDevice ? "上传设备名单" : "上传学生名单";
    const crumb = $("#jw-add-learner-crumb");
    if (crumb) crumb.textContent = isDevice ? "添加设备" : "添加学生";
    const modeRow = $("#jw-add-learner-mode-row");
    if (modeRow) modeRow.hidden = isDevice;
  }

  function ensureDemoRemovedLearner(courseId) {
    if (courseId == null) return;
    const list = getLearnersForCourse(courseId);
    const removed = getRemovedLearnersForCourse(courseId);
    const demoRemoved = {
      id: 63174,
      lehao: "63174",
      name: "杨莉莉",
      gender: "保密",
      klass: "一年级(2)班",
      addedAt: "2026-10-10 09:30:00",
    };
    const inActive = list.some(
      (item) => String(item.lehao) === demoRemoved.lehao || Number(item.id) === demoRemoved.id
    );
    const inRemoved = removed.some(
      (item) => String(item.lehao) === demoRemoved.lehao || Number(item.id) === demoRemoved.id
    );
    if (!inActive && !inRemoved) removed.push(demoRemoved);
  }

  function applyDemoImportedLearners() {
    const courseId = resolveLearnersCourseId();
    if (courseId == null) return null;
    learnersCourseId = courseId;
    const list = getLearnersForCourse(courseId);
    const demo = {
      id: 7277620,
      lehao: "7277620",
      name: "文祥云",
      gender: "保密",
      klass: "一年级(2)班",
      addedAt: "2026-10-14 11:02:06",
    };
    upsertLearner(list, demo);
    syncCourseLearnerCount(courseId);
    schedulePersist();
    return demo;
  }

  let restoreContinueAction = "import"; // import | add
  let pendingAddStudents = [];
  let pendingRestoreStudents = [];

  function applyDemoImportedDevices() {
    const courseId = resolveLearnersCourseId();
    if (courseId == null) return null;
    learnersCourseId = courseId;
    const list = getDevicesForCourse(courseId);
    const demo = {
      id: Date.now(),
      serial: "SN20260109",
      addedAt: nowText(),
    };
    upsertDevice(list, demo);
    syncCourseLearnerCount(courseId);
    schedulePersist();
    return demo;
  }

  function finishImportSuccess() {
    if (isLearnersDeviceMode()) applyDemoImportedDevices();
    else applyDemoImportedLearners();
    setJiaowuNav("learners");
    renderLearnersTable();
    showToast("导入成功");
    schedulePersist();
  }

  function finishAddLearnersSuccess(students) {
    const courseId = resolveLearnersCourseId();
    if (courseId == null) return;
    learnersCourseId = courseId;
    const list = getLearnersForCourse(courseId);
    const now = nowText();
    (students || []).forEach((item) => {
      upsertLearner(list, {
        id: Number(item.lehao) || item.id || Date.now(),
        lehao: String(item.lehao || ""),
        name: item.name,
        gender: item.gender || "保密",
        klass: item.klass || "--",
        addedAt: item.addedAt || now,
      });
    });
    syncCourseLearnerCount(courseId);
    setJiaowuNav("learners");
    renderLearnersTable();
    showToast("添加成功");
    schedulePersist();
  }

  function finishAddDeviceSuccess(serial) {
    const courseId = resolveLearnersCourseId();
    if (courseId == null) return;
    learnersCourseId = courseId;
    const list = getDevicesForCourse(courseId);
    upsertDevice(list, {
      id: Date.now(),
      serial: String(serial || ""),
      addedAt: nowText(),
    });
    addDeviceMatchedSerial = null;
    syncCourseLearnerCount(courseId);
    setJiaowuNav("learners");
    renderLearnersTable();
    showToast("添加成功");
    schedulePersist();
  }

  function renderImportRestoreList(removed) {
    const listEl = $("#jw-import-restore-list");
    const countEl = $("#jw-import-restore-count");
    if (countEl) countEl.textContent = `${removed.length}人被移除`;
    if (!listEl) return;
    listEl.innerHTML = removed
      .map((item) => {
        const lehao = item.lehao ? String(item.lehao) : "";
        const shortLehao = lehao.length > 6 ? `${lehao.slice(0, 5)}...` : lehao;
        return `<li class="jw-restore-dialog__item">
          <span class="jw-restore-dialog__name">${escapeAttr(item.name || "--")}${
          shortLehao ? ` (${escapeAttr(shortLehao)})` : ""
        }</span>
          <span class="jw-restore-dialog__meta">${escapeAttr(item.klass || "--")}</span>
        </li>`;
      })
      .join("");
  }

  function openImportRestoreModal(listOverride) {
    const courseId = resolveLearnersCourseId();
    if (courseId == null) return false;
    const removed = Array.isArray(listOverride)
      ? listOverride
      : getRemovedLearnersForCourse(courseId);
    if (!removed.length) return false;
    pendingRestoreStudents = removed.slice();
    const row = manageCourseList.find((item) => item.id === courseId);
    const courseEl = $("#jw-import-restore-course");
    if (courseEl) {
      const title = row?.title || "未命名课程";
      const subject = row?.subject || "语文";
      courseEl.textContent = `${title}（${subject}）`;
    }
    renderImportRestoreList(removed);
    const modal = $("#jw-import-restore-modal");
    if (!modal) return false;
    modal.hidden = false;
    modal.classList.add("is-open");
    return true;
  }

  function closeImportRestoreModal() {
    const modal = $("#jw-import-restore-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.hidden = true;
    pendingRestoreStudents = [];
    pendingAddStudents = [];
  }

  function confirmImportRestore() {
    const courseId = resolveLearnersCourseId();
    if (courseId == null) {
      closeImportRestoreModal();
      return;
    }
    learnersCourseId = courseId;
    const list = getLearnersForCourse(courseId);
    const removed = getRemovedLearnersForCourse(courseId);
    const action = restoreContinueAction;
    const pendingAdd = pendingAddStudents.slice();
    const restoreList = pendingRestoreStudents.length
      ? pendingRestoreStudents.slice()
      : removed.slice();
    const restoreIds = new Set(restoreList.map((item) => String(item.lehao || item.id)));
    const keep = [];
    removed.forEach((item) => {
      const key = String(item.lehao || item.id);
      if (restoreIds.has(key)) upsertLearner(list, item);
      else keep.push(item);
    });
    removed.length = 0;
    removed.push(...keep);
    restoreContinueAction = "import";
    pendingAddStudents = [];
    pendingRestoreStudents = [];
    const modal = $("#jw-import-restore-modal");
    if (modal) {
      modal.classList.remove("is-open");
      modal.hidden = true;
    }
    if (action === "add") finishAddLearnersSuccess(pendingAdd);
    else finishImportSuccess();
  }

  function getVisibleLearnersList() {
    if (learnersCourseId == null) return [];
    const keyword = (learnersListKeyword || "").trim().toLowerCase();
    if (isLearnersDeviceMode()) {
      return getDevicesForCourse(learnersCourseId).filter((row) => {
        if (!keyword) return true;
        return String(row.serial || "")
          .toLowerCase()
          .includes(keyword);
      });
    }
    const klassFilter = ($("#jw-learners-class")?.value || "全部").trim();
    return getLearnersForCourse(learnersCourseId).filter((row) => {
      if (klassFilter && klassFilter !== "全部") {
        const klass = String(row.klass || "").replace(/[()]/g, "");
        const target = klassFilter.replace(/[()]/g, "");
        if (!klass.includes(target) && !klass.includes(target.replace(/班$/, ""))) return false;
      }
      if (!keyword) return true;
      return (
        String(row.name || "")
          .toLowerCase()
          .includes(keyword) ||
        String(row.lehao || "")
          .toLowerCase()
          .includes(keyword)
      );
    });
  }

  function renderLearnersTable() {
    const tbody = $("#jw-learners-tbody");
    const countEl = $("#jw-learners-record-count");
    if (!tbody) return;
    syncLearnersMaintainModeUI();
    const isDevice = isLearnersDeviceMode();
    const list = getVisibleLearnersList();
    const colSpan = isDevice ? 4 : 7;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="${colSpan}"><div class="jw-learners-empty">暂无数据</div></td></tr>`;
    } else if (isDevice) {
      tbody.innerHTML = list
        .map(
          (row) => `<tr data-learner-id="${escapeAttr(String(row.id))}">
            <td class="col-check"><input class="xb-check" type="checkbox" aria-label="选择设备" /></td>
            <td>${escapeAttr(row.serial || "--")}</td>
            <td>${escapeAttr(row.addedAt || "--")}</td>
            <td class="col-maction">
              <button type="button" class="jw-link--remove" data-learner-remove="${escapeAttr(String(row.id))}">移除</button>
            </td>
          </tr>`
        )
        .join("");
    } else {
      tbody.innerHTML = list
        .map(
          (row) => `<tr data-learner-id="${escapeAttr(String(row.id))}">
            <td class="col-check"><input class="xb-check" type="checkbox" aria-label="选择学生" /></td>
            <td>${escapeAttr(row.lehao || "--")}</td>
            <td>${escapeAttr(row.name || "--")}</td>
            <td>${escapeAttr(row.gender || "--")}</td>
            <td>${escapeAttr(row.klass || "--")}</td>
            <td>${escapeAttr(row.addedAt || "--")}</td>
            <td class="col-maction">
              <button type="button" class="jw-link--remove" data-learner-remove="${escapeAttr(String(row.id))}">移除</button>
            </td>
          </tr>`
        )
        .join("");
    }
    if (countEl) countEl.textContent = `共${list.length}条记录`;
    ["#jw-learners-check-all", "#jw-learners-check-all-device"].forEach((sel) => {
      const checkAll = $(sel);
      if (checkAll) {
        checkAll.checked = false;
        checkAll.indeterminate = false;
      }
    });
  }

  function openLearnersPage(row) {
    if (!row) return;
    learnersCourseId = row.id;
    learnersListKeyword = "";
    const keywordInput = $("#jw-learners-keyword");
    if (keywordInput) keywordInput.value = "";
    syncLearnersMaintainModeUI();
    setJiaowuNav("learners");
    renderLearnersTable();
  }

  function formatLearnDataMetaValue(value, suffix) {
    if (value === null || value === undefined || value === "" || value === "—") {
      return "--";
    }
    return suffix ? `${value}${suffix}` : String(value);
  }

  let learnDataTab = "summary";
  let learnDataDim = "course";

  function renderLearnDataHeader() {
    const titleEl = $("#jw-learn-data-title");
    const metaEl = $("#jw-learn-data-meta");
    if (!titleEl || !metaEl) return;
    const courses = getLearnDataCourses();
    const learnPin = $("#pc-diff-learn-pin");
    if (learnPin) learnPin.dataset.diffPin = isLearnDataMulti() ? "pc-jw-learn-multi" : "pc-jw-learn-data";
    if (isLearnDataMulti()) {
      const names = courses.map((item) => item.title || "未命名课程").join("、");
      titleEl.textContent = `多课程统计 - ${names || "未命名课程"}`;
      metaEl.hidden = true;
      metaEl.innerHTML = "";
      return;
    }
    metaEl.hidden = false;
    const course = courses[0];
    const name = course?.title || "未命名课程";
    titleEl.textContent = `${name}-学习数据`;
    const grade = formatLearnDataMetaValue(course?.grade);
    const lessons = formatLearnDataMetaValue(course?.lessons, "课时");
    const learners = formatLearnDataMetaValue(course?.learners);
    metaEl.innerHTML = `
      <span>年级：${escapeAttr(grade)}</span>
      <span>总课时：${escapeAttr(lessons)}</span>
      <span>学习人数：${escapeAttr(learners)}</span>
    `;
  }

  function learnDataRateHtml(percent) {
    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    return `<span class="jw-learn-data-rate">
      <span class="jw-learn-data-rate__bar"><span class="jw-learn-data-rate__fill" style="width:${value}%"></span></span>
      <span>${value}%</span>
    </span>`;
  }

  function learnDataMetricHeadersHtml() {
    return `<th class="col-ld-students">学生数</th>
      <th class="col-ld-lessons">总课时数</th>
      <th class="col-ld-published">已上架课时数</th>
      <th class="col-ld-rate">
        <span class="jw-th-with-tip">
          视频观看时长占比
          <button type="button" class="jw-tip-btn" data-tip="avg-ratio" aria-label="视频观看时长占比说明">?</button>
        </span>
      </th>
      <th class="col-ld-rate">
        <span class="jw-th-with-tip">
          学习完成率
          <button type="button" class="jw-tip-btn" data-tip="learn-rate" aria-label="学习完成率说明">?</button>
        </span>
      </th>
      <th class="col-ld-rate">
        <span class="jw-th-with-tip">
          作业完成率
          <button type="button" class="jw-tip-btn" data-tip="hw-rate" aria-label="作业完成率说明">?</button>
        </span>
      </th>
      <th class="col-ld-rate">
        <span class="jw-th-with-tip">
          课件查看率
          <button type="button" class="jw-tip-btn" data-tip="cw-view-rate" aria-label="课件查看率说明">?</button>
        </span>
      </th>
      <th class="col-ld-rate">
        <span class="jw-th-with-tip">
          课件内容查看率
          <button type="button" class="jw-tip-btn" data-tip="cw-content-rate" aria-label="课件内容查看率说明">?</button>
        </span>
      </th>
      <th class="col-ld-action">操作</th>`;
  }

  function learnDataMetricCellsHtml(row) {
    const klassAttr = row.klass ? ` data-learn-data-klass="${escapeAttr(row.klass)}"` : "";
    const gradeAttr =
      row.grade && !row.klass ? ` data-learn-data-grade="${escapeAttr(row.grade)}"` : "";
    const subjectAttr =
      row.detailSubject && !row.klass && !row.grade
        ? ` data-learn-data-subject="${escapeAttr(row.detailSubject)}"`
        : "";
    return `<td class="col-ld-students">${escapeAttr(String(row.students))}</td>
      <td class="col-ld-lessons">${escapeAttr(String(row.totalLessons))}</td>
      <td class="col-ld-published">${escapeAttr(String(row.publishedLessons))}</td>
      <td class="col-ld-rate">${learnDataRateHtml(row.avgRatio)}</td>
      <td class="col-ld-rate">${learnDataRateHtml(row.learnRate)}</td>
      <td class="col-ld-rate">${learnDataRateHtml(row.homeworkRate)}</td>
      <td class="col-ld-rate">${learnDataRateHtml(row.coursewareViewRate)}</td>
      <td class="col-ld-rate">${learnDataRateHtml(row.coursewareContentRate)}</td>
      <td class="col-ld-action"><button type="button" class="jw-link" data-learn-data-detail${klassAttr}${gradeAttr}${subjectAttr}>查看详情</button></td>`;
  }

  function learnDataRateMetricDefaults() {
    return {
      avgRatio: 0,
      learnRate: 0,
      homeworkRate: 0,
      coursewareViewRate: 0,
      coursewareContentRate: 0,
    };
  }

  function learnDataMetricDefaults(course) {
    return {
      totalLessons: course?.lessons ?? 0,
      publishedLessons: course?.lessons ?? 0,
      ...learnDataRateMetricDefaults(),
    };
  }

  function learnDataAggregateMetrics(courses) {
    const list = courses || [];
    const totalLessons = list.reduce((sum, item) => sum + (Number(item.lessons) || 0), 0);
    const students = isLearnDataMulti()
      ? getLearnDataLearnersMerged().length ||
        list.reduce((sum, item) => sum + (Number(item.learners) || 0), 0)
      : list[0]?.learners ?? 0;
    return {
      students,
      totalLessons,
      publishedLessons: totalLessons,
      ...learnDataRateMetricDefaults(),
    };
  }

  function getLearnDataCourseRows() {
    const courses = getLearnDataCourses();
    if (!courses.length) return [];
    return [learnDataAggregateMetrics(courses)];
  }

  function getLearnDataClassRows() {
    const courses = getLearnDataCourses();
    if (!courses.length) return [];
    const metrics = learnDataAggregateMetrics(courses);
    const list = getLearnDataLearnersMerged();
    const grouped = new Map();
    list.forEach((student) => {
      const klass = student.klass || "--";
      if (!grouped.has(klass)) {
        grouped.set(klass, {
          klass,
          students: 0,
          totalLessons: metrics.totalLessons,
          publishedLessons: metrics.publishedLessons,
          ...learnDataRateMetricDefaults(),
        });
      }
      grouped.get(klass).students += 1;
    });
    if (grouped.size) return Array.from(grouped.values());
    return [
      { klass: "一年级(2)班", students: 2, ...metrics },
      { klass: "一年级(5)班", students: 1, ...metrics },
    ];
  }

  function getLearnDataGradeRows() {
    const courses = getLearnDataCourses();
    if (!courses.length) return [];
    const metrics = learnDataAggregateMetrics(courses);
    const list = getLearnDataLearnersMerged();
    const grouped = new Map();
    list.forEach((student) => {
      const grade =
        inferGradeFromKlass(student.klass) || courses[0]?.grade || "未分年级";
      if (!grouped.has(grade)) {
        grouped.set(grade, {
          grade,
          students: 0,
          totalLessons: metrics.totalLessons,
          publishedLessons: metrics.publishedLessons,
          ...learnDataRateMetricDefaults(),
        });
      }
      grouped.get(grade).students += 1;
    });
    if (grouped.size) return Array.from(grouped.values());
    return [
      { grade: "一年级", students: 3, ...metrics },
      { grade: "二年级", students: 2, ...metrics },
    ];
  }

  function getLearnDataLessonRows() {
    const courses = getLearnDataCourses();
    if (!courses.length) return [];
    return courses.map((course) => {
      const learnerCount =
        getLearnersForCourse(course.id).length || Number(course.learners) || 0;
      return {
        title: course.title || "未命名课程",
        subject: course.subject || "--",
        detailSubject: course.subject || "",
        students: learnerCount,
        totalLessons: course.lessons ?? 0,
        publishedLessons: course.lessons ?? 0,
        ...learnDataRateMetricDefaults(),
      };
    });
  }

  function syncLearnDataDimBar() {
    const multi = isLearnDataMulti();
    $$("[data-learn-data-dim]").forEach((btn) => {
      const dim = btn.dataset.learnDataDim;
      if (dim === "grade" || dim === "lesson") btn.hidden = !multi;
      btn.classList.toggle("is-active", dim === learnDataDim);
    });
    if (!multi && (learnDataDim === "grade" || learnDataDim === "lesson")) {
      learnDataDim = "course";
    }
  }

  function renderLearnDataSummaryTable() {
    const thead = $("#jw-learn-data-thead");
    const tbody = $("#jw-learn-data-tbody");
    const countEl = $("#jw-learn-data-record-count");
    if (!thead || !tbody) return;

    syncLearnDataDimBar();

    const isClassDim = learnDataDim === "class";
    const isGradeDim = learnDataDim === "grade";
    const isLessonDim = learnDataDim === "lesson";
    const leadLabel = isClassDim ? "班级" : isGradeDim ? "年级" : "";
    // 指标列 9（含课件查看率、课件内容查看率）+ 课程维 2 / 班级年级维 1 / 学校维 0
    const colSpan = isLessonDim ? 11 : leadLabel ? 10 : 9;
    thead.innerHTML = `<tr>
      ${
        isLessonDim
          ? '<th class="col-ld-title">课程名称</th><th class="col-ld-subject">学科</th>'
          : leadLabel
            ? `<th class="col-ld-lead">${leadLabel}</th>`
            : ""
      }
      ${learnDataMetricHeadersHtml()}
    </tr>`;

    const rows = isClassDim
      ? getLearnDataClassRows()
      : isGradeDim
        ? getLearnDataGradeRows()
        : isLessonDim
          ? getLearnDataLessonRows()
          : getLearnDataCourseRows();
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${colSpan}"><div class="jw-learners-empty">暂无数据</div></td></tr>`;
    } else {
      tbody.innerHTML = rows
        .map((row) => {
          const title = row.title || "--";
          const leadCell = isLessonDim
            ? `<td class="col-ld-title"><span class="jw-ld-title" title="${escapeAttr(
                title
              )}">${escapeAttr(title)}</span></td><td class="col-ld-subject">${escapeAttr(
                row.subject || "--"
              )}</td>`
            : isClassDim
              ? `<td class="col-ld-lead">${escapeAttr(row.klass || "--")}</td>`
              : isGradeDim
                ? `<td class="col-ld-lead">${escapeAttr(row.grade || "--")}</td>`
                : "";
          return `<tr>${leadCell}${learnDataMetricCellsHtml(row)}</tr>`;
        })
        .join("");
    }
    if (countEl) countEl.textContent = `共${rows.length}条记录`;
  }

  let learnDataDetailGrade = null;
  let learnDataDetailKlass = null;
  let learnDataDetailSubject = null;
  let learnDataGcOpen = false;

  function getLearnDataSubjectOptions() {
    const subjects = [];
    getLearnDataCourses().forEach((course) => {
      if (course.subject && !subjects.includes(course.subject)) {
        subjects.push(course.subject);
      }
    });
    return subjects.length ? subjects : ["语文"];
  }

  function syncLearnDataSubjectFilter() {
    const select = $("#jw-learn-data-subject");
    if (!select) return;
    const options = getLearnDataSubjectOptions();
    const current = learnDataDetailSubject;
    select.innerHTML = [
      `<option value="">全部</option>`,
      ...options.map(
        (subject) =>
          `<option value="${escapeAttr(subject)}">${escapeAttr(subject)}</option>`
      ),
    ].join("");
    if (current && options.includes(current)) {
      select.value = current;
      return;
    }
    learnDataDetailSubject = null;
    select.value = "";
  }

  function inferGradeFromKlass(klass) {
    if (!klass) return null;
    const match = String(klass).match(/^(.+?年级)/);
    return match ? match[1] : null;
  }

  function getLearnDataGradeClassTree() {
    const courses = getLearnDataCourses();
    const course = courses[0];
    const list = getLearnDataLearnersMerged();
    const tree = new Map();
    list.forEach((student) => {
      const klass = student.klass || "--";
      const grade = inferGradeFromKlass(klass) || course?.grade || "未分年级";
      if (!tree.has(grade)) tree.set(grade, new Set());
      tree.get(grade).add(klass);
    });
    if (!tree.size) {
      const grade = course?.grade || "一年级";
      tree.set(grade, new Set(["一年级(2)班", "一年级(5)班"]));
    }
    return Array.from(tree.entries()).map(([grade, classes]) => ({
      grade,
      classes: Array.from(classes),
    }));
  }

  function getLearnDataSubjectsForStudent(student) {
    const courses = getLearnDataCourses();
    if (!courses.length) return "--";
    if (!isLearnDataMulti()) return courses[0]?.subject || "--";
    const subjects = [];
    courses.forEach((course) => {
      const hit = getLearnersForCourse(course.id).some(
        (item) =>
          String(item.lehao) === String(student.lehao) ||
          Number(item.id) === Number(student.id)
      );
      if (hit && course.subject && !subjects.includes(course.subject)) {
        subjects.push(course.subject);
      }
    });
    if (subjects.length) return subjects.join("、");
    return (
      courses
        .map((course) => course.subject)
        .filter(Boolean)
        .filter((subject, index, arr) => arr.indexOf(subject) === index)
        .join("、") || "--"
    );
  }

  function getLearnDataDetailStudents() {
    const courses = getLearnDataCourses();
    const metrics = learnDataAggregateMetrics(courses);
    const list = getLearnDataLearnersMerged();
    let students = list.map((item) => ({
      lehao: item.lehao || "--",
      name: item.name || "--",
      klass: item.klass || "--",
      subject: getLearnDataSubjectsForStudent(item),
      totalLessons: metrics.totalLessons,
      publishedLessons: metrics.publishedLessons,
      totalDuration: 0,
      studyDuration: 0,
      progress: "0/0",
      homework: "0/0",
    }));
    if (!students.length) {
      const fallbackSubject = getLearnDataSubjectsForStudent({});
      students = [
        {
          lehao: "7277620",
          name: "文祥云",
          klass: "一年级(2)班",
          subject: fallbackSubject,
          totalLessons: metrics.totalLessons,
          publishedLessons: metrics.publishedLessons,
          totalDuration: 0,
          studyDuration: 0,
          progress: "0/0",
          homework: "0/0",
        },
        {
          lehao: "63174",
          name: "杨莉莉",
          klass: "一年级(2)班",
          subject: fallbackSubject,
          totalLessons: metrics.totalLessons,
          publishedLessons: metrics.publishedLessons,
          totalDuration: 0,
          studyDuration: 0,
          progress: "0/0",
          homework: "0/0",
        },
        {
          lehao: "7278405",
          name: "洪新慧",
          klass: "一年级(5)班",
          subject: fallbackSubject,
          totalLessons: metrics.totalLessons,
          publishedLessons: metrics.publishedLessons,
          totalDuration: 0,
          studyDuration: 0,
          progress: "0/0",
          homework: "0/0",
        },
      ];
    }
    const keyword = ($("#jw-learn-data-keyword")?.value || "").trim();
    return students.filter((row) => {
      if (learnDataDetailKlass && row.klass !== learnDataDetailKlass) return false;
      if (learnDataDetailGrade && !learnDataDetailKlass) {
        const grade = inferGradeFromKlass(row.klass);
        if (grade !== learnDataDetailGrade) return false;
      }
      if (learnDataDetailSubject) {
        const subjects = String(row.subject || "")
          .split("、")
          .map((item) => item.trim())
          .filter(Boolean);
        if (!subjects.includes(learnDataDetailSubject)) return false;
      }
      if (keyword) {
        const hit =
          String(row.name).includes(keyword) || String(row.lehao).includes(keyword);
        if (!hit) return false;
      }
      return true;
    });
  }

  function syncLearnDataGcLabel() {
    const label = $("#jw-learn-data-gc-label");
    if (!label) return;
    if (learnDataDetailKlass) {
      label.textContent = learnDataDetailGrade
        ? `${learnDataDetailGrade} / ${learnDataDetailKlass}`
        : learnDataDetailKlass;
      return;
    }
    if (learnDataDetailGrade) {
      label.textContent = `${learnDataDetailGrade} / 全部`;
      return;
    }
    label.textContent = "全部";
  }

  function closeLearnDataGcPanel() {
    learnDataGcOpen = false;
    const wrap = $("#jw-learn-data-gc");
    const panel = $("#jw-learn-data-gc-panel");
    const trigger = $("#jw-learn-data-gc-trigger");
    wrap?.classList.remove("is-open");
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function renderLearnDataGcPanel() {
    const gradeCol = $("#jw-learn-data-gc-grades");
    const classCol = $("#jw-learn-data-gc-classes");
    if (!gradeCol || !classCol) return;
    const tree = getLearnDataGradeClassTree();
    const activeGrade = learnDataDetailGrade;
    gradeCol.innerHTML = [
      `<button type="button" class="jw-gc-cascade__item${
        !activeGrade ? " is-active" : ""
      }" data-gc-grade="">全部<span class="jw-gc-cascade__arrow">›</span></button>`,
      ...tree.map(
        (item) => `<button type="button" class="jw-gc-cascade__item${
          activeGrade === item.grade ? " is-active" : ""
        }" data-gc-grade="${escapeAttr(item.grade)}">${escapeAttr(
          item.grade
        )}<span class="jw-gc-cascade__arrow">›</span></button>`
      ),
    ].join("");

    const gradeNode = tree.find((item) => item.grade === activeGrade);
    const classes = gradeNode?.classes || [];
    if (!activeGrade) {
      classCol.innerHTML = `<button type="button" class="jw-gc-cascade__item is-active" data-gc-class="">全部</button>`;
    } else {
      classCol.innerHTML = [
        `<button type="button" class="jw-gc-cascade__item${
          !learnDataDetailKlass ? " is-active" : ""
        }" data-gc-class="">全部</button>`,
        ...classes.map(
          (klass) => `<button type="button" class="jw-gc-cascade__item${
            learnDataDetailKlass === klass ? " is-active" : ""
          }" data-gc-class="${escapeAttr(klass)}">${escapeAttr(klass)}</button>`
        ),
      ].join("");
    }
    syncLearnDataGcLabel();
  }

  function openLearnDataGcPanel() {
    learnDataGcOpen = true;
    const wrap = $("#jw-learn-data-gc");
    const panel = $("#jw-learn-data-gc-panel");
    const trigger = $("#jw-learn-data-gc-trigger");
    wrap?.classList.add("is-open");
    if (panel) panel.hidden = false;
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    renderLearnDataGcPanel();
  }

  function setLearnDataDetailFilter({ grade = null, klass = null } = {}) {
    learnDataDetailGrade = grade || null;
    learnDataDetailKlass = klass || null;
    if (learnDataDetailKlass && !learnDataDetailGrade) {
      learnDataDetailGrade = inferGradeFromKlass(learnDataDetailKlass);
    }
    syncLearnDataGcLabel();
    renderLearnDataDetailTable();
  }

  function openLearnDataDetailFromSummary(klass, grade, subject) {
    learnDataTab = "detail";
    if (klass) {
      setLearnDataDetailFilter({
        grade: inferGradeFromKlass(klass),
        klass,
      });
    } else if (grade) {
      setLearnDataDetailFilter({ grade, klass: null });
    } else {
      setLearnDataDetailFilter({ grade: null, klass: null });
    }
    learnDataDetailSubject = subject || null;
    renderLearnDataPage();
  }

  function renderLearnDataDetailTable() {
    const tbody = $("#jw-learn-data-detail-tbody");
    const countEl = $("#jw-learn-data-detail-count");
    if (!tbody) return;
    const rows = getLearnDataDetailStudents();
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="11"><div class="jw-learners-empty">暂无数据</div></td></tr>`;
    } else {
      tbody.innerHTML = rows
        .map(
          (row) => `<tr>
            <td>${escapeAttr(row.lehao)}</td>
            <td>${escapeAttr(row.name)}</td>
            <td>${escapeAttr(row.klass)}</td>
            <td>${escapeAttr(row.subject || "--")}</td>
            <td>${escapeAttr(String(row.totalLessons))}</td>
            <td>${escapeAttr(String(row.publishedLessons))}</td>
            <td>${escapeAttr(String(row.totalDuration))}</td>
            <td>${escapeAttr(String(row.studyDuration))}</td>
            <td>${escapeAttr(row.progress)}</td>
            <td>${escapeAttr(row.homework)}</td>
            <td class="col-maction"><button type="button" class="jw-link" data-learn-student-detail data-student-name="${escapeAttr(
              row.name
            )}" data-student-klass="${escapeAttr(row.klass)}" data-student-lehao="${escapeAttr(
              row.lehao
            )}">查看详情</button></td>
          </tr>`
        )
        .join("");
    }
    if (countEl) countEl.textContent = `共${rows.length}条记录`;
    syncLearnDataSubjectFilter();
    renderLearnDataGcPanel();
  }

  function studentDetailStatusHtml(status) {
    if (status === "done") {
      return `<span class="jw-student-detail__lesson-status jw-student-detail__lesson-status--done">已学习 ✓</span>`;
    }
    if (status === "lock") {
      return `<span class="jw-student-detail__lesson-status jw-student-detail__lesson-status--lock">未解锁 🔒</span>`;
    }
    return `<span class="jw-student-detail__lesson-status jw-student-detail__lesson-status--todo">未学习 ⏱</span>`;
  }

  function getStudentDetailDemoContent(studentName) {
    const courses = getLearnDataCourses();
    const course = courses[0];
    const courseName = isLearnDataMulti()
      ? courses.map((item) => item.title || "未命名课程").join("、")
      : course?.title || "自适应测试";
    const subject = course?.subject || "语文";
    return {
      subject,
      courseName,
      units: [
        {
          title: "默认单元",
          lessons: [
            {
              name: "第 1 节 预习报告第3题",
              status: "done",
              meta: "已学习时长：0分4秒/0分4秒 | 点播",
              subs: [
                { name: "验证错题挑题重组题干完整性", tag: "试卷", state: "已完成" },
                { name: "《第一组 感受自然》试卷(学生用卷)(2)", tag: "课件", state: "已完成" },
              ],
            },
            {
              name: "第 1 节 wmv：儿童歌曲 - 小龙人",
              status: "todo",
              meta: "已学习时长：0分0秒/1分7秒 | 点播",
              subs: [],
            },
            {
              name: studentName === "杨莉莉" ? "第 2 节 2" : "第 2 节 拓展练习",
              status: "lock",
              meta: "已学习时长：0分1秒 | 点播",
              subs: [],
            },
          ],
        },
      ],
    };
  }

  function renderStudentDetailBody(content) {
    const tabs = $("#jw-student-detail-tabs");
    const body = $("#jw-student-detail-body");
    if (!tabs || !body) return;
    tabs.innerHTML = `<button type="button" class="jw-student-detail__tab is-active">${escapeAttr(
      content.subject
    )}</button>`;
    body.innerHTML = `
      <div class="jw-student-detail__course">${escapeAttr(content.courseName)}</div>
      ${(content.units || [])
        .map(
          (unit) => `<section class="jw-student-detail__unit">
            <h3 class="jw-student-detail__unit-title">${escapeAttr(unit.title)}</h3>
            ${(unit.lessons || [])
              .map(
                (lesson) => `<div class="jw-student-detail__lesson">
                  <div class="jw-student-detail__lesson-top">
                    <p class="jw-student-detail__lesson-name">${escapeAttr(lesson.name)}</p>
                    ${studentDetailStatusHtml(lesson.status)}
                  </div>
                  <p class="jw-student-detail__lesson-meta">${escapeAttr(lesson.meta || "")}</p>
                  ${
                    lesson.subs?.length
                      ? `<ul class="jw-student-detail__subs">${lesson.subs
                          .map(
                            (sub) => `<li class="jw-student-detail__sub">
                              <span class="jw-student-detail__sub-name">${escapeAttr(sub.name)}</span>
                              <span class="jw-student-detail__tag">${escapeAttr(sub.tag)}</span>
                              <span class="jw-student-detail__sub-state">${escapeAttr(sub.state)}</span>
                            </li>`
                          )
                          .join("")}</ul>`
                      : ""
                  }
                </div>`
              )
              .join("")}
          </section>`
        )
        .join("")}
    `;
  }

  function openStudentDetailModal(student) {
    const modal = $("#jw-student-detail-modal");
    const title = $("#jw-student-detail-title");
    if (!modal) return;
    const name = student?.name || "学生";
    const klass = student?.klass || "--";
    if (title) title.textContent = `学生详情 - ${name}/${klass}`;
    renderStudentDetailBody(getStudentDetailDemoContent(name));
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeStudentDetailModal() {
    const modal = $("#jw-student-detail-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function syncLearnDataTabUI() {
    $$("[data-learn-data-tab]").forEach((btn) => {
      const active = btn.dataset.learnDataTab === learnDataTab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    $$("[data-learn-data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.learnDataPanel !== learnDataTab;
    });
  }

  function renderLearnDataPage() {
    renderLearnDataHeader();
    syncLearnDataDimBar();
    syncLearnDataTabUI();
    if (learnDataTab === "summary") renderLearnDataSummaryTable();
    if (learnDataTab === "detail") renderLearnDataDetailTable();
  }

  function openLearnDataPage(row) {
    if (!row) return;
    learnDataCourseId = row.id;
    learnDataCourseIds = [row.id];
    learnDataTab = "summary";
    learnDataDim = "course";
    learnDataDetailGrade = null;
    learnDataDetailKlass = null;
    learnDataDetailSubject = null;
    closeLearnDataGcPanel();
    setJiaowuNav("learn-data");
    renderLearnDataPage();
  }

  function openMultiLearnDataPage(courseIds) {
    const ids = (courseIds || []).map(Number).filter((id) => Number.isFinite(id));
    if (ids.length < 2) return;
    learnDataCourseIds = ids;
    learnDataCourseId = ids[0];
    learnDataTab = "summary";
    learnDataDim = "course";
    learnDataDetailGrade = null;
    learnDataDetailKlass = null;
    learnDataDetailSubject = null;
    closeLearnDataGcPanel();
    setJiaowuNav("learn-data");
    renderLearnDataPage();
  }

  let pendingLearnerRemoveIds = [];

  function getSelectedLearnerIds() {
    return $$("#jw-learners-tbody tr[data-learner-id]")
      .filter((tr) => tr.querySelector(".xb-check")?.checked)
      .map((tr) => Number(tr.dataset.learnerId))
      .filter((id) => Number.isFinite(id));
  }

  function openLearnerRemoveModal(learnerId) {
    if (learnersCourseId == null) return;
    const isDevice = isLearnersDeviceMode();
    const list = isDevice
      ? getDevicesForCourse(learnersCourseId)
      : getLearnersForCourse(learnersCourseId);
    const row = list.find((item) => Number(item.id) === Number(learnerId));
    if (!row) return;
    pendingLearnerRemoveIds = [Number(learnerId)];
    const title = $("#jw-learner-remove-title");
    const desc = $("#jw-learner-remove-modal .xb-confirm__desc");
    if (title) {
      title.textContent = isDevice
        ? `确定将设备 ${row.serial || "该设备"} 从此课程中移除吗？`
        : `确定将 ${row.name || "该学生"} 从此课程中移除吗？`;
    }
    if (desc) {
      desc.textContent = isDevice
        ? "移除后该设备将无法学习此学科课程"
        : "移除后该学生将无法学习此学科课程";
    }
    const modal = $("#jw-learner-remove-modal");
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function openLearnerBatchRemoveModal(ids) {
    if (learnersCourseId == null || !ids?.length) return;
    pendingLearnerRemoveIds = ids.map(Number);
    const isDevice = isLearnersDeviceMode();
    const title = $("#jw-learner-remove-title");
    const desc = $("#jw-learner-remove-modal .xb-confirm__desc");
    if (title) {
      title.textContent = isDevice
        ? `确定将列表内 ${pendingLearnerRemoveIds.length} 台设备 从此课程中移除吗？`
        : `确定将列表内 ${pendingLearnerRemoveIds.length} 名学生 从此课程中移除吗？`;
    }
    if (desc) {
      desc.textContent = isDevice
        ? "移除后这些设备将无法学习此学科课程"
        : "移除后该学生将无法学习此学科课程";
    }
    const modal = $("#jw-learner-remove-modal");
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeLearnerRemoveModal() {
    const modal = $("#jw-learner-remove-modal");
    if (!modal) return;
    pendingLearnerRemoveIds = [];
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function confirmLearnerRemove() {
    if (learnersCourseId == null || !pendingLearnerRemoveIds.length) {
      closeLearnerRemoveModal();
      return;
    }
    const idSet = new Set(pendingLearnerRemoveIds.map(Number));
    const isDevice = isLearnersDeviceMode();
    const list = isDevice
      ? getDevicesForCourse(learnersCourseId)
      : getLearnersForCourse(learnersCourseId);
    const removedBucket = isDevice
      ? getRemovedDevicesForCourse(learnersCourseId)
      : getRemovedLearnersForCourse(learnersCourseId);
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (!idSet.has(Number(list[i].id))) continue;
      removedBucket.push(list.splice(i, 1)[0]);
    }
    syncCourseLearnerCount(learnersCourseId);
    closeLearnerRemoveModal();
    renderLearnersTable();
    showToast("已移除");
    schedulePersist();
  }

  function handleBatchRemoveLearners() {
    const ids = getSelectedLearnerIds();
    const isDevice = isLearnersDeviceMode();
    if (!ids.length) {
      showToast(isDevice ? "请至少选择一台设备" : "请至少选择一个学生", "warn");
      return;
    }
    if (ids.length === 1) {
      openLearnerRemoveModal(ids[0]);
      return;
    }
    openLearnerBatchRemoveModal(ids);
  }

  function escapeXml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sanitizeExportFileName(name) {
    return String(name || "未命名")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "")
      .trim();
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportLearnersList() {
    if (learnersCourseId == null) {
      showToast("请先进入学习名单", "warn");
      return;
    }
    const course = manageCourseList.find((item) => item.id === learnersCourseId);
    const isDevice = isLearnersDeviceMode();
    const list = isDevice
      ? getDevicesForCourse(learnersCourseId)
      : getLearnersForCourse(learnersCourseId);
    const title = sanitizeExportFileName(course?.title || "未命名课程");
    const subject = sanitizeExportFileName(course?.subject || "");
    const fileName = `${title}${subject}学习名单.xls`;
    const headers = isDevice ? ["序列号", "添加时间"] : ["乐号", "姓名", "性别", "班级", "添加时间"];
    const headerCells = headers
      .map((h) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
      .join("");
    const dataRows = list
      .map((row) => {
        const values = isDevice
          ? [row.serial, row.addedAt]
          : [row.lehao, row.name, row.gender, row.klass, row.addedAt];
        const cells = values.map(
          (val) =>
            `<Cell><Data ss:Type="String">${escapeXml(val == null || val === "" ? "--" : val)}</Data></Cell>`
        );
        return `<Row>${cells.join("")}</Row>`;
      })
      .join("");
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:Bold="1" ss:Color="#000000"/>
   <Interior ss:Color="#00B0F0" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="学习名单">
  <Table>
   <Row>${headerCells}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
    const blob = new Blob([`\ufeff${xml}`], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    downloadBlob(blob, fileName);
    showToast("导出成功");
  }

  let importHasFile = true;
  const IMPORT_DEMO_FILE_PERSON = "student_append_tpl.xls";
  const IMPORT_DEMO_FILE_DEVICE = "device_append_tpl.xls";

  function syncImportUploadState() {
    const uploadBtn = $("#jw-import-upload");
    const startBtn = $("#jw-import-start");
    const fileBox = $("#jw-import-file");
    const fileName = $("#jw-import-file-name");
    const demoFile = isLearnersDeviceMode() ? IMPORT_DEMO_FILE_DEVICE : IMPORT_DEMO_FILE_PERSON;
    if (uploadBtn) {
      uploadBtn.disabled = !!importHasFile;
      uploadBtn.classList.toggle("xb-btn--muted", !!importHasFile);
      uploadBtn.classList.toggle("xb-btn--primary", !importHasFile);
    }
    if (startBtn) {
      startBtn.disabled = !importHasFile;
      startBtn.classList.toggle("xb-btn--muted", !importHasFile);
      startBtn.classList.toggle("xb-btn--primary", !!importHasFile);
    }
    if (fileBox) fileBox.hidden = !importHasFile;
    if (fileName && importHasFile) fileName.textContent = demoFile;
  }

  function openLearnersImportPage() {
    const row = manageCourseList.find((item) => item.id === learnersCourseId);
    const nameEl = $("#jw-import-course-name");
    const subjectLabel = $("#jw-import-subject-label");
    if (nameEl) nameEl.textContent = row?.title || "未命名课程";
    if (subjectLabel) subjectLabel.textContent = row?.subject || "语文";
    const subjectCheck = $("#jw-import-subject");
    if (subjectCheck) subjectCheck.checked = true;
    if (!isLearnersDeviceMode()) ensureDemoRemovedLearner(learnersCourseId);
    importHasFile = true;
    syncLearnersMaintainModeUI();
    syncImportUploadState();
    setJiaowuNav("learners-import");
    schedulePersist();
  }

  const ADD_LEARNER_MAX = 1000;
  const ADD_LEARNER_LEHAO_MAP = {
    "7277620": { name: "文祥云", gender: "保密", klass: "一年级(2)班" },
    "63174": { name: "杨莉莉", gender: "保密", klass: "一年级(2)班" },
    "62848": { name: "梁美娟", gender: "女", klass: "一年级(1)班" },
    "10001": { name: "梁美娟", gender: "女", klass: "一年级(1)班" },
  };
  function normalizeDeviceSerial(raw) {
    return String(raw || "")
      .trim()
      .toUpperCase();
  }

  /** 序列号规则：SN + 年份 + 月份 + 日期，如 SN20260109 */
  function matchDeviceSerial(raw) {
    const serial = normalizeDeviceSerial(raw);
    const m = /^SN(\d{4})(\d{2})(\d{2})$/.exec(serial);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (year < 2000 || year > 2100) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return serial;
  }

  const schoolTreeData = [
    {
      id: "primary",
      name: "小学",
      open: true,
      children: [
        {
          id: "g1",
          name: "一年级",
          open: true,
          children: [
            {
              id: "g1c1",
              name: "一年级(1)班",
              open: true,
              children: [
                { id: "s1", name: "梁美娟", lehao: "62848", gender: "女", klass: "一年级(1)班", checked: true },
                { id: "s2", name: "蔡靖", lehao: "10002", gender: "男", klass: "一年级(1)班", checked: true },
                { id: "s3", name: "李姝词", lehao: "10003", gender: "女", klass: "一年级(1)班", checked: false },
                { id: "s4", name: "钟白", lehao: "10004", gender: "男", klass: "一年级(1)班", checked: false },
                { id: "s5", name: "zeng", lehao: "10005", gender: "保密", klass: "一年级(1)班", checked: false },
              ],
            },
            {
              id: "g1c2",
              name: "一年级(2)班",
              open: false,
              children: [
                { id: "s6", name: "赵梓墨", lehao: "10006", gender: "男", klass: "一年级(2)班", checked: true },
                { id: "s7", name: "文祥云", lehao: "7277620", gender: "保密", klass: "一年级(2)班", checked: true },
                { id: "s8", name: "杨莉莉", lehao: "63174", gender: "保密", klass: "一年级(2)班", checked: true },
                { id: "s9", name: "李白", lehao: "10009", gender: "男", klass: "一年级(2)班", checked: true },
              ],
            },
            {
              id: "g1c3",
              name: "一年级(3)班",
              open: false,
              children: [
                { id: "s10", name: "小明", lehao: "10010", gender: "男", klass: "一年级(3)班", checked: false },
              ],
            },
          ],
        },
      ],
    },
  ];

  const layerTreeData = [
    {
      id: "l1",
      name: "选修1班",
      open: true,
      children: [{ id: "ls1", name: "杨莉莉", lehao: "63174", gender: "保密", klass: "选修1班", checked: false }],
    },
    { id: "l2", name: "科学1班", open: false, children: [] },
    { id: "l3", name: "选修班物理1", open: false, children: [] },
    { id: "l4", name: "选修班物理2", open: false, children: [] },
    { id: "l5", name: "选修班科学1", open: false, children: [] },
    { id: "l6", name: "历史1", open: false, children: [] },
    { id: "l7", name: "书法", open: false, children: [] },
  ];

  let addLearnerMode = "school";
  let addLearnerSchoolKeyword = "";

  function walkTree(nodes, visitor) {
    (nodes || []).forEach((node) => {
      visitor(node);
      if (node.children?.length) walkTree(node.children, visitor);
    });
  }

  function collectCheckedLeaves(nodes) {
    const leaves = [];
    walkTree(nodes, (node) => {
      if ((!node.children || !node.children.length) && node.checked && node.lehao) {
        leaves.push(node);
      }
    });
    return leaves;
  }

  function syncParentChecks(node) {
    if (!node?.children?.length) return;
    node.children.forEach(syncParentChecks);
    const leafOrGroups = node.children;
    const allChecked = leafOrGroups.every((child) => {
      if (child.children?.length) return child.checked;
      return !!child.checked;
    });
    const someChecked = leafOrGroups.some((child) => {
      if (child.children?.length) return child.checked || child.indeterminate;
      return !!child.checked;
    });
    node.checked = allChecked && leafOrGroups.length > 0;
    node.indeterminate = !allChecked && someChecked;
  }

  function setTreeChecked(node, checked) {
    node.checked = !!checked;
    node.indeterminate = false;
    (node.children || []).forEach((child) => setTreeChecked(child, checked));
  }

  function findTreeNode(nodes, id) {
    for (const node of nodes || []) {
      if (node.id === id) return node;
      const found = findTreeNode(node.children, id);
      if (found) return found;
    }
    return null;
  }

  function syncWholeTreeChecks(nodes) {
    (nodes || []).forEach(syncParentChecks);
  }

  function filterTreeByKeyword(nodes, keyword) {
    if (!keyword) return nodes;
    const kw = keyword.toLowerCase();
    const filterNodes = (list) =>
      (list || [])
        .map((node) => {
          const children = filterNodes(node.children || []);
          const selfMatch = String(node.name || "").toLowerCase().includes(kw);
          if (selfMatch || children.length) {
            return { ...node, children, open: true };
          }
          return null;
        })
        .filter(Boolean);
    return filterNodes(nodes);
  }

  function renderAddLearnerTree(container, nodes, treeKey) {
    if (!container) return;
    const renderNode = (node, depth) => {
      const hasChildren = !!(node.children && node.children.length);
      const isLeaf = !hasChildren && node.lehao;
      const pad = depth * 14;
      const toggle = hasChildren
        ? `<button type="button" class="jw-add-tree-toggle${node.open ? "" : " is-collapsed"}" data-tree-toggle="${treeKey}:${node.id}" aria-label="展开收起">▾</button>`
        : `<span class="jw-add-tree-toggle" style="visibility:hidden">▾</span>`;
      const body = `<div class="jw-add-tree-node" style="padding-left:${pad}px">
        <div class="jw-add-tree-row">
          ${toggle}
          <label class="jw-add-tree-check">
            <input type="checkbox" data-tree-check="${treeKey}:${node.id}" ${node.checked ? "checked" : ""} ${
        node.indeterminate ? "data-indeterminate='1'" : ""
      } />
            <span>${escapeAttr(node.name)}</span>
          </label>
        </div>
        ${
          hasChildren
            ? `<div class="jw-add-tree-children"${node.open ? "" : " hidden"}>${node.children
                .map((child) => renderNode(child, depth + 1))
                .join("")}</div>`
            : ""
        }
      </div>`;
      return isLeaf || hasChildren ? body : body;
    };
    container.innerHTML = (nodes || []).map((node) => renderNode(node, 0)).join("") || `<div class="jw-learners-empty">暂无数据</div>`;
    container.querySelectorAll("input[data-indeterminate='1']").forEach((input) => {
      input.indeterminate = true;
    });
  }

  function renderAddLearnerChosen(listEl, countEl, selected) {
    if (countEl) countEl.textContent = `已选择 (${selected.length} / ${ADD_LEARNER_MAX})`;
    if (!listEl) return;
    if (!selected.length) {
      listEl.innerHTML = `<li class="jw-add-learner-chosen__empty"><span aria-hidden="true">📦</span><span>暂无数据</span></li>`;
      return;
    }
    listEl.innerHTML = selected
      .map(
        (item) => `<li class="jw-add-learner-chip">
        <span>${escapeAttr(item.name)}</span>
        <button type="button" class="jw-add-learner-chip__x" data-add-learner-remove="${escapeAttr(item.id)}" aria-label="移除">×</button>
      </li>`
      )
      .join("");
  }

  function refreshAddLearnerSchoolUI() {
    syncWholeTreeChecks(schoolTreeData);
    const filtered = filterTreeByKeyword(schoolTreeData, addLearnerSchoolKeyword);
    renderAddLearnerTree($("#jw-add-learner-school-tree"), filtered, "school");
    renderAddLearnerChosen(
      $("#jw-add-learner-school-chosen"),
      $("#jw-add-learner-school-count"),
      collectCheckedLeaves(schoolTreeData)
    );
  }

  function refreshAddLearnerLayerUI() {
    syncWholeTreeChecks(layerTreeData);
    renderAddLearnerTree($("#jw-add-learner-layer-tree"), layerTreeData, "layer");
    renderAddLearnerChosen(
      $("#jw-add-learner-layer-chosen"),
      $("#jw-add-learner-layer-count"),
      collectCheckedLeaves(layerTreeData)
    );
  }

  function setAddLearnerMode(mode) {
    addLearnerMode = mode || "school";
    $$('input[name="jw-add-learner-mode"]').forEach((input) => {
      input.checked = input.value === addLearnerMode;
    });
    $$("[data-add-learner-pane]").forEach((pane) => {
      pane.hidden = pane.dataset.addLearnerPane !== addLearnerMode;
    });
  }

  function syncAddLearnerLehaoName() {
    const lehao = ($("#jw-add-learner-lehao")?.value || "").trim();
    const nameEl = $("#jw-add-learner-lehao-name");
    if (!nameEl) return;
    const hit = ADD_LEARNER_LEHAO_MAP[lehao];
    nameEl.textContent = hit ? hit.name : "请输入正确的乐号";
    nameEl.style.color = hit ? "#333" : "#999";
  }

  function ensureDemoRemovedForAdd(courseId) {
    if (courseId == null) return;
    const list = getLearnersForCourse(courseId);
    const removed = getRemovedLearnersForCourse(courseId);
    const demo = {
      id: 62848,
      lehao: "62848",
      name: "梁美娟",
      gender: "女",
      klass: "一年级(1)班",
      addedAt: "2026-10-08 10:00:00",
    };
    // 与选择树中梁美娟对齐，便于演示恢复弹窗
    const treeNode = findTreeNode(schoolTreeData, "s1");
    if (treeNode) {
      treeNode.lehao = demo.lehao;
      treeNode.id = "s1";
    }
    const inActiveIdx = list.findIndex(
      (item) => String(item.lehao) === demo.lehao || item.name === demo.name
    );
    if (inActiveIdx >= 0) {
      const [moved] = list.splice(inActiveIdx, 1);
      demo.id = moved.id || demo.id;
    }
    const inRemoved = removed.some(
      (item) => String(item.lehao) === demo.lehao || item.name === demo.name
    );
    if (!inRemoved) removed.push(demo);
    syncCourseLearnerCount(courseId);
  }

  function collectPendingAddStudents() {
    const now = nowText();
    if (addLearnerMode === "lehao") {
      const lehao = ($("#jw-add-learner-lehao")?.value || "").trim();
      const hit = ADD_LEARNER_LEHAO_MAP[lehao];
      if (!hit) return { error: "请输入正确的乐号", students: [] };
      return {
        students: [
          {
            id: Number(lehao) || Date.now(),
            lehao,
            name: hit.name,
            gender: hit.gender,
            klass: hit.klass,
            addedAt: now,
          },
        ],
      };
    }
    const source = addLearnerMode === "layer" ? layerTreeData : schoolTreeData;
    const selected = collectCheckedLeaves(source);
    if (!selected.length) return { error: "请先选择学员", students: [] };
    return {
      students: selected.map((item) => ({
        id: Number(item.lehao) || Date.now(),
        lehao: String(item.lehao || ""),
        name: item.name,
        gender: item.gender || "保密",
        klass: item.klass || item.name,
        addedAt: now,
      })),
    };
  }

  function syncAddDeviceEcho() {
    const echo = $("#jw-add-device-echo");
    if (!echo) return;
    if (addDeviceMatchedSerial) {
      echo.textContent = addDeviceMatchedSerial;
      echo.style.color = "#333";
      return;
    }
    echo.textContent = "请输入正确的序列号";
    echo.style.color = "#999";
  }

  function resetAddDeviceForm() {
    addDeviceMatchedSerial = null;
    const serialInput = $("#jw-add-device-serial");
    if (serialInput) serialInput.value = "";
    syncAddDeviceEcho();
  }

  function openAddLearnerPage() {
    const row = manageCourseList.find((item) => item.id === learnersCourseId);
    const nameEl = $("#jw-add-learner-course-name");
    if (nameEl) nameEl.textContent = row?.title || "未命名课程";
    syncLearnersMaintainModeUI();
    const modeRow = $("#jw-add-learner-mode-row");
    if (isLearnersDeviceMode()) {
      if (modeRow) modeRow.hidden = true;
      resetAddDeviceForm();
      $$("[data-add-learner-pane]").forEach((pane) => {
        pane.hidden = pane.dataset.addLearnerPane !== "device";
      });
      setJiaowuNav("learners-add");
      schedulePersist();
      return;
    }
    if (modeRow) modeRow.hidden = false;
    ensureDemoRemovedForAdd(learnersCourseId);
    setAddLearnerMode("school");
    addLearnerSchoolKeyword = "";
    const search = $("#jw-add-learner-school-search");
    if (search) search.value = "";
    const lehaoInput = $("#jw-add-learner-lehao");
    if (lehaoInput) lehaoInput.value = "";
    // 人员模式不展示设备面板
    const devicePane = $('[data-add-learner-pane="device"]');
    if (devicePane) devicePane.hidden = true;
    syncAddLearnerLehaoName();
    refreshAddLearnerSchoolUI();
    refreshAddLearnerLayerUI();
    setJiaowuNav("learners-add");
    schedulePersist();
  }

  function confirmAddDevice() {
    const courseId = resolveLearnersCourseId();
    if (courseId == null) {
      showToast("未找到课程");
      return;
    }
    learnersCourseId = courseId;
    const serial = normalizeDeviceSerial($("#jw-add-device-serial")?.value);
    if (!serial) {
      showToast("请输入序列号");
      return;
    }
    const matched = matchDeviceSerial(serial);
    if (!matched) {
      addDeviceMatchedSerial = null;
      syncAddDeviceEcho();
      showToast("请输入正确的序列号");
      return;
    }
    // 第一次添加：回显匹配到的序列号；第二次添加：写入名单
    if (!addDeviceMatchedSerial || addDeviceMatchedSerial !== matched) {
      addDeviceMatchedSerial = matched;
      const input = $("#jw-add-device-serial");
      if (input) input.value = matched;
      syncAddDeviceEcho();
      showToast("已匹配设备序列号，请再次点击添加");
      return;
    }
    const list = getDevicesForCourse(courseId);
    if (list.some((item) => normalizeDeviceSerial(item.serial) === matched)) {
      showToast("该设备已在学习名单中");
      return;
    }
    finishAddDeviceSuccess(matched);
  }

  function confirmAddLearners() {
    if (isLearnersDeviceMode()) {
      confirmAddDevice();
      return;
    }
    const courseId = resolveLearnersCourseId();
    if (courseId == null) {
      showToast("未找到课程");
      return;
    }
    learnersCourseId = courseId;
    const collected = collectPendingAddStudents();
    if (collected.error) {
      showToast(collected.error);
      return;
    }
    const pending = collected.students;
    const removed = getRemovedLearnersForCourse(courseId);
    const overlap = removed.filter((item) =>
      pending.some((p) => String(p.lehao) === String(item.lehao) || p.name === item.name)
    );
    if (overlap.length) {
      pendingAddStudents = pending;
      restoreContinueAction = "add";
      openImportRestoreModal(overlap);
      return;
    }
    finishAddLearnersSuccess(pending);
  }

  function bindAddLearnerPage() {
    $$('input[name="jw-add-learner-mode"]').forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) setAddLearnerMode(input.value);
      });
    });
    $("#jw-add-learner-school-search")?.addEventListener("input", (e) => {
      addLearnerSchoolKeyword = e.target.value || "";
      refreshAddLearnerSchoolUI();
    });
    $("#jw-add-learner-school-clear")?.addEventListener("click", () => {
      walkTree(schoolTreeData, (node) => {
        node.checked = false;
        node.indeterminate = false;
      });
      refreshAddLearnerSchoolUI();
    });
    $("#jw-add-learner-layer-clear")?.addEventListener("click", () => {
      walkTree(layerTreeData, (node) => {
        node.checked = false;
        node.indeterminate = false;
      });
      refreshAddLearnerLayerUI();
    });
    $("#jw-add-learner-school-tree")?.addEventListener("click", (e) => {
      const toggle = e.target.closest("[data-tree-toggle]");
      if (!toggle) return;
      const id = toggle.dataset.treeToggle.split(":")[1];
      const node = findTreeNode(schoolTreeData, id);
      if (!node) return;
      node.open = !node.open;
      refreshAddLearnerSchoolUI();
    });
    $("#jw-add-learner-layer-tree")?.addEventListener("click", (e) => {
      const toggle = e.target.closest("[data-tree-toggle]");
      if (!toggle) return;
      const id = toggle.dataset.treeToggle.split(":")[1];
      const node = findTreeNode(layerTreeData, id);
      if (!node) return;
      node.open = !node.open;
      refreshAddLearnerLayerUI();
    });
    $("#jw-add-learner-school-tree")?.addEventListener("change", (e) => {
      const input = e.target.closest("[data-tree-check]");
      if (!input) return;
      const id = input.dataset.treeCheck.split(":")[1];
      const node = findTreeNode(schoolTreeData, id);
      if (!node) return;
      setTreeChecked(node, input.checked);
      refreshAddLearnerSchoolUI();
    });
    $("#jw-add-learner-layer-tree")?.addEventListener("change", (e) => {
      const input = e.target.closest("[data-tree-check]");
      if (!input) return;
      const id = input.dataset.treeCheck.split(":")[1];
      const node = findTreeNode(layerTreeData, id);
      if (!node) return;
      setTreeChecked(node, input.checked);
      refreshAddLearnerLayerUI();
    });
    $("#jw-add-learner-school-chosen")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-add-learner-remove]");
      if (!btn) return;
      const node = findTreeNode(schoolTreeData, btn.dataset.addLearnerRemove);
      if (node) setTreeChecked(node, false);
      refreshAddLearnerSchoolUI();
    });
    $("#jw-add-learner-layer-chosen")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-add-learner-remove]");
      if (!btn) return;
      const node = findTreeNode(layerTreeData, btn.dataset.addLearnerRemove);
      if (node) setTreeChecked(node, false);
      refreshAddLearnerLayerUI();
    });
    $("#jw-add-learner-lehao")?.addEventListener("input", syncAddLearnerLehaoName);
    $("#jw-add-device-serial")?.addEventListener("input", () => {
      addDeviceMatchedSerial = null;
      syncAddDeviceEcho();
    });
    $("#jw-add-learner-back-manage")?.addEventListener("click", () => {
      learnersCourseId = null;
      setJiaowuNav("manage");
    });
    $("#jw-add-learner-back-list")?.addEventListener("click", () => {
      setJiaowuNav("learners");
      renderLearnersTable();
    });
    $("#jw-add-learner-cancel")?.addEventListener("click", () => {
      setJiaowuNav("learners");
      renderLearnersTable();
    });
    $("#jw-add-learner-ok")?.addEventListener("click", confirmAddLearners);
  }

  function bindLearnersPage() {
    $("#jw-learn-data-back")?.addEventListener("click", () => {
      learnDataCourseId = null;
      learnDataCourseIds = [];
      setJiaowuNav("manage");
    });
    $$("[data-learn-data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        learnDataTab = btn.dataset.learnDataTab || "summary";
        if (learnDataTab === "detail" && learnDataDetailGrade == null && learnDataDetailKlass == null) {
          setLearnDataDetailFilter({ grade: null, klass: null });
        }
        closeLearnDataGcPanel();
        renderLearnDataPage();
      });
    });
    $$("[data-learn-data-dim]").forEach((btn) => {
      btn.addEventListener("click", () => {
        learnDataDim = btn.dataset.learnDataDim || "course";
        renderLearnDataSummaryTable();
      });
    });
    $("#jw-learn-data-export")?.addEventListener("click", () => {
      showToast("导出Excel（原型示意）");
    });
    $("#jw-learn-data-detail-export")?.addEventListener("click", () => {
      showToast("导出Excel（原型示意）");
    });
    $("#jw-learn-data-tbody")?.addEventListener("click", (e) => {
      const detailBtn = e.target.closest("[data-learn-data-detail]");
      if (!detailBtn) return;
      const klass = detailBtn.dataset.learnDataKlass || "";
      const grade = detailBtn.dataset.learnDataGrade || "";
      const subject = detailBtn.dataset.learnDataSubject || "";
      openLearnDataDetailFromSummary(klass || null, grade || null, subject || null);
    });
    $("#jw-learn-data-detail-tbody")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-learn-student-detail]");
      if (!btn) return;
      openStudentDetailModal({
        name: btn.dataset.studentName || "学生",
        klass: btn.dataset.studentKlass || "--",
        lehao: btn.dataset.studentLehao || "",
      });
    });
    $$("[data-close-student-detail]").forEach((el) => {
      el.addEventListener("click", closeStudentDetailModal);
    });
    $("#jw-learn-data-gc-trigger")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (learnDataGcOpen) closeLearnDataGcPanel();
      else openLearnDataGcPanel();
    });
    $("#jw-learn-data-gc-panel")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const gradeBtn = e.target.closest("[data-gc-grade]");
      if (gradeBtn) {
        const grade = gradeBtn.dataset.gcGrade || null;
        setLearnDataDetailFilter({ grade, klass: null });
        if (!grade) {
          closeLearnDataGcPanel();
          return;
        }
        renderLearnDataGcPanel();
        return;
      }
      const classBtn = e.target.closest("[data-gc-class]");
      if (classBtn) {
        const klass = classBtn.dataset.gcClass || null;
        setLearnDataDetailFilter({
          grade: klass ? learnDataDetailGrade || inferGradeFromKlass(klass) : learnDataDetailGrade,
          klass,
        });
        closeLearnDataGcPanel();
      }
    });
    $("#jw-learn-data-keyword")?.addEventListener("input", () => {
      if (learnDataTab === "detail") renderLearnDataDetailTable();
    });
    $("#jw-learn-data-subject")?.addEventListener("change", () => {
      const select = $("#jw-learn-data-subject");
      learnDataDetailSubject = (select?.value || "").trim() || null;
      if (learnDataTab === "detail") renderLearnDataDetailTable();
    });
    document.addEventListener(
      "click",
      (e) => {
        if (!learnDataGcOpen) return;
        if (e.target.closest("#jw-learn-data-gc")) return;
        closeLearnDataGcPanel();
      },
      true
    );
    $("#jw-learners-back")?.addEventListener("click", () => {
      learnersCourseId = null;
      setJiaowuNav("manage");
    });
    $$("[data-learners-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setLearnersMaintainMode(btn.dataset.learnersMode);
      });
    });
    $$("[data-close-learners-mode]").forEach((el) => {
      el.addEventListener("click", closeLearnersModeConfirmModal);
    });
    $("#jw-learners-mode-ok")?.addEventListener("click", confirmLearnersMaintainModeSwitch);
    $("#jw-learners-query")?.addEventListener("click", () => {
      learnersListKeyword = ($("#jw-learners-keyword")?.value || "").trim();
      renderLearnersTable();
      showToast("查询完成");
    });
    $("#jw-learners-keyword")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      learnersListKeyword = ($("#jw-learners-keyword")?.value || "").trim();
      renderLearnersTable();
    });
    $$("[data-learners-act]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const act = btn.dataset.learnersAct;
        if (act === "批量导入") {
          openLearnersImportPage();
          return;
        }
        if (act === "添加学生" || act === "添加设备") {
          openAddLearnerPage();
          return;
        }
        if (act === "批量移除") {
          handleBatchRemoveLearners();
          return;
        }
        if (act === "导出") {
          exportLearnersList();
          return;
        }
        showToast(`${act}（原型示意）`);
      });
    });
    bindAddLearnerPage();
    const syncLearnersCheckAll = (checked) => {
      $$("#jw-learners-tbody .xb-check").forEach((c) => {
        c.checked = checked;
      });
      const personAll = $("#jw-learners-check-all");
      const deviceAll = $("#jw-learners-check-all-device");
      if (personAll) personAll.checked = checked;
      if (deviceAll) deviceAll.checked = checked;
    };
    $("#jw-learners-check-all")?.addEventListener("change", () => {
      syncLearnersCheckAll(!!$("#jw-learners-check-all")?.checked);
    });
    $("#jw-learners-check-all-device")?.addEventListener("change", () => {
      syncLearnersCheckAll(!!$("#jw-learners-check-all-device")?.checked);
    });
    $("#jw-learners-tbody")?.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-learner-remove]");
      if (!removeBtn || learnersCourseId == null) return;
      openLearnerRemoveModal(Number(removeBtn.dataset.learnerRemove));
    });
    $$("[data-close-learner-remove]").forEach((el) => {
      el.addEventListener("click", closeLearnerRemoveModal);
    });
    $("#jw-learner-remove-ok")?.addEventListener("click", confirmLearnerRemove);

    $("#jw-import-back-manage")?.addEventListener("click", () => {
      learnersCourseId = null;
      setJiaowuNav("manage");
    });
    $("#jw-import-back-learners")?.addEventListener("click", () => {
      setJiaowuNav("learners");
      renderLearnersTable();
    });
    $("#jw-import-cancel")?.addEventListener("click", () => {
      setJiaowuNav("learners");
      renderLearnersTable();
    });
    $("#jw-import-download")?.addEventListener("click", () => {
      showToast("已下载模板（原型示意）");
    });
    $("#jw-import-upload")?.addEventListener("click", () => {
      if (importHasFile) return;
      importHasFile = true;
      syncImportUploadState();
      showToast("已上传文件");
    });
    $("#jw-import-file-remove")?.addEventListener("click", () => {
      importHasFile = false;
      syncImportUploadState();
    });
    $("#jw-import-start")?.addEventListener("click", () => {
      if (!importHasFile) return;
      restoreContinueAction = "import";
      pendingAddStudents = [];
      if (!isLearnersDeviceMode() && openImportRestoreModal()) return;
      finishImportSuccess();
    });
    $$("[data-close-import-restore]").forEach((el) => {
      el.addEventListener("click", () => {
        restoreContinueAction = "import";
        pendingAddStudents = [];
        closeImportRestoreModal();
      });
    });
    $("#jw-import-restore-ok")?.addEventListener("click", confirmImportRestore);
  }

  function nowText() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function renderCourseTable() {
    const tbody = $("#xb-course-tbody");
    const countEl = $("#xb-record-count");
    if (!tbody) return;
    tbody.innerHTML = courseList
      .map((row, index) => {
        const isReviewing = row.status === "reviewing";
        const isRejected = row.status === "rejected";
        const isPassed = row.status === "passed";
        const statusHtml = buildStatusHtml(row);
        const { hwHtml, cwHtml, emptyHw, emptyCw, showTitle } = buildRowAttachHtml(row);

        let opHtml = "";
        if (isRejected || (row.action === "制作" && !isPassed && !isReviewing)) {
          const noVideo = getRowResourceType(row) !== "video";
          // 无视频（试卷/课件）：主按钮「提交」；有视频：主按钮「制作」
          const menuItems = isRejected
            ? `${
                noVideo
                  ? ""
                  : `<button type="button" class="xb-op-menu__item" data-op-item="提交" data-submit-row="${row.id}">提交</button>`
              }
                <button type="button" class="xb-op-menu__item" data-op-item="移动" data-move-row="${row.id}">移动</button>
                <button type="button" class="xb-op-menu__item" data-op-item="审核记录" data-audit-row="${row.id}">审核记录</button>
                <button type="button" class="xb-op-menu__item" data-op-item="删除" data-del-row="${row.id}">删除</button>`
            : `${
                noVideo
                  ? ""
                  : `<button type="button" class="xb-op-menu__item" data-op-item="提交" data-submit-row="${row.id}">提交</button>`
              }
                <button type="button" class="xb-op-menu__item" data-op-item="编辑" data-edit-row="${row.id}">编辑</button>
                <button type="button" class="xb-op-menu__item" data-op-item="移动" data-move-row="${row.id}">移动</button>
                <button type="button" class="xb-op-menu__item" data-op-item="删除" data-del-row="${row.id}">删除</button>`;
          const mainBtn = noVideo
            ? `<button type="button" class="xb-btn xb-btn--sm xb-btn--outline" data-submit-row="${row.id}">提交</button>`
            : `<a class="xb-btn xb-btn--sm xb-btn--outline xb-btn--link" href="${escapeHref(makePageUrl(row.videoName))}" target="_blank" rel="noopener noreferrer" data-row-action="制作">制作</a>`;
          opHtml = `${mainBtn}
              <button type="button" class="xb-op__caret" data-op-caret aria-label="更多操作" aria-expanded="false"></button>
              <div class="xb-op-menu" hidden>
                ${menuItems}
              </div>
              ${
                noVideo
                  ? ""
                  : `<button type="button" class="proto-diff-pin proto-diff-pin--inline" data-diff-pin="pc-teacher-make" title="查看此处改动说明">改</button>`
              }`;
        } else if (isReviewing) {
          opHtml = `<button type="button" class="xb-btn xb-btn--sm xb-btn--outline" data-row-move="${row.id}">移动</button>
              <button type="button" class="xb-op__caret" data-op-caret aria-label="更多操作" aria-expanded="false"></button>
              <div class="xb-op-menu" hidden>
                <button type="button" class="xb-op-menu__item" data-op-item="撤回" data-withdraw-row="${row.id}">撤回</button>
                <button type="button" class="xb-op-menu__item" data-op-item="删除" data-del-row="${row.id}">删除</button>
              </div>`;
        } else if (isPassed) {
          opHtml = `<button type="button" class="xb-btn xb-btn--sm xb-btn--outline" data-row-move="${row.id}">移动</button>
              <button type="button" class="xb-op__caret" data-op-caret aria-label="更多操作" aria-expanded="false"></button>
              <div class="xb-op-menu" hidden>
                <button type="button" class="xb-op-menu__item" data-op-item="审核记录" data-audit-row="${row.id}">审核记录</button>
              </div>`;
        } else {
          opHtml = `<button type="button" class="xb-btn xb-btn--sm xb-btn--outline" data-row-move="${row.id}">移动</button>
              <button type="button" class="xb-op__caret" data-op-caret aria-label="更多操作" aria-expanded="false"></button>`;
        }

        const titleHtml = showTitle
          ? `<div class="xb-course-info__title">
              <a class="xb-preview-link" href="${escapeHref(PREVIEW.video)}" target="_blank" rel="noopener noreferrer">${escapeAttr(row.videoName)}</a>
              ${
                index === 0
                  ? `<button type="button" class="proto-diff-pin proto-diff-pin--inline" data-diff-pin="pc-teacher-video" title="查看此处改动说明">改</button>`
                  : ""
              }
            </div>`
          : "";

        return `<tr data-row-id="${row.id}">
          <td class="col-check"><input class="xb-check" type="checkbox" aria-label="选择行" /></td>
          <td class="col-subject">${row.subject}</td>
          <td class="col-info">
            ${titleHtml}
            ${hwHtml || emptyHw}
            ${cwHtml || emptyCw}
          </td>
          <td class="col-audit">${escapeAttr(row.audit)}</td>
          <td class="col-time">${row.createdAt}</td>
          <td class="col-time">${row.updatedAt}</td>
          <td class="col-status">${statusHtml}</td>
          <td class="col-action">
            <div class="xb-op">
              ${opHtml}
            </div>
          </td>
        </tr>`;
      })
      .join("");
    if (countEl) countEl.textContent = `共${courseList.length}条记录`;
    syncListChecks();
  }

  function getRowResourceType(row) {
    if (row?.resourceType === "paper" || row?.resourceType === "courseware") return row.resourceType;
    return "video";
  }

  function buildRowAttachHtml(row) {
    const isReviewing = row.status === "reviewing";
    const isPassed = row.status === "passed";
    const attachReadonly = isReviewing || isPassed;
    const resourceType = getRowResourceType(row);
    const showHw = resourceType !== "courseware";
    const showCw = resourceType !== "paper";
    const hwHtml = showHw
      ? (row.homeworks || [])
          .map((hw, idx) =>
            attachReadonly
              ? `<div class="xb-course-info__meta">
            <span class="xb-list-attach xb-list-attach--readonly">
              ${
                idx === 0
                  ? `<span class="xb-list-attach__label">作业:</span>`
                  : `<span class="xb-list-attach__label xb-list-attach__label--spacer" aria-hidden="true">作业:</span>`
              }
              <a class="xb-preview-link xb-list-attach__link" href="${escapeHref(PREVIEW.paper)}" target="_blank" rel="noopener noreferrer" title="点击预览">${escapeAttr(hw.name)}</a>
            </span>
          </div>`
              : `<div class="xb-course-info__meta">
            <span class="xb-list-attach">
              ${
                idx === 0
                  ? `<button type="button" class="xb-list-attach__dot" data-list-add-hw="${row.id}" aria-label="添加作业">+</button>
              <span class="xb-list-attach__label">作业:</span>`
                  : `<span class="xb-list-attach__dot xb-list-attach__dot--spacer" aria-hidden="true"></span>
              <span class="xb-list-attach__label xb-list-attach__label--spacer" aria-hidden="true">作业:</span>`
              }
              <input class="xb-list-attach__name" type="text" value="${escapeAttr(hw.name)}" data-list-hw-name="${row.id}:${hw.key}" readonly title="点击预览" />
              <span class="xb-list-attach__ops">
                <button type="button" data-list-edit-hw="${row.id}:${hw.key}" aria-label="编辑">${EDIT_ICON}</button>
                <button type="button" data-list-remove-hw="${row.id}:${hw.key}" aria-label="删除">${DEL_ICON}</button>
              </span>
            </span>
          </div>`
          )
          .join("")
      : "";
    const cwHtml = showCw
      ? (row.coursewares || [])
          .map((cw, idx) =>
            attachReadonly
              ? `<div class="xb-course-info__meta">
            <span class="xb-list-attach xb-list-attach--readonly">
              ${
                idx === 0
                  ? `<span class="xb-list-attach__label">课件:</span>`
                  : `<span class="xb-list-attach__label xb-list-attach__label--spacer" aria-hidden="true">课件:</span>`
              }
              <a class="xb-preview-link xb-list-attach__link" href="${escapeHref(PREVIEW.courseware)}" target="_blank" rel="noopener noreferrer" title="点击预览">${escapeAttr(cw.name)}</a>
            </span>
          </div>`
              : `<div class="xb-course-info__meta">
            <span class="xb-list-attach">
              ${
                idx === 0
                  ? `<button type="button" class="xb-list-attach__dot" data-list-add-cw="${row.id}" aria-label="添加课件">+</button>
              <span class="xb-list-attach__label">课件:</span>`
                  : `<span class="xb-list-attach__dot xb-list-attach__dot--spacer" aria-hidden="true"></span>
              <span class="xb-list-attach__label xb-list-attach__label--spacer" aria-hidden="true">课件:</span>`
              }
              <input class="xb-list-attach__name" type="text" value="${escapeAttr(cw.name)}" data-list-cw-name="${row.id}:${cw.key}" readonly title="点击预览" />
              <span class="xb-list-attach__ops">
                <button type="button" data-list-edit-cw="${row.id}:${cw.key}" aria-label="编辑">${EDIT_ICON}</button>
                <button type="button" data-list-remove-cw="${row.id}:${cw.key}" aria-label="删除">${DEL_ICON}</button>
              </span>
            </span>
          </div>`
          )
          .join("")
      : "";
    const emptyHw =
      showHw && !(row.homeworks || []).length
        ? attachReadonly
          ? `<div class="xb-course-info__meta">
            <span class="xb-list-attach xb-list-attach--readonly">
              <span class="xb-list-attach__label">作业:</span>
            </span>
          </div>`
          : `<div class="xb-course-info__meta">
            <span class="xb-list-attach">
              <button type="button" class="xb-list-attach__dot" data-list-add-hw="${row.id}" aria-label="添加作业">+</button>
              <span class="xb-list-attach__label">作业:</span>
            </span>
          </div>`
        : "";
    const emptyCw =
      showCw && !(row.coursewares || []).length
        ? attachReadonly
          ? `<div class="xb-course-info__meta">
            <span class="xb-list-attach xb-list-attach--readonly">
              <span class="xb-list-attach__label">课件:</span>
            </span>
          </div>`
          : `<div class="xb-course-info__meta">
            <span class="xb-list-attach">
              <button type="button" class="xb-list-attach__dot" data-list-add-cw="${row.id}" aria-label="添加课件">+</button>
              <span class="xb-list-attach__label">课件:</span>
            </span>
          </div>`
        : "";
    return { hwHtml, cwHtml, emptyHw, emptyCw, showTitle: resourceType === "video" };
  }

  function buildStatusHtml(row) {
    if (row.status === "making") return `<span class="xb-status--making">制作中</span>`;
    if (row.status === "reviewing") return `<span class="xb-status--review">审核中</span>`;
    if (row.status === "rejected") return `<span class="xb-status--fail">审核不通过</span>`;
    return `<span class="xb-status--ok">审核通过</span>`;
  }

  function buildJiaowuOpHtml(row) {
    const isReviewing = row.status === "reviewing";
    const isRejected = row.status === "rejected";
    const isPassed = row.status === "passed";
    const noVideo = getRowResourceType(row) !== "video";
    if (isRejected) {
      const mainBtn = noVideo
        ? `<button type="button" class="xb-btn xb-btn--sm xb-btn--outline" data-submit-row="${row.id}">提交</button>`
        : `<a class="xb-btn xb-btn--sm xb-btn--outline xb-btn--link" href="${escapeHref(makePageUrl(row.videoName))}" target="_blank" rel="noopener noreferrer">制作</a>`;
      return `${mainBtn}
              <button type="button" class="xb-op__caret" data-op-caret aria-label="更多操作" aria-expanded="false"></button>
              <div class="xb-op-menu" hidden>
                ${
                  noVideo
                    ? ""
                    : `<button type="button" class="xb-op-menu__item" data-op-item="提交" data-submit-row="${row.id}">提交</button>`
                }
                <button type="button" class="xb-op-menu__item" data-op-item="移动" data-move-row="${row.id}">移动</button>
                <button type="button" class="xb-op-menu__item" data-op-item="审核记录" data-audit-row="${row.id}">审核记录</button>
                <button type="button" class="xb-op-menu__item" data-op-item="删除" data-del-row="${row.id}">删除</button>
              </div>`;
    }
    if (row.status === "making") {
      const mainBtn = noVideo
        ? `<button type="button" class="xb-btn xb-btn--sm xb-btn--outline" data-submit-row="${row.id}">提交</button>`
        : `<a class="xb-btn xb-btn--sm xb-btn--outline xb-btn--link" href="${escapeHref(makePageUrl(row.videoName))}" target="_blank" rel="noopener noreferrer">制作</a>`;
      return `${mainBtn}
              <button type="button" class="xb-op__caret" data-op-caret aria-label="更多操作" aria-expanded="false"></button>
              <div class="xb-op-menu" hidden>
                ${
                  noVideo
                    ? ""
                    : `<button type="button" class="xb-op-menu__item" data-op-item="提交" data-submit-row="${row.id}">提交</button>`
                }
                <button type="button" class="xb-op-menu__item" data-op-item="编辑" data-edit-row="${row.id}">编辑</button>
                <button type="button" class="xb-op-menu__item" data-op-item="移动" data-move-row="${row.id}">移动</button>
                <button type="button" class="xb-op-menu__item" data-op-item="删除" data-del-row="${row.id}">删除</button>
              </div>`;
    }
    if (isReviewing) {
      return `<button type="button" class="xb-btn xb-btn--sm xb-btn--outline" data-jw-review="${row.id}">审核</button>
              <button type="button" class="xb-op__caret" data-op-caret aria-label="更多操作" aria-expanded="false"></button>
              <div class="xb-op-menu" hidden>
                <button type="button" class="xb-op-menu__item" data-op-item="移动" data-move-row="${row.id}">移动</button>
                <button type="button" class="xb-op-menu__item" data-op-item="撤回" data-withdraw-row="${row.id}">撤回</button>
                <button type="button" class="xb-op-menu__item" data-op-item="删除" data-del-row="${row.id}">删除</button>
              </div>`;
    }
    if (isPassed) {
      return `<button type="button" class="xb-btn xb-btn--sm xb-btn--outline" data-row-move="${row.id}">移动</button>
              <button type="button" class="xb-op__caret" data-op-caret aria-label="更多操作" aria-expanded="false"></button>
              <div class="xb-op-menu" hidden>
                <button type="button" class="xb-op-menu__item" data-op-item="审核记录" data-audit-row="${row.id}">审核记录</button>
              </div>`;
    }
    return `<button type="button" class="xb-btn xb-btn--sm xb-btn--outline" data-row-move="${row.id}">移动</button>
              <button type="button" class="xb-op__caret" data-op-caret aria-label="更多操作" aria-expanded="false"></button>`;
  }

  function renderJiaowuTable() {
    const tbody = $("#jw-course-tbody");
    const countEl = $("#jw-record-count");
    if (!tbody) return;
    tbody.innerHTML = courseList
      .map((row) => {
        const { hwHtml, cwHtml, emptyHw, emptyCw, showTitle } = buildRowAttachHtml(row);
        const titleHtml = showTitle
          ? `<div class="xb-course-info__title">
              <a class="xb-preview-link" href="${escapeHref(PREVIEW.video)}" target="_blank" rel="noopener noreferrer">${escapeAttr(row.videoName)}</a>
            </div>`
          : "";
        return `<tr data-row-id="${row.id}">
          <td class="col-check"><input class="xb-check" type="checkbox" aria-label="选择行" /></td>
          <td class="col-subject">${row.subject}</td>
          <td class="col-info">
            ${titleHtml}
            ${hwHtml || emptyHw}
            ${cwHtml || emptyCw}
          </td>
          <td class="col-maker">${escapeAttr(row.maker || "zfy")}</td>
          <td class="col-audit">${escapeAttr(row.audit)}</td>
          <td class="col-time">${row.createdAt}</td>
          <td class="col-time">${row.updatedAt}</td>
          <td class="col-status">${buildStatusHtml(row)}</td>
          <td class="col-action">
            <div class="xb-op">${buildJiaowuOpHtml(row)}</div>
          </td>
        </tr>`;
      })
      .join("");
    if (countEl) countEl.textContent = `共${courseList.length}条记录`;
    syncJiaowuChecks();
  }

  function syncJiaowuChecks() {
    const checkAll = $("#jw-check-all");
    const moveBtn = $("#jw-move-btn");
    const rows = $$("#jw-course-tbody .xb-check");
    if (!checkAll || !moveBtn) return;
    const checkedCount = rows.filter((c) => c.checked).length;
    checkAll.checked = rows.length > 0 && checkedCount === rows.length;
    checkAll.indeterminate = checkedCount > 0 && checkedCount < rows.length;
    const anyChecked = checkedCount > 0;
    moveBtn.disabled = !anyChecked;
    moveBtn.classList.toggle("xb-btn--muted", !anyChecked);
    moveBtn.classList.toggle("is-active", anyChecked);
  }

  function setJiaowuNav(nav) {
    state.jwNav = nav;
    const sideNav =
      nav === "publish" ||
      nav === "learners" ||
      nav === "learners-import" ||
      nav === "learners-add" ||
      nav === "learn-data"
        ? "manage"
        : nav;
    $$("[data-jw-nav]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.jwNav === sideNav);
    });
    $$("[data-jw-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.jwPanel !== nav;
    });
    if (nav !== "publish") hidePublishTip();
    schedulePersist();
  }

  let editingPublishId = null;

  function resetPublishForm() {
    editingPublishId = null;
    const nameInput = $("#jw-pub-name");
    if (nameInput) {
      nameInput.value = "";
      syncPublishNameCount(nameInput);
    }
    const grade = $("#jw-pub-grade");
    const subject = $("#jw-pub-subject");
    const lessons = $("#jw-pub-lessons");
    const intro = $("#jw-pub-intro");
    if (grade) grade.selectedIndex = 0;
    if (subject) subject.selectedIndex = 0;
    if (lessons) lessons.value = "";
    if (intro) intro.value = "";
    const order = document.querySelector('input[name="jw-learn-mode"][value="order"]');
    if (order) order.checked = true;
    const video = document.querySelector('input[name="jw-learn-sub"][value="video"]');
    if (video) video.checked = true;
    const sub = $("#jw-learn-sub");
    if (sub) sub.hidden = false;
    const lock = document.querySelector('input[name="jw-progress"][value="lock"]');
    if (lock) lock.checked = true;
    const self = document.querySelector('input[name="jw-hw-check"][value="self"]');
    if (self) self.checked = true;
  }

  function fillPublishForm(row) {
    editingPublishId = row.id;
    const nameInput = $("#jw-pub-name");
    if (nameInput) {
      nameInput.value = row.title || "";
      syncPublishNameCount(nameInput);
    }
    const grade = $("#jw-pub-grade");
    const subject = $("#jw-pub-subject");
    const lessons = $("#jw-pub-lessons");
    if (grade && row.grade) grade.value = row.grade;
    if (subject && row.subject) subject.value = row.subject;
    if (lessons) lessons.value = row.lessons != null ? String(row.lessons) : "";
  }

  function collectPublishForm() {
    const name = ($("#jw-pub-name")?.value || "").trim();
    const grade = $("#jw-pub-grade")?.value || "";
    const subject = $("#jw-pub-subject")?.value || "";
    const lessonsRaw = ($("#jw-pub-lessons")?.value || "").trim();
    const lessons = lessonsRaw ? Number(lessonsRaw) : null;
    return {
      title: name || "未命名课程",
      grade: grade || "一年级",
      subject: subject || "语文",
      lessons: Number.isFinite(lessons) && lessons > 0 ? lessons : null,
      learners: null,
      publishedAt: null,
      status: "draft",
      tags: ["vod"],
    };
  }

  function savePublishDraft() {
    const data = collectPublishForm();
    const units = snapshotUnitsForCourse();
    if (editingPublishId != null) {
      const row = manageCourseList.find((item) => item.id === editingPublishId);
      if (row) Object.assign(row, data, { scheduleUnits: units });
    } else {
      manageCourseList.unshift({
        id: manageListSeq++,
        ...data,
        scheduleUnits: units,
      });
    }
    editingPublishId = null;
    publishMode = "create";
    scheduleMode = "create";
    scheduleDirty = false;
    setGradeSubjectLocked(false);
    applyScheduleModeUI();
    renderManageTable();
    showToast("已保存，状态为待发布");
    setJiaowuNav("manage");
  }

  function setPublishStep(step) {
    const stepNum = Number(step) === 2 ? 2 : 1;
    state.publishStep = stepNum;
    $$("[data-pub-pane]").forEach((pane) => {
      pane.hidden = Number(pane.dataset.pubPane) !== stepNum;
    });
    $$("[data-pub-step]").forEach((el) => {
      const n = Number(el.dataset.pubStep);
      el.classList.toggle("is-active", n === stepNum);
      el.classList.toggle("is-done", n < stepNum);
    });
    const line = $(".jw-publish-step__line");
    if (line) line.classList.toggle("is-done", stepNum === 2);
    if (stepNum !== 2) hidePublishTip();
    if (stepNum === 2) renderScheduleUnits();
    syncPublishDiffPin();
    schedulePersist();
  }

  const CN_NUM = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  function chapterLabel(index) {
    const n = index + 1;
    if (n <= 10) return `第${CN_NUM[n]}章`;
    if (n < 20) return `第十${CN_NUM[n - 10]}章`;
    return `第${n}章`;
  }

  let scheduleUnitSeq = 1;
  const scheduleUnits = [];
  let publishMode = "create"; // create | modify
  let scheduleMode = "create"; // create | edit
  let scheduleDirty = false;

  function setGradeSubjectLocked(locked) {
    const grade = $("#jw-pub-grade");
    const subject = $("#jw-pub-subject");
    if (grade) grade.disabled = !!locked;
    if (subject) subject.disabled = !!locked;
  }

  function cloneScheduleUnits(units) {
    return (Array.isArray(units) ? units : []).map((unit) => ({
      id: unit.id,
      customName: unit.customName ?? null,
      open: unit.open !== false,
      editing: false,
      lessons: Array.isArray(unit.lessons)
        ? unit.lessons.map((lesson) => ({
            name: lesson.name,
            duration: lesson.duration || "0分0秒",
            homeworks: [...(lesson.homeworks || [])],
            coursewares: [...(lesson.coursewares || [])],
          }))
        : [],
    }));
  }

  function loadScheduleUnits(units) {
    scheduleUnits.length = 0;
    scheduleUnits.push(...cloneScheduleUnits(units));
    const maxId = scheduleUnits.reduce((max, unit) => Math.max(max, Number(unit.id) || 0), 0);
    scheduleUnitSeq = Math.max(scheduleUnitSeq, maxId + 1);
  }

  function snapshotUnitsForCourse() {
    return cloneScheduleUnits(scheduleUnits);
  }

  function buildDemoScheduleUnits() {
    const mkLesson = (name, homeworks = [], coursewares = []) => ({
      name,
      duration: "0分4秒",
      homeworks,
      coursewares,
    });
    return [
      {
        id: scheduleUnitSeq++,
        customName: null,
        open: true,
        editing: false,
        lessons: [
          mkLesson("预习报告第3题", ["预习报告第3题"]),
          mkLesson("预习报告第4题"),
          mkLesson("预习报告第5题"),
          mkLesson("预习报告第6题"),
          mkLesson("预习报告第7题"),
        ],
      },
      {
        id: scheduleUnitSeq++,
        customName: null,
        open: true,
        editing: false,
        lessons: [
          mkLesson("预习报告第8题", [], ["课件示例"]),
          mkLesson("预习报告第9题"),
          mkLesson("预习报告第10题"),
          mkLesson("预习报告第11题"),
          mkLesson("预习报告第12题"),
        ],
      },
    ];
  }

  function ensureCourseScheduleUnits(row) {
    if (!row) return [];
    if (Array.isArray(row.scheduleUnits)) return row.scheduleUnits;
    row.scheduleUnits = buildDemoScheduleUnits();
    return row.scheduleUnits;
  }

  function syncSchedulePublishBtn() {
    const btn = $("#jw-sched-publish");
    if (!btn) return;
    if (scheduleMode === "edit") {
      const enabled = !!scheduleDirty;
      btn.disabled = !enabled;
      btn.classList.toggle("xb-btn--muted", !enabled);
      btn.classList.toggle("xb-btn--primary", enabled);
    } else {
      btn.disabled = false;
      btn.classList.remove("xb-btn--muted");
      btn.classList.add("xb-btn--primary");
    }
  }

  function applyScheduleModeUI() {
    const isSchedEdit = scheduleMode === "edit";
    const isModify = publishMode === "modify";
    const crumb = $("#jw-publish-crumb-current");
    if (crumb) {
      if (isSchedEdit) crumb.textContent = "排课";
      else if (isModify) crumb.textContent = "基本信息";
      else crumb.textContent = "发布课程";
    }
    const steps = $("#jw-publish-steps");
    if (steps) steps.hidden = isSchedEdit || isModify;

    setGradeSubjectLocked(isModify);

    const pubCancel = $("#jw-pub-cancel");
    const pubModifySave = $("#jw-pub-modify-save");
    const pubSave = $("#jw-pub-save");
    const pubNow = $("#jw-pub-now");
    const pubNowWrap = $("#jw-pub-now-wrap");
    const pubSchedule = $("#jw-pub-schedule");
    if (pubCancel) pubCancel.hidden = !isModify;
    if (pubModifySave) pubModifySave.hidden = !isModify;
    if (pubSave) pubSave.hidden = isModify;
    if (pubNow) pubNow.hidden = isModify;
    if (pubNowWrap) pubNowWrap.hidden = isModify;
    if (pubSchedule) pubSchedule.hidden = isModify;

    const prev = $("#jw-sched-prev");
    const save = $("#jw-sched-save");
    const cancel = $("#jw-sched-cancel");
    if (prev) prev.hidden = isSchedEdit;
    if (save) save.hidden = isSchedEdit;
    if (cancel) cancel.hidden = !isSchedEdit;
    syncSchedulePublishBtn();
    syncPublishDiffPin();
  }

  function syncPublishDiffPin() {
    const pin = $("#pc-diff-publish-pin");
    if (!pin) return;
    if (scheduleMode === "edit") pin.dataset.diffPin = "pc-jw-schedule-edit";
    else if (publishMode === "modify") pin.dataset.diffPin = "pc-jw-modify";
    else if (state.publishStep === 2) pin.dataset.diffPin = "pc-jw-schedule";
    else pin.dataset.diffPin = "pc-jw-publish";
  }

  function exitModifyBasic() {
    publishMode = "create";
    scheduleMode = "create";
    scheduleDirty = false;
    editingPublishId = null;
    setGradeSubjectLocked(false);
    applyScheduleModeUI();
    setJiaowuNav("manage");
  }

  function saveModifyBasic() {
    if (editingPublishId == null) {
      exitModifyBasic();
      return;
    }
    const row = manageCourseList.find((item) => item.id === editingPublishId);
    if (row) {
      const data = collectPublishForm();
      row.title = data.title;
      row.grade = data.grade;
      row.subject = data.subject;
      row.lessons = data.lessons;
    }
    renderManageTable();
    showToast("已保存");
    exitModifyBasic();
  }

  function openModifyBasic(row) {
    if (!row) return;
    publishMode = "modify";
    scheduleMode = "create";
    scheduleDirty = false;
    fillPublishForm(row);
    if (Array.isArray(row.scheduleUnits)) loadScheduleUnits(row.scheduleUnits);
    setJiaowuNav("publish");
    setPublishStep(1);
    applyScheduleModeUI();
    const nameInput = $("#jw-pub-name");
    if (nameInput) syncPublishNameCount(nameInput);
  }

  function markScheduleDirty() {
    if (scheduleMode !== "edit") {
      schedulePersist();
      return;
    }
    if (!scheduleDirty) {
      scheduleDirty = true;
      syncSchedulePublishBtn();
    }
    schedulePersist();
  }

  function exitScheduleEdit() {
    if (editingPublishId != null) {
      const row = manageCourseList.find((item) => item.id === editingPublishId);
      if (row && Array.isArray(row.scheduleUnits)) loadScheduleUnits(row.scheduleUnits);
    }
    publishMode = "create";
    scheduleMode = "create";
    scheduleDirty = false;
    editingPublishId = null;
    setGradeSubjectLocked(false);
    applyScheduleModeUI();
    setJiaowuNav("manage");
  }

  function openScheduleEdit(row) {
    if (!row) return;
    publishMode = "create";
    scheduleMode = "edit";
    scheduleDirty = false;
    fillPublishForm(row);
    loadScheduleUnits(ensureCourseScheduleUnits(row));
    setJiaowuNav("publish");
    setPublishStep(2);
    applyScheduleModeUI();
  }

  function renderScheduleUnits() {
    const list = $("#jw-unit-list");
    const empty = $("#jw-schedule-empty");
    if (!list || !empty) return;
    const hasUnits = scheduleUnits.length > 0;
    empty.hidden = hasUnits;
    list.hidden = !hasUnits;
    if (!hasUnits) {
      list.innerHTML = "";
      return;
    }
    list.innerHTML = scheduleUnits
      .map((unit, index) => {
        const chapter = chapterLabel(index);
        const displayName = unit.customName ? unit.customName : "默认单元";
        const editing = unit.editing;
        const titleHtml = editing
          ? `<span class="jw-unit__chapter">${chapter}</span>
             <input class="jw-unit__name-input" type="text" data-unit-name-input="${unit.id}"
               placeholder="请输入单元名称" value="${escapeAttr(unit.customName || "")}" />`
          : `<span class="jw-unit__chapter">${chapter}</span>
             <span class="jw-unit__name">${escapeAttr(displayName)}</span>`;
        return `<article class="jw-unit${unit.open ? " is-open" : ""}" data-unit-id="${unit.id}">
          <div class="jw-unit__head">
            <button type="button" class="jw-unit__toggle" data-unit-toggle="${unit.id}" aria-label="展开收起">∨</button>
            <div class="jw-unit__title-wrap${editing ? " is-editing" : ""}">
              ${titleHtml}
              <button type="button" class="jw-unit__edit" data-unit-edit="${unit.id}" aria-label="编辑单元名称" title="编辑">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                  <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                  <path d="M10.2 3.8l2 2" stroke="currentColor" stroke-width="1.3"/>
                </svg>
              </button>
            </div>
            ${
              index === 0 && scheduleMode !== "edit"
                ? `<button type="button" class="proto-diff-pin proto-diff-pin--inline" data-diff-pin="pc-jw-unit" title="查看此处改动说明">改</button>`
                : ""
            }
            <div class="jw-unit__plan">
              <span class="jw-unit__plan-label">设置单元学习计划</span>
              <button type="button" class="jw-tip-btn" data-tip="plan" aria-label="学习计划说明">?</button>
              <span class="xb-date-range jw-unit__date" role="group" aria-label="学习计划日期">
                <input class="xb-date-range__input" type="text" placeholder="开始日期" readonly />
                <span class="xb-date-range__sep" aria-hidden="true">→</span>
                <input class="xb-date-range__input" type="text" placeholder="结束日期" readonly />
                <span class="xb-date-range__icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                    <rect x="2" y="3.5" width="12" height="10.5" rx="1.2" stroke="currentColor" stroke-width="1.2" />
                    <path d="M5 2v3M11 2v3M2 7h12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                  </svg>
                </span>
              </span>
            </div>
            <div class="jw-unit__actions">
              <button type="button" class="jw-unit__link" data-unit-del="${unit.id}">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                  <path d="M3.5 4.5h9M6 4.5V3h4v1.5M5 4.5l.6 8h4.8l.6-8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                删除
              </button>
              <button type="button" class="xb-btn xb-btn--ghost jw-unit__add-course" data-unit-add-course="${unit.id}">+ 添加课程</button>
            </div>
          </div>
          <div class="jw-unit__body">
            ${
              unit.lessons && unit.lessons.length
                ? `<ul class="jw-unit__lessons">${unit.lessons
                    .map(
                      (lesson, li) => `<li class="jw-unit__lesson" data-unit-id="${unit.id}" data-lesson-index="${li}" draggable="true">
                        <div class="jw-unit__lesson-main">
                          <div class="jw-unit__lesson-title">第${li + 1}节 ${escapeAttr(lesson.name)}${
                            index === 0 && li === 0
                              ? `<button type="button" class="proto-diff-pin proto-diff-pin--inline" data-diff-pin="pc-jw-lesson-row" title="查看此处改动说明">改</button>`
                              : ""
                          }</div>
                          ${
                            lesson.resourceType === "paper" || lesson.resourceType === "courseware"
                              ? ""
                              : `<div class="jw-unit__lesson-meta">${escapeAttr(lesson.duration || "0分0秒")}</div>`
                          }
                          ${renderLessonAttachHtml(lesson)}
                        </div>
                        <div class="jw-unit__lesson-ops">
                          <button type="button" class="jw-unit__lesson-icon" data-lesson-del="${unit.id}:${li}" aria-label="删除课时" title="删除">
                            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                              <path d="M3.5 4.5h9M6 4.5V3h4v1.5M5 4.5l.6 8h4.8l.6-8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                          </button>
                          <span class="jw-unit__lesson-drag" aria-hidden="true" title="拖拽排序">⋮⋮</span>
                        </div>
                      </li>`
                    )
                    .join("")}</ul>`
                : `<div class="jw-unit__body-art" aria-hidden="true"></div>
                   <p class="jw-unit__body-text">请添加课时视频</p>`
            }
          </div>
        </article>`;
      })
      .join("");

    const editingInput = list.querySelector("[data-unit-name-input]");
    if (editingInput) {
      editingInput.focus();
      editingInput.select();
    }
    schedulePersist();
  }

  function addScheduleUnit() {
    scheduleUnits.forEach((u) => {
      u.editing = false;
    });
    scheduleUnits.push({
      id: scheduleUnitSeq++,
      customName: null,
      open: true,
      editing: false,
      lessons: [],
    });
    markScheduleDirty();
    renderScheduleUnits();
  }

  let ADD_COURSE_VIDEOS = [
    { name: "大字", duration: "2分19秒", resourceType: "video" },
    { name: "flv: 测试分析", duration: "5分02秒", resourceType: "video" },
    { name: "wmv: 儿童歌曲 - 小龙人", duration: "3分41秒", resourceType: "video" },
    { name: "2", duration: "1分08秒", resourceType: "video" },
    { name: "屏幕录制 2024-08-12 162520", duration: "12分36秒", resourceType: "video" },
  ];
  const ADD_COURSE_MAX = 20;
  let addCourseUnitId = null;
  const addCourseSelected = new Set();
  let dragLessonKey = null;
  let addModalSource = "courseList"; // courseList | jwAddCourse
  let jwAddCourseResourceType = "video";

  function mockVideoDuration(name) {
    const n = String(name || "").length;
    const sec = 60 + (n * 17) % 240;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}分${String(s).padStart(2, "0")}秒`;
  }

  function getAddCourseItemType(item) {
    return item?.resourceType === "paper" || item?.resourceType === "courseware"
      ? item.resourceType
      : "video";
  }

  function ensureAddCourseVideo(name, duration, homeworks, coursewares, resourceType) {
    const type =
      resourceType === "paper" || resourceType === "courseware" ? resourceType : "video";
    let idx = ADD_COURSE_VIDEOS.findIndex(
      (item) => item.name === name && getAddCourseItemType(item) === type
    );
    const hw = Array.isArray(homeworks) ? homeworks : [];
    const cw = Array.isArray(coursewares) ? coursewares : [];
    if (idx < 0) {
      ADD_COURSE_VIDEOS.push({
        name,
        duration: type === "video" ? duration || mockVideoDuration(name) : duration || "—",
        homeworks: hw,
        coursewares: cw,
        resourceType: type,
      });
      idx = ADD_COURSE_VIDEOS.length - 1;
    } else {
      const item = ADD_COURSE_VIDEOS[idx];
      item.homeworks = hw.length ? hw : item.homeworks || [];
      item.coursewares = cw.length ? cw : item.coursewares || [];
      item.resourceType = type;
      if (duration) item.duration = duration;
    }
    return idx;
  }

  function collectAttachNames(ids, catalog, fallback) {
    return (ids || [])
      .map((id) => catalog[id]?.name || fallback)
      .filter(Boolean);
  }

  function renderLessonAttachHtml(lesson) {
    const rows = [];
    (lesson.homeworks || []).forEach((name) => {
      rows.push(
        `<div class="jw-unit__attach">
          <span class="jw-unit__attach-name" title="${escapeAttr(name)}">${escapeAttr(name)}</span>
          <span class="jw-unit__attach-tag">试卷</span>
        </div>`
      );
    });
    (lesson.coursewares || []).forEach((name) => {
      rows.push(
        `<div class="jw-unit__attach">
          <span class="jw-unit__attach-name" title="${escapeAttr(name)}">${escapeAttr(name)}</span>
          <span class="jw-unit__attach-tag">课件</span>
        </div>`
      );
    });
    if (!rows.length) return "";
    return `<div class="jw-unit__attach-list">${rows.join("")}</div>`;
  }

  function selectAddCourseVideo(index) {
    if (index < 0) return;
    if (addCourseSelected.has(index)) return;
    if (addCourseSelected.size >= ADD_COURSE_MAX) {
      showToast(`最多选择${ADD_COURSE_MAX}个`);
      return;
    }
    addCourseSelected.add(index);
  }

  function setJwStackClass(on) {
    ["#xb-add-modal", "#xb-pick-modal", "#xb-hw-modal", "#xb-cw-modal"].forEach((sel) => {
      $(sel)?.classList.toggle("is-above-jw", !!on);
    });
  }

  function jwAddCoursePickLabel(type) {
    if (type === "paper") return "选择试卷";
    if (type === "courseware") return "选择课件";
    return "选择课程视频";
  }

  function syncJwAddCourseTypeUI() {
    const select = $("#jw-add-course-resource-type");
    const label = $("#jw-add-course-pick-label");
    if (select) select.value = jwAddCourseResourceType;
    if (label) {
      label.innerHTML = `<span class="req">*</span>${jwAddCoursePickLabel(jwAddCourseResourceType)}：`;
    }
  }

  function setJwAddCourseResourceType(type) {
    const next = type === "paper" || type === "courseware" ? type : "video";
    if (next === jwAddCourseResourceType) return;
    jwAddCourseResourceType = next;
    addCourseSelected.clear();
    syncJwAddCourseTypeUI();
    renderAddCoursePicker();
  }

  function getJwAddCourseCatalog() {
    if (jwAddCourseResourceType === "paper") return HW_PAPERS;
    if (jwAddCourseResourceType === "courseware") return CW_ITEMS;
    return null;
  }

  function filteredAddCourseItems() {
    const keyword = ($("#jw-add-course-search")?.value || "").trim().toLowerCase();
    const catalog = getJwAddCourseCatalog();
    if (catalog) {
      return catalog
        .map((item, index) => ({ name: item.name, index, resourceType: jwAddCourseResourceType }))
        .filter((item) => item.name.toLowerCase().includes(keyword));
    }
    return ADD_COURSE_VIDEOS.map((item, index) => ({ ...item, index })).filter(
      (item) =>
        getAddCourseItemType(item) === "video" && item.name.toLowerCase().includes(keyword)
    );
  }

  function getJwAddCourseSelectedItems() {
    const catalog = getJwAddCourseCatalog();
    if (catalog) {
      return [...addCourseSelected]
        .sort((a, b) => a - b)
        .map((index) => {
          const item = catalog[index];
          if (!item) return null;
          return { name: item.name, index, resourceType: jwAddCourseResourceType };
        })
        .filter(Boolean);
    }
    return ADD_COURSE_VIDEOS.map((item, index) => ({ ...item, index })).filter(
      (item) => addCourseSelected.has(item.index) && getAddCourseItemType(item) === "video"
    );
  }

  function renderAddCoursePicker() {
    const list = $("#jw-add-course-list");
    const chosen = $("#jw-add-course-chosen");
    const count = $("#jw-add-course-count");
    if (!list || !chosen || !count) return;
    const items = filteredAddCourseItems();
    const emptyText =
      jwAddCourseResourceType === "paper"
        ? "暂无试卷资料"
        : jwAddCourseResourceType === "courseware"
          ? "暂无课件资料"
          : "暂无视频资料";
    list.innerHTML = items.length
      ? items
          .map(
            (item) => `<li>
          <label class="jw-add-course__item">
            <input type="checkbox" data-add-course-id="${item.index}" ${
              addCourseSelected.has(item.index) ? "checked" : ""
            } />
            <span title="${escapeAttr(item.name)}">${escapeAttr(item.name)}</span>
          </label>
        </li>`
          )
          .join("")
      : `<li class="jw-add-course__list-empty">${emptyText}</li>`;
    const selectedItems = getJwAddCourseSelectedItems();
    count.textContent = `已选择(${selectedItems.length}/${ADD_COURSE_MAX})`;
    chosen.innerHTML = selectedItems.length
      ? selectedItems
          .map(
            (item) => `<li class="jw-add-course__chip">
          <span title="${escapeAttr(item.name)}">${escapeAttr(item.name)}</span>
          <button type="button" class="jw-add-course__remove" data-add-course-remove="${item.index}" aria-label="移除">×</button>
        </li>`
          )
          .join("")
      : `<li class="jw-add-course__chosen-empty">暂无选择数据</li>`;
  }

  function openAddCourseModal(unitId) {
    const modal = $("#jw-add-course-modal");
    if (!modal) return;
    addCourseUnitId = unitId;
    addCourseSelected.clear();
    jwAddCourseResourceType = "video";
    syncJwAddCourseTypeUI();
    const search = $("#jw-add-course-search");
    if (search) search.value = "";
    const group = $(".jw-add-course__group");
    if (group) group.classList.remove("is-collapsed");
    const toggle = $("#jw-add-course-group-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    renderAddCoursePicker();
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeAddCourseModal() {
    const modal = $("#jw-add-course-modal");
    if (!modal) return;
    addCourseUnitId = null;
    addCourseSelected.clear();
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function buildJwPickedLessons() {
    if (jwAddCourseResourceType === "paper") {
      return [...addCourseSelected]
        .sort((a, b) => a - b)
        .map((id) => {
          const paper = HW_PAPERS[id];
          if (!paper) return null;
          const name = paper.name || "未命名试卷";
          return {
            name,
            duration: "—",
            homeworks: [name],
            coursewares: [],
            resourceType: "paper",
          };
        })
        .filter(Boolean);
    }
    if (jwAddCourseResourceType === "courseware") {
      return [...addCourseSelected]
        .sort((a, b) => a - b)
        .map((id) => {
          const item = CW_ITEMS[id];
          if (!item) return null;
          const name = item.name || "未命名课件";
          return {
            name,
            duration: "—",
            homeworks: [],
            coursewares: [name],
            resourceType: "courseware",
          };
        })
        .filter(Boolean);
    }
    return [...addCourseSelected]
      .sort((a, b) => a - b)
      .map((id) => ADD_COURSE_VIDEOS[id])
      .filter((item) => item && getAddCourseItemType(item) === "video")
      .map((item) => ({
        name: item.name,
        duration: item.duration,
        homeworks: [...(item.homeworks || [])],
        coursewares: [...(item.coursewares || [])],
        resourceType: "video",
      }));
  }

  function confirmAddCourse() {
    if (addCourseUnitId == null) {
      closeAddCourseModal();
      return;
    }
    const unit = scheduleUnits.find((u) => u.id === addCourseUnitId);
    const picked = buildJwPickedLessons();
    if (unit) {
      const merged = [...(unit.lessons || [])];
      const indexByName = new Map(merged.map((l, i) => [l.name, i]));
      picked.forEach((item) => {
        const existIdx = indexByName.get(item.name);
        if (existIdx == null) {
          indexByName.set(item.name, merged.length);
          merged.push(item);
        } else {
          merged[existIdx] = {
            ...merged[existIdx],
            ...item,
            homeworks: item.homeworks.length ? item.homeworks : merged[existIdx].homeworks || [],
            coursewares: item.coursewares.length
              ? item.coursewares
              : merged[existIdx].coursewares || [],
          };
        }
      });
      unit.lessons = merged;
      unit.open = true;
      if (picked.length) markScheduleDirty();
    }
    closeAddCourseModal();
    renderScheduleUnits();
    const doneText =
      jwAddCourseResourceType === "paper"
        ? "已添加试卷"
        : jwAddCourseResourceType === "courseware"
          ? "已添加课件"
          : "已添加课程视频";
    const emptyText =
      jwAddCourseResourceType === "paper"
        ? "未选择试卷"
        : jwAddCourseResourceType === "courseware"
          ? "未选择课件"
          : "未选择课程视频";
    showToast(picked.length ? doneText : emptyText);
  }

  function bindAddCourseModal() {
    $$("[data-close-add-course]").forEach((el) => {
      el.addEventListener("click", closeAddCourseModal);
    });
    $("#jw-add-course-ok")?.addEventListener("click", confirmAddCourse);
    $("#jw-add-course-resource-type")?.addEventListener("change", (e) => {
      setJwAddCourseResourceType(e.target.value);
    });
    $("#jw-add-course-search")?.addEventListener("input", renderAddCoursePicker);
    $("#jw-add-course-search-btn")?.addEventListener("click", renderAddCoursePicker);
    $("#jw-add-course-open-pick")?.addEventListener("click", () => {
      openAddModal("jwAddCourse");
    });
    $("#jw-add-course-group-toggle")?.addEventListener("click", () => {
      const group = $(".jw-add-course__group");
      const toggle = $("#jw-add-course-group-toggle");
      if (!group || !toggle) return;
      const collapsed = group.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
    $("#jw-add-course-list")?.addEventListener("change", (e) => {
      const input = e.target.closest("[data-add-course-id]");
      if (!input) return;
      const id = Number(input.dataset.addCourseId);
      if (input.checked) {
        if (addCourseSelected.size >= ADD_COURSE_MAX) {
          input.checked = false;
          showToast(`最多选择${ADD_COURSE_MAX}个`);
          return;
        }
        addCourseSelected.add(id);
      } else {
        addCourseSelected.delete(id);
      }
      renderAddCoursePicker();
    });
    $("#jw-add-course-chosen")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-add-course-remove]");
      if (!btn) return;
      addCourseSelected.delete(Number(btn.dataset.addCourseRemove));
      renderAddCoursePicker();
    });
  }

  function bindScheduleUnits() {
    const list = $("#jw-unit-list");
    if (!list) return;

    list.addEventListener("click", (e) => {
      const toggle = e.target.closest("[data-unit-toggle]");
      if (toggle) {
        const unit = scheduleUnits.find((u) => String(u.id) === toggle.dataset.unitToggle);
        if (unit) {
          unit.open = !unit.open;
          renderScheduleUnits();
        }
        return;
      }
      const editBtn = e.target.closest("[data-unit-edit]");
      if (editBtn) {
        e.stopPropagation();
        const id = editBtn.dataset.unitEdit;
        scheduleUnits.forEach((u) => {
          u.editing = String(u.id) === id;
        });
        renderScheduleUnits();
        return;
      }
      const delBtn = e.target.closest("[data-unit-del]");
      if (delBtn) {
        const id = Number(delBtn.dataset.unitDel);
        const idx = scheduleUnits.findIndex((u) => u.id === id);
        if (idx >= 0) {
          scheduleUnits.splice(idx, 1);
          markScheduleDirty();
        }
        renderScheduleUnits();
        return;
      }
      const addCourse = e.target.closest("[data-unit-add-course]");
      if (addCourse) {
        openAddCourseModal(Number(addCourse.dataset.unitAddCourse));
        return;
      }
      const lessonDel = e.target.closest("[data-lesson-del]");
      if (lessonDel) {
        const [uid, li] = lessonDel.dataset.lessonDel.split(":").map(Number);
        const unit = scheduleUnits.find((u) => u.id === uid);
        if (unit?.lessons) {
          unit.lessons.splice(li, 1);
          markScheduleDirty();
          renderScheduleUnits();
        }
      }
    });

    list.addEventListener("dragstart", (e) => {
      const row = e.target.closest(".jw-unit__lesson[draggable]");
      if (!row) return;
      dragLessonKey = `${row.dataset.unitId}:${row.dataset.lessonIndex}`;
      row.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    list.addEventListener("dragend", (e) => {
      const row = e.target.closest(".jw-unit__lesson");
      row?.classList.remove("is-dragging");
      dragLessonKey = null;
      $$(".jw-unit__lesson.is-drag-over").forEach((el) => el.classList.remove("is-drag-over"));
    });
    list.addEventListener("dragover", (e) => {
      const row = e.target.closest(".jw-unit__lesson[draggable]");
      if (!row || !dragLessonKey) return;
      e.preventDefault();
      $$(".jw-unit__lesson.is-drag-over").forEach((el) => {
        if (el !== row) el.classList.remove("is-drag-over");
      });
      row.classList.add("is-drag-over");
    });
    list.addEventListener("drop", (e) => {
      const row = e.target.closest(".jw-unit__lesson[draggable]");
      if (!row || !dragLessonKey) return;
      e.preventDefault();
      const [fromUnitId, fromIndex] = dragLessonKey.split(":").map(Number);
      const toUnitId = Number(row.dataset.unitId);
      const toIndex = Number(row.dataset.lessonIndex);
      if (fromUnitId !== toUnitId || fromIndex === toIndex) return;
      const unit = scheduleUnits.find((u) => u.id === fromUnitId);
      if (!unit?.lessons) return;
      const [moved] = unit.lessons.splice(fromIndex, 1);
      unit.lessons.splice(toIndex, 0, moved);
      renderScheduleUnits();
    });

    list.addEventListener("focusout", (e) => {
      const input = e.target.closest("[data-unit-name-input]");
      if (!input) return;
      const next = e.relatedTarget;
      if (next && input.closest(".jw-unit__title-wrap")?.contains(next)) return;
      const id = Number(input.dataset.unitNameInput);
      const unit = scheduleUnits.find((u) => u.id === id);
      if (!unit) return;
      const value = (input.value || "").trim();
      unit.customName = value || null;
      unit.editing = false;
      renderScheduleUnits();
    });

    list.addEventListener("keydown", (e) => {
      const input = e.target.closest("[data-unit-name-input]");
      if (!input) return;
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        const id = Number(input.dataset.unitNameInput);
        const unit = scheduleUnits.find((u) => u.id === id);
        if (unit) unit.editing = false;
        renderScheduleUnits();
      }
    });
  }

  function openPublishPage(row) {
    publishMode = "create";
    scheduleMode = "create";
    scheduleDirty = false;
    setGradeSubjectLocked(false);
    if (row && typeof row === "object" && row.id != null) {
      fillPublishForm(row);
      if (Array.isArray(row.scheduleUnits)) loadScheduleUnits(row.scheduleUnits);
    } else {
      resetPublishForm();
      scheduleUnits.length = 0;
    }
    setJiaowuNav("publish");
    setPublishStep(1);
    applyScheduleModeUI();
    const nameInput = $("#jw-pub-name");
    if (nameInput) syncPublishNameCount(nameInput);
  }

  const PUBLISH_TIPS = {
    learn: `<ol>
      <li>「按视频进度解锁」模式下，需按课时顺序完成视频学习后才能解锁下一课时。</li>
      <li>「按作业正确率解锁」模式下，需按课时顺序完成配套作业并正确率达标才能解锁下一课时。在此模式下，配套作业仅支持客观题且系统自动批改。每份试卷正确率可在排课页面设置。</li>
      <li>「自由选择课时学习」模式下，全部课时为解锁状态，可以随意选择课时进行学习。</li>
    </ol>`,
    progress:
      "选择“锁定”后，则不允许拖动课程进度条；选择“不锁定”，视频学习累计时长仍需要达到总时长的90%才算学完视频。",
    plan: "可为单元设置学习起止日期，用于安排学习计划。",
    "avg-ratio": `<div>计算方式：全部学生各课时有效观看时长之和 ÷ 全部学生对应课时总时长之和</div><div>指标含义：反应整体视频内容的观看比例，关注实际观看程度</div>`,
    "learn-rate": `<div>计算方式：视频观看时长达到90%的课时数/已上架课时数*100%</div><div>指标含义：关注完成达标情况</div>`,
    "hw-rate": "已完成作业数/作业总数*100%",
    "cw-view-rate": `<div>计算方式：全部学生已查看课件数之和 ÷ 全部学生应查看课件数之和 × 100%</div><div>指标含义：关注课件是否被使用</div>`,
    "cw-content-rate": `<div>计算方式：全部学生已查看的课件去重页数之和 ÷ 全部学生应查看课件总页数之和 × 100%</div><div>指标含义：关注资源内容被查看了多少</div>`,
    "total-duration":
      "所有已上架课时的时长总和。时长展示为友好近似值，所有进度、达标率均以后台原始秒级数据为准。",
    "study-duration":
      "学生学习时长总和。展示时长为友好近似值，进度、达标率以后台原始秒级数据为准。",
    "study-progress": "视频观看时长达到90%的课时数/已上架课时数",
    "hw-status": "已完成作业数 / 作业总数",
  };

  function hidePublishTip() {
    const tip = $("#jw-tip-pop");
    if (tip) tip.hidden = true;
    $$(".jw-tip-btn.is-open").forEach((btn) => btn.classList.remove("is-open"));
  }

  function showPublishTip(btn) {
    const tip = $("#jw-tip-pop");
    if (!tip || !btn) return;
    const key = btn.dataset.tip;
    const html = PUBLISH_TIPS[key];
    if (!html) return;
    hidePublishTip();
    tip.innerHTML = html;
    tip.hidden = false;
    btn.classList.add("is-open");
    const rect = btn.getBoundingClientRect();
    const tipW = tip.offsetWidth || 320;
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - tipW / 2),
      window.innerWidth - tipW - 8
    );
    tip.style.left = `${left}px`;
    tip.style.top = `${rect.bottom + 10}px`;
  }

  function syncPublishNameCount(input) {
    const count = $("#jw-pub-name-count");
    if (count) count.textContent = `${input.value.length} / 100`;
  }

  function bindPublishPage() {
    $("#jw-publish-btn")?.addEventListener("click", () => openPublishPage());
    $("#jw-publish-back")?.addEventListener("click", () => {
      if (scheduleMode === "edit") {
        exitScheduleEdit();
        return;
      }
      if (publishMode === "modify") {
        exitModifyBasic();
        return;
      }
      editingPublishId = null;
      publishMode = "create";
      scheduleMode = "create";
      scheduleDirty = false;
      setGradeSubjectLocked(false);
      applyScheduleModeUI();
      setJiaowuNav("manage");
    });
    $("#jw-pub-cancel")?.addEventListener("click", exitModifyBasic);
    $("#jw-pub-modify-save")?.addEventListener("click", saveModifyBasic);
    $("#jw-pub-save")?.addEventListener("click", savePublishDraft);
    $("#jw-pub-now")?.addEventListener("click", openPublishNowModal);
    $("#jw-pub-schedule")?.addEventListener("click", () => {
      if (publishMode === "modify") return;
      setPublishStep(2);
    });
    $("#jw-sched-prev")?.addEventListener("click", () => {
      if (scheduleMode === "edit" || publishMode === "modify") return;
      setPublishStep(1);
    });
    $("#jw-sched-save")?.addEventListener("click", savePublishDraft);
    $("#jw-sched-cancel")?.addEventListener("click", exitScheduleEdit);
    $("#jw-sched-publish")?.addEventListener("click", () => {
      if (scheduleMode === "edit" && !scheduleDirty) return;
      openPublishNowModal();
    });
    $("#jw-add-unit-btn")?.addEventListener("click", addScheduleUnit);
    bindScheduleUnits();
    $("#jw-pub-cover")?.addEventListener("click", () => {
      showToast("上传封面（原型示意）");
    });

    $("#jw-pub-name")?.addEventListener("input", (e) => {
      syncPublishNameCount(e.target);
      schedulePersist();
    });

    $("#jw-pub-lessons")?.addEventListener("input", (e) => {
      const el = e.target;
      el.value = el.value.replace(/[^\d]/g, "").replace(/^0+/, "");
      schedulePersist();
    });

    $("#jw-publish-form")?.addEventListener("change", schedulePersist);
    $("#jw-pub-intro")?.addEventListener("input", schedulePersist);

    $$('input[name="jw-learn-mode"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        const sub = $("#jw-learn-sub");
        const mode = $$('input[name="jw-learn-mode"]:checked')[0]?.value;
        if (sub) sub.hidden = mode === "free";
        schedulePersist();
      });
    });

    $("#pc-jiaowu-lib")?.addEventListener("mouseover", (e) => {
      const tipBtn = e.target.closest(".jw-tip-btn");
      if (!tipBtn) return;
      const from = e.relatedTarget;
      if (from && tipBtn.contains(from)) return;
      showPublishTip(tipBtn);
    });
    $("#pc-jiaowu-lib")?.addEventListener("mouseout", (e) => {
      const tipBtn = e.target.closest(".jw-tip-btn");
      if (!tipBtn) return;
      const to = e.relatedTarget;
      if (to && tipBtn.contains(to)) return;
      hidePublishTip();
    });
    window.addEventListener("scroll", hidePublishTip, true);
  }

  function closeAllOpMenus() {
    $$(".xb-op-menu").forEach((menu) => {
      menu.hidden = true;
    });
    $$("[data-op-caret]").forEach((btn) => btn.setAttribute("aria-expanded", "false"));
    $$(".xb-op.is-open").forEach((op) => op.classList.remove("is-open"));
  }

  function syncListChecks() {
    const checkAll = $("#xb-check-all");
    const moveBtn = $("#xb-move-btn");
    const rows = $$("#xb-course-tbody .xb-check");
    if (!checkAll || !moveBtn) return;
    const checkedCount = rows.filter((c) => c.checked).length;
    checkAll.checked = rows.length > 0 && checkedCount === rows.length;
    checkAll.indeterminate = checkedCount > 0 && checkedCount < rows.length;
    const anyChecked = checkedCount > 0;
    moveBtn.disabled = !anyChecked;
    moveBtn.classList.toggle("xb-btn--muted", !anyChecked);
    moveBtn.classList.toggle("is-active", anyChecked);
  }

  function bindTeacherListChecks() {
    const checkAll = $("#xb-check-all");
    const tbody = $("#xb-course-tbody");
    if (!checkAll || !tbody) return;

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".xb-op")) closeAllOpMenus();
    });

    checkAll.addEventListener("change", () => {
      $$("#xb-course-tbody .xb-check").forEach((c) => {
        c.checked = checkAll.checked;
      });
      checkAll.indeterminate = false;
      syncListChecks();
    });

    tbody.addEventListener("change", (e) => {
      if (e.target.matches(".xb-check")) syncListChecks();
    });

    tbody.addEventListener("click", (e) => {
      const addHw = e.target.closest("[data-list-add-hw]");
      if (addHw) {
        openHwModalForList(Number(addHw.dataset.listAddHw));
        return;
      }
      const addCw = e.target.closest("[data-list-add-cw]");
      if (addCw) {
        openCwModalForList(Number(addCw.dataset.listAddCw));
        return;
      }

      const submitBtn = e.target.closest("[data-submit-row]");
      if (submitBtn) {
        e.stopPropagation();
        closeAllOpMenus();
        openSubmitModal(Number(submitBtn.dataset.submitRow));
        return;
      }

      const menuItem = e.target.closest("[data-op-item]");
      if (menuItem) {
        e.stopPropagation();
        const action = menuItem.dataset.opItem;
        const rowIdFromTr = menuItem.closest("tr")?.dataset.rowId;
        const delRowId = menuItem.dataset.delRow || rowIdFromTr;
        const moveRowId = menuItem.dataset.moveRow;
        const editRowId = menuItem.dataset.editRow;
        const withdrawRowId = menuItem.dataset.withdrawRow;
        const auditRowId = menuItem.dataset.auditRow;
        closeAllOpMenus();
        if (action === "删除" && delRowId != null && delRowId !== "") {
          openDelModal(Number(delRowId));
        }
        if (action === "移动" && moveRowId) openMoveModal([Number(moveRowId)]);
        if (action === "编辑" && editRowId) openEditModal(Number(editRowId));
        if (action === "撤回" && withdrawRowId) openWithdrawModal(Number(withdrawRowId));
        if (action === "审核记录" && auditRowId) openAuditModal(Number(auditRowId));
        return;
      }

      const rowMove = e.target.closest("[data-row-move]");
      if (rowMove) {
        openMoveModal([Number(rowMove.dataset.rowMove)]);
        return;
      }

      const caret = e.target.closest("[data-op-caret]");
      if (caret) {
        e.stopPropagation();
        const op = caret.closest(".xb-op");
        const menu = op?.querySelector(".xb-op-menu");
        const willOpen = menu && menu.hidden;
        closeAllOpMenus();
        if (menu && willOpen) {
          menu.hidden = false;
          caret.setAttribute("aria-expanded", "true");
          op.classList.add("is-open");
        }
        return;
      }

      const editHw = e.target.closest("[data-list-edit-hw]");
      if (editHw) {
        e.preventDefault();
        activateNameInput(`[data-list-hw-name="${editHw.dataset.listEditHw}"]`);
        return;
      }
      const editCw = e.target.closest("[data-list-edit-cw]");
      if (editCw) {
        e.preventDefault();
        activateNameInput(`[data-list-cw-name="${editCw.dataset.listEditCw}"]`);
        return;
      }
      const removeHw = e.target.closest("[data-list-remove-hw]");
      if (removeHw) {
        const [rowId, key] = removeHw.dataset.listRemoveHw.split(":");
        const row = courseList.find((item) => String(item.id) === rowId);
        if (row) {
          row.homeworks = (row.homeworks || []).filter((hw) => hw.key !== key);
          refreshCourseViews();
        }
        return;
      }
      const removeCw = e.target.closest("[data-list-remove-cw]");
      if (removeCw) {
        const [rowId, key] = removeCw.dataset.listRemoveCw.split(":");
        const row = courseList.find((item) => String(item.id) === rowId);
        if (row) {
          row.coursewares = (row.coursewares || []).filter((cw) => cw.key !== key);
          refreshCourseViews();
        }
        return;
      }

      const hwName = e.target.closest("[data-list-hw-name]");
      if (hwName && hwName.readOnly) {
        openExternalUrl(PREVIEW.paper);
        return;
      }
      const cwName = e.target.closest("[data-list-cw-name]");
      if (cwName && cwName.readOnly) {
        openExternalUrl(PREVIEW.courseware);
      }
    });

    tbody.addEventListener(
      "blur",
      (e) => {
        const hwInput = e.target.closest("[data-list-hw-name]");
        if (hwInput && !hwInput.readOnly) {
          saveListAttachName(hwInput, "hw");
          return;
        }
        const cwInput = e.target.closest("[data-list-cw-name]");
        if (cwInput && !cwInput.readOnly) saveListAttachName(cwInput, "cw");
      },
      true
    );

    tbody.addEventListener("keydown", (e) => {
      const input = e.target.closest("[data-list-hw-name], [data-list-cw-name]");
      if (!input || input.readOnly) return;
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
    });
  }

  function saveListAttachName(input, type) {
    const raw = type === "hw" ? input.dataset.listHwName : input.dataset.listCwName;
    const [rowId, key] = (raw || "").split(":");
    const row = courseList.find((item) => String(item.id) === rowId);
    if (!row) return;
    const list = type === "hw" ? row.homeworks : row.coursewares;
    const item = (list || []).find((entry) => entry.key === key);
    if (!item) return;
    const next = input.value.trim() || item.name;
    item.name = next;
    input.value = next;
    input.readOnly = true;
    input.classList.remove("is-editing");
  }

  const LOCAL_KEY = "local";
  const RESOURCE_KEY = "resource";
  let addTab = "library";
  let addResourceType = "video";

  const localUpload = {
    fileName: "",
  };

  function syncLocalGroupOptions() {
    const select = $("#xb-local-group");
    if (!select) return;
    const current = select.value || "默认分组";
    const groups = ["默认分组", ...lessonGroups.filter((name) => name !== "默认分组")];
    select.innerHTML = groups
      .map((name) => `<option value="${escapeAttr(name)}">${escapeAttr(name)}</option>`)
      .join("");
    select.value = groups.includes(current) ? current : "默认分组";
  }

  function updateLocalNameCount() {
    const input = $("#xb-local-name");
    const count = $("#xb-local-name-count");
    if (!input || !count) return;
    count.textContent = `${input.value.length} / 50`;
  }

  function setLocalFile(fileName) {
    localUpload.fileName = fileName || "";
    const item = $("#xb-local-file-item");
    const nameEl = $("#xb-local-file-name");
    if (nameEl) nameEl.textContent = localUpload.fileName;
    if (item) item.hidden = !localUpload.fileName;
  }

  function resetLocalUploadForm() {
    localUpload.fileName = "";
    setLocalFile("");
    const nameInput = $("#xb-local-name");
    if (nameInput) nameInput.value = "";
    updateLocalNameCount();
    const subject = $("#xb-local-subject");
    if (subject) subject.value = "小学语文";
    syncLocalGroupOptions();
    delete hwByCourse[LOCAL_KEY];
    delete cwByCourse[LOCAL_KEY];
    renderLocalAttaches();
  }

  function renderLocalAttaches() {
    const hwWrap = $("#xb-local-hw-list");
    const cwWrap = $("#xb-local-cw-list");
    if (hwWrap) hwWrap.innerHTML = renderHwRows(LOCAL_KEY);
    if (cwWrap) cwWrap.innerHTML = renderCwRows(LOCAL_KEY);
  }

  function resourceFieldLabel(type) {
    if (type === "paper") return "选择试卷";
    if (type === "courseware") return "选择课件";
    return "选择微课";
  }

  function isTeacherResourceMode() {
    return addResourceType !== "video";
  }

  function syncResourceTypeUI() {
    const typeRow = $("#xb-resource-type-row");
    const typeSelect = $("#xb-resource-type");
    const localTypeRow = $("#xb-local-resource-type-row");
    const localTypeSelect = $("#xb-local-resource-type");
    const title = $("#xb-add-title");
    const label = $("#xb-pick-field-label");
    const localLabel = $("#xb-local-pick-field-label");
    const localFileRow = $("#xb-local-file-row");
    const localNameRow = $("#xb-local-name-row");
    const localResourcePick = $("#xb-local-resource-pick");
    const localHwRow = $("#xb-local-hw-row");
    const localCwRow = $("#xb-local-cw-row");
    const fromJw = addModalSource === "jwAddCourse";
    const isResourceOnly = addResourceType !== "video";
    // 教务端已在外层选好资源类型，内层弹窗与教师端一致但不重复展示类型选择
    if (typeRow) typeRow.hidden = fromJw;
    if (localTypeRow) localTypeRow.hidden = fromJw;
    if (typeSelect) typeSelect.value = addResourceType;
    if (localTypeSelect) localTypeSelect.value = addResourceType;
    if (title) {
      title.textContent = fromJw && !isResourceOnly ? "添加视频课" : "新增";
    }
    if (label) label.innerHTML = `<i class="xb-required">*</i>${resourceFieldLabel(addResourceType)}:`;
    if (localLabel) {
      localLabel.innerHTML = `<i class="xb-required">*</i>${resourceFieldLabel(addResourceType)}:`;
    }
    if (localFileRow) localFileRow.hidden = isResourceOnly;
    if (localNameRow) localNameRow.hidden = isResourceOnly;
    if (localResourcePick) localResourcePick.hidden = !isResourceOnly;
    if (localHwRow) localHwRow.hidden = isResourceOnly;
    if (localCwRow) localCwRow.hidden = isResourceOnly;
  }

  function setResourceType(type) {
    const next = type === "paper" || type === "courseware" ? type : "video";
    if (next === addResourceType) return;
    addResourceType = next;
    pickState.confirmed = [];
    pickState.selected = new Set(PICK_COURSES.length ? [0] : []);
    delete hwByCourse[RESOURCE_KEY];
    delete cwByCourse[RESOURCE_KEY];
    if (next !== "video") {
      delete hwByCourse[LOCAL_KEY];
      delete cwByCourse[LOCAL_KEY];
    }
    syncResourceTypeUI();
    renderSelectedCourses();
    renderLocalResourceList();
    renderLocalAttaches();
  }

  function renderLocalResourceList() {
    const wrap = $("#xb-local-selected-resources");
    if (!wrap) return;
    if (addResourceType === "video") {
      wrap.innerHTML = "";
      return;
    }
    wrap.innerHTML =
      addResourceType === "paper" ? renderHwRows(RESOURCE_KEY) : renderCwRows(RESOURCE_KEY);
  }

  function openAddModal(source) {
    const modal = $("#xb-add-modal");
    if (!modal) return;
    addModalSource = source === "jwAddCourse" ? "jwAddCourse" : "courseList";
    pickState.confirmed = [];
    pickState.selected = new Set(PICK_COURSES.length ? [0] : []);
    Object.keys(hwByCourse).forEach((key) => delete hwByCourse[key]);
    Object.keys(cwByCourse).forEach((key) => delete cwByCourse[key]);
    renderSelectedCourses();
    resetLocalUploadForm();
    addResourceType =
      addModalSource === "jwAddCourse" ? jwAddCourseResourceType : "video";
    syncResourceTypeUI();
    renderLocalResourceList();
    setJwStackClass(addModalSource === "jwAddCourse");
    modal.hidden = false;
    modal.classList.add("is-open");
    setAddTab("library");
  }

  function closeAddModal() {
    closeCwModal();
    closeHwModal();
    closePickModal();
    const modal = $("#xb-add-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.hidden = true;
    setJwStackClass(false);
    addModalSource = "courseList";
  }

  function confirmAddCoursesForJwResourceOnly() {
    const isPaper = addResourceType === "paper";
    const ids = (isPaper ? hwByCourse[RESOURCE_KEY] : cwByCourse[RESOURCE_KEY]) || [];
    if (!ids.length) {
      closeAddModal();
      return [];
    }
    // 直接勾选资源库弹窗里同一批试卷/课件，供左侧待选列表使用
    return [...ids].sort((a, b) => a - b);
  }

  function confirmAddCoursesForJw() {
    let addedIndexes = [];
    if (addResourceType === "paper" || addResourceType === "courseware") {
      addedIndexes = confirmAddCoursesForJwResourceOnly();
    } else if (addTab === "local") {
      if (!localUpload.fileName) {
        window.alert("请先上传视频文件");
        return;
      }
      const nameInput = $("#xb-local-name");
      const lessonName = (nameInput?.value || "").trim();
      if (!lessonName) {
        window.alert("请输入单课名称");
        return;
      }
      const hwNames = collectAttachNames(hwByCourse[LOCAL_KEY], HW_PAPERS, "未命名试卷");
      const cwNames = collectAttachNames(cwByCourse[LOCAL_KEY], CW_ITEMS, "未命名课件");
      addedIndexes.push(
        ensureAddCourseVideo(lessonName, mockVideoDuration(lessonName), hwNames, cwNames, "video")
      );
    } else {
      if (!pickState.confirmed.length) {
        closeAddModal();
        return;
      }
      pickState.confirmed.forEach((videoId) => {
        const name = PICK_COURSES[videoId];
        if (!name) return;
        const hwNames = collectAttachNames(hwByCourse[videoId], HW_PAPERS, "未命名试卷");
        const cwNames = collectAttachNames(cwByCourse[videoId], CW_ITEMS, "未命名课件");
        addedIndexes.push(
          ensureAddCourseVideo(name, mockVideoDuration(name), hwNames, cwNames, "video")
        );
      });
    }
    addedIndexes.forEach((idx) => selectAddCourseVideo(idx));
    closeAddModal();
    renderAddCoursePicker();
    const okText =
      addResourceType === "paper"
        ? "已添加到可选试卷并选中"
        : addResourceType === "courseware"
          ? "已添加到可选课件并选中"
          : "已添加到可选视频并选中";
    const emptyText =
      addResourceType === "paper"
        ? "未添加试卷"
        : addResourceType === "courseware"
          ? "未添加课件"
          : "未添加视频";
    showToast(addedIndexes.length ? okText : emptyText);
  }

  function setAddTab(tab) {
    addTab = tab === "local" ? "local" : "library";
    $$("[data-add-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.addTab === addTab);
    });
    $$("[data-add-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.addPanel !== addTab;
    });
    if (addTab === "local") {
      syncLocalGroupOptions();
      syncResourceTypeUI();
      renderLocalAttaches();
      renderLocalResourceList();
    }
  }

  function subjectToShort(stageSubject) {
    if (!stageSubject) return "语文";
    if (stageSubject.includes("数学")) return "数学";
    if (stageSubject.includes("英语")) return "英语";
    if (stageSubject.includes("语文")) return "语文";
    return stageSubject.slice(-2);
  }

  function confirmLocalUpload() {
    if (!localUpload.fileName) {
      window.alert("请先上传视频文件");
      return;
    }
    const nameInput = $("#xb-local-name");
    const lessonName = (nameInput?.value || "").trim();
    if (!lessonName) {
      window.alert("请输入单课名称");
      return;
    }
    const stageSubject = $("#xb-local-subject")?.value || "小学语文";
    const groupName = $("#xb-local-group")?.value || "";
    const hwIds = hwByCourse[LOCAL_KEY] || [];
    const cwIds = cwByCourse[LOCAL_KEY] || [];
    const stamp = nowText();
    courseList.unshift({
      id: courseListSeq++,
      subject: subjectToShort(stageSubject),
      stageSubject,
      videoName: lessonName,
      resourceType: "video",
      groupName: groupName === "默认分组" ? "" : groupName,
      homeworks: hwIds.map((hwId) => ({
        key: `hw-local-${hwId}-${Date.now()}`,
        paperIndex: hwId,
        name: HW_PAPERS[hwId]?.name || "未命名试卷",
      })),
      coursewares: cwIds.map((cwId) => ({
        key: `cw-local-${cwId}-${Date.now()}`,
        cwIndex: cwId,
        name: CW_ITEMS[cwId]?.name || "未命名课件",
      })),
      maker: "zfy",
      audit: "无",
      createdAt: stamp,
      updatedAt: stamp,
      status: "making",
      action: "制作",
      auditRecords: [],
    });
    refreshCourseViews();
    closeAddModal();
  }

  function confirmAddCourses() {
    if (addModalSource === "jwAddCourse") {
      confirmAddCoursesForJw();
      return;
    }
    if (addResourceType === "paper" || addResourceType === "courseware") {
      confirmResourceOnlyAdd();
      return;
    }
    if (addTab === "local") {
      confirmLocalUpload();
      return;
    }
    if (!pickState.confirmed.length) {
      closeAddModal();
      return;
    }
    const stamp = nowText();
    const newRows = pickState.confirmed.map((videoId) => {
      const hwIds = hwByCourse[videoId] || [];
      const cwIds = cwByCourse[videoId] || [];
      return {
        id: courseListSeq++,
        subject: "语文",
        stageSubject: "小学语文",
        videoName: PICK_COURSES[videoId],
        resourceType: "video",
        groupName: "",
        maker: "zfy",
        homeworks: hwIds.map((hwId) => ({
          key: `hw-${videoId}-${hwId}-${Date.now()}`,
          paperIndex: hwId,
          name: HW_PAPERS[hwId]?.name || "未命名试卷",
        })),
        coursewares: cwIds.map((cwId) => ({
          key: `cw-${videoId}-${cwId}-${Date.now()}`,
          cwIndex: cwId,
          name: CW_ITEMS[cwId]?.name || "未命名课件",
        })),
        audit: "无",
        createdAt: stamp,
        updatedAt: stamp,
        status: "making",
        action: "制作",
        auditRecords: [],
      };
    });
    courseList.unshift(...newRows);
    refreshCourseViews();
    closeAddModal();
  }

  function confirmResourceOnlyAdd() {
    const isPaper = addResourceType === "paper";
    const ids = (isPaper ? hwByCourse[RESOURCE_KEY] : cwByCourse[RESOURCE_KEY]) || [];
    if (!ids.length) {
      closeAddModal();
      return;
    }
    const stamp = nowText();
    const localStageSubject = $("#xb-local-subject")?.value || "";
    const localGroupName = $("#xb-local-group")?.value || "";
    const useLocalMeta = addTab === "local";
    const first = isPaper ? HW_PAPERS[ids[0]] : CW_ITEMS[ids[0]];
    const stageSubject = useLocalMeta
      ? localStageSubject || "小学语文"
      : first?.subject || "小学语文";
    const displayName = isPaper
      ? first?.name || "未命名试卷"
      : first?.name || "未命名课件";
    const homeworks = isPaper
      ? ids.map((itemId) => ({
          key: `hw-res-${itemId}-${Date.now()}`,
          paperIndex: itemId,
          name: HW_PAPERS[itemId]?.name || "未命名试卷",
        }))
      : [];
    const coursewares = isPaper
      ? []
      : ids.map((itemId) => ({
          key: `cw-res-${itemId}-${Date.now()}`,
          cwIndex: itemId,
          name: CW_ITEMS[itemId]?.name || "未命名课件",
        }));
    courseList.unshift({
      id: courseListSeq++,
      subject: subjectToShort(stageSubject),
      stageSubject,
      videoName: displayName,
      resourceType: isPaper ? "paper" : "courseware",
      groupName: useLocalMeta && localGroupName !== "默认分组" ? localGroupName : "",
      maker: "zfy",
      homeworks,
      coursewares,
      audit: "无",
      createdAt: stamp,
      updatedAt: stamp,
      status: "making",
      action: "制作",
      auditRecords: [],
    });
    refreshCourseViews();
    closeAddModal();
  }

  function parseAttachKey(raw) {
    const text = String(raw || "");
    const idx = text.indexOf(":");
    if (idx < 0) return { courseId: text, itemId: NaN };
    const coursePart = text.slice(0, idx);
    const itemPart = text.slice(idx + 1);
    return {
      courseId: coursePart === LOCAL_KEY || coursePart === RESOURCE_KEY ? coursePart : Number(coursePart),
      itemId: Number(itemPart),
    };
  }

  function bindAddModal() {
    $("#xb-add-btn")?.addEventListener("click", openAddModal);
    $$("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", closeAddModal);
    });
    $("#xb-add-ok")?.addEventListener("click", confirmAddCourses);
    $("#xb-resource-type")?.addEventListener("change", (e) => setResourceType(e.target.value));
    $("#xb-local-resource-type")?.addEventListener("change", (e) => setResourceType(e.target.value));
    $$("[data-add-tab]").forEach((btn) => {
      btn.addEventListener("click", () => setAddTab(btn.dataset.addTab));
    });

    $("#xb-local-open-pick")?.addEventListener("click", () => {
      if (addResourceType === "paper") {
        openHwModal(RESOURCE_KEY);
        return;
      }
      if (addResourceType === "courseware") {
        openCwModal(RESOURCE_KEY);
        return;
      }
    });

    $("#xb-local-selected-resources")?.addEventListener("click", (e) => {
      const removeHw = e.target.closest("[data-remove-hw]");
      if (removeHw) {
        const { courseId, itemId } = parseAttachKey(removeHw.dataset.removeHw);
        hwByCourse[courseId] = (hwByCourse[courseId] || []).filter((id) => id !== itemId);
        renderLocalResourceList();
        renderSelectedCourses();
        return;
      }
      const removeCw = e.target.closest("[data-remove-cw]");
      if (removeCw) {
        const { courseId, itemId } = parseAttachKey(removeCw.dataset.removeCw);
        cwByCourse[courseId] = (cwByCourse[courseId] || []).filter((id) => id !== itemId);
        renderLocalResourceList();
        renderSelectedCourses();
        return;
      }
      const editHw = e.target.closest("[data-edit-hw]");
      if (editHw) {
        activateNameInput(`[data-hw-name-input="${editHw.dataset.editHw}"]`);
        return;
      }
      const editCw = e.target.closest("[data-edit-cw]");
      if (editCw) {
        activateNameInput(`[data-cw-name-input="${editCw.dataset.editCw}"]`);
      }
    });
    $("#xb-local-selected-resources")?.addEventListener("blur", (e) => {
      const hwInput = e.target.closest("[data-hw-name-input]");
      if (hwInput) {
        saveHwName(hwInput);
        return;
      }
      const cwInput = e.target.closest("[data-cw-name-input]");
      if (cwInput) saveCwName(cwInput);
    }, true);
    $("#xb-local-selected-resources")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const hwInput = e.target.closest("[data-hw-name-input]");
      if (hwInput) {
        e.preventDefault();
        saveHwName(hwInput);
        return;
      }
      const cwInput = e.target.closest("[data-cw-name-input]");
      if (cwInput) {
        e.preventDefault();
        saveCwName(cwInput);
      }
    });

    $("#xb-local-upload")?.addEventListener("click", () => {
      // 原型：模拟本地上传成功，回显截图效果
      setLocalFile("小分辨率的视频.mp4");
      const nameInput = $("#xb-local-name");
      if (nameInput && !nameInput.value.trim()) {
        nameInput.value = "自适应视频";
        updateLocalNameCount();
      }
    });
    $("#xb-local-file-input")?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      setLocalFile(file.name);
      const nameInput = $("#xb-local-name");
      if (nameInput && !nameInput.value.trim()) {
        nameInput.value = file.name.replace(/\.[^.]+$/, "") || "自适应视频";
        updateLocalNameCount();
      }
      e.target.value = "";
    });
    $("#xb-local-file-remove")?.addEventListener("click", () => setLocalFile(""));
    $("#xb-local-name")?.addEventListener("input", updateLocalNameCount);
    $("#xb-local-add-hw")?.addEventListener("click", () => openHwModal(LOCAL_KEY));
    $("#xb-local-add-cw")?.addEventListener("click", () => openCwModal(LOCAL_KEY));

    $("#xb-add-panel-local")?.addEventListener("click", (e) => {
      const removeHw = e.target.closest("[data-remove-hw]");
      if (removeHw) {
        const { courseId, itemId } = parseAttachKey(removeHw.dataset.removeHw);
        hwByCourse[courseId] = (hwByCourse[courseId] || []).filter((id) => id !== itemId);
        renderLocalAttaches();
        return;
      }
      const removeCw = e.target.closest("[data-remove-cw]");
      if (removeCw) {
        const { courseId, itemId } = parseAttachKey(removeCw.dataset.removeCw);
        cwByCourse[courseId] = (cwByCourse[courseId] || []).filter((id) => id !== itemId);
        renderLocalAttaches();
        return;
      }
      const editHw = e.target.closest("[data-edit-hw]");
      if (editHw) {
        activateNameInput(`[data-hw-name-input="${editHw.dataset.editHw}"]`);
        return;
      }
      const editCw = e.target.closest("[data-edit-cw]");
      if (editCw) activateNameInput(`[data-cw-name-input="${editCw.dataset.editCw}"]`);
    });
  }

  const PICK_COURSES = [
    "wmv: 儿童歌曲-小龙人",
    "wmv: 儿童歌曲 - 小龙人",
    "flv: 测试分析",
    "avi: 03 jmeter的两种录制方法",
    "屏幕录制 2025-12-22 164212",
    "大字",
    "chloe_yacht_departure_tracking_shot",
    "预习报告第3题",
    "1",
    "合拍视频1",
    "测试视频2",
  ];

  const pickState = {
    selected: new Set([0]),
    confirmed: [],
  };

  function openPickModal() {
    const modal = $("#xb-pick-modal");
    if (!modal) return;
    if (pickState.confirmed.length) {
      pickState.selected = new Set(pickState.confirmed);
    }
    modal.hidden = false;
    modal.classList.add("is-open");
    renderPickList();
  }

  function closePickModal() {
    const modal = $("#xb-pick-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function confirmPick() {
    pickState.confirmed = [...pickState.selected].sort((a, b) => a - b);
    renderSelectedCourses();
    closePickModal();
  }

  const FILE_ICON = `<svg class="xb-course-card__icon" viewBox="0 0 18 18" aria-hidden="true">
    <rect x="3" y="2" width="12" height="14" rx="1.5" fill="#f5c16c"/>
    <rect x="5" y="5" width="8" height="1.4" rx="0.5" fill="#fff"/>
    <rect x="5" y="8" width="6" height="1.4" rx="0.5" fill="#fff"/>
    <path d="M11 2l4 4h-2.5A1.5 1.5 0 0 1 11 4.5V2z" fill="#e0a84a"/>
  </svg>`;

  const HW_ICON = `<span class="xb-attach-badge xb-attach-badge--hw" aria-hidden="true">
    <svg width="14" height="16" viewBox="0 0 14 16"><rect x="1" y="1" width="12" height="14" rx="1.5" fill="#e8f5e9" stroke="#52c41a"/><path d="M4 5h6M4 8h6M4 11h4" stroke="#52c41a" stroke-width="1.2"/></svg>
    <i>试卷</i>
  </span>`;

  const CW_ICON = `<span class="xb-attach-badge xb-attach-badge--cw" aria-hidden="true">
    <svg width="14" height="16" viewBox="0 0 14 16"><rect x="1" y="1" width="12" height="14" rx="1.5" fill="#fff7e6" stroke="#fa8c16"/><path d="M4 5h6M4 8h6M4 11h4" stroke="#fa8c16" stroke-width="1.2"/></svg>
    <i>课件</i>
  </span>`;

  const EDIT_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M8.6 2.4l3 3L4.5 12H1.5v-3L8.6 2.4z" stroke="currentColor" stroke-width="1.2" fill="none"/>
  </svg>`;

  const DEL_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2.5 4h9M5.2 4V2.8h3.6V4M3.6 4l.5 8h5.8l.5-8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;

  // courseId -> homework / courseware ids
  const hwByCourse = {};
  const cwByCourse = {};

  function escapeAttr(text) {
    return String(text).replace(/"/g, "&quot;");
  }

  function renderHwRows(courseId) {
    const ids = hwByCourse[courseId] || [];
    if (!ids.length) return "";
    return ids
      .map((hwId) => {
        const paper = HW_PAPERS[hwId];
        if (!paper) return "";
        return `<div class="xb-attach-row">
          ${HW_ICON}
          <input
            class="xb-course-card__name"
            type="text"
            value="${escapeAttr(paper.name)}"
            data-hw-name-input="${courseId}:${hwId}"
            readonly
          />
          <div class="xb-course-card__ops">
            <button type="button" data-edit-hw="${courseId}:${hwId}" aria-label="编辑">${EDIT_ICON}</button>
            <button type="button" data-remove-hw="${courseId}:${hwId}" aria-label="删除">${DEL_ICON}</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderCwRows(courseId) {
    const ids = cwByCourse[courseId] || [];
    if (!ids.length) return "";
    return ids
      .map((cwId) => {
        const item = CW_ITEMS[cwId];
        if (!item) return "";
        return `<div class="xb-attach-row">
          ${CW_ICON}
          <input
            class="xb-course-card__name"
            type="text"
            value="${escapeAttr(item.name)}"
            data-cw-name-input="${courseId}:${cwId}"
            readonly
          />
          <div class="xb-course-card__ops">
            <button type="button" data-edit-cw="${courseId}:${cwId}" aria-label="编辑">${EDIT_ICON}</button>
            <button type="button" data-remove-cw="${courseId}:${cwId}" aria-label="删除">${DEL_ICON}</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderSelectedCourses() {
    const wrap = $("#xb-selected-courses");
    if (!wrap) return;
    if (addResourceType === "paper") {
      wrap.innerHTML = renderHwRows(RESOURCE_KEY);
      return;
    }
    if (addResourceType === "courseware") {
      wrap.innerHTML = renderCwRows(RESOURCE_KEY);
      return;
    }
    wrap.innerHTML = pickState.confirmed
      .map((id) => {
        const name = PICK_COURSES[id];
        return `<div class="xb-course-card" data-course-id="${id}">
          <div class="xb-course-card__title">
            ${FILE_ICON}
            <input
              class="xb-course-card__name"
              type="text"
              value="${escapeAttr(name)}"
              data-name-input="${id}"
              readonly
            />
            <div class="xb-course-card__ops">
              <button type="button" data-edit-course="${id}" aria-label="编辑">${EDIT_ICON}</button>
              <button type="button" data-remove-course="${id}" aria-label="删除">${DEL_ICON}</button>
            </div>
          </div>
          <div class="xb-course-card__body">
            <div class="xb-course-card__meta">
              <span>配套作业:</span>
              <button type="button" class="xb-link-add" data-add-homework="${id}">
                <span class="xb-link-add__plus">+</span>
                添加
              </button>
            </div>
            ${renderHwRows(id)}
            <div class="xb-course-card__meta">
              <span>配套课件:</span>
              <button type="button" class="xb-link-add" data-add-courseware="${id}">
                <span class="xb-link-add__plus">+</span>
                添加
              </button>
            </div>
            ${renderCwRows(id)}
          </div>
        </div>`;
      })
      .join("");
  }

  function activateNameInput(selector) {
    const input = $(selector);
    if (!input) return;
    input.readOnly = false;
    input.classList.add("is-editing");
    input.focus();
    input.select();
  }

  function saveCourseName(input) {
    if (!input || input.readOnly) return;
    const id = Number(input.dataset.nameInput);
    const next = input.value.trim() || PICK_COURSES[id];
    PICK_COURSES[id] = next;
    input.value = next;
    input.readOnly = true;
    input.classList.remove("is-editing");
  }

  function saveHwName(input) {
    if (!input || input.readOnly) return;
    const key = input.dataset.hwNameInput || "";
    const hwId = Number(key.split(":")[1]);
    const paper = HW_PAPERS[hwId];
    if (!paper) return;
    const next = input.value.trim() || paper.name;
    paper.name = next;
    input.value = next;
    input.readOnly = true;
    input.classList.remove("is-editing");
  }

  function saveCwName(input) {
    if (!input || input.readOnly) return;
    const key = input.dataset.cwNameInput || "";
    const cwId = Number(key.split(":")[1]);
    const item = CW_ITEMS[cwId];
    if (!item) return;
    const next = input.value.trim() || item.name;
    item.name = next;
    input.value = next;
    input.readOnly = true;
    input.classList.remove("is-editing");
  }

  function filteredPickCourses() {
    const keyword = ($("#xb-pick-search")?.value || "").trim().toLowerCase();
    return PICK_COURSES.map((name, index) => ({ name, index })).filter((item) =>
      item.name.toLowerCase().includes(keyword)
    );
  }

  function renderPickList() {
    const list = $("#xb-pick-list");
    const chosen = $("#xb-pick-chosen");
    const count = $("#xb-pick-count");
    const checkAll = $("#xb-pick-all");
    if (!list || !chosen || !count) return;

    const items = filteredPickCourses();
    list.innerHTML = items
      .map(
        (item) => `
      <li>
        <label class="xb-pick__item">
          <input type="checkbox" data-pick-id="${item.index}" ${
          pickState.selected.has(item.index) ? "checked" : ""
        } />
          <span>${item.name}</span>
        </label>
      </li>`
      )
      .join("");

    const selectedItems = PICK_COURSES.map((name, index) => ({ name, index })).filter((item) =>
      pickState.selected.has(item.index)
    );
    count.textContent = `已选择 (${selectedItems.length})`;
    chosen.innerHTML = selectedItems
      .map(
        (item) => `
      <li class="xb-pick__chip">
        <span>${item.name}</span>
        <button type="button" class="xb-pick__remove" data-remove-id="${item.index}" aria-label="移除">×</button>
      </li>`
      )
      .join("");

    if (checkAll) {
      const visibleIds = items.map((item) => item.index);
      const checkedVisible = visibleIds.filter((id) => pickState.selected.has(id)).length;
      checkAll.checked = visibleIds.length > 0 && checkedVisible === visibleIds.length;
      checkAll.indeterminate = checkedVisible > 0 && checkedVisible < visibleIds.length;
    }
  }

  function bindPickModal() {
    $("#xb-open-pick")?.addEventListener("click", () => {
      if (addResourceType === "paper") {
        openHwModal(RESOURCE_KEY);
        return;
      }
      if (addResourceType === "courseware") {
        openCwModal(RESOURCE_KEY);
        return;
      }
      openPickModal();
    });
    $$("[data-close-pick]").forEach((el) => {
      el.addEventListener("click", closePickModal);
    });
    $("#xb-pick-ok")?.addEventListener("click", confirmPick);

    $("#xb-pick-search")?.addEventListener("input", renderPickList);
    $(".xb-pick__search-btn")?.addEventListener("click", renderPickList);

    $("#xb-pick-all")?.addEventListener("change", (e) => {
      const checked = e.target.checked;
      filteredPickCourses().forEach((item) => {
        if (checked) pickState.selected.add(item.index);
        else pickState.selected.delete(item.index);
      });
      renderPickList();
    });

    $("#xb-pick-clear")?.addEventListener("click", () => {
      pickState.selected.clear();
      renderPickList();
    });

    $("#xb-pick-list")?.addEventListener("change", (e) => {
      const input = e.target.closest("[data-pick-id]");
      if (!input) return;
      const id = Number(input.dataset.pickId);
      if (input.checked) pickState.selected.add(id);
      else pickState.selected.delete(id);
      renderPickList();
    });

    $("#xb-pick-chosen")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove-id]");
      if (!btn) return;
      pickState.selected.delete(Number(btn.dataset.removeId));
      renderPickList();
    });

    $("#xb-selected-courses")?.addEventListener("click", (e) => {
      const hwBtn = e.target.closest("[data-add-homework]");
      if (hwBtn) {
        openHwModal(Number(hwBtn.dataset.addHomework));
        return;
      }
      const cwBtn = e.target.closest("[data-add-courseware]");
      if (cwBtn) {
        openCwModal(Number(cwBtn.dataset.addCourseware));
        return;
      }
      const removeHw = e.target.closest("[data-remove-hw]");
      if (removeHw) {
        const { courseId, itemId } = parseAttachKey(removeHw.dataset.removeHw);
        hwByCourse[courseId] = (hwByCourse[courseId] || []).filter((id) => id !== itemId);
        renderSelectedCourses();
        return;
      }
      const removeCw = e.target.closest("[data-remove-cw]");
      if (removeCw) {
        const { courseId, itemId } = parseAttachKey(removeCw.dataset.removeCw);
        cwByCourse[courseId] = (cwByCourse[courseId] || []).filter((id) => id !== itemId);
        renderSelectedCourses();
        return;
      }
      const editHw = e.target.closest("[data-edit-hw]");
      if (editHw) {
        activateNameInput(`[data-hw-name-input="${editHw.dataset.editHw}"]`);
        return;
      }
      const editCw = e.target.closest("[data-edit-cw]");
      if (editCw) {
        activateNameInput(`[data-cw-name-input="${editCw.dataset.editCw}"]`);
        return;
      }
      const removeBtn = e.target.closest("[data-remove-course]");
      if (removeBtn) {
        const id = Number(removeBtn.dataset.removeCourse);
        pickState.confirmed = pickState.confirmed.filter((item) => item !== id);
        pickState.selected.delete(id);
        delete hwByCourse[id];
        delete cwByCourse[id];
        renderSelectedCourses();
        return;
      }
      const editBtn = e.target.closest("[data-edit-course]");
      if (editBtn) {
        activateNameInput(`[data-name-input="${editBtn.dataset.editCourse}"]`);
      }
    });

    $("#xb-selected-courses")?.addEventListener("blur", (e) => {
      const courseInput = e.target.closest("[data-name-input]");
      if (courseInput) {
        saveCourseName(courseInput);
        return;
      }
      const hwInput = e.target.closest("[data-hw-name-input]");
      if (hwInput) {
        saveHwName(hwInput);
        return;
      }
      const cwInput = e.target.closest("[data-cw-name-input]");
      if (cwInput) saveCwName(cwInput);
    }, true);

    $("#xb-selected-courses")?.addEventListener("keydown", (e) => {
      const input = e.target.closest("[data-name-input], [data-hw-name-input], [data-cw-name-input]");
      if (!input || input.readOnly) return;
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
    });
  }

  const HW_PAPERS = [
    { subject: "化学", name: "2026-09-24化学试卷", author: "zfy", type: "普通试卷", subjective: "有", handwriting: "无", cite: 0 },
    { subject: "数学", name: "填空题.png", author: "zfy", type: "普通试卷", subjective: "无", handwriting: "无", cite: 1 },
    { subject: "语文", name: "2026-03-10语文阅读理解", author: "zfy", type: "普通试卷", subjective: "有", handwriting: "有", cite: 2 },
    { subject: "历史", name: "七年级历史上册单元测", author: "zfy", type: "普通试卷", subjective: "有", handwriting: "无", cite: 0 },
    { subject: "数学", name: "二次函数专项练习", author: "zfy", type: "普通试卷", subjective: "有", handwriting: "有", cite: 3 },
    { subject: "英语", name: "Unit1 词汇检测卷", author: "zfy", type: "普通试卷", subjective: "无", handwriting: "无", cite: 1 },
    { subject: "物理", name: "力学综合测试", author: "zfy", type: "普通试卷", subjective: "有", handwriting: "无", cite: 0 },
    { subject: "化学", name: "酸碱盐基础卷", author: "zfy", type: "普通试卷", subjective: "有", handwriting: "有", cite: 2 },
  ];

  const hwState = {
    mode: "add", // add | list
    courseId: null,
    listRowId: null,
    selected: new Set([0]),
  };

  function resolveHwSelectedIds(homeworks) {
    const selected = new Set();
    (homeworks || []).forEach((hw) => {
      if (typeof hw.paperIndex === "number") {
        selected.add(hw.paperIndex);
        return;
      }
      const idx = HW_PAPERS.findIndex((paper) => paper.name === hw.name);
      if (idx >= 0) selected.add(idx);
    });
    return selected;
  }

  function openHwModal(courseId) {
    const modal = $("#xb-hw-modal");
    if (!modal) return;
    hwState.mode = "add";
    hwState.courseId = courseId;
    hwState.listRowId = null;
    const existed = hwByCourse[courseId] || [];
    hwState.selected = new Set(existed.length ? existed : [0]);
    renderHwTable();
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function openHwModalForList(rowId) {
    const modal = $("#xb-hw-modal");
    const row = courseList.find((item) => item.id === rowId);
    if (!modal || !row) return;
    hwState.mode = "list";
    hwState.courseId = null;
    hwState.listRowId = rowId;
    hwState.selected = resolveHwSelectedIds(row.homeworks);
    renderHwTable();
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeHwModal() {
    const modal = $("#xb-hw-modal");
    if (!modal) return;
    hwState.mode = "add";
    hwState.listRowId = null;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function confirmHw() {
    if (hwState.mode === "list") {
      const row = courseList.find((item) => item.id === hwState.listRowId);
      if (row) {
        row.homeworks = [...hwState.selected].sort((a, b) => a - b).map((hwId) => ({
          key: `hw-list-${row.id}-${hwId}-${Date.now()}`,
          paperIndex: hwId,
          name: HW_PAPERS[hwId]?.name || "未命名试卷",
        }));
        row.updatedAt = nowText();
      }
      closeHwModal();
      refreshCourseViews();
      return;
    }
    const courseId = hwState.courseId;
    if (courseId == null) {
      closeHwModal();
      return;
    }
    hwByCourse[courseId] = [...hwState.selected].sort((a, b) => a - b);
    if (courseId === LOCAL_KEY) renderLocalAttaches();
    else {
      renderSelectedCourses();
      renderLocalResourceList();
    }
    closeHwModal();
  }

  function filteredHwPapers() {
    const keyword = ($("#xb-hw-search")?.value || "").trim().toLowerCase();
    return HW_PAPERS.map((item, index) => ({ ...item, index })).filter((item) =>
      item.name.toLowerCase().includes(keyword)
    );
  }

  function renderHwTable() {
    const tbody = $("#xb-hw-tbody");
    if (!tbody) return;
    const items = filteredHwPapers();
    tbody.innerHTML = items
      .map(
        (item) => `<tr>
        <td class="col-pick">
          <input type="checkbox" class="xb-check" data-hw-id="${item.index}" ${
          hwState.selected.has(item.index) ? "checked" : ""
        } />
        </td>
        <td>${item.subject}</td>
        <td>${item.name}</td>
        <td>${item.author}</td>
        <td>${item.type}</td>
        <td>${item.subjective}</td>
        <td>${item.handwriting}</td>
        <td>${item.cite}</td>
        <td><button type="button" class="xb-link-preview">预览</button></td>
      </tr>`
      )
      .join("");
  }

  function bindHwModal() {
    $$("[data-close-hw]").forEach((el) => {
      el.addEventListener("click", closeHwModal);
    });
    $("#xb-hw-ok")?.addEventListener("click", confirmHw);
    $("#xb-hw-query")?.addEventListener("click", renderHwTable);
    $("#xb-hw-search")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        renderHwTable();
      }
    });
    $("#xb-hw-tbody")?.addEventListener("change", (e) => {
      const input = e.target.closest("[data-hw-id]");
      if (!input) return;
      const id = Number(input.dataset.hwId);
      if (input.checked) hwState.selected.add(id);
      else hwState.selected.delete(id);
    });
  }

  const CW_ITEMS = [
    { subject: "小学语文", name: "lesson_0707_153848_422", author: "zfy", docType: "视频", cite: 0 },
    { subject: "小学语文", name: "lesson_0707_153848_423", author: "zfy", docType: "视频", cite: 1 },
    { subject: "小学语文", name: "lesson_0707_153848_424", author: "zfy", docType: "视频", cite: 0 },
    { subject: "小学语文", name: "《第一组 感受自然》试卷(学生版)", author: "zfy", docType: "文档", cite: 14 },
    { subject: "小学语文", name: "《第一组 感受自然》课件", author: "zfy", docType: "文档", cite: 5 },
    { subject: "小学数学", name: "七年级上册单元复习课件", author: "zfy", docType: "文档", cite: 2 },
    { subject: "小学英语", name: "Unit1 词汇课件", author: "zfy", docType: "文档", cite: 3 },
    { subject: "小学语文", name: "古诗诵读示范视频", author: "zfy", docType: "视频", cite: 1 },
  ];

  const cwState = {
    mode: "add", // add | list
    courseId: null,
    listRowId: null,
    selected: new Set([0]),
  };

  function resolveCwSelectedIds(coursewares) {
    const selected = new Set();
    (coursewares || []).forEach((cw) => {
      if (typeof cw.cwIndex === "number") {
        selected.add(cw.cwIndex);
        return;
      }
      const idx = CW_ITEMS.findIndex((item) => item.name === cw.name);
      if (idx >= 0) selected.add(idx);
    });
    return selected;
  }

  function openCwModal(courseId) {
    const modal = $("#xb-cw-modal");
    if (!modal) return;
    cwState.mode = "add";
    cwState.courseId = courseId;
    cwState.listRowId = null;
    const existed = cwByCourse[courseId] || [];
    cwState.selected = new Set(existed.length ? existed : [0]);
    renderCwTable();
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function openCwModalForList(rowId) {
    const modal = $("#xb-cw-modal");
    const row = courseList.find((item) => item.id === rowId);
    if (!modal || !row) return;
    cwState.mode = "list";
    cwState.courseId = null;
    cwState.listRowId = rowId;
    cwState.selected = resolveCwSelectedIds(row.coursewares);
    renderCwTable();
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeCwModal() {
    const modal = $("#xb-cw-modal");
    if (!modal) return;
    cwState.mode = "add";
    cwState.listRowId = null;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function confirmCw() {
    if (cwState.mode === "list") {
      const row = courseList.find((item) => item.id === cwState.listRowId);
      if (row) {
        row.coursewares = [...cwState.selected].sort((a, b) => a - b).map((cwId) => ({
          key: `cw-list-${row.id}-${cwId}-${Date.now()}`,
          cwIndex: cwId,
          name: CW_ITEMS[cwId]?.name || "未命名课件",
        }));
        row.updatedAt = nowText();
      }
      closeCwModal();
      refreshCourseViews();
      return;
    }
    const courseId = cwState.courseId;
    if (courseId == null) {
      closeCwModal();
      return;
    }
    cwByCourse[courseId] = [...cwState.selected].sort((a, b) => a - b);
    if (courseId === LOCAL_KEY) renderLocalAttaches();
    else {
      renderSelectedCourses();
      renderLocalResourceList();
    }
    closeCwModal();
  }

  function filteredCwItems() {
    const keyword = ($("#xb-cw-search")?.value || "").trim().toLowerCase();
    return CW_ITEMS.map((item, index) => ({ ...item, index })).filter((item) =>
      item.name.toLowerCase().includes(keyword)
    );
  }

  function renderCwTable() {
    const tbody = $("#xb-cw-tbody");
    if (!tbody) return;
    const items = filteredCwItems();
    tbody.innerHTML = items
      .map(
        (item) => `<tr>
        <td class="col-pick">
          <input type="checkbox" class="xb-check" data-cw-id="${item.index}" ${
          cwState.selected.has(item.index) ? "checked" : ""
        } />
        </td>
        <td>${item.subject}</td>
        <td>${item.name}</td>
        <td>${item.author}</td>
        <td>${item.docType}</td>
        <td>${item.cite}</td>
        <td>
          <button type="button" class="xb-link-preview">预览</button>
          <button type="button" class="xb-link-preview" style="margin-left:8px">下载</button>
        </td>
      </tr>`
      )
      .join("");
  }

  let pendingDeleteRowId = null;

  function openDelModal(rowId) {
    const modal = $("#xb-del-modal");
    if (!modal) return;
    pendingDeleteRowId = rowId;
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeDelModal() {
    const modal = $("#xb-del-modal");
    if (!modal) return;
    pendingDeleteRowId = null;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function confirmDeleteRow() {
    if (pendingDeleteRowId == null) {
      closeDelModal();
      return;
    }
    const idx = courseList.findIndex((item) => item.id === pendingDeleteRowId);
    if (idx >= 0) courseList.splice(idx, 1);
    closeDelModal();
    refreshCourseViews();
    showToast("删除成功");
  }

  function bindDelModal() {
    $$("[data-close-del]").forEach((el) => {
      el.addEventListener("click", closeDelModal);
    });
    $("#xb-del-ok")?.addEventListener("click", confirmDeleteRow);
  }

  let pendingManageDeleteId = null;

  function openManageDelModal(rowId) {
    const modal = $("#jw-manage-del-modal");
    if (!modal) return;
    pendingManageDeleteId = rowId;
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeManageDelModal() {
    const modal = $("#jw-manage-del-modal");
    if (!modal) return;
    pendingManageDeleteId = null;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function confirmManageDelete() {
    if (pendingManageDeleteId == null) {
      closeManageDelModal();
      return;
    }
    const idx = manageCourseList.findIndex((item) => item.id === pendingManageDeleteId);
    if (idx >= 0) manageCourseList.splice(idx, 1);
    closeManageDelModal();
    renderManageTable();
    showToast("已删除");
  }

  function bindManageDelModal() {
    $$("[data-close-manage-del]").forEach((el) => {
      el.addEventListener("click", closeManageDelModal);
    });
    $("#jw-manage-del-ok")?.addEventListener("click", confirmManageDelete);
  }

  const MANAGE_OFF_SKIP_KEY = "xb-proto-v085-off-skip";
  let pendingManageOffId = null;

  function shouldSkipManageOffModal() {
    try {
      return localStorage.getItem(MANAGE_OFF_SKIP_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setSkipManageOffModal(skip) {
    try {
      if (skip) localStorage.setItem(MANAGE_OFF_SKIP_KEY, "1");
      else localStorage.removeItem(MANAGE_OFF_SKIP_KEY);
    } catch {
      /* ignore */
    }
  }

  function applyCourseOffShelf(rowId) {
    const row = manageCourseList.find((item) => item.id === rowId);
    if (!row) return;
    row.status = "off";
    renderManageTable();
    showToast("已下架");
    schedulePersist();
  }

  function openManageOffModal(rowId) {
    if (shouldSkipManageOffModal()) {
      applyCourseOffShelf(rowId);
      return;
    }
    const modal = $("#jw-manage-off-modal");
    if (!modal) return;
    pendingManageOffId = rowId;
    const skip = $("#jw-manage-off-skip");
    if (skip) skip.checked = false;
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeManageOffModal() {
    const modal = $("#jw-manage-off-modal");
    if (!modal) return;
    pendingManageOffId = null;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function confirmManageOff() {
    if (pendingManageOffId == null) {
      closeManageOffModal();
      return;
    }
    const skip = $("#jw-manage-off-skip");
    if (skip?.checked) setSkipManageOffModal(true);
    const id = pendingManageOffId;
    closeManageOffModal();
    applyCourseOffShelf(id);
  }

  function bindManageOffModal() {
    $$("[data-close-manage-off]").forEach((el) => {
      el.addEventListener("click", closeManageOffModal);
    });
    $("#jw-manage-off-ok")?.addEventListener("click", confirmManageOff);
  }

  function openPublishNowModal() {
    if (scheduleMode === "edit" && !scheduleDirty) return;
    const modal = $("#jw-publish-now-modal");
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closePublishNowModal() {
    const modal = $("#jw-publish-now-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function confirmPublishNow() {
    if (scheduleMode === "edit") {
      if (!scheduleDirty || editingPublishId == null) {
        closePublishNowModal();
        return;
      }
      const row = manageCourseList.find((item) => item.id === editingPublishId);
      if (row) {
        row.scheduleUnits = snapshotUnitsForCourse();
        const lessonCount = row.scheduleUnits.reduce(
          (n, unit) => n + (unit.lessons?.length || 0),
          0
        );
        if (lessonCount > 0) row.lessons = lessonCount;
      }
      closePublishNowModal();
      scheduleDirty = false;
      publishMode = "create";
      scheduleMode = "create";
      editingPublishId = null;
      setGradeSubjectLocked(false);
      applyScheduleModeUI();
      renderManageTable();
      showToast("发布成功");
      setJiaowuNav("manage");
      schedulePersist();
      return;
    }

    const data = collectPublishForm();
    const today = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const publishedAt = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
    const units = snapshotUnitsForCourse();
    const published = {
      ...data,
      status: "on",
      learners: data.learners ?? 0,
      publishedAt,
      lessons: data.lessons ?? 0,
      scheduleUnits: units,
    };
    if (editingPublishId != null) {
      const row = manageCourseList.find((item) => item.id === editingPublishId);
      if (row) Object.assign(row, published);
    } else {
      manageCourseList.unshift({
        id: manageListSeq++,
        ...published,
      });
    }
    editingPublishId = null;
    publishMode = "create";
    scheduleMode = "create";
    scheduleDirty = false;
    setGradeSubjectLocked(false);
    applyScheduleModeUI();
    closePublishNowModal();
    renderManageTable();
    showToast("发布成功");
    setJiaowuNav("manage");
  }

  function bindPublishNowModal() {
    $$("[data-close-publish-now]").forEach((el) => {
      el.addEventListener("click", closePublishNowModal);
    });
    $("#jw-publish-now-ok")?.addEventListener("click", confirmPublishNow);
  }

  let pendingSubmitRowId = null;

  function openSubmitModal(rowId) {
    const modal = $("#xb-submit-modal");
    if (!modal) return;
    pendingSubmitRowId = rowId;
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeSubmitModal() {
    const modal = $("#xb-submit-modal");
    if (!modal) return;
    pendingSubmitRowId = null;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function confirmSubmitRow() {
    if (pendingSubmitRowId == null) {
      closeSubmitModal();
      return;
    }
    const row = courseList.find((item) => item.id === pendingSubmitRowId);
    if (row) {
      row.status = "reviewing";
      row.action = "移动";
      row.updatedAt = nowText();
    }
    closeSubmitModal();
    refreshCourseViews();
    showToast("提交成功");
  }

  let pendingWithdrawRowId = null;

  function openWithdrawModal(rowId) {
    const modal = $("#xb-withdraw-modal");
    if (!modal) return;
    pendingWithdrawRowId = rowId;
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeWithdrawModal() {
    const modal = $("#xb-withdraw-modal");
    if (!modal) return;
    pendingWithdrawRowId = null;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function confirmWithdrawRow() {
    if (pendingWithdrawRowId == null) {
      closeWithdrawModal();
      return;
    }
    const row = courseList.find((item) => item.id === pendingWithdrawRowId);
    if (row) {
      row.status = "making";
      row.action = "制作";
      row.updatedAt = nowText();
    }
    closeWithdrawModal();
    refreshCourseViews();
    showToast("已撤回");
  }

  function bindWithdrawModal() {
    $$("[data-close-withdraw]").forEach((el) => {
      el.addEventListener("click", closeWithdrawModal);
    });
    $("#xb-withdraw-ok")?.addEventListener("click", confirmWithdrawRow);
  }

  function formatAuditTime(timeText) {
    const raw = String(timeText || "").trim();
    const parts = raw.split(/\s+/);
    if (parts.length >= 2) return `${parts[0]}\n${parts[1]}`;
    return raw;
  }

  function openAuditModal(rowId) {
    const modal = $("#xb-audit-modal");
    const tbody = $("#xb-audit-tbody");
    const row = courseList.find((item) => item.id === rowId);
    if (!modal || !tbody) return;
    const records = (row && row.auditRecords) || [];
    if (!records.length) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="xb-audit-empty">暂无审核记录</div></td></tr>`;
    } else {
      tbody.innerHTML = records
        .map((item) => {
          const pass = item.result === "pass";
          return `<tr>
            <td><div class="xb-audit-time">${escapeAttr(formatAuditTime(item.time))}</div></td>
            <td>${escapeAttr(item.reviewer || "-")}</td>
            <td>${escapeAttr(item.opinion || "无")}</td>
            <td><span class="xb-audit-tag ${pass ? "xb-audit-tag--pass" : "xb-audit-tag--reject"}">${
              pass ? "通过" : "不通过"
            }</span></td>
          </tr>`;
        })
        .join("");
    }
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeAuditModal() {
    const modal = $("#xb-audit-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function bindAuditModal() {
    $$("[data-close-audit]").forEach((el) => {
      el.addEventListener("click", closeAuditModal);
    });
  }

  let pendingReviewRowId = null;

  function openReviewModal(rowId) {
    const modal = $("#jw-review-modal");
    if (!modal) return;
    pendingReviewRowId = rowId;
    const pass = modal.querySelector('input[name="jw-review-result"][value="pass"]');
    if (pass) pass.checked = true;
    const opinion = $("#jw-review-opinion");
    if (opinion) opinion.value = "";
    const count = $("#jw-review-count");
    if (count) count.textContent = "0 / 200";
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeReviewModal() {
    const modal = $("#jw-review-modal");
    if (!modal) return;
    pendingReviewRowId = null;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function confirmReviewRow() {
    if (pendingReviewRowId == null) {
      closeReviewModal();
      return;
    }
    const result =
      document.querySelector('input[name="jw-review-result"]:checked')?.value || "pass";
    const opinion = ($("#jw-review-opinion")?.value || "").trim() || "无";
    const row = courseList.find((item) => item.id === pendingReviewRowId);
    if (row) {
      const passed = result === "pass";
      row.status = passed ? "passed" : "rejected";
      row.action = passed ? "移动" : "制作";
      row.audit = passed ? opinion === "无" ? "无" : opinion : opinion;
      row.updatedAt = nowText();
      if (!row.auditRecords) row.auditRecords = [];
      row.auditRecords.unshift({
        time: row.updatedAt,
        reviewer: "zfy",
        opinion: row.audit,
        result: passed ? "pass" : "reject",
      });
    }
    closeReviewModal();
    refreshCourseViews();
    showToast(result === "pass" ? "审核通过" : "已驳回");
  }

  function bindReviewModal() {
    $$("[data-close-review]").forEach((el) => {
      el.addEventListener("click", closeReviewModal);
    });
    $("#jw-review-ok")?.addEventListener("click", confirmReviewRow);
    $("#jw-review-opinion")?.addEventListener("input", (e) => {
      const count = $("#jw-review-count");
      if (count) count.textContent = `${e.target.value.length} / 200`;
    });
  }

  function bindJiaowuLib() {
    $$("[data-jw-nav]").forEach((btn) => {
      btn.addEventListener("click", () => setJiaowuNav(btn.dataset.jwNav));
    });
    $("#jw-add-btn")?.addEventListener("click", openAddModal);
    $("#jw-add-group-btn")?.addEventListener("click", () => {
      $("#xb-add-group-btn")?.click();
    });
    $("#jw-check-all")?.addEventListener("change", () => {
      const checked = $("#jw-check-all").checked;
      $$("#jw-course-tbody .xb-check").forEach((c) => {
        c.checked = checked;
      });
      syncJiaowuChecks();
    });
    $("#jw-move-btn")?.addEventListener("click", () => {
      const ids = $$("#jw-course-tbody tr")
        .filter((tr) => tr.querySelector(".xb-check")?.checked)
        .map((tr) => Number(tr.dataset.rowId));
      if (ids.length) openMoveModal(ids);
    });
    $("#jw-group-tags")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-jw-group-filter]");
      if (!btn) return;
      activeGroupFilter = btn.dataset.jwGroupFilter;
      renderGroupTags();
    });

    $("#jw-view-data-btn")?.addEventListener("click", () => {
      if ($("#jw-view-data-btn")?.disabled) return;
      const ids = getSelectedManageCourseIds();
      if (ids.length < 2) return;
      openMultiLearnDataPage(ids);
    });
    $("#jw-manage-check-all")?.addEventListener("change", () => {
      const checked = $("#jw-manage-check-all").checked;
      $$("#jw-manage-tbody .xb-check").forEach((c) => {
        c.checked = checked;
      });
      syncManageChecks();
    });
    const manageTbody = $("#jw-manage-tbody");
    manageTbody?.addEventListener("change", (e) => {
      if (e.target.matches(".xb-check")) syncManageChecks();
    });
    manageTbody?.addEventListener("click", (e) => {
      const moreBtn = e.target.closest("[data-manage-more]");
      if (moreBtn) {
        e.stopPropagation();
        const menu = moreBtn.parentElement?.querySelector(".jw-manage-more__menu");
        const open = menu && !menu.hidden;
        $$(".jw-manage-more__menu").forEach((m) => {
          m.hidden = true;
        });
        if (menu) menu.hidden = open;
        return;
      }
      const op = e.target.closest("[data-manage-op]");
      if (op) {
        $$(".jw-manage-more__menu").forEach((m) => {
          m.hidden = true;
        });
        const tr = op.closest("tr");
        const rowId = Number(tr?.dataset.manageId);
        const row = manageCourseList.find((item) => item.id === rowId);
        const action = op.dataset.manageOp;
        if (action === "继续编辑" && row) {
          openPublishPage(row);
          return;
        }
        if (action === "排课" && row) {
          openScheduleEdit(row);
          return;
        }
        if (action === "学习名单" && row) {
          openLearnersPage(row);
          return;
        }
        if (action === "学习数据" && row) {
          openLearnDataPage(row);
          return;
        }
        if (action === "修改" && row) {
          openModifyBasic(row);
          return;
        }
        if (action === "删除" && row) {
          openManageDelModal(rowId);
          return;
        }
        if (action === "下架" && row) {
          openManageOffModal(rowId);
          return;
        }
        showToast(`${action}（原型示意）`);
      }
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".jw-manage-more")) {
        $$(".jw-manage-more__menu").forEach((m) => {
          m.hidden = true;
        });
      }
    });

    const tbody = $("#jw-course-tbody");
    if (!tbody) return;
    tbody.addEventListener("change", (e) => {
      if (e.target.matches(".xb-check")) syncJiaowuChecks();
    });
    tbody.addEventListener("click", (e) => {
      const addHw = e.target.closest("[data-list-add-hw]");
      if (addHw) {
        openHwModalForList(Number(addHw.dataset.listAddHw));
        return;
      }
      const addCw = e.target.closest("[data-list-add-cw]");
      if (addCw) {
        openCwModalForList(Number(addCw.dataset.listAddCw));
        return;
      }
      const submitBtn = e.target.closest("[data-submit-row]");
      if (submitBtn) {
        e.stopPropagation();
        closeAllOpMenus();
        openSubmitModal(Number(submitBtn.dataset.submitRow));
        return;
      }
      const menuItem = e.target.closest("[data-op-item]");
      if (menuItem) {
        e.stopPropagation();
        const action = menuItem.dataset.opItem;
        const rowIdFromTr = menuItem.closest("tr")?.dataset.rowId;
        const delRowId = menuItem.dataset.delRow || rowIdFromTr;
        const moveRowId = menuItem.dataset.moveRow;
        const editRowId = menuItem.dataset.editRow;
        const withdrawRowId = menuItem.dataset.withdrawRow;
        const auditRowId = menuItem.dataset.auditRow;
        closeAllOpMenus();
        if (action === "删除" && delRowId != null && delRowId !== "") openDelModal(Number(delRowId));
        if (action === "移动" && moveRowId) openMoveModal([Number(moveRowId)]);
        if (action === "编辑" && editRowId) openEditModal(Number(editRowId));
        if (action === "撤回" && withdrawRowId) openWithdrawModal(Number(withdrawRowId));
        if (action === "审核记录" && auditRowId) openAuditModal(Number(auditRowId));
        return;
      }
      const reviewBtn = e.target.closest("[data-jw-review]");
      if (reviewBtn) {
        openReviewModal(Number(reviewBtn.dataset.jwReview));
        return;
      }
      const rowMove = e.target.closest("[data-row-move]");
      if (rowMove) {
        openMoveModal([Number(rowMove.dataset.rowMove)]);
        return;
      }
      const caret = e.target.closest("[data-op-caret]");
      if (caret) {
        e.stopPropagation();
        const op = caret.closest(".xb-op");
        const menu = op?.querySelector(".xb-op-menu");
        const willOpen = menu && menu.hidden;
        closeAllOpMenus();
        if (menu && willOpen) {
          menu.hidden = false;
          caret.setAttribute("aria-expanded", "true");
          op.classList.add("is-open");
        }
        return;
      }
      const editHw = e.target.closest("[data-list-edit-hw]");
      if (editHw) {
        activateNameInput(`[data-list-hw-name="${editHw.dataset.listEditHw}"]`);
        return;
      }
      const editCw = e.target.closest("[data-list-edit-cw]");
      if (editCw) {
        activateNameInput(`[data-list-cw-name="${editCw.dataset.listEditCw}"]`);
        return;
      }
      const removeHw = e.target.closest("[data-list-remove-hw]");
      if (removeHw) {
        const [rowId, key] = removeHw.dataset.listRemoveHw.split(":");
        const row = courseList.find((item) => String(item.id) === rowId);
        if (row) {
          row.homeworks = (row.homeworks || []).filter((hw) => hw.key !== key);
          refreshCourseViews();
        }
        return;
      }
      const removeCw = e.target.closest("[data-list-remove-cw]");
      if (removeCw) {
        const [rowId, key] = removeCw.dataset.listRemoveCw.split(":");
        const row = courseList.find((item) => String(item.id) === rowId);
        if (row) {
          row.coursewares = (row.coursewares || []).filter((cw) => cw.key !== key);
          refreshCourseViews();
        }
        return;
      }
      const hwName = e.target.closest("[data-list-hw-name]");
      if (hwName && hwName.readOnly) {
        openExternalUrl(PREVIEW.paper);
        return;
      }
      const cwName = e.target.closest("[data-list-cw-name]");
      if (cwName && cwName.readOnly) openExternalUrl(PREVIEW.courseware);
    });
  }

  function bindSubmitModal() {
    $$("[data-close-submit]").forEach((el) => {
      el.addEventListener("click", closeSubmitModal);
    });
    $("#xb-submit-ok")?.addEventListener("click", confirmSubmitRow);
  }

  const lessonGroups = [];
  let activeGroupFilter = "全部";
  let pendingMoveRowIds = [];

  function renderGroupTags() {
    const tags = ["全部", ...lessonGroups];
    const html = tags
      .map(
        (name) =>
          `<button type="button" class="xb-btn xb-btn--tag${
            name === activeGroupFilter ? " is-active" : ""
          }" data-group-filter="${escapeAttr(name)}">${escapeAttr(name)}</button>`
      )
      .join("");
    const wrap = $("#xb-group-tags");
    if (wrap) wrap.innerHTML = html;
    const jwWrap = $("#jw-group-tags");
    if (jwWrap) {
      jwWrap.innerHTML = tags
        .map(
          (name) =>
            `<button type="button" class="xb-btn xb-btn--tag${
              name === activeGroupFilter ? " is-active" : ""
            }" data-jw-group-filter="${escapeAttr(name)}">${escapeAttr(name)}</button>`
        )
        .join("");
    }
  }

  function fillMoveGroupSelect() {
    const select = $("#xb-move-group");
    if (!select) return;
    select.innerHTML =
      `<option value="" selected disabled>请选择新的分组</option>` +
      lessonGroups.map((name) => `<option value="${escapeAttr(name)}">${escapeAttr(name)}</option>`).join("");
  }

  function openMoveModal(rowIds) {
    const modal = $("#xb-move-modal");
    if (!modal) return;
    if (!lessonGroups.length) {
      window.alert("请先在上方「单课分组」中添加分组");
      return;
    }
    pendingMoveRowIds = rowIds || [];
    fillMoveGroupSelect();
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeMoveModal() {
    const modal = $("#xb-move-modal");
    if (!modal) return;
    pendingMoveRowIds = [];
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  let toastTimer = null;

  function showToast(message, type) {
    const toast = $("#xb-toast");
    if (!toast) return;
    toast.classList.toggle("xb-toast--warn", type === "warn");
    if (type === "warn") {
      toast.innerHTML = `<span class="xb-toast__icon" aria-hidden="true">!</span><span>${escapeAttr(
        message
      )}</span>`;
    } else {
      toast.textContent = message;
    }
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("is-show"));
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("is-show");
      setTimeout(() => {
        toast.hidden = true;
        toast.classList.remove("xb-toast--warn");
        toast.textContent = "";
      }, 200);
    }, 1800);
  }

  function confirmMove() {
    const select = $("#xb-move-group");
    const groupName = select?.value;
    if (!groupName) {
      window.alert("请选择新的分组");
      return;
    }
    pendingMoveRowIds.forEach((id) => {
      const row = courseList.find((item) => item.id === id);
      if (row) row.groupName = groupName;
    });
    closeMoveModal();
    refreshCourseViews();
    showToast("移动成功");
  }

  let pendingEditRowId = null;

  function fillEditGroupSelect(selected) {
    const select = $("#xb-edit-group");
    if (!select) return;
    select.innerHTML =
      `<option value="" ${selected ? "" : "selected"} disabled>请选择新的分组</option>` +
      lessonGroups
        .map(
          (name) =>
            `<option value="${escapeAttr(name)}"${
              name === selected ? " selected" : ""
            }>${escapeAttr(name)}</option>`
        )
        .join("");
  }

  function syncEditNameCount() {
    const input = $("#xb-edit-name");
    const count = $("#xb-edit-count");
    if (!input || !count) return;
    count.textContent = `${input.value.length} / 50`;
  }

  function openEditModal(rowId) {
    const modal = $("#xb-edit-modal");
    const row = courseList.find((item) => item.id === rowId);
    if (!modal || !row) return;
    pendingEditRowId = rowId;
    const nameInput = $("#xb-edit-name");
    const subjectSelect = $("#xb-edit-subject");
    if (nameInput) nameInput.value = row.videoName || "";
    if (subjectSelect) {
      const stage = row.stageSubject || "小学语文";
      const hasOption = [...subjectSelect.options].some((opt) => opt.value === stage || opt.text === stage);
      if (!hasOption) {
        const opt = document.createElement("option");
        opt.value = stage;
        opt.textContent = stage;
        subjectSelect.appendChild(opt);
      }
      subjectSelect.value = stage;
    }
    fillEditGroupSelect(row.groupName || "");
    syncEditNameCount();
    modal.hidden = false;
    modal.classList.add("is-open");
  }

  function closeEditModal() {
    const modal = $("#xb-edit-modal");
    if (!modal) return;
    pendingEditRowId = null;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function confirmEdit() {
    const row = courseList.find((item) => item.id === pendingEditRowId);
    if (!row) {
      closeEditModal();
      return;
    }
    const name = ($("#xb-edit-name")?.value || "").trim();
    if (!name) {
      window.alert("请输入单课名称");
      return;
    }
    row.videoName = name.slice(0, 50);
    row.stageSubject = $("#xb-edit-subject")?.value || row.stageSubject;
    const subjectText = row.stageSubject || "";
    row.subject = subjectText.replace(/^(小学|初中|高中)/, "") || row.subject;
    const group = $("#xb-edit-group")?.value || "";
    if (group) row.groupName = group;
    row.updatedAt = nowText();
    closeEditModal();
    refreshCourseViews();
  }

  function bindEditModal() {
    $$("[data-close-edit]").forEach((el) => {
      el.addEventListener("click", closeEditModal);
    });
    $("#xb-edit-ok")?.addEventListener("click", confirmEdit);
    $("#xb-edit-name")?.addEventListener("input", syncEditNameCount);
  }

  function bindGroupAndMove() {
    renderGroupTags();

    $("#xb-add-group-btn")?.addEventListener("click", () => {
      const name = (window.prompt("请输入分组名称") || "").trim();
      if (!name) return;
      if (name === "全部") {
        window.alert("分组名称不能为「全部」");
        return;
      }
      if (lessonGroups.includes(name)) {
        window.alert("该分组已存在");
        return;
      }
      lessonGroups.push(name);
      activeGroupFilter = name;
      renderGroupTags();
    });

    $("#xb-group-tags")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-group-filter]");
      if (!btn) return;
      activeGroupFilter = btn.dataset.groupFilter;
      renderGroupTags();
    });

    $("#xb-move-btn")?.addEventListener("click", () => {
      if ($("#xb-move-btn")?.disabled) return;
      const ids = $$("#xb-course-tbody tr")
        .filter((tr) => tr.querySelector(".xb-check")?.checked)
        .map((tr) => Number(tr.dataset.rowId))
        .filter(Boolean);
      if (!ids.length) return;
      openMoveModal(ids);
    });

    $$("[data-close-move]").forEach((el) => {
      el.addEventListener("click", closeMoveModal);
    });
    $("#xb-move-ok")?.addEventListener("click", confirmMove);
  }

  function bindCwModal() {
    $$("[data-close-cw]").forEach((el) => {
      el.addEventListener("click", closeCwModal);
    });
    $("#xb-cw-ok")?.addEventListener("click", confirmCw);
    $("#xb-cw-query")?.addEventListener("click", renderCwTable);
    $("#xb-cw-search")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        renderCwTable();
      }
    });
    $("#xb-cw-tbody")?.addEventListener("change", (e) => {
      const input = e.target.closest("[data-cw-id]");
      if (!input) return;
      const id = Number(input.dataset.cwId);
      if (input.checked) cwState.selected.add(id);
      else cwState.selected.delete(id);
    });
  }

  function restoreFromSaved(saved) {
    if (!saved) return null;
    state.terminal = saved.terminal || state.terminal;
    state.role = saved.role || state.role;
    state.pcPage = saved.pcPage || state.pcPage;
    state.padPage = saved.padPage || state.padPage;
    if (saved.padXbSubject && PAD_XB_SUBJECTS.includes(saved.padXbSubject)) {
      padXbSubject = saved.padXbSubject;
    }
    if (saved.padXbCourseId) padXbCourseId = saved.padXbCourseId;
    if (Number.isFinite(Number(saved.padXbHwStep))) {
      padXbHwStep = Math.max(0, Math.min(Number(saved.padXbHwStep), PAD_XB_HW_STEPS.length - 1));
    }
    if (saved.padXbHwStatus && PAD_XB_HW_CARD[saved.padXbHwStatus]) {
      padXbHwStatus = saved.padXbHwStatus;
    }
    state.jwNav = saved.jwNav || state.jwNav;
    state.publishStep = saved.publishStep || state.publishStep;
    if (Array.isArray(saved.manageCourseList) && saved.manageCourseList.length) {
      manageCourseList.length = 0;
      manageCourseList.push(...saved.manageCourseList);
    }
    if (saved.manageListSeq) manageListSeq = saved.manageListSeq;
    if (Array.isArray(saved.scheduleUnits)) {
      scheduleUnits.length = 0;
      scheduleUnits.push(
        ...saved.scheduleUnits.map((unit) => ({
          ...unit,
          editing: false,
          lessons: Array.isArray(unit.lessons) ? unit.lessons : [],
        }))
      );
    }
    if (saved.scheduleUnitSeq) scheduleUnitSeq = saved.scheduleUnitSeq;
    if (Array.isArray(saved.addCourseVideos) && saved.addCourseVideos.length) {
      ADD_COURSE_VIDEOS = saved.addCourseVideos;
    }
    if (saved.editingPublishId != null) editingPublishId = saved.editingPublishId;
    if (saved.publishMode === "modify" || saved.publishMode === "create") {
      publishMode = saved.publishMode;
    }
    if (saved.scheduleMode === "edit" || saved.scheduleMode === "create") {
      scheduleMode = saved.scheduleMode;
    }
    scheduleDirty = !!saved.scheduleDirty;
    if (saved.learnersCourseId != null) learnersCourseId = saved.learnersCourseId;
    if (saved.learnDataCourseId != null) learnDataCourseId = saved.learnDataCourseId;
    if (Array.isArray(saved.learnDataCourseIds) && saved.learnDataCourseIds.length) {
      learnDataCourseIds = saved.learnDataCourseIds.map(Number).filter((id) => Number.isFinite(id));
    } else if (learnDataCourseId != null) {
      learnDataCourseIds = [learnDataCourseId];
    }
    if (saved.learnersByCourse && typeof saved.learnersByCourse === "object") {
      Object.keys(learnersByCourse).forEach((key) => {
        delete learnersByCourse[key];
      });
      Object.entries(saved.learnersByCourse).forEach(([key, list]) => {
        learnersByCourse[key] = Array.isArray(list) ? list : [];
      });
    }
    if (saved.removedLearnersByCourse && typeof saved.removedLearnersByCourse === "object") {
      Object.keys(removedLearnersByCourse).forEach((key) => {
        delete removedLearnersByCourse[key];
      });
      Object.entries(saved.removedLearnersByCourse).forEach(([key, list]) => {
        removedLearnersByCourse[key] = Array.isArray(list) ? list : [];
      });
    }
    if (saved.devicesByCourse && typeof saved.devicesByCourse === "object") {
      Object.keys(devicesByCourse).forEach((key) => {
        delete devicesByCourse[key];
      });
      Object.entries(saved.devicesByCourse).forEach(([key, list]) => {
        devicesByCourse[key] = Array.isArray(list) ? list : [];
      });
    }
    if (saved.removedDevicesByCourse && typeof saved.removedDevicesByCourse === "object") {
      Object.keys(removedDevicesByCourse).forEach((key) => {
        delete removedDevicesByCourse[key];
      });
      Object.entries(saved.removedDevicesByCourse).forEach(([key, list]) => {
        removedDevicesByCourse[key] = Array.isArray(list) ? list : [];
      });
    }
    if (saved.learnersMaintainModeByCourse && typeof saved.learnersMaintainModeByCourse === "object") {
      Object.keys(learnersMaintainModeByCourse).forEach((key) => {
        delete learnersMaintainModeByCourse[key];
      });
      Object.entries(saved.learnersMaintainModeByCourse).forEach(([key, mode]) => {
        learnersMaintainModeByCourse[key] = mode === "device" ? "device" : "person";
      });
    }
    return saved;
  }

  bind();
  const saved = restoreFromSaved(loadProtoState());
  setTerminal(state.terminal);
  $$(".pc-role-panel").forEach((panel) => {
    panel.hidden = panel.dataset.role !== state.role;
  });
  $$(".role-menu__item[data-role]").forEach((item) => {
    item.classList.toggle("is-current", item.dataset.role === state.role);
  });
  updateDiffNotes();
  if (state.pcPage === "module") openPcModule();
  else showPcHome();
  restorePadView();
  if (saved?.publishForm) applyPublishSnapshot(saved.publishForm);
  applyScheduleModeUI();
  refreshCourseViews();
  if (state.jwNav === "learners" || state.jwNav === "learners-import") {
    renderLearnersTable();
  }
  if (state.jwNav === "learn-data") {
    renderLearnDataPage();
  }
  persistReady = true;
  schedulePersist();
})();
