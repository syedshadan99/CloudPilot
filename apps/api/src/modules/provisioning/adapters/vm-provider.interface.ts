/**
 * Configuration for a VM to be provisioned.
 * Mirrors the fields in vm_requirements; self-contained in the job record.
 */
export interface VmConfig {
  cpuCores: number;
  ramGb: number;
  storageGb: number;
  os: string;
}

export interface ProvisionRequest {
  jobId: string;
  orderId: string;
  customerId: string;
  config: VmConfig;
}

export interface ProvisionResult {
  /** Unique identifier from the simulated provider (e.g. "vm-abc123") */
  simulatedVmId: string;
  /** Simulated hostname e.g. "vm-abc123.sim.cloudpilot.local" */
  hostname: string;
  /** Simulated IPv4 address */
  ipAddress: string;
}

export interface CapacityCheckResult {
  available: boolean;
  reason?: string;
}

export interface ResizeRequest {
  requestId: string;
  vmId: string;
  simulatedVmId?: string;
  oldConfig: Partial<VmConfig>;
  newConfig: Partial<VmConfig>;
}

export interface ResizeResult {
  success: boolean;
  message?: string;
}

/**
 * Replaceable provider adapter. Implement this to swap in a real cloud
 * provider without touching the provisioning service or job processor.
 *
 * The simulator used today is SimulatedVmProvider. A real provider would
 * be injected via the VM_PROVIDER token without changing any other code.
 */
export interface VirtualMachineProvider {
  /**
   * Check whether the simulated/real infrastructure can accommodate this config.
   * Must be called before creating a provisioning job.
   */
  checkCapacity(config: VmConfig): Promise<CapacityCheckResult>;

  /**
   * Run the provisioning sequence for the given request.
   * Returns identifiers once the VM is reachable. Throws on unrecoverable failure.
   */
  provision(request: ProvisionRequest): Promise<ProvisionResult>;

  /**
   * Apply a resize to an existing simulated or real VM.
   */
  resize(request: ResizeRequest): Promise<ResizeResult>;
}

export const VM_PROVIDER = Symbol("VM_PROVIDER");
