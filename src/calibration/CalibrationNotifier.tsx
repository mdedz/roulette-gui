import React, { useMemo } from 'react';
import { useCalibrationStatus } from './useCalibrationStatus';

type Severity = 'critical' | 'warning' | 'ok' | 'info';

const styles: Record<Severity, React.CSSProperties> = {
  critical: {
    background: '#ffe5e5',
    border: '1px solid #ff4d4f',
    color: '#5a0b0b',
    padding: '12px',
    borderRadius: 6,
    marginBottom: 8,
  },
  warning: {
    background: '#fff7e6',
    border: '1px solid #faad14',
    color: '#7a4f00',
    padding: '12px',
    borderRadius: 6,
    marginBottom: 8,
  },
  ok: {
    background: '#f6ffed',
    border: '1px solid #52c41a',
    color: '#09320a',
    padding: '12px',
    borderRadius: 6,
    marginBottom: 8,
  },
  info: {
    background: '#eef6ff',
    border: '1px solid #1890ff',
    color: '#07233b',
    padding: '12px',
    borderRadius: 6,
    marginBottom: 8,
  },
};

function formatPercent(ratio?: number | null) {
  if (ratio == null || Number.isNaN(ratio)) return '—';
  return `${(ratio * 100).toFixed(1)}%`;
}

export const CalibrationNotifier: React.FC = () => {
  const { calibrationStatus, runtimeStatus, loading, error } = useCalibrationStatus();

  const messages = useMemo(() => {
    const list: { key: string; severity: Severity; lines: string[] }[] = [];

    // Critical conditions
    if (runtimeStatus?.status === 'INVALID') {
      const key = `runtime-invalid-${runtimeStatus.score ?? 'na'}`;
      list.push({
        key,
        severity: 'critical',
        lines: [
          `Runtime status: INVALID (score: ${runtimeStatus.score ?? 'n/a'})`,
          ...(runtimeStatus.reasons?.length ? ['Reasons: ' + runtimeStatus.reasons.join('; ')] : []),
        ],
      });
    }

    if (calibrationStatus) {
      if (calibrationStatus.calibration_ready === false && calibrationStatus.has_best_calibration === false) {
        list.push({
          key: 'recalibration-required',
          severity: 'critical',
          lines: ['Recalibration required — no best calibration and calibration not ready.'],
        });
      }
      if (calibrationStatus.last_error) {
        list.push({
          key: `last-error-${calibrationStatus.last_error}`,
          severity: 'critical',
          lines: [`Error: ${calibrationStatus.last_error}`],
        });
      }
    }

    // Warnings
    if (runtimeStatus?.status === 'SUSPECT') {
      list.push({
        key: 'runtime-suspect',
        severity: 'warning',
        lines: [`Runtime status: SUSPECT (score: ${runtimeStatus.score ?? 'n/a'})`, ...(runtimeStatus.reasons || [])],
      });
    }

    if (runtimeStatus?.reasons && runtimeStatus.reasons.length > 0) {
      list.push({
        key: 'runtime-reasons',
        severity: 'warning',
        lines: ['Runtime reasons: ' + runtimeStatus.reasons.join('; ')],
      });
    }

    const coverage = calibrationStatus?.progress?.coverage_ratio ?? calibrationStatus?.progress?.coverage_ratio;
    if (typeof coverage === 'number' && coverage < 0.7) {
      list.push({
        key: `low-coverage-${coverage}`,
        severity: 'warning',
        lines: [`Coverage is low: ${formatPercent(coverage)}.`],
      });
    }

    // OK
    if (runtimeStatus?.status === 'VALID' && calibrationStatus?.calibration_ready === true) {
      list.push({
        key: 'ok',
        severity: 'ok',
        lines: ['Calibration OK', `Coverage: ${formatPercent(calibrationStatus.progress?.coverage_ratio ?? null)}`],
      });
    }

    // Info: errors / loading
    if (error) {
      list.push({ key: `fetch-error-${error}`, severity: 'critical', lines: [`Fetch error: ${error}`] });
    } else if (loading && !calibrationStatus && !runtimeStatus) {
      list.push({ key: 'loading', severity: 'info', lines: ['Loading calibration status...'] });
    }

    // Add useful info lines to each entry where applicable (status_message, samples, bins)
    const enriched = list.map((item) => {
      const extra: string[] = [];
      if (calibrationStatus?.status_message) extra.push(`Message: ${calibrationStatus.status_message}`);
      const samples = calibrationStatus?.progress?.samples_collected ?? calibrationStatus?.samples_collected;
      const binsTotal = calibrationStatus?.progress?.bins_total ?? calibrationStatus?.bins_total;
      if (typeof samples === 'number' && typeof binsTotal === 'number') {
        extra.push(`Samples: ${samples} / ${binsTotal}`);
      }
      const cov = calibrationStatus?.progress?.coverage_ratio;
      if (typeof cov === 'number') extra.push(`Coverage: ${formatPercent(cov)}`);
      return { ...item, lines: [...item.lines, ...extra] };
    });

    // Deduplicate by text content (key may vary), keep first occurrence
    const seen = new Set<string>();
    const unique: typeof enriched = [];
    for (const it of enriched) {
      const text = it.lines.join(' | ');
      if (!seen.has(text)) {
        seen.add(text);
        unique.push(it);
      }
    }

    return unique;
  }, [calibrationStatus, runtimeStatus, loading, error]);

  if (!messages.length) return null;

  return (
    <div style={{ position: 'fixed', top: 16, right: 16, width: 360, zIndex: 9999 }}>
      {messages.map((m) => (
        <div key={m.key} style={styles[m.severity]}>
          {m.lines.map((line, idx) => (
            <div key={idx} style={{ marginBottom: idx === m.lines.length - 1 ? 0 : 6 }}>
              {line}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default CalibrationNotifier;

