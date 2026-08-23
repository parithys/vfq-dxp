import { registerScreen } from '../../screenRegistry';
import { NewPostpaidWizard } from './NewPostpaidWizard';

// SCR-154/155/156/159/157/158/160/161/162 are steps of the same single-page
// guided wizard (Pattern 1) — all nine route entries resolve to it.
registerScreen('SCR-154', NewPostpaidWizard);
registerScreen('SCR-155', NewPostpaidWizard);
registerScreen('SCR-156', NewPostpaidWizard);
registerScreen('SCR-157', NewPostpaidWizard);
registerScreen('SCR-158', NewPostpaidWizard);
registerScreen('SCR-159', NewPostpaidWizard);
registerScreen('SCR-160', NewPostpaidWizard);
registerScreen('SCR-161', NewPostpaidWizard);
registerScreen('SCR-162', NewPostpaidWizard);
