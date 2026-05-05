// --- State ---
let isRegisterMode = false;

// --- Helpers ---
function getCurrentUserId() {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.userId;
  } catch {
    return null;
  }
}

function getToken() {
  return localStorage.getItem(CONFIG.STORAGE_KEY);
}

function setToken(token) {
  localStorage.setItem(CONFIG.STORAGE_KEY, token);
}

function removeToken() {
  localStorage.removeItem(CONFIG.STORAGE_KEY);
}

async function apiFetch(route, options = {}) {
  const token = getToken();

  const headers = {
    ...options.headers,
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${CONFIG.API_URL}${route}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || data.msg || "Request failed");
  }

  return data;
}

// --- Auth ---
function showAuth() {
  document.getElementById("auth-section").style.display = "block";
  document.getElementById("app-section").style.display = "none";
  document.getElementById("logout-btn").style.display = "none";
  renderAuthForm();
}

function renderAuthForm() {
  const fields = isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
  const title = isRegisterMode ? "Sign Up" : "Log In";

  const switchText = isRegisterMode
    ? 'Already have an account? <a href="#" id="switch-mode">Log in</a>'
    : 'Don\'t have an account? <a href="#" id="switch-mode">Sign up</a>';

  document.getElementById("auth-section").innerHTML = `
    <h2>${title}</h2>
    <form id="auth-form">
      ${fields
        .map((f) => {
          const type =
            f === "password" ? "password" : f === "email" ? "email" : "text";
          const label = f.charAt(0).toUpperCase() + f.slice(1);

          return `
            <div class="form-group">
              <label for="${f}">${label}</label>
              <input type="${type}" id="${f}" name="${f}" required />
            </div>
          `;
        })
        .join("")}
      <button type="submit">${title}</button>
    </form>
    <p class="switch-text">${switchText}</p>
    <p id="auth-error" class="error"></p>
  `;

  document.getElementById("auth-form").addEventListener("submit", handleAuth);

  document.getElementById("switch-mode").addEventListener("click", (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    renderAuthForm();
  });
}

