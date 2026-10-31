"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector) => document.querySelector(selector);

  const taskForm = $("#task-form");
  const taskList = $("#task-list");
  const emptyState = $("#empty-state");
  const scheduleList = $("#schedule-list");

  const STORAGE_KEY = "studyflow-ai-tasks";
  let currentUserId = null;

function getUserStorageKey(key) {
  return currentUserId
    ? `${key}_${currentUserId}`
    : key;
}

  let tasks = loadTasks();
  let timerInterval = null;
  let timeRemaining = 25 * 60;
let timerRunning = false;
let timerMode = "focus";

  // ---------- Storage ----------

  function loadTasks() {
    try {
      const saved = localStorage.getItem(getUserStorageKey(STORAGE_KEY));
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Could not load saved tasks:", error);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(
  getUserStorageKey(STORAGE_KEY),
  JSON.stringify(tasks)
);
    } catch (error) {
      console.error("Could not save tasks:", error);
      showFeedback("Could not save tasks in this browser.", true);
    }
  }

  
async function saveTaskToSupabase(task) {
  const supabase = window.supabaseClient;

  if (!supabase) {
    throw new Error("Supabase connection is unavailable.");
  }

  const { data: { user }, error: userError } =
    await supabase.auth.getUser();

  if (userError) throw userError;

  if (!user) {
    throw new Error("Please log in before saving a task.");
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: task.title,
      task_type: "assignment",
      due_date: task.deadline,
      difficulty: String(task.difficulty).toLowerCase(),
      estimated_minutes: task.duration,
      is_completed: task.completed
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

async function loadTasksFromSupabase() {
  const supabase = window.supabaseClient;

  try {
    const { data: { session }, error: sessionError } =
  await supabase.auth.getSession();

if (sessionError) throw sessionError;

const user = session?.user;

if (!user) return;

currentUserId = user.id;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    
tasks = data.map((row) => ({
  id: row.id,
  title: row.title,
  subject: row.subject_id || "",
  deadline: row.due_date ? row.due_date.slice(0, 10) : "",
  duration: row.estimated_minutes,
  difficulty:
    row.difficulty.charAt(0).toUpperCase() +
    row.difficulty.slice(1),
  completed: row.is_completed,
  createdAt: row.created_at
}));

saveTasks();
render();

console.log("Dashboard tasks updated from Supabase:", tasks);

  } catch (error) {
    console.error("Could not load tasks from Supabase:", error);
  }
}



  // ---------- Helpers ----------

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function formatDeadline(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "No valid deadline";

    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function showFeedback(message, isError = false) {
    const feedback = $("#form-feedback");
    feedback.textContent = message;
    feedback.style.color = isError ? "#c0394b" : "#279d75";
  }

  function priorityClass(priority) {
    return String(priority).toLowerCase();
  }

  // ---------- Task creation ----------

  taskForm.addEventListener("submit", async (event) => {
    console.log("DEBUG: Task form handler is running");
    event.preventDefault();

    const title = $("#task-title").value.trim();
    const subject = $("#task-subject").value.trim();
    const deadline = $("#task-deadline").value;
    const duration = Number($("#task-duration").value);
    const difficulty = $("#task-difficulty").value;

    if (!title || !subject || !deadline) {
      showFeedback("Please complete all required fields.", true);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const chosenDate = new Date(`${deadline}T00:00:00`);

    if (Number.isNaN(chosenDate.getTime())) {
      showFeedback("Please choose a valid deadline.", true);
      return;
    }

    const task = {
      id: window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      subject,
      deadline,
      duration,
      difficulty,
      completed: false,
      createdAt: new Date().toISOString()
    };

    
tasks.push(task);
saveTasks();
render();

try {
    console.log("DEBUG: Attempting to save task to Supabase", task);
  await saveTaskToSupabase(task);
  console.log("Task saved to Supabase successfully!");
} catch (error) {
  console.error("Could not save task to Supabase:", error);
  showFeedback(
    "Task saved locally, but cloud saving failed. Please check the console.",
    true
  );
}


    taskForm.reset();
    $("#task-duration").value = "60";
    $("#task-difficulty").value = "Medium";
    showFeedback("Your study task was added successfully!");
  });

  // ---------- Task actions ----------

  taskList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const taskId = button.dataset.id;
    const action = button.dataset.action;

    
if (action === "toggle") {
  const updatedTasks = tasks.map((task) =>
    task.id === taskId
      ? { ...task, completed: !task.completed }
      : task
  );

  const wasCompleted = tasks.find(task => task.id === taskId)?.completed;

tasks = updatedTasks;

if (!wasCompleted) {
  const currentPoints = Number(
    localStorage.getItem(getUserStorageKey("studyflow_total_points")) || 0
  );

  localStorage.setItem(
  getUserStorageKey("studyflow_total_points"),
  currentPoints + 10
);
}
 

  const updatedTask = tasks.find((task) => task.id === taskId);

  if (updatedTask && window.supabaseClient) {
    window.supabaseClient
      .from("tasks")
      .update({ is_completed: updatedTask.completed })
      .eq("id", taskId)
      .then(({ error }) => {
        if (error) {
          console.error("Could not sync task completion:", error);
        } else {
          console.log("Task completion synced to Supabase!");
        }
      });
  }
}


    
if (action === "delete") {
  const confirmDelete = confirm(
    "Are you sure you want to delete this task? Your earned points and study time will remain saved."
  );

  if (!confirmDelete) {
    return;
  }

  tasks = tasks.filter((task) => task.id !== taskId);

  if (window.supabaseClient) {
    window.supabaseClient
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .then(({ error }) => {
        if (error) {
          console.error("Could not delete task from Supabase:", error);
        } else {
          console.log("Task deleted from Supabase!");
        }
      });
  }
}


    saveTasks();
    render();
  });

  // ---------- Rendering ----------

  function renderTasks() {
    const sortedTasks = StudyPlanner.sortTasks(tasks);

    taskList.replaceChildren();

    if (sortedTasks.length === 0) {
      taskList.appendChild(emptyState);
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;

    for (const task of sortedTasks) {
      const priority = StudyPlanner.getPriority(task);

      const card = document.createElement("article");
      card.className = `task-item${task.completed ? " completed" : ""}`;

      card.innerHTML = `
        <button
          class="task-check"
          type="button"
          data-action="toggle"
          data-id="${escapeHTML(task.id)}"
          aria-label="${task.completed ? "Mark incomplete" : "Mark complete"}: ${escapeHTML(task.title)}"
          aria-pressed="${task.completed}"
        >${task.completed ? "✓" : ""}</button>

        <div class="task-details">
          <h4>${escapeHTML(task.title)}</h4>
          <p>${escapeHTML(task.subject)} · ${Number(task.duration)} min</p>
          <p class="task-deadline">Due ${escapeHTML(formatDeadline(task.deadline))}</p>
        </div>

        <div class="task-meta">
          <span class="priority-badge ${priorityClass(priority.label)}">${escapeHTML(priority.label)}</span>
          <button
            class="delete-task"
            type="button"
            data-action="delete"
            data-id="${escapeHTML(task.id)}"
            aria-label="Delete ${escapeHTML(task.title)}"
            title="Delete task"
          >×</button>
        </div>
      `;

      taskList.appendChild(card);
    }
  }
  // ---------- Study Analytics ----------

function updateStudyAnalytics() {
  const completedTasks = tasks.filter(task => task.completed).length;
  const pendingTasks = tasks.filter(task => !task.completed).length;

  const weeklyData = JSON.parse(
    localStorage.getItem(getUserStorageKey("studyflow_weekly_minutes")) || "{}"
  );

  const totalMinutes = Object.values(weeklyData).reduce(
    (total, minutes) => total + Number(minutes || 0),
    0
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  $("#analytics-total-time").textContent =
    hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;

  $("#analytics-completed-tasks").textContent = completedTasks;
  $("#analytics-pending-tasks").textContent = pendingTasks;

  const chart = $("#weekly-study-chart");
  if (!chart) return;

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const today = new Date();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const dailyValues = days.map((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = date.toISOString().split("T")[0];

    return {
      day,
      minutes: Number(weeklyData[key] || 0)
    };
  });

  const maxMinutes = Math.max(
    60,
    ...dailyValues.map(item => item.minutes)
  );

  chart.replaceChildren();

  dailyValues.forEach(item => {
    const column = document.createElement("div");
    column.className = "weekly-chart-column";

    const value = document.createElement("span");
    value.className = "weekly-chart-value";
    value.textContent = item.minutes ? `${item.minutes}m` : "0m";

    const track = document.createElement("div");
    track.className = "weekly-chart-track";

    const bar = document.createElement("div");
    bar.className = "weekly-chart-bar";
    bar.style.height = `${Math.max(
      item.minutes > 0 ? 8 : 0,
      (item.minutes / maxMinutes) * 100
    )}%`;

    const label = document.createElement("span");
    label.className = "weekly-chart-label";
    label.textContent = item.day;

    track.appendChild(bar);
    column.append(value, track, label);
    chart.appendChild(column);
  });
  // Update rewards points
const totalPoints = Number(
  localStorage.getItem(
  getUserStorageKey("studyflow_total_points")
) || 0
);

$("#total-points").textContent = totalPoints;
$("#tasks-points").textContent = tasks.filter(
  task => task.completed
).length;
// Calculate earned achievements
const completedCount = tasks.filter(task => task.completed).length;
const currentStreak = Number(
  localStorage.getItem(
  getUserStorageKey("studyflow_streak_count")
) || 0
);

const achievements = [
  {
    id: "first-step",
    unlocked: completedCount >= 1
  },
  {
    id: "consistency-star",
    unlocked: currentStreak >= 3
  },
  {
    id: "bookworm",
    unlocked: completedCount >= 10
  },
  {
    id: "study-champion",
    unlocked: completedCount >= 25
  }
];

const previousAchievements = JSON.parse(
  localStorage.getItem(
  getUserStorageKey("studyflow_unlocked_achievements")
) || "[]"
);

const newlyUnlocked = achievements.filter(
  achievement =>
    achievement.unlocked &&
    !previousAchievements.includes(achievement.id)
);
const achievementCards = document.querySelectorAll(".achievement-item");

achievements.forEach((achievement, index) => {
  const card = achievementCards[index];
  if (card) {
    card.classList.toggle("locked", !achievement.unlocked);
  }
});

$("#badges-earned").textContent = achievements.filter(
  achievement => achievement.unlocked
).length;
if (newlyUnlocked.length > 0) {
  const badgeDetails = {
    "first-step": {
      icon: "🌱",
      title: "First Step",
      message: "Amazing! You've completed your first task!"
    },
    "consistency-star": {
      icon: "🔥",
      title: "Consistency Star",
      message: "You've maintained a 3-day study streak!"
    },
    "bookworm": {
      icon: "📚",
      title: "Bookworm",
      message: "You've completed 10 study tasks!"
    },
    "study-champion": {
      icon: "👑",
      title: "Study Champion",
      message: "You've completed 25 study tasks!"
    }
  };

  const badge = badgeDetails[newlyUnlocked[0].id];

  if (badge) {
    $("#achievement-popup-icon").textContent = badge.icon;
    $("#achievement-popup-title").textContent = badge.title;
    $("#achievement-popup-message").textContent = badge.message;
    $("#achievement-popup-points").textContent = "Badge earned! 🏅";
    $("#achievement-popup").classList.add("show");
  }

  localStorage.setItem(
  getUserStorageKey("studyflow_unlocked_achievements"),
  JSON.stringify([
    ...previousAchievements,
    ...newlyUnlocked.map(item => item.id)
  ])
);
}
}

  function renderStats() {
    const completed = tasks.filter((task) => task.completed).length;
    const total = tasks.length;
    const pending = total - completed;
    const progress = total ? Math.round((completed / total) * 100) : 0;

    $("#total-tasks").textContent = total;
    $("#completed-tasks").textContent = completed;
    $("#pending-tasks").textContent = pending;
    $("#progress-value").textContent = `${progress}%`;
    $("#progress-fill").style.width = `${progress}%`;
    $("#task-count").textContent = `${total} ${total === 1 ? "task" : "tasks"}`;
  }

  
function renderDashboardPreviews() {
  const taskPreview = $("#dashboard-task-preview");
  const schedulePreview = $("#dashboard-schedule-preview");

  if (!taskPreview || !schedulePreview) return;

  // Show the latest pending tasks
  const pendingTasks = StudyPlanner.sortTasks(
    tasks.filter(task => !task.completed)
  );

  taskPreview.replaceChildren();

  if (pendingTasks.length === 0) {
    taskPreview.textContent = "No pending tasks. Great job! 🎉";
  } else {
    pendingTasks.slice(0, 3).forEach(task => {
      const item = document.createElement("div");
      item.className = "dashboard-preview-item task-preview-item";

      const title = document.createElement("strong");
      title.textContent = task.title;

      const details = document.createElement("p");
details.textContent = `${task.subject} · ${Number(task.duration)} min`;

const priority = StudyPlanner.getPriority(task);
const badge = document.createElement("span");
badge.className = `priority-badge ${priorityClass(priority.label)}`;
badge.textContent = priority.label;

item.append(title, details, badge);
      taskPreview.appendChild(item);
    });
  }

  // Show the next study sessions
  const schedule = StudyPlanner.generateSchedule(tasks);

  schedulePreview.replaceChildren();

  if (schedule.length === 0) {
    schedulePreview.textContent = "No upcoming study sessions yet.";
  } else {
    schedule.slice(0, 3).forEach(session => {
      const item = document.createElement("div");
      item.className = "dashboard-preview-item";

      const title = document.createElement("strong");
      title.textContent = session.title;

      const details = document.createElement("p");
      details.textContent = `${session.start} · ${session.duration} min`;

      item.append(title, details);
      schedulePreview.appendChild(item);
    });
  }
}


  function renderSchedule() {
    const schedule = StudyPlanner.generateSchedule(tasks);
    scheduleList.replaceChildren();

    if (schedule.length === 0) {
      const message = document.createElement("p");
      message.className = "muted-message";
      message.textContent = tasks.length
        ? "All tasks are complete. Enjoy your progress!"
        : "Add a task to start planning your study time.";
      scheduleList.appendChild(message);
      $("#schedule-summary-text").textContent =
        tasks.length ? "You're all caught up!" : "Your personalized plan will appear here.";
      return;
    }

    $("#schedule-summary-text").textContent =
      `${schedule.length} study ${schedule.length === 1 ? "session" : "sessions"} planned.`;

    for (const item of schedule) {
      const entry = document.createElement("article");
      entry.className = "schedule-item";
      entry.innerHTML = `
        <div class="schedule-time">${escapeHTML(item.start)}</div>
        <div class="schedule-marker"></div>
        <div class="schedule-details">
          <strong>${escapeHTML(item.title)}</strong>
          <p>${escapeHTML(item.subject)} · ${item.duration} min</p>
        </div>
        <span class="priority-badge ${priorityClass(item.priority)}">${escapeHTML(item.priority)}</span>
      `;
      scheduleList.appendChild(entry);
    }
  }
  function updateDailyGoal() {
  const dailyGoalMinutes = 120;
  const completedMinutes = Number(
    localStorage.getItem(getUserStorageKey("studyflow_daily_minutes"))  || 0
  );

  const percentage = Math.min(
    (completedMinutes / dailyGoalMinutes) * 100,
    100
  );

  $("#daily-goal-time").textContent =
    `${completedMinutes} / ${dailyGoalMinutes} min`;

  $("#daily-goal-bar").style.width = `${percentage}%`;

  $("#daily-goal-message").textContent =
    percentage >= 100
      ? "🎉 Daily study goal completed! Amazing work!"
      : "Keep going! Every minute counts. 🌸";
      const streak = Number(
  localStorage.getItem(getUserStorageKey("studyflow_streak_count")) || 0
);
$("#study-streak").textContent = streak;
}

  function render() {
  renderStats();
  renderTasks();
  renderSchedule();
  renderDashboardPreviews();
  updateDailyGoal();
  updateStudyAnalytics();
}

  
// ---------- Study schedule ----------

$("#generate-schedule").addEventListener("click", () => {
  const tasksLink = document.querySelector(
    '.navigation .nav-link[data-page="tasks-view"]'
  );

  if (tasksLink) {
    tasksLink.click();
  } 
});



  
  // ---------- Focus and break timer ----------

  function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    $("#timer-display").textContent =
      `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function stopTimer() {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerRunning = false;
  }

  $("#focus-popup-ok").addEventListener("click", () => {
  $("#focus-popup").classList.remove("show");
});

$("#achievement-popup-ok").addEventListener("click", () => {
  $("#achievement-popup").classList.remove("show");
});


  $("#timer-start").addEventListener("click", () => {
    if (timerRunning) {
      stopTimer();
      $("#timer-start").textContent =
        timerMode === "focus" ? "Resume focus" : "Resume break";
      $("#timer-caption").textContent = "Paused. Continue when you're ready.";
      return;
    }

    if (timeRemaining <= 0) {
      timerMode = "focus";
      timeRemaining = 25 * 60;
      updateTimerDisplay();
    }

    timerRunning = true;

    $("#timer-start").textContent =
      timerMode === "focus" ? "Pause session" : "Pause break";

    $("#timer-caption").textContent =
      timerMode === "focus"
        ? "You're doing great. Stay focused!"
        : "Relax and recharge. Break time!";

    timerInterval = setInterval(() => {
      timeRemaining--;
      updateTimerDisplay();

      if (timeRemaining <= 0) {
        stopTimer();
        timeRemaining = 0;
        updateTimerDisplay();

        if (timerMode === "focus") {
          const today = new Date().toISOString().split("T")[0];
const savedDate = localStorage.getItem(getUserStorageKey("studyflow_study_date"));

let completedMinutes = Number(
  localStorage.getItem(getUserStorageKey("studyflow_daily_minutes")) || 0
);

if (savedDate !== today) {
  completedMinutes = 0;
}

completedMinutes += 25;


localStorage.setItem(
  getUserStorageKey("studyflow_study_date"),
  today
);

localStorage.setItem(
  getUserStorageKey("studyflow_daily_minutes"),
  completedMinutes
);
const weeklyData = JSON.parse(
  localStorage.getItem(
    getUserStorageKey("studyflow_weekly_minutes")
  ) || "{}"
);

weeklyData[today] = Number(weeklyData[today] || 0) + 25;

localStorage.setItem(
  getUserStorageKey("studyflow_weekly_minutes"),
  JSON.stringify(weeklyData)
);
const lastStudyDate = localStorage.getItem(
  getUserStorageKey("studyflow_last_study_date")
);
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayString = yesterday.toISOString().split("T")[0];

let streak = Number(
  localStorage.getItem(getUserStorageKey("studyflow_streak_count")) || 0
);

if (lastStudyDate !== today) {
  streak = lastStudyDate === yesterdayString ? streak + 1 : 1;

  localStorage.setItem(
  getUserStorageKey("studyflow_streak_count"),
  streak
);
  localStorage.setItem(
  getUserStorageKey("studyflow_last_study_date"),
  today
);
  $("#study-streak").textContent = streak;
}
updateDailyGoal();
updateStudyAnalytics();

          timerMode = "break";
          timeRemaining = 5 * 60;
          updateTimerDisplay();

          $("#timer-caption").textContent =
            "🎉 Focus complete! Your 5-minute break starts now.";
            const focusPopup = $("#focus-popup");
if (focusPopup) {
  focusPopup.classList.add("show");
}

          $("#timer-start").textContent = "Pause break";

          timerRunning = true;

          timerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerDisplay();

            if (timeRemaining <= 0) {
              stopTimer();
              timeRemaining = 0;
              updateTimerDisplay();

              $("#timer-start").textContent = "Start focus";
              $("#timer-caption").textContent =
                "☀️ Break completed! Ready for another focus session.";
            }
          }, 1000);

        } else {
          $("#timer-start").textContent = "Start focus";
          $("#timer-caption").textContent =
            "☀️ Break completed! Ready for another focus session.";
        }
      }
    }, 1000);
  });

  $("#timer-reset").addEventListener("click", () => {
    stopTimer();

    if (timerMode === "break") {
      timeRemaining = 5 * 60;
      $("#timer-start").textContent = "Start break";
      $("#timer-caption").textContent = "Take another 5 minutes to recharge.";
    } else {
      timeRemaining = 25 * 60;
      $("#timer-start").textContent = "Start focus";
      $("#timer-caption").textContent = "Ready when you are.";
    }

    updateTimerDisplay();
  });
  

  // ---------- Initial setup ----------

  const today = new Date();
  $("#today-date").textContent = today.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short"
  });

  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" :
    hour < 18 ? "Good afternoon" : "Good evening";

  $("#greeting").innerHTML =
    `${greeting}, let's make today count <span>✦</span>`;

  updateTimerDisplay();

loadTasksFromSupabase().then(() => {
  render();
});

  
  window.addEventListener("studyflow-user-changed", () => {
  loadTasksFromSupabase();
});
});



/* StudyFlow AI — Sidebar and Dashboard navigation */
(() => {
  const navLinks = document.querySelectorAll(".navigation .nav-link");
  const pageLinks = document.querySelectorAll("[data-page]");
  const pages = document.querySelectorAll(".main-content .page-view");

  if (!pages.length) return;

  function showPage(pageId) {
    const targetPage = document.getElementById(pageId);

    if (!targetPage || !targetPage.classList.contains("page-view")) return;

    pages.forEach(page => {
      page.classList.toggle("active", page.id === pageId);
    });

    navLinks.forEach(link => {
      const isActive = link.dataset.page === pageId;
      link.classList.toggle("active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (window.location.hash !== `#${pageId}`) {
      history.replaceState(null, "", `#${pageId}`);
    }
  }

  pageLinks.forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      showPage(link.dataset.page);
    });
  });

  const initialPage = window.location.hash.slice(1);
  const validInitial = [...pages].some(page => page.id === initialPage);

  showPage(validInitial ? initialPage : "dashboard");
})();
