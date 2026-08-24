import type { AgentProfile } from '../stores/authStore';
import { getPersona } from './configEngine';
import * as mockDataEngine from './mockDataEngine';

interface UserAgentRecord {
  userId: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  team: string;
}

// No real login/session directory exists in the mock data — the 3 seeded
// users-agents.json records stand in for "who's signed in," matched by a
// loose keyword against the selected persona's name/type. Falls back to the
// first seeded agent (a Sales Agent) when nothing matches or no role is
// chosen. Shared by LoginPage (initial sign-in) and PersonaSwitcher
// (switching role from the profile menu) so the displayed identity — name,
// job title, team — always matches the active persona in both places,
// instead of only being resolved once at login.
export async function pickProfileForRole(personaId: string): Promise<AgentProfile> {
  const agents = await mockDataEngine.list<UserAgentRecord>('users-agents');
  const persona = getPersona(personaId);
  const haystack = `${persona?.name ?? ''} ${persona?.type ?? ''}`.toLowerCase();
  const match =
    (haystack.includes('fulfilment') && agents.find((a) => a.team.toLowerCase().includes('fulfilment'))) ||
    (/(manager|approver)/.test(haystack) && agents.find((a) => a.jobTitle.toLowerCase().includes('manager'))) ||
    agents[0];
  return { userId: match.userId, name: `${match.firstName} ${match.lastName}`, jobTitle: match.jobTitle, team: match.team };
}