async function handleAuth(e) {
  e.preventDefault();

  const errorEl = document.getElementById("auth-error");
  errorEl.textContent = "";

  const fields = isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
  const route = isRegisterMode ? CONFIG.ROUTES.REGISTER : CONFIG.ROUTES.LOGIN;

  const body = {};

  fields.forEach((f) => {
    body[f] = document.getElementById(f).value;
  });

  try {
    const data = await apiFetch(route, {
      method: "POST",
      body: JSON.stringify(body),
    });

    setToken(data.token);
    showApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

// --- App ---
async function showApp() {
  document.getElementById("auth-section").style.display = "none";
  document.getElementById("app-section").style.display = "block";
  document.getElementById("logout-btn").style.display = "inline-block";

  await loadQuestions();
}

async function loadQuestions(keyword = "", page = 1) {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading questions...</p>';

  try {
    const params = new URLSearchParams({
      page,
      limit: CONFIG.QUESTIONS_PER_PAGE,
    });

    if (keyword) params.set("keyword", keyword);

    const result = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}?${params}`);

    const { data: questions, total, totalPages } = result;
    const currentUserId = getCurrentUserId();

    const solvedCount = questions.filter((q) => q.isCorrect).length;

    let html = `
      <div class="score-bar">
        <div class="score-item">
          <div class="score-value">${total}</div>
          <div class="score-label">Questions</div>
        </div>
        <div class="score-item">
          <div class="score-value">${solvedCount}/${questions.length}</div>
          <div class="score-label">Correct this page</div>
        </div>
      </div>

      <div class="toolbar">
        <button class="btn btn-primary" id="new-question-btn">+ New Question</button>

        <div class="search-bar">
          <input 
            type="text" 
            id="keyword-input" 
            placeholder="Search by keyword..." 
            value="${keyword}" 
          />
          <button class="btn btn-search" id="search-btn">Search</button>
          ${keyword ? `<button class="btn btn-clear" id="clear-btn">Clear</button>` : ""}
        </div>
      </div>
    `;

    if (questions.length === 0) {
      html += `<p class="empty-state">No questions found. Create one to get started!</p>`;
    } else {
      html += questions
        .map(
          (q) => `
          <article class="question-card ${q.isCorrect ? "solved-card" : ""}">
            <h3>
              <a href="#" class="question-link" data-id="${q.id}">
                ${q.question}
              </a>

              ${q.isCorrect ? `<span class="badge-solved">Correct</span>` : ""}
              ${q.isAttempted && !q.isCorrect ? `<span class="badge-solved">Attempted</span>` : ""}
              ${q.isBookmarked ? `<span class="badge-solved">Bookmarked</span>` : ""}
              ${q.isLiked ? `<span class="badge-solved">Liked</span>` : ""}
            </h3>

            ${
              q.imageUrl
                ? `<img class="question-thumb" src="${q.imageUrl}" alt="Question image" />`
                : ""
            }

            ${
              q.keywords && q.keywords.length
                ? `<div class="question-keywords">
                    ${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}
                  </div>`
                : ""
            }

            <p class="question-meta">
              Attempts: ${q.attemptsCount || 0} | 
              Bookmarks: ${q.bookmarksCount || 0} | 
              Likes: ${q.likesCount || 0}
            </p>

            <div class="question-actions">
              <span>
                <button class="btn btn-play" data-id="${q.id}">Play</button>
                ${q.isAttempted || q.isOwner ? `<a href="#" class="read-more" data-id="${q.id}">See answer</a>` : ""}
                <button class="btn btn-bookmark" data-id="${q.id}">
                  ${q.isBookmarked ? "Remove Bookmark" : "Bookmark"}
                </button>
                <button class="btn btn-like" data-id="${q.id}">
                  ${q.isLiked ? "Unlike" : "Like"}
                </button>
              </span>

              ${
                q.userId === currentUserId
                  ? `<span class="owner-actions">
                      <button class="btn btn-edit" data-id="${q.id}">Edit</button>
                      <button class="btn btn-delete" data-id="${q.id}">Delete</button>
                    </span>`
                  : ""
              }
            </div>
          </article>
        `
        )
        .join("");
    }

    if (totalPages > 1) {
      html += `
        <div class="pagination">
          <button class="btn btn-page" id="prev-btn" ${page <= 1 ? "disabled" : ""}>
            Previous
          </button>

          <span class="page-info">Page ${page} of ${totalPages}</span>

          <button class="btn btn-page" id="next-btn" ${page >= totalPages ? "disabled" : ""}>
            Next
          </button>
        </div>
      `;
    }

    container.innerHTML = html;

    document
      .getElementById("new-question-btn")
      .addEventListener("click", () => showQuestionForm());

    document.getElementById("search-btn").addEventListener("click", () => {
      loadQuestions(document.getElementById("keyword-input").value.trim(), 1);
    });

    document.getElementById("keyword-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") loadQuestions(e.target.value.trim(), 1);
    });

    const clearBtn = document.getElementById("clear-btn");
    if (clearBtn) clearBtn.addEventListener("click", () => loadQuestions());

    const prevBtn = document.getElementById("prev-btn");
    if (prevBtn) prevBtn.addEventListener("click", () => loadQuestions(keyword, page - 1));

    const nextBtn = document.getElementById("next-btn");
    if (nextBtn) nextBtn.addEventListener("click", () => loadQuestions(keyword, page + 1));

    container.querySelectorAll(".question-link, .read-more").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        loadQuestionDetail(el.dataset.id);
      });
    });

    container.querySelectorAll(".btn-edit").forEach((el) => {
      el.addEventListener("click", () => showQuestionForm(el.dataset.id));
    });

    container.querySelectorAll(".btn-delete").forEach((el) => {
      el.addEventListener("click", () => deleteQuestion(el.dataset.id));
    });

    container.querySelectorAll(".btn-play").forEach((el) => {
      el.addEventListener("click", () => playQuestion(el.dataset.id));
    });

    container.querySelectorAll(".btn-bookmark").forEach((el) => {
      el.addEventListener("click", () =>
        toggleBookmark(el.dataset.id, keyword, page)
      );
    });

    container.querySelectorAll(".btn-like").forEach((el) => {
      el.addEventListener("click", () =>
        toggleLike(el.dataset.id, keyword, page)
      );
    });
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

// --- Detail ---
async function loadQuestionDetail(qId) {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);
    const currentUserId = getCurrentUserId();
    const isOwner = q.userId === currentUserId;

    container.innerHTML = `
      <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>

      <article class="question-card question-detail">
        <h3>
          ${q.question}
          ${q.isCorrect ? `<span class="badge-solved">Correct</span>` : ""}
          ${q.isBookmarked ? `<span class="badge-solved">Bookmarked</span>` : ""}
          ${q.isLiked ? `<span class="badge-solved">Liked</span>` : ""}
        </h3>

        <p class="question-meta">by ${q.userName || "Unknown"}</p>

        ${q.imageUrl ? `<img class="question-image" src="${q.imageUrl}" alt="Question image" />` : ""}

        ${
          q.answer
            ? `<p class="question-answer">${q.answer}</p>`
            : `<p class="question-answer">Answer hidden. Try the question first.</p>`
        }

        ${
          q.keywords && q.keywords.length
            ? `<div class="question-keywords">
                ${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}
              </div>`
            : ""
        }

        <p class="question-meta">
          Attempts: ${q.attemptsCount || 0} | 
          Bookmarks: ${q.bookmarksCount || 0} | 
          Likes: ${q.likesCount || 0}
        </p>

        <div class="question-actions detail-actions">
          <button class="btn btn-play" id="detail-play-btn">Play</button>

          <button class="btn btn-bookmark" id="detail-bookmark-btn">
            ${q.isBookmarked ? "Remove Bookmark" : "Bookmark"}
          </button>

          <button class="btn btn-like" id="detail-like-btn">
            ${q.isLiked ? "Unlike" : "Like"}
          </button>

          ${
            isOwner
              ? `
                <button class="btn btn-edit" id="detail-edit-btn">Edit</button>
                <button class="btn btn-delete" id="detail-delete-btn">Delete</button>
              `
              : ""
          }
        </div>
      </article>
    `;

    document.getElementById("back-btn").addEventListener("click", (e) => {
      e.preventDefault();
      loadQuestions();
    });

    const detailPlayBtn = document.getElementById("detail-play-btn");

if (detailPlayBtn) {
  detailPlayBtn.addEventListener("click", () => {
    playQuestion(qId);
  });
}

    document.getElementById("detail-bookmark-btn").addEventListener("click", () => {
      toggleBookmark(qId);
    });

    document.getElementById("detail-like-btn").addEventListener("click", () => {
      toggleLike(qId);
    });

    if (isOwner) {
      document
        .getElementById("detail-edit-btn")
        .addEventListener("click", () => showQuestionForm(qId));

      document
        .getElementById("detail-delete-btn")
        .addEventListener("click", () => deleteQuestion(qId));
    }
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

// --- Create / Edit ---
async function showQuestionForm(qId) {
  const container = document.getElementById("questions-container");
  const isEdit = !!qId;

  let q = {
    question: "",
    date: "",
    answer: "",
    keywords: [],
    imageUrl: "",
  };

  if (isEdit) {
    try {
      q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);
    } catch (err) {
      container.innerHTML = `<p class="error">${err.message}</p>`;
      return;
    }
  }

  container.innerHTML = `
    <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>

    <div class="question-form-wrapper">
      <h2>${isEdit ? "Edit Question" : "New Question"}</h2>

      <form id="question-form" enctype="multipart/form-data">
        <div class="form-group">
          <label for="q-question">Question</label>
          <input type="text" id="q-question" value="${q.question || ""}" required />
        </div>

        <div class="form-group">
          <label for="q-date">Date</label>
          <input type="date" id="q-date" value="${q.date || ""}" required />
        </div>

        <div class="form-group">
          <label for="q-answer">Answer</label>
          <textarea id="q-answer" rows="4" required>${q.answer || ""}</textarea>
        </div>

        <div class="form-group">
          <label for="q-keywords">Keywords comma-separated</label>
          <input 
            type="text" 
            id="q-keywords" 
            value="${q.keywords ? q.keywords.join(", ") : ""}" 
          />
        </div>

        <div class="form-group">
          <label for="q-image">Image ${isEdit ? "(leave empty to keep current image)" : "(optional)"}</label>
          <input type="file" id="q-image" accept="image/*" />
          ${
            isEdit && q.imageUrl
              ? `<img src="${q.imageUrl}" alt="Current image" style="max-width:200px;margin-top:0.5rem;border-radius:8px;" />`
              : ""
          }
        </div>

        <button type="submit" class="btn btn-primary">
          ${isEdit ? "Save Changes" : "Create Question"}
        </button>
      </form>

      <p id="question-form-error" class="error"></p>
    </div>
  `;

  document.getElementById("back-btn").addEventListener("click", (e) => {
    e.preventDefault();
    loadQuestions();
  });

  document.getElementById("question-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const errorEl = document.getElementById("question-form-error");
    errorEl.textContent = "";

    const formData = new FormData();

    formData.append("question", document.getElementById("q-question").value);
    formData.append("date", document.getElementById("q-date").value);
    formData.append("answer", document.getElementById("q-answer").value);

    document
      .getElementById("q-keywords")
      .value.split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .forEach((keyword) => {
        formData.append("keywords", keyword);
      });

    const imageInput = document.getElementById("q-image");

    if (imageInput.files[0]) {
      formData.append("image", imageInput.files[0]);
    }

    try {
      if (isEdit) {
        await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`, {
          method: "PUT",
          body: formData,
        });
      } else {
        await apiFetch(CONFIG.ROUTES.QUESTIONS, {
          method: "POST",
          body: formData,
        });
      }

      loadQuestions();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// --- Play / Attempt ---
async function playQuestion(qId) {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);

    container.innerHTML = `
      <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>

      <div class="question-form-wrapper" style="text-align:center">
        <div class="play-question-text">${q.question}</div>

        ${q.imageUrl ? `<img class="question-image" src="${q.imageUrl}" alt="Question image" />` : ""}

        ${
          q.keywords && q.keywords.length
            ? `<div class="question-keywords" style="justify-content:center;margin-bottom:1.5rem">
                ${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}
              </div>`
            : ""
        }

        <form id="play-form" style="text-align:left">
          <div class="form-group">
            <label for="play-answer">Your answer</label>
            <textarea id="play-answer" rows="3" required></textarea>
          </div>

          <div style="text-align:center">
            <button 
              type="submit" 
              class="btn btn-play" 
              style="padding:0.7rem 2.5rem;font-size:1rem"
            >
              Submit
            </button>
          </div>
        </form>

        <div id="play-result"></div>
        <p id="play-error" class="error"></p>
      </div>
    `;

    document.getElementById("back-btn").addEventListener("click", (e) => {
      e.preventDefault();
      loadQuestions();
    });

    document.getElementById("play-form").addEventListener("submit", async (e) => {
      e.preventDefault();

      const errorEl = document.getElementById("play-error");
      const resultEl = document.getElementById("play-result");

      errorEl.textContent = "";
      resultEl.innerHTML = "";

      const answer = document.getElementById("play-answer").value;

      try {
        const result = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}/attempt`, {
          method: "POST",
          body: JSON.stringify({
            userAnswer: answer,
          }),
        });

        if (result.attempt.isCorrect) {
          resultEl.innerHTML = `<div class="play-result correct">Correct!</div>`;
        } else {
          resultEl.innerHTML = `
            <div class="play-result incorrect">
              Incorrect. Try again.
            </div>
          `;
        }
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

// --- Bookmark ---
async function toggleBookmark(qId, keyword = "", page = 1) {
  try {
    const q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);

    if (q.isBookmarked) {
      await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}/bookmark`, {
        method: "DELETE",
      });
    } else {
      await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}/bookmark`, {
        method: "POST",
      });
    }

    loadQuestions(keyword, page);
  } catch (err) {
    alert(err.message);
  }
}

// --- Like ---
async function toggleLike(qId, keyword = "", page = 1) {
  try {
    const q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);

    if (q.isLiked) {
      await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}/like`, {
        method: "DELETE",
      });
    } else {
      await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}/like`, {
        method: "POST",
      });
    }

    loadQuestions(keyword, page);
  } catch (err) {
    alert(err.message);
  }
}

// --- Delete ---
async function deleteQuestion(qId) {
  if (!confirm("Are you sure you want to delete this question?")) return;

  try {
    await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`, {
      method: "DELETE",
    });

    loadQuestions();
  } catch (err) {
    alert(err.message);
  }
}

// --- Logout ---
function handleLogout() {
  removeToken();
  showAuth();
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  if (getToken()) {
    showApp();
  } else {
    showAuth();
  }
});