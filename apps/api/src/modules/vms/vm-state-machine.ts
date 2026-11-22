/**
 * VM state machine — only these states and transitions are legal.
 *
 * Roadmap P9 / workflow-D:
 *   PROVISIONING → RUNNING            (provisioning job reaches READY)
 *   RUNNING      → STOPPING           (stop action)
 *   STOPPING     → STOPPED            (stop completes)
 *   STOPPED      → RUNNING            (restart / start action)
 *   RUNNING      → TERMINATED         (terminate action — irreversible)
 *   STOPPED      → TERMINATED         (terminate while stopped)
 *
 * PROVISIONING and TERMINATED are terminal from an action perspective
 * (no customer action is allowed from PROVISIONING; TERMINATED cannot change).
 */
export type VmState =
  | "PROVISIONING"
  | "RUNNING"
  | "STOPPING"
  | "STOPPED"
  | "TERMINATED"
  | "RESIZING";

export type VmAction = "START" | "STOP" | "RESTART" | "TERMINATE";

/** Legal transitions: [fromState, action] → toState */
const TRANSITIONS: Record<string, Record<string, VmState>> = {
  RUNNING: {
    STOP:      "STOPPING",
    TERMINATE: "TERMINATED",
  },
  STOPPING: {
    // STOPPING → STOPPED is set by the system, not by customer action.
  },
  STOPPED: {
    START:     "RUNNING",
    RESTART:   "RUNNING",
    TERMINATE: "TERMINATED",
  },
  RESIZING: {
    // RESIZING blocks all customer actions; transitions are system-controlled.
  },
};

/**
 * Returns the next state for a given action, or null if the transition
 * is illegal from the current state.
 */
export function resolveTransition(
  current: VmState,
  action: VmAction,
): VmState | null {
  return TRANSITIONS[current]?.[action] ?? null;
}

/**
 * Returns true if the action is allowed from the current state.
 */
export function isTransitionAllowed(current: VmState, action: VmAction): boolean {
  return resolveTransition(current, action) !== null;
}
