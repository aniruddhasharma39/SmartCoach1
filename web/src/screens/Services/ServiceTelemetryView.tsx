import { useEffect, useState, useMemo } from 'react';
import {
  FaUndo, FaBell, FaFilter, FaTachometerAlt, FaThermometerHalf,
  FaExclamationTriangle, FaMicrochip, FaSlidersH, FaCircle, FaWind, FaArrowLeft
} from 'react-icons/fa';
import { API_URL, authHeaders } from '../../api';
import { useToast } from '../../context/ToastContext';
import type { SmartCoachService, ServiceColumnConfig, ServiceDevice } from '../../types';
import './Services.css';

interface Props {
  serviceSlug: string;
  initialDeviceId?: string | null;
  onBack?: () => void;
  onOpenConfig?: () => void;
}

export default function ServiceTelemetryView({ serviceSlug, initialDeviceId, onBack, onOpenConfig }: Props) {
  const { error: toastError } = useToast();

  const [service, setService] = useState<SmartCoachService | null>(null);
  const [configs, setConfigs] = useState<ServiceColumnConfig[]>([]);
  const [devices, setDevices] = useState<ServiceDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(initialDeviceId || 'ALL');

  useEffect(() => {
    if (initialDeviceId) {
      setSelectedDevice(initialDeviceId);
    }
  }, [initialDeviceId]);

  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 1. Fetch metadata and presentation configs
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const srvRes = await fetch(`${API_URL}/api/v1/services/${serviceSlug}`, { headers: authHeaders() });
        const srvData = await srvRes.json();
        if (srvData.success) setService(srvData.service);

        const devRes = await fetch(`${API_URL}/api/v1/services/${serviceSlug}/devices`, { headers: authHeaders() });
        const devData = await devRes.json();
        if (devData.success) setDevices(devData.accessibleDevices || []);

        const cfgRes = await fetch(`${API_URL}/api/v1/services/${serviceSlug}/config`, { headers: authHeaders() });
        const cfgData = await cfgRes.json();
        if (cfgData.success) setConfigs(cfgData.configs || []);
      } catch (err: any) {
        toastError(err.message, 'Service');
      }
    };
    fetchMetadata();
  }, [serviceSlug]);

  // 2. Fetch live telemetry stream (strictly read-only from Supabase)
  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/v1/services/${serviceSlug}/telemetry?limit=50`;
      if (selectedDevice !== 'ALL') {
        url += `&deviceId=${encodeURIComponent(selectedDevice)}`;
      }
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTelemetry(data.data);
      }
    } catch (err: any) {
      console.error('Error streaming telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, [serviceSlug, selectedDevice]);

  // Auto-refresh timer every 6 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchTelemetry();
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh, serviceSlug, selectedDevice]);

  // Service Icon Helper
  const getServiceIcon = (slug: string) => {
    switch (slug) {
      case 'brake-binding':
        return <FaTachometerAlt />;
      case 'hot-axle':
        return <FaThermometerHalf />;
      case 'bad-odour':
        return <FaWind />;
      case 'emergency-brake':
        return <FaExclamationTriangle />;
      case 'bpc-pressure':
        return <FaMicrochip />;
      default:
        return <FaTachometerAlt />;
    }
  };

  // Evaluate gradient performance class
  const getGradientClass = (val: number, config: ServiceColumnConfig) => {
    if (!config.gradientEnabled || isNaN(val)) return '';
    if (config.criticalValue !== null && config.criticalValue !== undefined) {
      if (config.minGoodValue !== null && config.minGoodValue !== undefined && config.minGoodValue > config.criticalValue) {
        // Lower is worse (e.g. Battery percentage or Air pressure)
        if (val <= config.criticalValue) return 'card-critical';
        if (config.warningValue !== null && config.warningValue !== undefined && val <= config.warningValue) return 'card-warning';
        return 'card-nominal';
      } else {
        // Higher is worse (e.g. Temperature or abnormal Brake Cylinder pressure)
        if (val >= config.criticalValue) return 'card-critical';
        if (config.warningValue !== null && config.warningValue !== undefined && val >= config.warningValue) return 'card-warning';
        return 'card-nominal';
      }
    }
    return '';
  };

  // Detect condition alerts across recent rows
  const activeAlerts = useMemo(() => {
    const alerts: { message: string; deviceId: string; time?: string }[] = [];
    const alertCols = configs.filter((c) => c.alertTriggerType && c.alertTriggerType !== 'NONE' && c.alertThreshold);

    if (alertCols.length === 0 || telemetry.length === 0) return alerts;

    telemetry.slice(0, 5).forEach((row) => {
      alertCols.forEach((col) => {
        const val = row[col.columnKey];
        if (val === undefined || val === null) return;

        let triggered = false;
        if (col.alertTriggerType === 'GREATER_THAN') {
          triggered = parseFloat(val) > parseFloat(col.alertThreshold!);
        } else if (col.alertTriggerType === 'LESS_THAN') {
          triggered = parseFloat(val) < parseFloat(col.alertThreshold!);
        } else if (col.alertTriggerType === 'EQUALS') {
          triggered = String(val).trim().toUpperCase() === String(col.alertThreshold).trim().toUpperCase();
        }

        if (triggered) {
          alerts.push({
            message: col.alertMessage || `${col.displayName} exceeded threshold (${val})`,
            deviceId: row.device_id || row.coach_no || 'Unknown',
            time: row.timestamp || row.received_timestamp,
          });
        }
      });
    });

    return alerts;
  }, [configs, telemetry]);

  const latestRow = telemetry[0] || {};

  return (
    <div className="services-container">
      {/* Top Header Card */}
      <div className="card" style={{ padding: '20px 24px', borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {onBack && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={onBack}
              title="Return to Device Cards List"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.85rem',
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: 10,
                borderColor: '#cbd5e1',
              }}
            >
              <FaArrowLeft size={12} /> Devices
            </button>
          )}
          <div className="service-icon-box">{getServiceIcon(serviceSlug)}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontWeight: 800 }}>
                {service?.name || serviceSlug.toUpperCase()}
              </h2>
              <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '0.75rem', fontWeight: 700 }}>
                LIVE STREAM
              </span>
              {selectedDevice !== 'ALL' && (
                <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', fontSize: '0.75rem', fontWeight: 700, border: '1px solid #cbd5e1' }}>
                  Device: {selectedDevice}
                </span>
              )}
            </div>
            <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.88rem' }}>
              {service?.description}
            </p>
          </div>
        </div>

        {/* Action Controls & Device Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <FaFilter size={12} style={{ color: '#64748b' }} />
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              style={{ background: 'transparent', border: 'none', fontWeight: 600, color: '#334155', outline: 'none', cursor: 'pointer', fontSize: '0.88rem' }}
            >
              <option value="ALL">All Accessible Devices ({devices.length})</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.deviceId} ({d.coachNumber || d.location})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
          >
            <FaCircle size={8} style={{ color: autoRefresh ? '#10b981' : '#94a3b8' }} />
            {autoRefresh ? 'Live Streaming' : 'Paused'}
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={fetchTelemetry}
            disabled={loading}
            title="Refresh stream"
          >
            <FaUndo />
          </button>

          {onOpenConfig && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenConfig}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FaSlidersH /> Presentation Config
            </button>
          )}
        </div>
      </div>

      {/* Active Alerts Banner */}
      {activeAlerts.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
            border: '1px solid #f87171',
            borderRadius: 12,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            animation: 'pulseCritical 2s infinite',
          }}
        >
          <FaBell size={24} style={{ color: '#dc2626', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#991b1b', fontSize: '0.95rem' }}>Active Alert Triggered:</strong>
            <span style={{ color: '#b91c1c', marginLeft: 8, fontSize: '0.9rem' }}>
              {activeAlerts[0].message} on Device <strong>{activeAlerts[0].deviceId}</strong>
            </span>
          </div>
          <span className="badge" style={{ backgroundColor: '#dc2626', color: '#fff', fontSize: '0.75rem' }}>
            CRITICAL
          </span>
        </div>
      )}

      {/* Primary Identity Badges & Status Pills */}
      <div className="pills-container">
        {configs
          .filter((a) => a.isVisible && (a.displayStyle === 'badge' || a.displayStyle === 'pill'))
          .map((attr) => {
            const val = latestRow[attr.columnKey] !== undefined ? String(latestRow[attr.columnKey]) : '—';
            if (attr.displayStyle === 'badge') {
              return (
                <div key={attr.columnKey} className="presentation-badge">
                  <span>{attr.displayName}:</span>
                  <strong>{val}</strong>
                </div>
              );
            }
            return (
              <div key={attr.columnKey} className="presentation-pill">
                <span style={{ color: '#64748b' }}>{attr.displayName}:</span>
                <strong style={{ color: '#0f172a' }}>{val}</strong>
              </div>
            );
          })}
      </div>

      {/* KPI Metric Cards with Performance Gradients */}
      <div className="presentation-kpi-grid">
        {configs
          .filter((a) => a.isVisible && a.displayStyle === 'card')
          .map((attr) => {
            const numVal = parseFloat(latestRow[attr.columnKey]);
            const displayVal = latestRow[attr.columnKey] !== undefined ? latestRow[attr.columnKey] : '0.00';
            const gradientClass = !isNaN(numVal) ? getGradientClass(numVal, attr) : '';

            return (
              <div key={attr.columnKey} className={`presentation-card ${gradientClass}`}>
                <div className="presentation-card-label">{attr.displayName}</div>
                <div className="presentation-card-value">
                  {displayVal}
                </div>
                {attr.gradientEnabled && (
                  <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#64748b' }}>
                    Nominal: {attr.minGoodValue ?? '—'} - {attr.maxGoodValue ?? '—'}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Live Stream Telemetry History Table */}
      <div className="card" style={{ padding: 24, borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h4 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800 }}>
            Live Telemetry History ({telemetry.length} Packets)
          </h4>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
            Auto-refresh active (every 6s)
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {configs
                  .filter((a) => a.isVisible)
                  .map((attr) => (
                    <th key={attr.columnKey} style={{ padding: '10px 14px', textAlign: 'left' }}>
                      {attr.displayName}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {telemetry.map((row, idx) => (
                <tr key={row.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {configs
                    .filter((a) => a.isVisible)
                    .map((attr) => {
                      const val = row[attr.columnKey];
                      return (
                        <td key={attr.columnKey} style={{ padding: '10px 14px' }}>
                          {val !== null && val !== undefined ? String(val) : '—'}
                        </td>
                      );
                    })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
