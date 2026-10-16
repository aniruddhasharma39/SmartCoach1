import { useEffect, useState, useMemo } from 'react';
import {
  FaMicrochip, FaSearch, FaFilter, FaUndo, FaChevronDown, FaChevronUp,
  FaTachometerAlt, FaThermometerHalf, FaWind, FaExclamationTriangle,
  FaSlidersH, FaArrowRight, FaMapMarkerAlt,
  FaSortAmountDown, FaSortAmountUp, FaTimes
} from 'react-icons/fa';
import { API_URL, authHeaders } from '../../api';
import { useToast } from '../../context/ToastContext';
import type { SmartCoachService, ServiceColumnConfig, ServiceDevice } from '../../types';
import './Services.css';

interface Props {
  serviceSlug: string;
  onSelectDevice: (deviceId: string) => void;
  onOpenConfig?: () => void;
}

export default function ServiceDeviceListView({ serviceSlug, onSelectDevice, onOpenConfig }: Props) {
  const { error: toastError } = useToast();

  const [service, setService] = useState<SmartCoachService | null>(null);
  const [configs, setConfigs] = useState<ServiceColumnConfig[]>([]);
  const [devices, setDevices] = useState<ServiceDevice[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Sort State
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState<string>('deviceId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Fetch service metadata, presentation configs, and accessible devices
  const fetchDevicesAndConfig = async () => {
    setLoading(true);
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
      toastError(err.message || 'Failed to fetch devices', 'Service Devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevicesAndConfig();
    setSelectedFilters({});
    setSearchQuery('');
  }, [serviceSlug]);

  // Helper: Extract value for a specific attribute key from device or its latestData
  const getDeviceAttrValue = (dev: ServiceDevice, key: string): any => {
    const lk = key.toLowerCase();
    if (lk === 'device_id' || lk === 'device_id' || lk === 'actual_id') {
      return dev.deviceId;
    }
    if (lk === 'coach_no' || lk === 'coach_number' || lk === 'coachno' || lk === 'coachnumber') {
      return dev.coachNumber || dev.latestData?.[key];
    }
    if (lk === 'train_no' || lk === 'train_number' || lk === 'trainno' || lk === 'trainnumber') {
      return dev.trainNumber || dev.latestData?.[key];
    }
    if (lk === 'location' || lk === 'zone' || lk === 'owning_rly') {
      return dev.location || dev.latestData?.[key];
    }
    if (dev.latestData && dev.latestData[key] !== undefined && dev.latestData[key] !== null) {
      return dev.latestData[key];
    }
    // Case-insensitive fallback lookup in latestData
    if (dev.latestData) {
      const foundKey = Object.keys(dev.latestData).find((k) => k.toLowerCase() === lk);
      if (foundKey && dev.latestData[foundKey] !== undefined && dev.latestData[foundKey] !== null) {
        return dev.latestData[foundKey];
      }
    }
    return null;
  };

  // Derive filterable attributes dynamically from visible presentation configs
  const filterableAttributes = useMemo(() => {
    return configs
      .filter((c) => c.isVisible)
      .map((c) => {
        const rawValues = devices
          .map((d) => getDeviceAttrValue(d, c.columnKey))
          .filter((v) => v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== '—');

        const uniqueValues = Array.from(new Set(rawValues.map((v) => String(v).trim()))).sort();
        return {
          config: c,
          columnKey: c.columnKey,
          displayName: c.displayName,
          uniqueValues,
        };
      })
      .filter((item) => item.uniqueValues.length > 0);
  }, [configs, devices]);

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = Object.values(selectedFilters).filter((v) => v && v !== 'ALL').length;
    if (searchQuery.trim()) count += 1;
    return count;
  }, [selectedFilters, searchQuery]);

  // Handle filter change
  const handleFilterChange = (columnKey: string, value: string) => {
    setSelectedFilters((prev) => {
      const next = { ...prev };
      if (!value || value === 'ALL') {
        delete next[columnKey];
      } else {
        next[columnKey] = value;
      }
      return next;
    });
  };

  // Reset all filters
  const resetFilters = () => {
    setSelectedFilters({});
    setSearchQuery('');
    setSortField('deviceId');
    setSortDirection('asc');
  };

  // Filter & Sort Devices
  const processedDevices = useMemo(() => {
    let result = [...devices];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((d) => {
        const devId = (d.deviceId || '').toLowerCase();
        const coach = (d.coachNumber || '').toLowerCase();
        const train = (d.trainNumber || '').toLowerCase();
        const loc = (d.location || '').toLowerCase();
        return devId.includes(q) || coach.includes(q) || train.includes(q) || loc.includes(q);
      });
    }

    // Dynamic attribute filters
    Object.entries(selectedFilters).forEach(([colKey, filterVal]) => {
      if (!filterVal || filterVal === 'ALL') return;
      result = result.filter((d) => {
        const val = getDeviceAttrValue(d, colKey);
        if (val === null || val === undefined) return false;
        return String(val).trim().toLowerCase() === filterVal.trim().toLowerCase();
      });
    });

    // Sorting
    result.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'deviceId') {
        valA = a.deviceId || '';
        valB = b.deviceId || '';
      } else if (sortField === 'coachNumber') {
        valA = a.coachNumber || '';
        valB = b.coachNumber || '';
      } else if (sortField === 'trainNumber') {
        valA = a.trainNumber || '';
        valB = b.trainNumber || '';
      } else if (sortField === 'location') {
        valA = a.location || '';
        valB = b.location || '';
      } else {
        valA = getDeviceAttrValue(a, sortField) ?? '';
        valB = getDeviceAttrValue(b, sortField) ?? '';
      }

      // Numeric comparison if both are numbers
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      let comparison = 0;
      if (!isNaN(numA) && !isNaN(numB)) {
        comparison = numA - numB;
      } else {
        comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [devices, searchQuery, selectedFilters, sortField, sortDirection]);

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

  // Top visible metadata attributes to display on the card (excluding device ID)
  const cardHighlightConfigs = useMemo(() => {
    return configs
      .filter((c) => c.isVisible && c.columnKey.toLowerCase() !== 'device_id' && c.columnKey.toLowerCase() !== 'device_id')
      .slice(0, 4);
  }, [configs]);

  return (
    <div className="services-container">
      {/* Top Header Card */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          borderRadius: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="service-icon-box">{getServiceIcon(serviceSlug)}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontWeight: 800 }}>
                {service?.name || serviceSlug.toUpperCase()}
              </h2>
              <span
                className="badge"
                style={{ backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '0.75rem', fontWeight: 700 }}
              >
                {devices.length} Permitted Device{devices.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.88rem' }}>
              Select a designated coach hardware unit below to monitor live telemetry streaming, diagnostics, and sensor history.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={fetchDevicesAndConfig}
            disabled={loading}
            title="Refresh devices"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
          >
            <FaUndo size={12} /> Refresh
          </button>

          {onOpenConfig && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenConfig}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            >
              <FaSlidersH size={12} /> Presentation Config
            </button>
          )}
        </div>
      </div>

      {/* Expandable & Collapsible Filter and Sort Section */}
      <div
        className="card"
        style={{
          padding: 0,
          borderRadius: 16,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}
      >
        {/* Toolbar Header */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderBottom: isFilterExpanded ? '1px solid var(--border)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260, maxWidth: 440 }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <FaSearch
                size={14}
                style={{
                  position: 'absolute',
                  left: 12,
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search by Device ID, Coach, Train, Zone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  outline: 'none',
                  background: '#ffffff',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: 10,
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <FaTimes size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons: Sort, Expand/Collapse, Reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: 10 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Sort:</span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#334155',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="deviceId">Device ID (Primary Key)</option>
                <option value="coachNumber">Coach Number</option>
                <option value="trainNumber">Train Number</option>
                <option value="location">Zone / Location</option>
                {filterableAttributes.map((attr) => (
                  <option key={attr.columnKey} value={attr.columnKey}>
                    {attr.displayName}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                title={sortDirection === 'asc' ? 'Ascending (A-Z)' : 'Descending (Z-A)'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {sortDirection === 'asc' ? <FaSortAmountDown size={14} /> : <FaSortAmountUp size={14} />}
              </button>
            </div>

            {/* Expand / Collapse Button */}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: isFilterExpanded ? '#f1f5f9' : '#ffffff',
              }}
            >
              <FaFilter size={12} style={{ color: activeFiltersCount > 0 ? '#0284c7' : '#64748b' }} />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    borderRadius: 9999,
                    fontSize: '0.72rem',
                    padding: '1px 6px',
                    fontWeight: 700,
                  }}
                >
                  {activeFiltersCount}
                </span>
              )}
              {isFilterExpanded ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
            </button>

            {/* Reset Filters Button */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={resetFilters}
                style={{
                  fontSize: '0.82rem',
                  color: '#dc2626',
                  borderColor: '#fca5a5',
                  padding: '6px 12px',
                }}
              >
                Reset All
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Panel with Dynamic Attribute Selectors */}
        {isFilterExpanded && (
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
                Filter by Enabled Service Attributes ({filterableAttributes.length})
              </span>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Showing <strong>{processedDevices.length}</strong> of <strong>{devices.length}</strong> devices
              </span>
            </div>

            {/* Grid of Dynamic Unique Value Dropdowns */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              {filterableAttributes.map((attr) => {
                const currentVal = selectedFilters[attr.columnKey] || 'ALL';
                const isSelected = currentVal !== 'ALL';

                return (
                  <div
                    key={attr.columnKey}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      background: isSelected ? 'rgba(2, 132, 199, 0.05)' : '#f8fafc',
                      border: `1px solid ${isSelected ? '#38bdf8' : '#e2e8f0'}`,
                      padding: '8px 12px',
                      borderRadius: 10,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <label
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: isSelected ? '#0284c7' : '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {attr.displayName}
                    </label>
                    <select
                      value={currentVal}
                      onChange={(e) => handleFilterChange(attr.columnKey, e.target.value)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: '0.86rem',
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? '#0369a1' : '#334155',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <option value="ALL">All ({attr.uniqueValues.length})</option>
                      {attr.uniqueValues.map((val) => (
                        <option key={val} value={val}>
                          {val}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Active Filter Chips Bar */}
            {activeFiltersCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  paddingTop: 10,
                  borderTop: '1px dashed #e2e8f0',
                }}
              >
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Active filters:</span>
                {searchQuery && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#e0f2fe',
                      color: '#0369a1',
                      padding: '4px 10px',
                      borderRadius: 9999,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    Search: "{searchQuery}"
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: 0 }}
                    >
                      <FaTimes size={10} />
                    </button>
                  </span>
                )}
                {Object.entries(selectedFilters).map(([colKey, val]) => {
                  const attrDef = filterableAttributes.find((a) => a.columnKey === colKey);
                  return (
                    <span
                      key={colKey}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#e0f2fe',
                        color: '#0369a1',
                        padding: '4px 10px',
                        borderRadius: 9999,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                      }}
                    >
                      {attrDef?.displayName || colKey}: <strong>{val}</strong>
                      <button
                        type="button"
                        onClick={() => handleFilterChange(colKey, 'ALL')}
                        style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: 0 }}
                      >
                        <FaTimes size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Devices Cards Grid */}
      {processedDevices.length === 0 ? (
        <div
          className="card text-center"
          style={{
            padding: 48,
            borderRadius: 16,
            backgroundColor: '#ffffff',
            border: '1px dashed #cbd5e1',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: '#f1f5f9',
              color: '#94a3b8',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              marginBottom: 16,
            }}
          >
            <FaMicrochip />
          </div>
          <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', fontWeight: 700 }}>
            No Matching Hardware Devices Found
          </h3>
          <p className="text-muted" style={{ maxWidth: 460, margin: '0 auto 16px', fontSize: '0.9rem' }}>
            {devices.length === 0
              ? 'No hardware devices for this service are currently assigned to your Scope Group.'
              : 'No devices match your active search and attribute filters.'}
          </p>
          {activeFiltersCount > 0 && (
            <button type="button" className="btn btn-outline" onClick={resetFilters}>
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 20,
          }}
        >
          {processedDevices.map((dev) => {
            const hasData = !!dev.latestData;
            return (
              <div
                key={dev.deviceId}
                className="card"
                onClick={() => onSelectDevice(dev.deviceId)}
                style={{
                  padding: 22,
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = '#0284c7';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(2, 132, 199, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
                }}
              >
                {/* Card Top: Primary Key / Device ID & Status Pill */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.1) 0%, rgba(14, 154, 167, 0.15) 100%)',
                          color: '#0284c7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.25rem',
                          flexShrink: 0,
                        }}
                      >
                        <FaMicrochip />
                      </div>
                      <div>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            color: '#94a3b8',
                            display: 'block',
                          }}
                        >
                          Device ID / Primary Key
                        </span>
                        <h3
                          style={{
                            margin: '2px 0 0 0',
                            fontSize: '1.2rem',
                            fontWeight: 800,
                            color: '#0f172a',
                            lineHeight: 1.2,
                          }}
                        >
                          {dev.deviceId}
                        </h3>
                      </div>
                    </div>

                    <span
                      className="badge"
                      style={{
                        backgroundColor: hasData ? '#f0fdf4' : '#f8fafc',
                        color: hasData ? '#16a34a' : '#64748b',
                        border: `1px solid ${hasData ? '#bbf7d0' : '#e2e8f0'}`,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: hasData ? '#16a34a' : '#94a3b8',
                        }}
                      />
                      {hasData ? 'Live Active' : 'Standby'}
                    </span>
                  </div>

                  {/* Minimalist Metadata Grid */}
                  <div
                    style={{
                      background: '#f8fafc',
                      borderRadius: 12,
                      padding: '12px 14px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 10,
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600 }}>
                        Coach Number
                      </span>
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                        {dev.coachNumber || '—'}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600 }}>
                        Train Number
                      </span>
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                        {dev.trainNumber || '—'}
                      </strong>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600 }}>
                        Zone / Location
                      </span>
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <FaMapMarkerAlt size={11} style={{ color: '#0284c7' }} />
                        {dev.location || 'Indian Railways'}
                      </strong>
                    </div>
                  </div>

                  {/* Key Dynamic Telemetry Metrics Badges (if enabled & present) */}
                  {cardHighlightConfigs.length > 0 && hasData && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                      {cardHighlightConfigs.map((cfg) => {
                        const val = getDeviceAttrValue(dev, cfg.columnKey);
                        if (val === null || val === undefined || String(val) === '') return null;
                        return (
                          <div
                            key={cfg.columnKey}
                            style={{
                              fontSize: '0.75rem',
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: '#f1f5f9',
                              color: '#334155',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <span style={{ color: '#64748b' }}>{cfg.displayName}:</span>
                            <strong style={{ color: '#0f172a' }}>{String(val)}</strong>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Card Action Link */}
                <div
                  style={{
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {dev.latestData?.timestamp
                      ? new Date(dev.latestData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Ready for stream'}
                  </span>

                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    View Telemetry <FaArrowRight size={11} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
