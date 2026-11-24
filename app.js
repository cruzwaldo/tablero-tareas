/* ============================================================
   NeonBoard · Tablero de tareas
   Frontend puro: localStorage como única persistencia.
   ============================================================ */

(function () {
  "use strict";

  const STORAGE_KEY = "neonboard.tasks.v1";
  const THEME_KEY = "neonboard.theme";
  const STATUSES = ["pendiente", "en proceso", "terminada"];

  /* ---------- Referencias del DOM ---------- */

  const themeToggle = document.getElementById("theme-toggle");
  const modal = document.getElementById("task-modal");
  const form = document.getElementById("task-form");
  const modalTitle = document.getElementById("modal-title");
  const fTitle = document.getElementById("f-title");
  const fDesc = document.getElementById("f-desc");
  const fStatus = document.getElementById("f-status");
  const fDate = document.getElementById("f-date");
  const cancelBtn = document.getElementById("cancel");

  const lists = new Map();
  const counters = new Map();

  document.querySelectorAll(".column__list").forEach(function (el) {
    lists.set(el.dataset.status, el);
  });
  document.querySelectorAll(".column__count").forEach(function (el) {
    counters.set(el.dataset.status, el);
  });

  /* ---------- Estado ---------- */

  let tasks = [];
  let editingId = null;
  let defaultStatus = "pendiente";
  let draggedId = null;

  /* ---------- Utilidades ---------- */

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "t-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function todayISO() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day;
  }

  function shiftISO(iso, days) {
    const parts = iso.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + days);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day;
  }

  function formatDate(iso) {
    if (!iso) return "Sin fecha";
    const parts = iso.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return iso;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  }

  /* ---------- Datos ---------- */

  function seedTasks() {
    const today = todayISO();
    return [
      {
        id: uid(),
        title: "Definir el alcance del proyecto",
        status: "terminada",
        description: "Objetivos, entregables y fecha límite del primer sprint.",
        date: shiftISO(today, -3)
      },
      {
        id: uid(),
        title: "Diseñar el tablero con estilo neón",
        status: "en proceso",
        description: "Glassmorphism, bordes luminosos difuminados y modo claro/oscuro.",
        date: today
      },
      {
        id: uid(),
        title: "Preparar la presentación",
        status: "pendiente",
        description: "",
        date: shiftISO(today, 2)
      }
    ];
  }

  function isValidTask(task) {
    return (
      task &&
      typeof task === "object" &&
      typeof task.title === "string" &&
      task.title.trim() !== "" &&
      STATUSES.indexOf(task.status) !== -1
    );
  }

  function normalizeTask(task) {
    return {
      id: typeof task.id === "string" && task.id ? task.id : uid(),
      title: task.title.trim().slice(0, 80),
      status: task.status,
      description: typeof task.description === "string" ? task.description.slice(0, 240) : "",
      date: typeof task.date === "string" && task.date ? task.date : todayISO()
    };
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        const seeded = seedTasks();
        persistTasks(seeded);
        return seeded;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidTask).map(normalizeTask);
    } catch (err) {
      console.warn("No se pudo leer el localStorage:", err);
      return [];
    }
  }

  function persistTasks(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list || tasks));
    } catch (err) {
      console.warn("No se pudo guardar en el localStorage:", err);
    }
  }

  /* ---------- Render ---------- */

  function render() {
    STATUSES.forEach(function (status) {
      const list = lists.get(status);
      if (!list) return;

      list.textContent = "";

      const columnTasks = tasks.filter(function (t) {
        return t.status === status;
      });

      const counter = counters.get(status);
      if (counter) counter.textContent = columnTasks.length;

      if (columnTasks.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "Arrastra una tarea aquí";
        list.appendChild(empty);
        return;
      }

      columnTasks.forEach(function (task) {
        list.appendChild(createCard(task));
      });
    });
  }

  function createCard(task) {
    const card = document.createElement("article");
    card.className = "task";
    card.draggable = true;
    card.dataset.id = task.id;
    card.tabIndex = 0;
    card.setAttribute("aria-label", task.title + " (" + task.status + ")");

    const top = document.createElement("div");
    top.className = "task__top";

    const title = document.createElement("h3");
    title.className = "task__title";
    title.textContent = task.title;

    const actions = document.createElement("div");
    actions.className = "task__actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "icon-btn";
    editBtn.title = "Editar tarea";
    editBtn.setAttribute("aria-label", "Editar tarea: " + task.title);
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      openModal(task);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "icon-btn icon-btn--danger";
    deleteBtn.title = "Eliminar tarea";
    deleteBtn.setAttribute("aria-label", "Eliminar tarea: " + task.title);
    deleteBtn.textContent = "🗑";
    deleteBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      removeTask(task.id);
    });

    actions.append(editBtn, deleteBtn);
    top.append(title, actions);
    card.appendChild(top);

    if (task.description) {
      const desc = document.createElement("p");
      desc.className = "task__desc";
      desc.textContent = task.description;
      card.appendChild(desc);
    }

    const footer = document.createElement("div");
    footer.className = "task__footer";

    const date = document.createElement("span");
    date.className = "task__date";
    date.textContent = "◷ " + formatDate(task.date);
    footer.appendChild(date);
    card.appendChild(footer);

    /* Drag & drop */
    card.addEventListener("dragstart", function (event) {
      draggedId = task.id;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", task.id);
    });

    card.addEventListener("dragend", function () {
      card.classList.remove("is-dragging");
      draggedId = null;
      clearDropHighlights();
    });

    /* Doble clic para editar */
    card.addEventListener("dblclick", function () {
      openModal(task);
    });

    card.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        openModal(task);
      }
    });

    return card;
  }

  function clearDropHighlights() {
    document.querySelectorAll(".column__list.is-over").forEach(function (el) {
      el.classList.remove("is-over");
    });
  }

  /* ---------- Acciones ---------- */

  function moveTask(id, status) {
    if (STATUSES.indexOf(status) === -1) return;
    const task = tasks.find(function (t) {
      return t.id === id;
    });
    if (!task || task.status === status) return;

    task.status = status;
    persistTasks();
    render();
  }

  function removeTask(id) {
    const task = tasks.find(function (t) {
      return t.id === id;
    });
    if (!task) return;

    const confirmed = window.confirm('¿Eliminar la tarea "' + task.title + '"?');
    if (!confirmed) return;

    tasks = tasks.filter(function (t) {
      return t.id !== id;
    });
    persistTasks();
    render();
  }

  /* ---------- Modal ---------- */

  function openModal(task) {
    editingId = task ? task.id : null;
    defaultStatus = task ? task.status : defaultStatus;

    form.reset();
    fTitle.value = task ? task.title : "";
    fDesc.value = task ? task.description || "" : "";
    fStatus.value = task ? task.status : defaultStatus;
    fDate.value = task ? task.date || todayISO() : todayISO();

    modalTitle.textContent = task ? "Editar tarea" : "Nueva tarea";

    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "");
    }
    fTitle.focus();
  }

  function closeModal() {
    editingId = null;
    if (typeof modal.close === "function") {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }
  }

  /* ---------- Tema ---------- */

  function setTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    themeToggle.querySelector(".theme-toggle__icon").textContent = isDark ? "🌙" : "☀️";
    themeToggle.querySelector(".theme-toggle__text").textContent = isDark ? "Modo oscuro" : "Modo claro";
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch (err) {
      /* almacenamiento no disponible: el tema funciona igual en esta sesión */
    }
  }

  function initTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch (err) {
      saved = null;
    }
    if (saved !== "dark" && saved !== "light") {
      saved = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }
    setTheme(saved);
  }

  /* ---------- Eventos globales ---------- */

  function bindEvents() {
    themeToggle.addEventListener("click", function () {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });

    document.querySelectorAll(".add-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        defaultStatus = btn.dataset.status;
        openModal(null);
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const title = fTitle.value.trim();
      if (!title) {
        fTitle.focus();
        return;
      }

      const data = {
        title: title.slice(0, 80),
        description: fDesc.value.trim().slice(0, 240),
        status: STATUSES.indexOf(fStatus.value) !== -1 ? fStatus.value : "pendiente",
        date: fDate.value || todayISO()
      };

      if (editingId) {
        const task = tasks.find(function (t) {
          return t.id === editingId;
        });
        if (task) Object.assign(task, data);
      } else {
        tasks.push({
          id: uid(),
          title: data.title,
          status: data.status,
          description: data.description,
          date: data.date
        });
      }

      persistTasks();
      render();
      closeModal();
    });

    cancelBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", function (event) {
      if (event.target !== modal) return;
      const rect = modal.getBoundingClientRect();
      const outside =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;
      if (outside) closeModal();
    });

    lists.forEach(function (list, status) {
      list.addEventListener("dragover", function (event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        list.classList.add("is-over");
      });

      list.addEventListener("dragenter", function (event) {
        event.preventDefault();
        list.classList.add("is-over");
      });

      list.addEventListener("dragleave", function (event) {
        if (!list.contains(event.relatedTarget)) {
          list.classList.remove("is-over");
        }
      });

      list.addEventListener("drop", function (event) {
        event.preventDefault();
        const id = event.dataTransfer.getData("text/plain") || draggedId;
        clearDropHighlights();
        if (id) moveTask(id, status);
        draggedId = null;
      });
    });
  }

  /* ---------- Arranque ---------- */

  initTheme();
  tasks = loadTasks();
  bindEvents();
  render();
})();
