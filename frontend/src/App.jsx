import { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const { token, ...fetchOptions } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: {
      ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = new Error(body?.detail || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("access_token"));
  const [user, setUser] = useState(null);
  const [todos, setTodos] = useState([]);
  const [sessionLoading, setSessionLoading] = useState(Boolean(token));
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setSessionLoading(false);
      setUser(null);
      setTodos([]);
      return;
    }

    let active = true;
    async function restoreSession() {
      setSessionLoading(true);
      try {
        const account = await request("/api/auth/me", { token });
        const items = await request("/api/todos", { token });
        if (active) {
          setUser(account);
          setTodos(items);
          setError("");
        }
      } catch (requestError) {
        if (!active) return;
        if (requestError.status === 401) {
          localStorage.removeItem("access_token");
          setToken(null);
          setUser(null);
          setTodos([]);
        } else {
          setError(requestError.message);
        }
      } finally {
        if (active) setSessionLoading(false);
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, [token]);

  const remaining = useMemo(
    () => todos.filter((todo) => !todo.completed).length,
    [todos],
  );

  function signOut() {
    localStorage.removeItem("access_token");
    setToken(null);
    setUser(null);
    setTodos([]);
    setTitle("");
    setEditingId(null);
    setError("");
  }

  async function handleAuth(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const result = await request(path, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("access_token", result.access_token);
      setUser(result.user);
      setSessionLoading(true);
      setToken(result.access_token);
      setPassword("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshTodos(activeToken = token) {
    const items = await request("/api/todos", { token: activeToken });
    setTodos(items);
  }

  async function handleTodoSubmit(event) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || busy) return;

    setBusy(true);
    setError("");
    try {
      if (editingId === null) {
        await request("/api/todos", {
          method: "POST",
          token,
          body: JSON.stringify({ title: cleanTitle }),
        });
      } else {
        await request(`/api/todos/${editingId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ title: cleanTitle }),
        });
      }
      setTitle("");
      setEditingId(null);
      await refreshTodos();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateTodo(todoId, changes) {
    setError("");
    try {
      const updated = await request(`/api/todos/${todoId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(changes),
      });
      setTodos((current) =>
        current.map((todo) => (todo.id === todoId ? updated : todo)),
      );
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteTodo(todoId) {
    setError("");
    try {
      await request(`/api/todos/${todoId}`, { method: "DELETE", token });
      setTodos((current) => current.filter((todo) => todo.id !== todoId));
      if (editingId === todoId) {
        setEditingId(null);
        setTitle("");
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function startEditing(todo) {
    setEditingId(todo.id);
    setTitle(todo.title);
    document.getElementById("todo-title").focus();
  }

  function cancelEditing() {
    setEditingId(null);
    setTitle("");
  }

  if (sessionLoading) {
    return (
      <main className="page-shell">
        <Header />
        <div className="loading-state" role="status">Loading your space...</div>
      </main>
    );
  }

  if (!token || !user) {
    return (
      <main className="page-shell">
        <Header />
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR DAILY SPACE</div>
          <h1 id="auth-title">
            {mode === "login" ? "Welcome back." : "A fresh start."}
          </h1>
          <p className="intro">
            {mode === "login"
              ? "Sign in to pick up where you left off."
              : "Create an account to keep your tasks in one place."}
          </p>

          <form className="auth-form" onSubmit={handleAuth}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 8 : 1}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              required
            />
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>
              {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setError("");
                setMode(mode === "login" ? "register" : "login");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </section>
        <PageFooter />
      </main>
    );
  }

  return (
    <main className="page-shell">
      <Header
        account={user.email}
        onSignOut={signOut}
      />
      <section className="todo-panel" aria-labelledby="page-title">
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR DAILY SPACE</div>
        <div className="heading-row">
          <div>
            <h1 id="page-title">Make today<br />a good one.</h1>
            <p className="intro">Small steps add up. What would you like to get done?</p>
          </div>
          <div className="date-card" aria-label="Your todo list">
            <span className="date-icon" aria-hidden="true">✳</span>
            <span>YOUR LIST</span>
          </div>
        </div>

        <form className="todo-form" onSubmit={handleTodoSubmit}>
          <label className="sr-only" htmlFor="todo-title">
            {editingId === null ? "Add a new task" : "Edit task"}
          </label>
          <input
            id="todo-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Take a proper lunch break"
            maxLength={200}
            required
          />
          <button className="primary-button" type="submit" disabled={busy || !title.trim()}>
            {editingId === null ? "Add task" : "Save task"}
            <span aria-hidden="true">↗</span>
          </button>
          {editingId !== null && (
            <button className="cancel-button" type="button" onClick={cancelEditing}>
              Cancel
            </button>
          )}
        </form>

        {error && <div className="error-message" role="alert">{error}</div>}

        <div className="list-heading">
          <h2>Tasks <span className="count">{todos.length}</span></h2>
          <span className="remaining">{remaining} {remaining === 1 ? "thing" : "things"} left</span>
        </div>

        {todos.length === 0 ? (
          <div className="empty-state">
            <span className="empty-sparkle" aria-hidden="true">✳</span>
            <strong>A fresh start.</strong>
            <span>Add your first task above and take it one step at a time.</span>
          </div>
        ) : (
          <ul className="todo-list">
            {todos.map((todo) => (
              <li className={`todo-item${todo.completed ? " is-complete" : ""}`} key={todo.id}>
                <button
                  className="check-button"
                  type="button"
                  aria-label={todo.completed ? `Mark ${todo.title} incomplete` : `Mark ${todo.title} complete`}
                  aria-pressed={todo.completed}
                  onClick={() => updateTodo(todo.id, { completed: !todo.completed })}
                >
                  {todo.completed && <span aria-hidden="true">✓</span>}
                </button>
                <span className="todo-title">{todo.title}</span>
                <div className="todo-actions">
                  <button type="button" aria-label={`Edit ${todo.title}`} onClick={() => startEditing(todo)}>
                    Edit
                  </button>
                  <button className="delete-action" type="button" aria-label={`Delete ${todo.title}`} onClick={() => deleteTodo(todo.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {todos.length > 0 && (
          <footer className="list-footer">
            <span><span className="footer-sparkle">✳</span> Keep going at your own pace.</span>
            <span>{todos.length - remaining} done</span>
          </footer>
        )}
      </section>
      <PageFooter />
    </main>
  );
}

function Header({ account, onSignOut }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Daymark home">
        <span className="brand-mark" aria-hidden="true">d.</span>
        <span>daymark</span>
      </a>
      {account ? (
        <div className="account-actions">
          <span className="account-email">{account}</span>
          <button type="button" className="sign-out-button" onClick={onSignOut}>Sign out</button>
        </div>
      ) : (
        <span className="topbar-note">A little more focus, every day.</span>
      )}
    </header>
  );
}

function PageFooter() {
  return (
    <footer className="page-footer">
      <span>ONE THING AT A TIME.</span>
      <span>MADE FOR YOUR EVERYDAY.</span>
    </footer>
  );
}
