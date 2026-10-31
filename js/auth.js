
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  const authContainer = document.getElementById("auth-container");
  const dashboard = document.querySelector(".app-shell");

  if (!supabase || !authContainer || !dashboard) {
    console.error("StudyFlow: Required elements or Supabase client missing.");
    return;
  }

  // Show the dashboard only after successful login.
 async function showDashboard() {
  authContainer.hidden = true;
  dashboard.hidden = false;
  dashboard.style.display = "";

  const avatar = document.getElementById("student-avatar");
  const greeting = document.getElementById("greeting");

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return;

  const name =
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "Student";

  if (avatar) {
    const initials = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");

    avatar.textContent = initials || "S";
    avatar.setAttribute("aria-label", `${name}'s profile`);
    avatar.title = name;
  }

  if (greeting) {
    greeting.textContent =
      `Good evening, ${name}! Let's make today count ✦`;
  }
}
  function showAuth() {
  authContainer.hidden = false;
  dashboard.hidden = true;
  dashboard.style.display = "none";
}

  // Check whether the student is already logged in.
  showAuth();

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    console.error("Could not check login session:", sessionError.message);
  }

  if (sessionData?.session) {
    showDashboard();
  }

  authContainer.innerHTML = `
    <section class="auth-card">
      <div class="auth-icon">📚✨</div>
      <h1>Welcome to StudyFlow!</h1>
      <p>Your little steps make big achievements 🌱</p>

      <div class="auth-tabs">
        <button type="button" id="show-login">Log in</button>
        <button type="button" id="show-signup">Sign up</button>
      </div>

      <form id="auth-form">
        <label for="auth-name">Your name</label>
        <input id="auth-name" type="text" autocomplete="name"
          placeholder="What should we call you?" required>

        <label for="auth-email">Email address</label>
        <input id="auth-email" type="email" autocomplete="email"
          placeholder="you@example.com" required>

        <label for="auth-password">Password</label>
        <input id="auth-password" type="password"
          autocomplete="new-password" minlength="8"
          placeholder="At least 8 characters" required>

        <button type="submit" id="auth-submit">
          Create my account 🚀
        </button>
        <p id="auth-message" role="status" aria-live="polite"></p>
      </form>
    </section>
  `;

  let mode = "signup";

  const form = document.getElementById("auth-form");
  const nameInput = document.getElementById("auth-name");
  const passwordInput = document.getElementById("auth-password");
  const submitButton = document.getElementById("auth-submit");
  const message = document.getElementById("auth-message");

  function setMode(nextMode) {
    mode = nextMode;
    const signingUp = mode === "signup";

    nameInput.required = signingUp;
    nameInput.hidden = !signingUp;
    document.querySelector('label[for="auth-name"]').hidden = !signingUp;

    passwordInput.autocomplete = signingUp
      ? "new-password"
      : "current-password";

    submitButton.textContent = signingUp
      ? "Create my account 🚀"
      : "Log in to StudyFlow 💜";

    message.textContent = "";
  }

  document.getElementById("show-login").addEventListener("click", () => {
    setMode("login");
  });

  document.getElementById("show-signup").addEventListener("click", () => {
    setMode("signup");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    submitButton.disabled = true;

    try {
      const email = document.getElementById("auth-email").value.trim();
      const password = passwordInput.value;

      if (mode === "signup") {
        const displayName = nameInput.value.trim();

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName }
          }
        });

        if (error) throw error;

        if (data.session) {
          showDashboard();
          message.textContent = "Account created! Welcome to StudyFlow 🎉";
        } else {
          message.textContent =
            "Account created! Please check your email to confirm your account 📩";
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        if (data.session) {
          showDashboard();
        }

        message.textContent = "You're logged in! Welcome back 💜";
      }
    } catch (error) {
      message.textContent =
        error.message || "Something went wrong. Please try again.";
    } finally {
      submitButton.disabled = false;
    }
  });

  
 // Keep the screen in sync with login and logout changes.
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    showDashboard();

    if (event === "SIGNED_IN") {
      window.dispatchEvent(new Event("studyflow-user-changed"));
    }
  } else {
    showAuth();
  }
});


  // Open and close the student profile menu
const avatarButton = document.getElementById("student-avatar");
const profileMenu = document.getElementById("profile-menu");
const profileName = document.getElementById("profile-name");
const profileEmail = document.getElementById("profile-email");

if (avatarButton && profileMenu) {
  avatarButton.addEventListener("click", async () => {
    profileMenu.hidden = !profileMenu.hidden;

    avatarButton.setAttribute(
      "aria-expanded",
      String(!profileMenu.hidden)
    );

    if (!profileMenu.hidden) {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (!error && user) {
        const name =
          user.user_metadata?.display_name ||
          user.email?.split("@")[0] ||
          "Student";

        if (profileName) profileName.textContent = name;
        if (profileEmail) profileEmail.textContent = user.email || "";
      }
    }
  });
}


  // Log out the current student
  const logoutButton = document.getElementById("logout-button");

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true;
      message.textContent = "";

      try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        profileMenu.hidden = true;
        avatarButton.setAttribute("aria-expanded", "false");
        setMode("login");
        message.textContent =
          "You've logged out successfully. See you soon! 💜";
      } catch (error) {
        message.textContent =
          error.message || "Unable to log out. Please try again.";
      } finally {
        logoutButton.disabled = false;
      }
    });
  }








  setMode("signup");
});
