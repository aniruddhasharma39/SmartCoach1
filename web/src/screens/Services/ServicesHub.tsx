import { useEffect, useState, useMemo } from 'react';
import {
  FaMicrochip, FaThermometerHalf, FaTachometerAlt, FaExclamationTriangle,
  FaArrowRight, FaSlidersH,
  FaSearch, FaBell, FaSave, FaUndo, FaEye, FaEyeSlash, FaCog, FaWind
} from 'react-icons/fa';
import { API_URL, authHeaders } from '../../api';
import { useToast } from '../../context/ToastContext';
import type { SmartCoachService, ServiceDevice, ServiceColumnConfig } from '../../types';
import './Services.css';

interface Props {
  initialServiceSlug?: string;
  onNavigateToServiceTelemetry?: (slug: string) => void;
}

type FlowStep = 'services' | 'devices' | 'attributes' | 'ui' | 'presentation';

export default function ServicesHub({ initialServiceSlug, onNavigateToServiceTelemetry }: Props) {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const [currentStep, setCurrentStep] = useState<FlowStep>(initialServiceSlug ? 'devices' : 'services');
  const [services, setServices] = useState<SmartCoachService[]>([]);
  const [selectedService, setSelectedService] = useState<SmartCoachService | null>(null);
  const [devices, setDevices] = useState<ServiceDevice[]>([]);
  const [searchDevice, setSearchDevice] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<ServiceDevice | null>(null);

  const [attributes, setAttributes] = useState<ServiceColumnConfig[]>([]);
  const [activeEditingCol, setActiveEditingCol] = useState<ServiceColumnConfig | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Live Presentation state
  const [latestData, setLatestData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // 1. Fetch available services
  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/services`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.services)) {
        setServices(data.services);
        if (initialServiceSlug) {
          const found = data.services.find((s: SmartCoachService) => s.slug === initialServiceSlug);
          if (found) {
            handleSelectService(found, false);
          }
        }
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch services', 'Services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // 2. Select service and load devices & configs
  const handleSelectService = async (service: SmartCoachService, advanceStep = true) => {
    setSelectedService(service);
    setSelectedDevice(null);
    if (advanceStep) setCurrentStep('devices');

    try {
      // Fetch devices
      const devRes = await fetch(`${API_URL}/api/v1/services/${service.slug}/devices`, { headers: authHeaders() });
      const devData = await devRes.json();
      if (devData.success) {
        setDevices(devData.accessibleDevices || []);
        if (devData.accessibleDevices?.length > 0) {
          setSelectedDevice(devData.accessibleDevices[0]);
        }
      }

      // Fetch attributes & presentation configs
      const attrRes = await fetch(`${API_URL}/api/v1/services/${service.slug}/attributes`, { headers: authHeaders() });
      const attrData = await attrRes.json();
      if (attrData.success) {
        setAttributes(attrData.attributes || []);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to load service data', 'Services');
    }
  };

  // Fetch live telemetry for presentation step
  const fetchPresentationData = async () => {
    if (!selectedService) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/services/${selectedService.slug}/latest`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setLatestData(data.latest || []);
      }
    } catch (err: any) {
      console.error('Error fetching live telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentStep === 'presentation' && selectedService) {
      fetchPresentationData();
    }
  }, [currentStep, selectedService]);

  // Filtered devices
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const query = searchDevice.toLowerCase();
      return (
        d.deviceId.toLowerCase().includes(query) ||
        (d.coachNumber && d.coachNumber.toLowerCase().includes(query)) ||
        (d.location && d.location.toLowerCase().includes(query)) ||
        (d.trainNumber && d.trainNumber.toLowerCase().includes(query))
      );
    });
  }, [devices, searchDevice]);

  // Toggle attribute visibility
  const toggleVisibility = (colKey: string) => {
    setAttributes((prev) =>
      prev.map((col) => (col.columnKey === colKey ? { ...col, isVisible: !col.isVisible } : col))
    );
  };

  // Update attribute display style
  const updateDisplayStyle = (colKey: string, style: 'card' | 'pill' | 'badge' | 'table-column') => {
    setAttributes((prev) =>
      prev.map((col) => (col.columnKey === colKey ? { ...col, displayStyle: style } : col))
    );
  };

  // Open UI Config Drawer for advanced thresholds & gradient
  const openConfigDrawer = (col: ServiceColumnConfig) => {
    setActiveEditingCol({ ...col });
    setIsDrawerOpen(true);
  };

  const saveDrawerConfig = () => {
    if (!activeEditingCol) return;
    setAttributes((prev) =>
      prev.map((col) => (col.columnKey === activeEditingCol.columnKey ? activeEditingCol : col))
    );
    setIsDrawerOpen(false);
    toastInfo(`Updated presentation style for ${activeEditingCol.displayName}`, 'Presentation Designer');
  };

  // Persist all configs to AWS RDS backend
  const handleSaveAllConfigs = async () => {
    if (!selectedService) return;
    setIsSavingConfig(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/services/${selectedService.slug}/config`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ configs: attributes }),
      });
      const data = await res.json();
      if (data.success) {
        toastSuccess('Presentation and threshold configurations saved to database!', 'Smart Coach Config');
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to save configuration', 'Error');
    } finally {
      setIsSavingConfig(false);
    }
  };

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
        return <FaCog />;
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

  return (
    <div className="services-container">
      {/* 5-Step Flow Stepper */}
      <div className="stepper-flow">
        <button
          type="button"
          className={`step-item ${currentStep === 'services' ? 'active' : ''}`}
          onClick={() => setCurrentStep('services')}
        >
          <span className="step-number">1</span>
          <span>Services</span>
        </button>

        <span className="step-arrow"><FaArrowRight /></span>

        <button
          type="button"
          className={`step-item ${currentStep === 'devices' ? 'active' : ''}`}
          disabled={!selectedService}
          onClick={() => setCurrentStep('devices')}
        >
          <span className="step-number">2</span>
          <span>Devices ({devices.length})</span>
        </button>

        <span className="step-arrow"><FaArrowRight /></span>

        <button
          type="button"
          className={`step-item ${currentStep === 'attributes' ? 'active' : ''}`}
          disabled={!selectedService}
          onClick={() => setCurrentStep('attributes')}
        >
          <span className="step-number">3</span>
          <span>Attributes ({attributes.length})</span>
        </button>

        <span className="step-arrow"><FaArrowRight /></span>

        <button
          type="button"
          className={`step-item ${currentStep === 'ui' ? 'active' : ''}`}
          disabled={!selectedService}
          onClick={() => setCurrentStep('ui')}
        >
          <span className="step-number">4</span>
          <span>UI Config</span>
        </button>

        <span className="step-arrow"><FaArrowRight /></span>

        <button
          type="button"
          className={`step-item ${currentStep === 'presentation' ? 'active' : ''}`}
          disabled={!selectedService}
          onClick={() => setCurrentStep('presentation')}
        >
          <span className="step-number">5</span>
          <span>Presentation</span>
        </button>
      </div>

      {/* STEP 1: SERVICES DIRECTORY */}
      {currentStep === 'services' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: '0 0 6px 0', color: 'var(--primary)', fontWeight: 800 }}>Smart Coach Services Hub</h2>
            <p className="text-muted" style={{ margin: 0 }}>
              Select a railway rolling-stock monitoring service to inspect deployed coach devices, configure telemetry attributes, and tailor operator presentation.
            </p>
          </div>

          <div className="services-grid">
            {services.map((srv) => (
              <div
                key={srv.slug}
                className={`service-card ${selectedService?.slug === srv.slug ? 'selected' : ''}`}
                onClick={() => handleSelectService(srv)}
              >
                <div>
                  <div className="service-card-header">
                    <div className="service-icon-box">{getServiceIcon(srv.slug)}</div>
                    <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                      {srv.shortCode}
                    </span>
                  </div>
                  <h3 className="service-title">{srv.name}</h3>
                  <p className="service-desc">{srv.description}</p>
                </div>

                <div className="service-meta-row">
                  <span style={{ color: '#475569' }}>
                    <strong>{srv.deviceCount}</strong> Deployed Devices
                  </span>
                  <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Configure <FaArrowRight size={11} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: DEVICES DIRECTORY */}
      {currentStep === 'devices' && selectedService && (
        <div className="card" style={{ padding: 24, borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                  {selectedService.shortCode}
                </span>
                <h3 style={{ margin: 0, color: '#1e293b', fontWeight: 800 }}>
                  {selectedService.name} — Deployed Devices
                </h3>
              </div>
              <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.88rem' }}>
                Hardware nodes and coaches reporting into {selectedService.tableName}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 260 }}>
                <FaSearch style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Filter by Coach, Train, Location..."
                  value={searchDevice}
                  onChange={(e) => setSearchDevice(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCurrentStep('attributes')}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                Proceed to Attributes <FaArrowRight size={12} />
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Device ID</th>
                  <th style={{ padding: '12px 16px' }}>Coach Number</th>
                  <th style={{ padding: '12px 16px' }}>Train No</th>
                  <th style={{ padding: '12px 16px' }}>Location / Zone</th>
                  <th style={{ padding: '12px 16px' }}>Actual ID / Hardware Code</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((dev) => (
                  <tr
                    key={dev.deviceId}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: selectedDevice?.deviceId === dev.deviceId ? 'rgba(11, 60, 122, 0.04)' : undefined,
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)' }}>
                      {dev.deviceId}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#1e293b' }}>
                        {dev.coachNumber || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{dev.trainNumber || 'N/A'}</td>
                    <td style={{ padding: '12px 16px' }}>{dev.location || 'Indian Railways'}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.85rem' }}>
                      {dev.actualId || dev.deviceId}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setSelectedDevice(dev);
                          setCurrentStep('presentation');
                        }}
                      >
                        Inspect Telemetry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 3 & 4: ATTRIBUTES & UI PRESENTATION CONFIGURATOR */}
      {(currentStep === 'attributes' || currentStep === 'ui') && selectedService && (
        <div className="card" style={{ padding: 24, borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                  {selectedService.shortCode}
                </span>
                <h3 style={{ margin: 0, color: '#1e293b', fontWeight: 800 }}>
                  {currentStep === 'attributes' ? 'Attribute Visibility & Role Mapping' : 'Presentation & Style Customizer'}
                </h3>
              </div>
              <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.88rem' }}>
                Define which columns are visible to operators and configure their rendering style (Cards, Pills, Badges, Tables, and Performance Gradients).
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveAllConfigs}
                disabled={isSavingConfig}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <FaSave /> {isSavingConfig ? 'Saving...' : 'Save Configuration'}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCurrentStep('presentation')}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                Preview Presentation <FaArrowRight size={12} />
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 14px', width: 60 }}>Visible</th>
                  <th style={{ padding: '12px 14px' }}>Column Key</th>
                  <th style={{ padding: '12px 14px' }}>Display Label</th>
                  <th style={{ padding: '12px 14px' }}>Display Format</th>
                  <th style={{ padding: '12px 14px' }}>Performance Gradient</th>
                  <th style={{ padding: '12px 14px' }}>Condition Alert</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Customize</th>
                </tr>
              </thead>
              <tbody>
                {attributes.map((col) => (
                  <tr key={col.columnKey} style={{ borderBottom: '1px solid #f1f5f9', opacity: col.isVisible ? 1 : 0.6 }}>
                    <td style={{ padding: '12px 14px' }}>
                      <button
                        type="button"
                        onClick={() => toggleVisibility(col.columnKey)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: col.isVisible ? '#10b981' : '#94a3b8', fontSize: '1.2rem' }}
                        title={col.isVisible ? 'Visible' : 'Hidden'}
                      >
                        {col.isVisible ? <FaEye /> : <FaEyeSlash />}
                      </button>
                    </td>

                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#334155' }}>
                      <code>{col.columnKey}</code>
                      {col.isPrimaryKey && (
                        <span className="badge" style={{ marginLeft: 6, fontSize: '0.68rem', backgroundColor: '#e2e8f0' }}>
                          Primary Key
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <input
                        type="text"
                        value={col.displayName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAttributes((prev) =>
                            prev.map((c) => (c.columnKey === col.columnKey ? { ...c, displayName: val } : c))
                          );
                        }}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', width: 220, fontSize: '0.88rem' }}
                      />
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <select
                        value={col.displayStyle}
                        onChange={(e) => updateDisplayStyle(col.columnKey, e.target.value as any)}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.88rem' }}
                      >
                        <option value="card">KPI Card</option>
                        <option value="pill">Rounded Pill</option>
                        <option value="badge">Identity Badge</option>
                        <option value="table-column">Table Column</option>
                      </select>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      {col.gradientEnabled ? (
                        <span className="badge success" style={{ fontSize: '0.78rem' }}>
                          Gradient Active
                        </span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#94a3b8', fontSize: '0.78rem' }}>
                          Disabled
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      {col.alertTriggerType && col.alertTriggerType !== 'NONE' ? (
                        <span className="badge" style={{ backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                          <FaBell size={10} /> {col.alertTriggerType}: {col.alertThreshold}
                        </span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#94a3b8', fontSize: '0.78rem' }}>
                          None
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => openConfigDrawer(col)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <FaSlidersH size={11} /> Rules
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 5: LIVE PRESENTATION PREVIEW */}
      {currentStep === 'presentation' && selectedService && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Bar */}
          <div className="card" style={{ padding: '16px 24px', borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="service-icon-box" style={{ width: 44, height: 44, fontSize: '1.2rem' }}>
                {getServiceIcon(selectedService.slug)}
              </div>
              <div>
                <h3 style={{ margin: '0 0 2px 0', color: '#0f172a', fontWeight: 800 }}>
                  {selectedService.name} — Live Presentation
                </h3>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                  Live telemetry stream from Supabase ({selectedService.tableName})
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={fetchPresentationData}
                disabled={loading}
              >
                <FaUndo style={{ marginRight: 6 }} /> Refresh Stream
              </button>

              {onNavigateToServiceTelemetry && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onNavigateToServiceTelemetry(selectedService.slug)}
                >
                  Open Dedicated Screen <FaArrowRight size={11} style={{ marginLeft: 6 }} />
                </button>
              )}
            </div>
          </div>

          {/* Identity Badges & Status Pills */}
          <div className="pills-container">
            {attributes
              .filter((a) => a.isVisible && (a.displayStyle === 'badge' || a.displayStyle === 'pill'))
              .map((attr) => {
                const sampleRow = latestData[0] || {};
                const val = sampleRow[attr.columnKey] !== undefined ? String(sampleRow[attr.columnKey]) : '—';

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
            {attributes
              .filter((a) => a.isVisible && a.displayStyle === 'card')
              .map((attr) => {
                const sampleRow = latestData[0] || {};
                const numVal = parseFloat(sampleRow[attr.columnKey]);
                const displayVal = sampleRow[attr.columnKey] !== undefined ? sampleRow[attr.columnKey] : '0.00';
                const gradientClass = !isNaN(numVal) ? getGradientClass(numVal, attr) : '';

                return (
                  <div key={attr.columnKey} className={`presentation-card ${gradientClass}`}>
                    <div className="presentation-card-label">{attr.displayName}</div>
                    <div className="presentation-card-value">
                      {displayVal}
                    </div>
                    {attr.alertTriggerType && attr.alertTriggerType !== 'NONE' && (
                      <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FaBell size={9} /> Threshold: {attr.alertThreshold}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Time Series Telemetry Table */}
          <div className="card" style={{ padding: 20, borderRadius: 16 }}>
            <h4 style={{ margin: '0 0 14px 0', color: 'var(--primary)', fontWeight: 700 }}>
              Live Telemetry Packet History ({latestData.length} Recent Packets)
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {attributes
                      .filter((a) => a.isVisible)
                      .map((attr) => (
                        <th key={attr.columnKey} style={{ padding: '10px 14px', textAlign: 'left' }}>
                          {attr.displayName}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {latestData.slice(0, 15).map((row, idx) => (
                    <tr key={row.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {attributes
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
      )}

      {/* Advanced UI Rules & Performance Gradient Drawer */}
      {isDrawerOpen && activeEditingCol && (
        <div className="config-drawer-overlay" onClick={() => setIsDrawerOpen(false)}>
          <div className="config-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800 }}>
                {activeEditingCol.displayName} Configuration
              </h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsDrawerOpen(false)}
                style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.2rem' }}
              >
                &times;
              </button>
            </div>

            <div className="drawer-body">
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: 6 }}>
                  Display Label
                </label>
                <input
                  type="text"
                  value={activeEditingCol.displayName}
                  onChange={(e) => setActiveEditingCol({ ...activeEditingCol, displayName: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: 6 }}>
                  Display Format
                </label>
                <select
                  value={activeEditingCol.displayStyle}
                  onChange={(e) => setActiveEditingCol({ ...activeEditingCol, displayStyle: e.target.value as any })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}
                >
                  <option value="card">KPI Card (Large metric box)</option>
                  <option value="pill">Pill (Compact rounded chip)</option>
                  <option value="badge">Identity Badge</option>
                  <option value="table-column">Data Table Column</option>
                </select>
              </div>

              {/* Performance Gradient Section */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>Performance Color Gradient</strong>
                    <p className="text-muted" style={{ margin: 0, fontSize: '0.78rem' }}>
                      Automatically shifts background: Nominal (Green) &rarr; Warning (Amber) &rarr; Critical (Red)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeEditingCol.gradientEnabled || false}
                    onChange={(e) => setActiveEditingCol({ ...activeEditingCol, gradientEnabled: e.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </div>

                {activeEditingCol.gradientEnabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Nominal Min (Green)</label>
                      <input
                        type="number"
                        step="any"
                        value={activeEditingCol.minGoodValue ?? ''}
                        onChange={(e) => setActiveEditingCol({ ...activeEditingCol, minGoodValue: e.target.value ? parseFloat(e.target.value) : null })}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Nominal Max (Green)</label>
                      <input
                        type="number"
                        step="any"
                        value={activeEditingCol.maxGoodValue ?? ''}
                        onChange={(e) => setActiveEditingCol({ ...activeEditingCol, maxGoodValue: e.target.value ? parseFloat(e.target.value) : null })}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Warning Threshold (Amber)</label>
                      <input
                        type="number"
                        step="any"
                        value={activeEditingCol.warningValue ?? ''}
                        onChange={(e) => setActiveEditingCol({ ...activeEditingCol, warningValue: e.target.value ? parseFloat(e.target.value) : null })}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Critical Danger (Crimson Red)</label>
                      <input
                        type="number"
                        step="any"
                        value={activeEditingCol.criticalValue ?? ''}
                        onChange={(e) => setActiveEditingCol({ ...activeEditingCol, criticalValue: e.target.value ? parseFloat(e.target.value) : null })}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Alert Triggers */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <strong style={{ fontSize: '0.9rem', color: '#1e293b', display: 'block', marginBottom: 12 }}>
                  Condition Alert Triggers
                </strong>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Trigger Condition</label>
                    <select
                      value={activeEditingCol.alertTriggerType || 'NONE'}
                      onChange={(e) => setActiveEditingCol({ ...activeEditingCol, alertTriggerType: e.target.value })}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                    >
                      <option value="NONE">No Alert Trigger</option>
                      <option value="GREATER_THAN">Greater Than (&gt;)</option>
                      <option value="LESS_THAN">Less Than (&lt;)</option>
                      <option value="EQUALS">Equals (==)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Threshold Value</label>
                    <input
                      type="text"
                      placeholder="e.g. 75 or EMERGENCY BRAKE"
                      value={activeEditingCol.alertThreshold || ''}
                      onChange={(e) => setActiveEditingCol({ ...activeEditingCol, alertThreshold: e.target.value })}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Notification Message</label>
                  <input
                    type="text"
                    placeholder="Alert message template"
                    value={activeEditingCol.alertMessage || ''}
                    onChange={(e) => setActiveEditingCol({ ...activeEditingCol, alertMessage: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <button type="button" className="btn btn-outline" onClick={() => setIsDrawerOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={saveDrawerConfig}>
                Apply Style
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
