import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useEntityStore } from '../../stores/entityStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { DEMO_LOGIN_PASSWORD } from '../../auth/staffIdRoleMap';
import { passwordPolicyError } from '../../auth/passwordPolicy';
import { downloadCsv } from '../../engines/csvExport';
import { Input } from '../../components/primitives/Input';
import { Button } from '../../components/primitives/Button';
import { Badge } from '../../components/primitives/Badge';
import { Select } from '../../components/primitives/Select';

// Agent 360 AEX-03: "Order, Ticket until VFQ confirms the complete list"
// (OI-AGN-07) — the entity kinds and their entityStore keys are the only
// two named as examples anywhere in the BRSD.
const EXPORTABLE_ENTITIES = [
  { value: 'orders', label: 'Orders' },
  { value: 'trouble-tickets', label: 'Tickets' },
] as const;

// Placeholder verification code — same open item as Forgot Password
// (OI-AGN-05/OI-AGN-06): VFQ Security has not confirmed the real
// Authcode/OTP mechanism for either forgot-password or in-session
// change-password/MFA identity verification.
const DEMO_VERIFICATION_CODE = '123456';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[length:var(--fs-caption)] text-muted">{label}</div>
      <div className="text-fg text-[length:var(--fs-body)]">{value || '—'}</div>
    </div>
  );
}

