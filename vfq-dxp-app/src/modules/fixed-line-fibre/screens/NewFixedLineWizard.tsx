import { FixedActivationWizard } from '../fixedActivation/FixedActivationWizard';

// SCR-043 - New Fixed Line Activation. Now the Fixed Activation Journey (CBU): see fixedActivation/. The legacy
// config-driven wizard (InstallationActivationWizard) stays in place for FWA, which still uses it.
export function NewFixedLineWizard() {
  return <FixedActivationWizard />;
}
