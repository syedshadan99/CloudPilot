import { useState } from "react";
import type { VmRequirements } from "../../lib/api/chat.js";
import styles from "./chat.module.css";

interface ManualFallbackFormProps {
  sessionId: string;
  initial?: VmRequirements | null;
  onSave: (data: Partial<VmRequirements>) => Promise<void>;
  onCancel?: () => void;
}

interface FormState {
  cpu_cores: string;
  ram_gb: string;
  storage_gb: string;
  os: string;
  duration_days: string;
  billing_cycle: string;
  use_case: string;
  notes: string;
}

function toForm(r: VmRequirements | null | undefined): FormState {
  return {
    cpu_cores: r?.cpu_cores?.toString() ?? "",
    ram_gb: r?.ram_gb?.toString() ?? "",
    storage_gb: r?.storage_gb?.toString() ?? "",
    os: r?.os ?? "",
    duration_days: r?.duration_days?.toString() ?? "",
    billing_cycle: r?.billing_cycle ?? "",
    use_case: r?.use_case ?? "",
    notes: r?.notes ?? "",
  };
}

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (f.cpu_cores && (isNaN(Number(f.cpu_cores)) || Number(f.cpu_cores) < 1)) {
    errors.cpu_cores = "Must be a positive number";
  }
  if (f.ram_gb && (isNaN(Number(f.ram_gb)) || Number(f.ram_gb) < 1)) {
    errors.ram_gb = "Must be a positive number";
  }
  if (f.storage_gb && (isNaN(Number(f.storage_gb)) || Number(f.storage_gb) < 1)) {
    errors.storage_gb = "Must be a positive number";
  }
  if (f.duration_days && (isNaN(Number(f.duration_days)) || Number(f.duration_days) < 1)) {
    errors.duration_days = "Must be a positive number";
  }
  return errors;
}

export function ManualFallbackForm({ initial, onSave, onCancel }: ManualFallbackFormProps) {
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const payload: Partial<VmRequirements> = {
      cpu_cores: form.cpu_cores ? Number(form.cpu_cores) : null,
      ram_gb: form.ram_gb ? Number(form.ram_gb) : null,
      storage_gb: form.storage_gb ? Number(form.storage_gb) : null,
      os: form.os || null,
      duration_days: form.duration_days ? Number(form.duration_days) : null,
      billing_cycle: (form.billing_cycle as VmRequirements["billing_cycle"]) || null,
      use_case: form.use_case || null,
      notes: form.notes || null,
    };

    setSaving(true);
    setSaveError(null);
    try {
      await onSave(payload);
      setSaved(true);
    } catch (err) {
      setSaveError((err as Error).message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-label="VM requirements form">
      <div className={styles.formRow}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="cpu_cores">CPU Cores</label>
          <input
            id="cpu_cores"
            type="number"
            min={1}
            className={`${styles.input} ${errors.cpu_cores ? styles.invalid : ""}`}
            value={form.cpu_cores}
            onChange={(e) => handleChange("cpu_cores", e.target.value)}
            placeholder="e.g. 4"
            aria-invalid={!!errors.cpu_cores}
            aria-describedby={errors.cpu_cores ? "cpu_cores_err" : undefined}
          />
          {errors.cpu_cores && (
            <span id="cpu_cores_err" className={styles.fieldError}>{errors.cpu_cores}</span>
          )}
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="ram_gb">RAM (GB)</label>
          <input
            id="ram_gb"
            type="number"
            min={1}
            className={`${styles.input} ${errors.ram_gb ? styles.invalid : ""}`}
            value={form.ram_gb}
            onChange={(e) => handleChange("ram_gb", e.target.value)}
            placeholder="e.g. 8"
            aria-invalid={!!errors.ram_gb}
            aria-describedby={errors.ram_gb ? "ram_gb_err" : undefined}
          />
          {errors.ram_gb && (
            <span id="ram_gb_err" className={styles.fieldError}>{errors.ram_gb}</span>
          )}
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="storage_gb">Storage (GB)</label>
          <input
            id="storage_gb"
            type="number"
            min={1}
            className={`${styles.input} ${errors.storage_gb ? styles.invalid : ""}`}
            value={form.storage_gb}
            onChange={(e) => handleChange("storage_gb", e.target.value)}
            placeholder="e.g. 100"
            aria-invalid={!!errors.storage_gb}
            aria-describedby={errors.storage_gb ? "storage_gb_err" : undefined}
          />
          {errors.storage_gb && (
            <span id="storage_gb_err" className={styles.fieldError}>{errors.storage_gb}</span>
          )}
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="duration_days">Duration (days)</label>
          <input
            id="duration_days"
            type="number"
            min={1}
            className={`${styles.input} ${errors.duration_days ? styles.invalid : ""}`}
            value={form.duration_days}
            onChange={(e) => handleChange("duration_days", e.target.value)}
            placeholder="e.g. 30"
            aria-invalid={!!errors.duration_days}
            aria-describedby={errors.duration_days ? "duration_err" : undefined}
          />
          {errors.duration_days && (
            <span id="duration_err" className={styles.fieldError}>{errors.duration_days}</span>
          )}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="os">Operating System</label>
        <select
          id="os"
          className={styles.select}
          value={form.os}
          onChange={(e) => handleChange("os", e.target.value)}
        >
          <option value="">— Select OS —</option>
          <option value="Ubuntu">Ubuntu</option>
          <option value="Debian">Debian</option>
          <option value="CentOS">CentOS</option>
          <option value="Fedora">Fedora</option>
          <option value="Windows Server">Windows Server</option>
          <option value="Windows">Windows</option>
          <option value="Linux">Linux (generic)</option>
        </select>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="billing_cycle">Billing Cycle</label>
        <select
          id="billing_cycle"
          className={styles.select}
          value={form.billing_cycle}
          onChange={(e) => handleChange("billing_cycle", e.target.value)}
        >
          <option value="">— Select billing —</option>
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="use_case">Use Case</label>
        <input
          id="use_case"
          type="text"
          className={styles.input}
          value={form.use_case}
          onChange={(e) => handleChange("use_case", e.target.value)}
          placeholder="e.g. Web server, Database, Development…"
          maxLength={500}
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="notes">Additional Notes</label>
        <textarea
          id="notes"
          className={styles.textarea}
          value={form.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          placeholder="Any additional requirements or constraints…"
          maxLength={1000}
        />
      </div>

      {saveError && (
        <div className={`${styles.inlineAlert} ${styles.inlineAlertError}`} role="alert">
          {saveError}
        </div>
      )}
      {saved && (
        <div className={`${styles.inlineAlert} ${styles.inlineAlertSuccess}`} role="status">
          Requirements saved successfully.
        </div>
      )}

      <div className={styles.formActions}>
        {onCancel && (
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className={styles.btnPrimary} disabled={saving}>
          {saving ? "Saving…" : "Save Requirements"}
        </button>
      </div>
    </form>
  );
}
