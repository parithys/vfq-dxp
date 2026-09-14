import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/primitives/Badge';
import { Button } from '../../components/primitives/Button';
import { Select } from '../../components/primitives/Select';
import { useEntityStore } from '../../stores/entityStore';
import { usePersonaStore } from '../../stores/personaStore';
import { useNotificationStore } from '../../stores/notificationStore';
import * as mockDataEngine from '../../engines/mockDataEngine';

// Agent 360 ATV-06 / Annex_02: Task status model — "Open -> Assigned/In
// Progress/Closed -> (In Progress/Closed) -> Closed; no transition out of
// Closed." Passed to mockDataEngine.transition() so this is a real,
// falsifiable guard rather than the previous UI-only button-hiding (which
// a direct store call could bypass entirely).
const TASK_STATUS_TRANSITIONS: string[][] = [
  ['Open', 'Assigned'],
  ['Open', 'In Progress'],
  ['Open', 'Closed'],
  ['Assigned', 'In Progress'],
  ['Assigned', 'Closed'],
  ['In Progress', 'Closed'],
];

interface AgentDirectoryEntry {
  userId: string;
  firstName: string;
  lastName: string;
}

interface AgentTask {
  taskId: string;
  taskName: string;
  taskDescription?: string;
  taskType: string;
  taskStatus: string;
  priorityFlag: boolean;
  assignedAgentId: string | null;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'filled-neutral' | 'outlined-red'> = {
  Open: 'warning',
  Assigned: 'filled-neutral',
  'In Progress': 'outlined-red',
  Closed: 'success',
};

// Agent 360 ATV-04/06 (detail view + status transitions) and ATV-03/BR-05
// (supervisor-only assignment). The Assign control below only renders for
// PERSONA-024 (Supervisor) — the one BRSD role with an existing, matching
// persona record, so this gate is grounded rather than an invented role
// check (see the validation report's note on PERSONA-024's own documented
// "no cross-agent view exists" gap, which this closes for tasks specifically).
export function TaskDetailView() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const tasks = (useEntityStore((s) => s.records.tasks) ?? []) as unknown as AgentTask[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const isSupervisor = activePersonaId === 'PERSONA-024';
  const pushToast = useNotificationStore((s) => s.pushToast);

  const [assignTo, setAssignTo] = useState('');
  const [agents, setAgents] = useState<AgentDirectoryEntry[]>([]);

  useEffect(() => {
    loadKind('tasks');
  }, [loadKind]);

  // Real userIds, not free text — an assignment has to produce an ID that
  // actually matches the assignee's authStore.profile.userId on their next
  // login, or ATV-02's per-agent scoping (agentTaskEngine.ts) would never
  // show them this task.
  useEffect(() => {
    mockDataEngine.list<AgentDirectoryEntry>('users-agents').then(setAgents);
  }, []);

  const task = tasks.find((t) => t.taskId === taskId);
  if (!task) {
    return <div className="p-8 text-fg-2">No task selected — go back to My Tasks and pick one from a category.</div>;
  }

  const applyStatusTransition = (toState: string, patch: Record<string, unknown>) => {
    const result = mockDataEngine.transition(TASK_STATUS_TRANSITIONS, task.taskStatus, toState);
    if (!result.ok) {
      pushToast('error', result.reason ?? `Cannot move task from ${task.taskStatus} to ${toState}.`);
      return;
    }
    updateRecord('tasks', 'taskId', task.taskId, patch);
  };

  const moveToInProgress = () => applyStatusTransition('In Progress', { taskStatus: 'In Progress' });
  const closeTask = () => applyStatusTransition('Closed', { taskStatus: 'Closed' });
  const assign = () => {
    if (!assignTo.trim()) return;
    // Assignment always sets the owner; it only drives the Open -> Assigned
    // status transition for a still-open task. Reassigning a task already
    // In Progress/Assigned changes the owner without illegally moving
    // status sideways or backward per the Annex_02 model above.
    if (task.taskStatus === 'Open') {
      applyStatusTransition('Assigned', { assignedAgentId: assignTo.trim(), taskStatus: 'Assigned' });
    } else {
      updateRecord('tasks', 'taskId', task.taskId, { assignedAgentId: assignTo.trim() });
    }
    setAssignTo('');
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">{task.taskName}</h1>
        <Badge variant={STATUS_VARIANT[task.taskStatus] ?? 'filled-neutral'}>{task.taskStatus}</Badge>
        {task.priorityFlag && <Badge variant="danger">Priority</Badge>}
      </div>
      <p className="text-fg-2 mb-6">
        {task.taskId} · {task.taskType} · Created {new Date(task.createdAt).toLocaleString()}
      </p>

      <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5 mb-6">
        <div className="text-[length:var(--fs-caption)] text-muted mb-1">Description</div>
        <p className="text-fg text-[length:var(--fs-body)]">{task.taskDescription || 'No description on file.'}</p>
        <div className="text-[length:var(--fs-caption)] text-muted mt-4 mb-1">Assigned to</div>
        <p className="text-fg text-[length:var(--fs-body)]">{task.assignedAgentId ?? 'Unassigned'}</p>
      </div>

      {task.taskStatus !== 'Closed' && (
        <div className="flex flex-wrap gap-2 mb-6">
          {task.taskStatus !== 'In Progress' && (
            <Button variant="ghost-rect" onClick={moveToInProgress}>
              Move to In Progress
            </Button>
          )}
          <Button variant="primary-rect" onClick={closeTask}>
            Close task
          </Button>
          <Button variant="ghost-rect" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      )}

      {isSupervisor && task.taskStatus !== 'Closed' && (
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
          <h2 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-1">Assign to a team member</h2>
          <p className="text-fg-2 text-[length:var(--fs-caption)] mb-3">Supervisor-only action (BR-05).</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select
                placeholder="Select a team member"
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                options={agents.map((a) => ({ value: a.userId, label: `${a.firstName} ${a.lastName}` }))}
              />
            </div>
            <Button variant="primary-rect" onClick={assign} disabled={!assignTo.trim()}>
              Assign
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