// Agent 360 BRSD APM-01/05/06/07/10: role-based profile view, initiate edit,
// change password (current/new/confirm), identity verification via
// Authcode/OTP, save. Previously there was no profile screen at all — an
// agent could only sign out or (as a demo affordance) switch role from the
// top-bar menu. MFA settings live alongside this on the same screen (see
// MfaSettingsSection).
export function AgentProfileWorkspace() {
  const staffId = useAuthStore((s) => s.staffId);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const loadKind = useEntityStore((s) => s.loadKind);
  const orders = useEntityStore((s) => s.records.orders) ?? [];
  const tickets = useEntityStore((s) => s.records['trouble-tickets']) ?? [];

  const [exportEntity, setExportEntity] = useState<(typeof EXPORTABLE_ENTITIES)[number]['value']>('orders');

  useEffect(() => {
    loadKind('orders');
    loadKind('trouble-tickets');
  }, [loadKind]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [mfaEditing, setMfaEditing] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<'Authenticator App' | 'SMS OTP'>(profile?.mfaMethod ?? 'Authenticator App');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);

  const submitPasswordChange = () => {
    setSaved(false);
    if (currentPassword !== DEMO_LOGIN_PASSWORD) {
      setError('Current password is incorrect.');
      return;
    }
    if (verificationCode !== DEMO_VERIFICATION_CODE) {
      setError('Invalid or expired verification code.');
      return;
    }
    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setError(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setVerificationCode('');
    setSaved(true);
    pushToast('success', 'Password changed.');
  };

  // BR-02 / APM-07/08: MFA change requires identity verification before it
  // takes effect. "Privileges approved by VFQ Security" (BR-02) is left as
  // self-service here since no distinct privilege matrix is confirmed for
  // this action (OI-AGN-06) — every authenticated agent manages their own
  // MFA, gated only by the verification-code step below.
  const toggleMfa = () => {
    if (profile?.mfaEnabled) {
      setProfile({ ...profile, mfaEnabled: false });
      pushToast('info', 'MFA disabled.');
      return;
    }
    setMfaEditing(true);
  };

  const submitMfaEnable = () => {
    if (mfaCode !== DEMO_VERIFICATION_CODE) {
      setMfaError('Invalid or expired verification code.');
      return;
    }
    if (!profile) return;
    setMfaError(null);
    setProfile({ ...profile, mfaEnabled: true, mfaMethod });
    setMfaEditing(false);
    setMfaCode('');
    pushToast('success', `MFA enabled via ${mfaMethod}.`);
  };

  // APM-09: "change language from available options" — English/Arabic per
  // DF-AGT-008, subject to VFQ confirming completeness (D-03). Persisted on
  // the profile so it carries across sessions like MFA settings, and read
  // by App.tsx to mirror the layout (dir="rtl") for Arabic.
  const changeLanguage = (language: 'English' | 'العربية') => {
    if (!profile) return;
    setProfile({ ...profile, language });
    pushToast('success', language === 'English' ? 'Language set to English.' : 'تم تعيين اللغة إلى العربية.');
  };

  const exportRecords = exportEntity === 'orders' ? orders : tickets;

  // AEX-02: "export all visible entity records... irrespective of whether
  // they are assigned to the logged-in agent" — every record this agent's
  // session has already loaded counts as visible, matching the app's
  // existing lack of per-agent row filtering on these two entities.
  const exportEntities = () => {
    downloadCsv(`${exportEntity}-export-${new Date().toISOString().slice(0, 10)}.csv`, exportRecords);
    pushToast('success', `Exported ${exportRecords.length} ${exportEntity === 'orders' ? 'order(s)' : 'ticket(s)'}.`);
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">Agent Profile</h1>
      <p className="text-fg-2 mb-6">View your details and manage your password and MFA settings.</p>

      <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" value={profile?.name ?? ''} />
          <Field label="Staff ID" value={staffId} />
          <Field label="Job Title" value={profile?.jobTitle ?? ''} />
          <Field label="Team" value={profile?.team ?? ''} />
        </div>
      </div>

      <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
        <h2 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-1">Change password</h2>
        <p className="text-fg-2 text-[length:var(--fs-caption)] mb-4">
          Requires your current password and a verification code. (Demo code: {DEMO_VERIFICATION_CODE} — pending VFQ Security's
          real Authcode/OTP method.)
        </p>
        <div className="space-y-3">
          <Input label="Current password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <Input label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <Input label="Confirm new password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <Input id="password-verification-code" label="Verification code" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} />
          {error && <p className="text-danger text-[length:var(--fs-caption)]">{error}</p>}
          {saved && <Badge variant="success">Password updated</Badge>}
          <div className="pt-1">
            <Button
              variant="primary-rect"
              onClick={submitPasswordChange}
              disabled={!currentPassword || !newPassword || !confirmPassword || !verificationCode}
            >
              Save password
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5 mt-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[length:var(--fs-body-lg)] font-medium text-fg">Multi-factor authentication</h2>
          <Badge variant={profile?.mfaEnabled ? 'success' : 'filled-neutral'}>{profile?.mfaEnabled ? 'Enabled' : 'Disabled'}</Badge>
        </div>
        {profile?.mfaEnabled && (
          <p className="text-fg-2 text-[length:var(--fs-caption)] mb-4">Method: {profile.mfaMethod}</p>
        )}
        {!mfaEditing && (
          <Button variant="ghost-rect" onClick={toggleMfa}>
            {profile?.mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
          </Button>
        )}
        {mfaEditing && (
          <div className="space-y-3 mt-2">
            <Select
              label="Authenticator method"
              value={mfaMethod}
              onChange={(e) => setMfaMethod(e.target.value as 'Authenticator App' | 'SMS OTP')}
              options={[
                { value: 'Authenticator App', label: 'Authenticator App' },
                { value: 'SMS OTP', label: 'SMS OTP' },
              ]}
            />
            <Input id="mfa-verification-code" label="Verification code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} />
            {mfaError && <p className="text-danger text-[length:var(--fs-caption)]">{mfaError}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="ghost-rect" onClick={() => { setMfaEditing(false); setMfaCode(''); setMfaError(null); }}>
                Cancel
              </Button>
              <Button variant="primary-rect" onClick={submitMfaEnable} disabled={!mfaCode}>
                Save MFA settings
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5 mt-6">
        <h2 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-1">Language</h2>
        <p className="text-fg-2 text-[length:var(--fs-caption)] mb-4">
          Choose your preferred language. (English/Arabic — completeness pending VFQ confirmation, D-03.)
        </p>
        <Select
          label="Language"
          value={profile?.language ?? 'English'}
          onChange={(e) => changeLanguage(e.target.value as 'English' | 'العربية')}
          options={[
            { value: 'English', label: 'English' },
            { value: 'العربية', label: 'العربية (Arabic)' },
          ]}
        />
      </div>

      <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5 mt-6">
        <h2 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-1">Export your data</h2>
        <p className="text-fg-2 text-[length:var(--fs-caption)] mb-4">
          Download a CSV of every visible record for an entity type. (Entity list: Orders, Tickets — pending VFQ's confirmation
          of the complete list, OI-AGN-07.)
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Select
              label="Entity type"
              value={exportEntity}
              onChange={(e) => setExportEntity(e.target.value as (typeof EXPORTABLE_ENTITIES)[number]['value'])}
              options={[...EXPORTABLE_ENTITIES]}
            />
          </div>
          <Button variant="primary-rect" onClick={exportEntities} disabled={exportRecords.length === 0}>
            Export {exportRecords.length} record{exportRecords.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </div>
  );
}
