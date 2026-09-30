"use client";

import "./login.css";

type Props = {
  user: string;
  pin: string;
  loading?: boolean;
  error?: string;
  onUserChange: (value: string) => void;
  onPinChange: (value: string) => void;
  onSubmit: () => void;
};

export default function LoginScreen({
  user,
  pin,
  loading = false,
  error = "",
  onUserChange,
  onPinChange,
  onSubmit,
}: Props) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!loading) {
      onSubmit();
    }
  }

  return (
    <main className="ams-login-page">
      <div className="ams-login-overlay" />

      <section className="ams-login-card">
        <div className="ams-login-brand">
          <div className="ams-login-logo">
            AMS
          </div>

          <div className="ams-login-brand-text">
            <h1>AMS ACOPIO</h1>
            <p>Sistema de operaciones</p>
          </div>
        </div>

        <div className="ams-login-line" />

        <h2>Inicio de sesión</h2>

        <form
          className="ams-login-form"
          onSubmit={handleSubmit}
        >
          <label htmlFor="ams-user">
            USUARIO
          </label>

          <div className="ams-login-input-wrap">
            <span
              className="ams-login-input-icon"
              aria-hidden="true"
            >
              ♙
            </span>

            <input
              id="ams-user"
              type="text"
              value={user}
              onChange={(e) =>
                onUserChange(e.target.value)
              }
              autoComplete="username"
              placeholder="Usuario"
              disabled={loading}
            />
          </div>

          <label htmlFor="ams-pin">
            PIN
          </label>

          <div className="ams-login-input-wrap">
            <span
              className="ams-login-input-icon"
              aria-hidden="true"
            >
              🔒
            </span>

            <input
              id="ams-pin"
              type="password"
              value={pin}
              onChange={(e) =>
                onPinChange(e.target.value)
              }
              autoComplete="current-password"
              placeholder="••••"
              disabled={loading}
            />
          </div>

          {error && (
            <div
              className="ams-login-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            className="ams-login-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "INGRESANDO..."
              : "INICIAR SESIÓN"}
          </button>
        </form>

        <div className="ams-login-footer">
          <div>
            <span aria-hidden="true">🚚</span>
            <strong>ACOPIO</strong>
          </div>

          <span className="ams-login-divider" />

          <div>
            <span aria-hidden="true">⚙</span>
            <strong>OPERACIONES</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
