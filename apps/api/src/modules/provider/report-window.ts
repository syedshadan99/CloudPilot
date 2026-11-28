import { BadRequestException } from "@nestjs/common";

const MAX_REPORT_WINDOW_MS = 366 * 24 * 60 * 60 * 1000;

export function validateProviderReportWindow(from?: string, to?: string): void {
  if ((from === undefined) !== (to === undefined)) {
    throw new BadRequestException("Custom reporting windows must include both from and to");
  }
  if (!from || !to) return;

  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || toTime <= fromTime) {
    throw new BadRequestException("The reporting window must satisfy from < to");
  }
  if (toTime - fromTime > MAX_REPORT_WINDOW_MS) {
    throw new BadRequestException("The reporting window cannot exceed 366 days");
  }
}
