import { registerScreen } from '../../screenRegistry';
import { NewPrepaidWizard } from './NewPrepaidWizard';

// SCR-190/191/192 are three steps of the same single-page guided wizard
// (Pattern 1) — all three route entries open the same component, matching
// how the source guided-journey screenshots show one wizard advancing through
// accordion steps without a URL change per step.
registerScreen('SCR-190', NewPrepaidWizard);
registerScreen('SCR-191', NewPrepaidWizard);
registerScreen('SCR-192', NewPrepaidWizard);
