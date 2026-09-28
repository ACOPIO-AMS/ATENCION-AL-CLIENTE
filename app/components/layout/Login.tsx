"use client";

type LoginProps = {
  user: string;
  pin: string;
  busy: boolean;
  error: string;
  onUserChange: (value: string) => void;
  onPinChange: (value: string) => void;
  onLogin: () => void;
};

export default function Login({
  user,
  pin,
  busy,
  error,
  onUserChange,
  onPinChange,
  onLogin,
}: LoginProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "linear-gradient(135deg,#eef3f6,#dfe9ee)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 410,
          background: "#fff",
          borderRadius: 18,
          padding: 28,
          boxShadow: "0 18px 50px rgba(0,0,0,.14)",
          border: "1px solid #dce5e9",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 2,
              color: "#667b86",
            }}
          >
            ANALYTICA MINERAL SERVICES SAC
          </div>

          <h1
            style={{
              margin: "10px 0 4px",
              fontSize: 25,
              color: "#18364a",
            }}
          >
            ATENCIÓN AL CLIENTE
          </h1>

          <div style={{ color: "#71838c", fontSize: 14 }}>
            Inicio de sesión
          </div>
        </div>

        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 900,
            marginBottom: 6,
            color: "#344c59",
          }}
        >
          USUARIO
        </label>

        <input
          value={user}
          onChange={(e) => onUserChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") onLogin();
          }}
          autoComplete="username"
          autoFocus
          placeholder="Ingresa tu usuario"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "13px 14px",
            borderRadius: 10,
            border: "1px solid #bdcbd2",
            fontSize: 16,
            marginBottom: 16,
            textTransform: "uppercase",
          }}
        />

        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 900,
            marginBottom: 6,
            color: "#344c59",
          }}
        >
          PIN
        </label>

        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) =>
            onPinChange(e.target.value.replace(/\D/g, ""))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") onLogin();
          }}
          autoComplete="current-password"
          placeholder="••••"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "13px 14px",
            borderRadius: 10,
            border: "1px solid #bdcbd2",
            fontSize: 18,
            marginBottom: 12,
            letterSpacing: 3,
          }}
        />

        {error && (
          <div
            style={{
              margin: "4px 0 12px",
              padding: "10px 12px",
              borderRadius: 9,
              background: "#fff1f1",
              color: "#a52020",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={onLogin}
          disabled={busy}
          style={{
            width: "100%",
            border: 0,
            borderRadius: 10,
            padding: "14px 16px",
            fontWeight: 900,
            fontSize: 14,
            cursor: busy ? "wait" : "pointer",
            background: "#18364a",
            color: "#fff",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "VALIDANDO..." : "INICIAR SESIÓN"}
        </button>
      </div>
    </main>
  );
}
