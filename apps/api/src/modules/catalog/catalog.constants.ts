export const STORAGE_TYPES = ["hdd", "ssd", "nvme"] as const;
export type StorageType = (typeof STORAGE_TYPES)[number];

export const TEMPLATE_AVAILABILITY = ["available", "limited", "unavailable", "retired"] as const;
export type TemplateAvailability = (typeof TEMPLATE_AVAILABILITY)[number];

export const SUPPORTED_OPERATING_SYSTEMS = [
  "Ubuntu 24.04 LTS",
  "Debian 12",
  "Rocky Linux 9",
  "Windows Server 2022",
] as const;

export const RESOURCE_LIMITS = {
  cpuCores: { min: 1, max: 256 },
  ramGb: { min: 1, max: 4096 },
  storageGb: { min: 1, max: 65536 },
  bandwidthMbps: { min: 1, max: 100000 },
} as const;

export const MAX_PAGE_SIZE = 100;
