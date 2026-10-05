import { useState } from 'react';
import { Icon } from '../components/primitives/Icon';
import { VodafoneMark } from '../components/primitives/VodafoneMark';
import { Tooltip } from '../components/primitives/Tooltip';
import { PRIMARY_SURFACE } from '../components/primitives/Button';
import { useAuthStore } from '../stores/authStore';
import { usePersonaStore } from '../stores/personaStore';
import { pickProfileForRole } from '../engines/agentProfileEngine';
import { useEnterToSubmit } from '../hooks/useEnterToSubmit';
import { DEMO_LOGIN_PASSWORD, resolveRoleFromStaffId } from './staffIdRoleMap';
import { ForgotPasswordFlow } from './ForgotPasswordFlow';
import { LOGIN_METRICS } from '../data/synthetic/loginMetrics';

const ICONS = {
  shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z M9.5 12l1.8 1.8L15 10',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z',
  users: 'M8 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c.6-3.4 3-5.5 5.5-5.5s4.9 2.1 5.5 5.5 M16.5 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M15.5 13.2c2.2.5 3.9 2.3 4.3 4.8',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3.2 2',
  checkCircle: 'M21 11.5a9 9 0 1 1-5.3-8.2 M21 4.5l-9 9-3-3',
  gift: 'M4 10h16v10H4z M4 10V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3 M12 10V5 M12 5c0-1.2-1-2.5-2.5-2.5S7 3.8 7 5c0 1.2 1.1 2 2.5 2H12z M12 5c0-1.2 1-2.5 2.5-2.5S17 3.8 17 5c0 1.2-1.1 2-2.5 2H12z',
  trendUp: 'M4 16l6-6 4 4 6-8 M14 6h6v6',
  minus: 'M5 12h14',
  arrowRight: 'M5 12h14 M13 6l6 6-6 6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18 M10.6 10.6a3 3 0 0 0 4.2 4.2 M9.9 5.1A10.8 10.8 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.1 3.9 M6.2 6.2A17.7 17.7 0 0 0 2 12s4 7 10 7c1.4 0 2.7-.3 3.8-.8',
  helpCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9.2 9a2.8 2.8 0 1 1 3.9 2.6c-.9.4-1.4 1-1.4 2 M12 17h.01',
};



