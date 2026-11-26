import { useState, type FormEvent } from "react";
import { Activity, ArrowRight, Eye, EyeOff, ShieldCheck, Zap } from "lucide-react";
import { useAuth } from "./AuthContext";

export default function AuthScreen() {
  const { login, register, error, clearError } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register({ name, email, password, organizationName });
    } catch { /* AuthContext exposes a safe user-facing error. */ }
    finally { setBusy(false); }
  };

  const changeMode = (next: "login" | "register") => {
    setMode(next);
    clearError();
  };

  return <main className="auth-layout">
    <section className="auth-story">
      <div className="auth-brand"><span><Zap size={21} fill="currentColor"/></span><strong>voltwise</strong></div>
      <div className="auth-story-copy">
        <div className="auth-eyebrow"><Activity size={14}/> ENTERPRISE ENERGY INTELLIGENCE</div>
        <h1>Make every<br/><em>watt</em> work smarter.</h1>
        <p>One intelligent workspace to understand energy performance, uncover opportunities, and make confident operational decisions.</p>
        <div className="auth-proof"><span><ShieldCheck size={16}/> Tenant-isolated workspaces</span><span><Activity size={16}/> Operational intelligence</span></div>
      </div>
      <div className="auth-story-foot">VOLTWISE · ENERGY OPERATIONS PLATFORM</div>
    </section>
    <section className="auth-panel-wrap">
      <div className="auth-panel">
        <div className="auth-mobile-brand"><Zap size={18} fill="currentColor"/> voltwise</div>
        <div className="auth-heading"><div className="auth-kicker">WELCOME TO VOLTWISE</div><h2>{mode === "login" ? "Welcome back" : "Create your workspace"}</h2><p>{mode === "login" ? "Sign in to continue to your energy operations." : "Set up your account and organization in minutes."}</p></div>
        <div className="auth-tabs"><button type="button" className={mode === "login" ? "selected" : ""} onClick={() => changeMode("login")}>Sign in</button><button type="button" className={mode === "register" ? "selected" : ""} onClick={() => changeMode("register")}>Create account</button></div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <><label>Full name<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Alex Morgan" minLength={2} maxLength={100} required/></label><label>Organization name<input autoComplete="organization" value={organizationName} onChange={event => setOrganizationName(event.target.value)} placeholder="Northstar Industries" minLength={2} maxLength={120} required/></label></>}
          <label>Work email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" maxLength={254} required/></label>
          <label>Password<span className="password-wrap"><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === "login" ? "Enter your password" : "At least 10 characters"} minLength={mode === "login" ? 1 : 10} maxLength={128} required/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in to workspace" : "Create workspace"} <ArrowRight size={16}/></button>
        </form>
        <div className="auth-security"><ShieldCheck size={15}/> Protected with secure session management</div>
        <p className="auth-terms">By continuing, you agree to your organization's access and security policies.</p>
      </div>
    </section>
  </main>;
}
