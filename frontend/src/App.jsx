import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

export default function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadTodos = useCallback(async () => {
    setError("");
    try {
      setTodos(await request("/api/todos"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  const remaining = useMemo(
    () => todos.filter((todo) => !todo.completed).length,
    [todos],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || busy) return;

    setBusy(true);
    setError("");
    try {
      if (editingId === null) {
        await request("/api/todos", {
          method: "POST",
          body: JSON.stringify({ title: cleanTitle }),
        });
      } else {
        await request(`/api/todos/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ title: cleanTitle }),
        });
      }
      setTitle("");
      setEditingId(null);
      await loadTodos();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateTodo(todoId, changes) {
    setError("");
    try {
      const updated = await request(`/api/todos/${todoId}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setTodos((current) =>
        current.map((todo) => (todo.id === todoId ? updated : todo)),
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteTodo(todoId) {
    setError("");
    try {
      await request(`/api/todos/${todoId}`, { method: "DELETE" });
      setTodos((current) => current.filter((todo) => todo.id !== todoId));
      if (editingId === todoId) {
        setEditingId(null);
        setTitle("");
      }
    } catch (err) {
      setError(err.message);
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

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Daymark home">
          <span className="brand-mark" aria-hidden="true">d.</span>
          <span>daymark</span>
        </a>
        <span className="topbar-note">A little more focus, every day.</span>
      </header>

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

        <form className="todo-form" onSubmit={handleSubmit}>
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
          <button type="submit" disabled={busy || !title.trim()}>
            {editingId === null ? "Add task" : "Save task"}
            <span aria-hidden="true">↗</span>
          </button>
          {editingId !== null && (
            <button className="cancel-button" type="button" onClick={cancelEditing}>
              Cancel
            </button>
          )}
        </form>

        {error && (
          <div className="error-message" role="alert">
            <span>{error}</span>
            <button type="button" onClick={loadTodos}>Try again</button>
          </div>
        )}

        <div className="list-heading">
          <h2>Tasks <span className="count">{todos.length}</span></h2>
          <span className="remaining">{remaining} {remaining === 1 ? "thing" : "things"} left</span>
        </div>

        {loading ? (
          <div className="empty-state" role="status">Loading your list…</div>
        ) : todos.length === 0 ? (
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

        {!loading && todos.length > 0 && (
          <footer className="list-footer">
            <span><span className="footer-sparkle">✳</span> Keep going at your own pace.</span>
            <span>{todos.length - remaining} done</span>
          </footer>
        )}
      </section>

      <footer className="page-footer">
        <span>ONE THING AT A TIME.</span>
        <span>MADE FOR YOUR EVERYDAY.</span>
      </footer>
    </main>
  );
}