// New auth gate - not evidenced in the source corpus (no SCR- id); implements
// the split-panel login mock supplied directly by the user. The "Sign in with
// SSO" action is fully mocked (no backend/IdP), consistent with every other
// simulated action in this app. Role is not user-selectable: it's derived
// from the entered Staff ID via staffIdRoleMap.ts, then carried through
// post-login the same way a manually picked persona used to be.
//
// Credential validation (Agent 360 BRSD JSM-01 / Annex_02 "Login Failed"
// state): an unrecognised Staff ID or wrong password now genuinely blocks
// sign-in with an inline error, instead of silently defaulting to a role.
// The password check is against a placeholder demo credential
// (DEMO_LOGIN_PASSWORD) - see staffIdRoleMap.ts for why.
//
// JSM-01 itself ("Reuse requirement TT-001-JSM-*") is a reuse-stub in the
// BRSD's own requirements register - it names no inline Acceptance Criteria
// and points at a source document (TT-001-JSM-*) that isn't present in this
// corpus, which the compliance audit flagged as making the requirement
// unverifiable as literally written, independent of whether login itself
// works. Since no code change can supply a missing external document, this
// comment records the concrete, testable behavior this screen actually
// implements, so a future audit has a real AC to check against rather than
// an unresolved stub:
//   1. An agent submits a Staff ID and a password (both required).
//   2. An unrecognised Staff ID is rejected with "Staff ID not recognised."
//      and sign-in does not proceed (handleSignIn, below).
//   3. A recognised Staff ID with the wrong password is rejected with
//      "Incorrect password." and sign-in does not proceed.
//   4. Only when both checks pass does the agent's persona/profile resolve
//      and signIn() fire, matching Annex_02's Login Initiated -> Login
//      Failed -> Login Initiated / Login Initiated -> Authenticated ->
//      Session Active state model.
// Closing this open item fully still requires either the actual TT-001-
// JSM-* text or a formal business sign-off that the above satisfies intent.
export function LoginPage() {
  const signIn = useAuthStore((s) => s.signIn);
  const setActivePersona = usePersonaStore((s) => s.setActivePersona);

  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const handleSignIn = async () => {
    if (signingIn) return;
    setLoginError(null);

    if (!staffId.trim() || !password) {
      setLoginError('Enter your Staff ID and password.');
      return;
    }

    setSigningIn(true);
    const resolvedRole = resolveRoleFromStaffId(staffId);
    if (!resolvedRole) {
      setLoginError('Staff ID not recognised.');
      setSigningIn(false);
      return;
    }
    if (password !== DEMO_LOGIN_PASSWORD) {
      setLoginError('Incorrect password.');
      setSigningIn(false);
      return;
    }

    setActivePersona(resolvedRole.personaId);
    const profile = await pickProfileForRole(resolvedRole.personaId);

    // Land every sign-in on the Dashboard.
    //
    // <BrowserRouter> is mounted by App only once isAuthenticated flips, so it
    // reads window.location at that moment - whatever URL the browser happened
    // to be left on. Signing out at /mobile/sim-device and back in therefore
    // dropped you straight back there, skipping the landing page entirely, and
    // could drop a role onto a destination its approach doesn't even include.
    //
    // This uses the History API rather than useNavigate deliberately: LoginPage
    // renders OUTSIDE the router (App returns it before <BrowserRouter>), so no
    // router hook is available here. Rewriting the URL before signIn() means the
    // router mounts already pointing at '/', so there is no visible redirect.
    if (window.location.pathname !== '/' || window.location.search) {
      window.history.replaceState(null, '', '/');
    }

    signIn(staffId, profile);
  };

  const handleFormKeyDown = useEnterToSubmit(!signingIn, handleSignIn);

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans">
      {/* Sign-in panel - ordered after the brand panel on md:+ to match the
          reference layout (dark brand story left, focused form right); DOM
          order (and therefore tab order) is untouched, only visual order. */}
      <div className="w-full md:w-[420px] shrink-0 md:order-2 bg-charcoal-panel text-white flex flex-col justify-between px-10 py-10">
        <div className="flex items-center gap-2">
          <VodafoneMark />
          <span className="text-[length:var(--fs-h5)] font-bold">Vodafone</span>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-[length:var(--fs-h3)] font-extrabold mb-2">Welcome back</h1>
            <p className="text-white/60 text-[length:var(--fs-body)]">
              Authorised staff access only. All activity is monitored and logged.
            </p>
          </div>

          <div className="space-y-5" onKeyDown={handleFormKeyDown}>
            {loginError && (
              <div role="alert" className="rounded-[var(--radius-sm)] border border-danger/50 bg-danger/10 px-3 py-2.5 text-[length:var(--fs-caption)] text-white">
                {loginError}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="staff-id" className="text-[length:var(--fs-caption)] text-white/70">Staff ID</label>
              <input
                id="staff-id"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="e.g. VFQ-12345"
                className="rounded-[var(--radius-sm)] border border-white/15 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/35 focus:outline-none focus-visible:border-accent"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-[length:var(--fs-caption)] text-white/70">Password</label>
                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(true)}
                  className="text-[length:var(--fs-caption)] text-white/70 underline underline-offset-2 hover:text-white"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-[var(--radius-sm)] border border-white/15 bg-white/5 px-3 py-2.5 pr-10 text-white placeholder:text-white/35 focus:outline-none focus-visible:border-accent"
                />
                <Tooltip content={showPassword ? 'Hide password' : 'Show password'} placement="top">
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    <Icon path={showPassword ? ICONS.eyeOff : ICONS.eye} className="w-4.5 h-4.5" />
                  </button>
                </Tooltip>
              </div>
            </div>

            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className={`w-full flex items-center justify-center gap-2 rounded-[var(--radius-btn)] border ${PRIMARY_SURFACE} enabled:hover:bg-[image:var(--accent-gradient-hover)] enabled:active:scale-[0.99] disabled:opacity-60 font-medium py-3 transition-[color,border-color,transform]`}
            >
              {signingIn ? 'Signing in…' : 'Sign In'}
              {!signingIn && <Icon path={ICONS.arrowRight} className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <button
              onClick={() => setHelpOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[length:var(--fs-caption)] text-white/60 hover:text-white"
            >
              <Icon path={ICONS.helpCircle} className="w-4 h-4" />
              Help &amp; support
            </button>
            {helpOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-64 rounded-[var(--radius-card)] border border-white/15 bg-charcoal-panel shadow-raised z-50 p-4">
                <p className="text-white font-medium mb-1">Help &amp; support</p>
                <p className="text-white/70 text-[length:var(--fs-body)]">
                  Contact the IT Service Desk at <span className="text-link">servicedesk@vodafone.qa</span> or extension 4100 for platform issues.
                </p>
              </div>
            )}
          </div>
          <p className="text-[length:var(--fs-caption)] text-white/35">
            Vodafone Qatar W.L.L. · Authorised use only · VFQ-DXP v3.4.1
          </p>
        </div>
      </div>

      {/* Brand/metrics panel - background (public/brand/login-bg.jpg) is a
          real photo of the Doha, Qatar skyline at night (West Bay towers incl.
          Aspire Tower/Doha Tower), by Hongbin (@hbsun2013) on Unsplash
          (unsplash.com/photos/a-city-skyline-at-night-5jvAmqV4W-c), used under
          the Unsplash License. A light scrim keeps the photo itself visible;
          the KPI cards below get their own backdrop-blur glass treatment
          (rather than a heavy opaque fill) so they read as sitting in the
          scene instead of pasted flat on top of it, while still staying
          legible against whatever's directly behind them. */}
      <div className="relative flex-1 px-8 md:px-16 py-10 flex flex-col justify-between text-white md:order-1 overflow-hidden bg-[var(--login-bg)]">
        <img src="/brand/login-bg.jpg" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[image:var(--login-scrim)]" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block shrink-0" />
              <span className="text-[length:var(--fs-caption-upper)] uppercase tracking-wide text-white/80">
                Today&rsquo;s store performance · {today}
              </span>
            </div>
            <span className="hidden sm:flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-white/10 px-3 py-1 text-[length:var(--fs-caption)] text-white/80 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
              Live store data
            </span>
          </div>
          <h2 className="text-[length:var(--fs-h1)] font-black leading-[1.02] mb-3">Operational overview</h2>
          <p className="text-white/85 text-[length:var(--fs-lead)] max-w-xl">
            Real-time store and operations metrics. Review your team&rsquo;s performance before entering the portal.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
            {LOGIN_METRICS.map((m) => (
              <div key={m.label} className="rounded-[var(--radius-card)] border border-white/15 bg-white/10 backdrop-blur-md shadow-[var(--shadow-login-card)] p-5">
                <div className="flex items-center justify-between mb-6">
                  <span className="w-9 h-9 rounded-[10px] bg-white/10 flex items-center justify-center">
                    <Icon path={ICONS[m.icon]} className="w-4.5 h-4.5" />
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5 text-[length:var(--fs-caption)] font-medium ${
                      m.trend === 'up' ? 'bg-success/15 text-success' : 'bg-white/10 text-white/70'
                    }`}
                  >
                    <Icon path={m.trend === 'up' ? ICONS.trendUp : ICONS.minus} className="w-3 h-3" />
                    {m.trend === 'up' ? 'Up' : 'Stable'}
                  </span>
                </div>
                <div className="text-[length:var(--fs-h3)] font-extrabold mb-1">{m.value}</div>
                <div className="font-semibold text-[length:var(--fs-body)]">{m.label}</div>
                <div className="text-white/70 text-[length:var(--fs-caption)]">{m.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative pt-6 mt-6 border-t border-white/20 flex items-center justify-between text-white/60 text-[length:var(--fs-caption)]">
          <span>Metrics refresh every 5 minutes · Last updated just now</span>
          <span className="text-white/40">VFQ-DXP v3.4.1</span>
        </div>
      </div>

      <ForgotPasswordFlow open={forgotPasswordOpen} onClose={() => setForgotPasswordOpen(false)} initialStaffId={staffId} />
    </div>
  );
}
