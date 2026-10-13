import { useEffect, useState, useMemo, useRef } from 'react';
import { 
  FaPaintBrush, 
  FaCloudUploadAlt, 
  FaImage, 
  FaCheck, 
  FaUndo, 
  FaTag, 
  FaTrashAlt, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaMagic,
  FaFileImage,
  FaSpinner,
  FaPalette,
  FaEye,
  FaSlidersH
} from 'react-icons/fa';
import type { User } from '../types';
import { API_URL } from '../config';
import './Branding.css';

type Props = {
  user: User;
};

interface GradientPreset {
  id: string;
  name: string;
  color1: string;
  color2: string;
  angle: string;
  css: string;
}

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #0b3c7a 0%, #0e9aa7 100%)';

const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'railway-blue',
    name: 'Railway Blue',
    color1: '#0b3c7a',
    color2: '#0e9aa7',
    angle: '135deg',
    css: 'linear-gradient(135deg, #0b3c7a 0%, #0e9aa7 100%)',
  },
  {
    id: 'midnight-navy',
    name: 'Midnight Navy',
    color1: '#0f172a',
    color2: '#1e3a8a',
    angle: '135deg',
    css: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
  },
  {
    id: 'royal-indigo',
    name: 'Royal Indigo',
    color1: '#1e1b4b',
    color2: '#4338ca',
    angle: '135deg',
    css: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)',
  },
  {
    id: 'steel-slate',
    name: 'Steel Slate',
    color1: '#1e293b',
    color2: '#475569',
    angle: '135deg',
    css: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
  },
  {
    id: 'ocean-teal',
    name: 'Ocean Teal',
    color1: '#042f2e',
    color2: '#0d9488',
    angle: '135deg',
    css: 'linear-gradient(135deg, #042f2e 0%, #0d9488 100%)',
  },
  {
    id: 'crimson-express',
    name: 'Crimson Express',
    color1: '#450a0a',
    color2: '#991b1b',
    angle: '135deg',
    css: 'linear-gradient(135deg, #450a0a 0%, #991b1b 100%)',
  },
  {
    id: 'forest-emerald',
    name: 'Forest Emerald',
    color1: '#064e3b',
    color2: '#059669',
    angle: '135deg',
    css: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
  },
  {
    id: 'obsidian-noir',
    name: 'Obsidian Noir',
    color1: '#09090b',
    color2: '#27272a',
    angle: '135deg',
    css: 'linear-gradient(135deg, #09090b 0%, #27272a 100%)',
  },
];

const ANGLE_OPTIONS = [
  { label: '↘ 135°', value: '135deg' },
  { label: '↓ 180°', value: '180deg' },
  { label: '→ 90°', value: '90deg' },
  { label: '↗ 45°', value: '45deg' },
];

function parseGradient(gradientStr: string) {
  const match = gradientStr.match(
    /linear-gradient\(\s*([\w\d]+)\s*,\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s*(?:\d+%)?\s*,\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i
  );
  if (match) {
    return {
      angle: match[1] || '135deg',
      color1: match[2].startsWith('#') ? match[2] : '#0b3c7a',
      color2: match[3].startsWith('#') ? match[3] : '#0e9aa7',
    };
  }
  return {
    angle: '135deg',
    color1: '#0b3c7a',
    color2: '#0e9aa7',
  };
}

export default function Branding({}: Props) {
  const [appName, setAppName] = useState('');
  const [initialAppName, setInitialAppName] = useState('');
  const [wallpaperUrl, setWallpaperUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Gradient state
  const [loginGradient, setLoginGradient] = useState(DEFAULT_GRADIENT);
  const [initialLoginGradient, setInitialLoginGradient] = useState(DEFAULT_GRADIENT);
  const [color1, setColor1] = useState('#0b3c7a');
  const [color2, setColor2] = useState('#0e9aa7');
  const [angle, setAngle] = useState('135deg');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/settings/branding`)
      .then((res) => res.json())
      .then((data) => {
        if (data.appName) {
          setAppName(data.appName);
          setInitialAppName(data.appName);
        }
        if (data.wallpaperUrl || data.logoUrl) {
          setWallpaperUrl(data.wallpaperUrl || data.logoUrl);
        }
        if (data.loginGradient) {
          setLoginGradient(data.loginGradient);
          setInitialLoginGradient(data.loginGradient);
          const parsed = parseGradient(data.loginGradient);
          setColor1(parsed.color1);
          setColor2(parsed.color2);
          setAngle(parsed.angle);
        }
      })
      .catch((err) => console.error('Error fetching branding:', err));
  }, []);

  // Compute the live display image (newly picked file preview or server logo)
  const activeImage = useMemo(() => {
    return previewUrl || wallpaperUrl || '';
  }, [previewUrl, wallpaperUrl]);

  // Handle local file selection with instant object URL preview
  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile) {
      if (!selectedFile.type.startsWith('image/')) {
        setErrorMessage('Please select a valid image file (PNG, JPG, WEBP, or SVG).');
        return;
      }
      setFile(selectedFile);
      const objUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objUrl);
      setErrorMessage(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveDraftFile = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Gradient Handlers
  const handleSelectPreset = (preset: GradientPreset) => {
    setLoginGradient(preset.css);
    setColor1(preset.color1);
    setColor2(preset.color2);
    setAngle(preset.angle);
  };

  const handleColor1Change = (newColor1: string) => {
    setColor1(newColor1);
    const newCss = `linear-gradient(${angle}, ${newColor1} 0%, ${color2} 100%)`;
    setLoginGradient(newCss);
  };

  const handleColor2Change = (newColor2: string) => {
    setColor2(newColor2);
    const newCss = `linear-gradient(${angle}, ${color1} 0%, ${newColor2} 100%)`;
    setLoginGradient(newCss);
  };

  const handleAngleChange = (newAngle: string) => {
    setAngle(newAngle);
    const newCss = `linear-gradient(${newAngle}, ${color1} 0%, ${color2} 100%)`;
    setLoginGradient(newCss);
  };

  const handleResetToCurrent = () => {
    setAppName(initialAppName);
    handleRemoveDraftFile();
    setLoginGradient(initialLoginGradient);
    const parsed = parseGradient(initialLoginGradient);
    setColor1(parsed.color1);
    setColor2(parsed.color2);
    setAngle(parsed.angle);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('appName', appName.trim() || 'LC Platform');
    formData.append('loginGradient', loginGradient);
    if (file) {
      formData.append('wallpaper', file);
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/settings/branding`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setAppName(data.appName);
        setInitialAppName(data.appName);
        if (data.wallpaperUrl || data.logoUrl) {
          setWallpaperUrl(data.wallpaperUrl || data.logoUrl);
        }
        if (data.loginGradient) {
          setLoginGradient(data.loginGradient);
          setInitialLoginGradient(data.loginGradient);
        }
        setFile(null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        setToastMessage('Branding, logo, and login gradient updated successfully!');
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setErrorMessage(data.error || 'Failed to update branding');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error occurred while saving branding');
    } finally {
      setLoading(false);
    }
  };

  const isDirty = useMemo(() => {
    return (
      appName !== initialAppName ||
      file !== null ||
      loginGradient !== initialLoginGradient
    );
  }, [appName, initialAppName, file, loginGradient, initialLoginGradient]);

  return (
    <div className="branding-page-container">
      {/* Page Header */}
      <div className="branding-header">
        <div className="branding-header-icon-badge">
          <FaPaintBrush />
        </div>
        <div className="branding-header-text">
          <h2>Application Branding & Visual Identity</h2>
          <p>
            Configure custom platform naming, login card logo/emblem, and login screen background gradient.
          </p>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="branding-studio-grid">
        <div className="branding-form-col">
          {toastMessage && (
            <div className="branding-toast">
              <FaCheckCircle style={{ fontSize: '1.1rem' }} />
              <span>{toastMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                backgroundColor: 'rgba(214, 69, 69, 0.1)',
                color: 'var(--danger)',
                border: '1px solid rgba(214, 69, 69, 0.25)',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FaExclamationTriangle />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Panel 1: Application Title */}
            <div className="branding-panel-card">
              <div className="panel-card-title-group">
                <div>
                  <h3 className="panel-card-title">
                    <FaTag className="panel-card-title-icon" />
                    Application Identity
                  </h3>
                  <p className="panel-card-subtitle">
                    Displayed across header navigation, login page, and browser titles.
                  </p>
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">
                  <span>Application Name</span>
                  <span className="char-count">{appName.length} / 50</span>
                </label>
                <div className="branding-input-wrap">
                  <FaMagic className="branding-input-icon" />
                  <input
                    type="text"
                    className="branding-text-input"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="e.g., LC Application, Northern Railway Portal"
                    maxLength={50}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Panel 2: Login Card Emblem & Insignia */}
            <div className="branding-panel-card">
              <div className="panel-card-title-group">
                <div>
                  <h3 className="panel-card-title">
                    <FaImage className="panel-card-title-icon" />
                    Login Card Emblem & Logo
                  </h3>
                  <p className="panel-card-subtitle">
                    Uploaded insignia appears centered inside the login box above the platform title.
                  </p>
                </div>
              </div>

              {/* Active Asset Card if present */}
              {activeImage && (
                <div className="active-asset-card">
                  <div className="asset-card-left">
                    <div className="asset-thumbnail-wrap">
                      <img src={activeImage} alt="Active Branding Logo" className="asset-thumbnail-img" />
                    </div>
                    <div className="asset-info">
                      <p className="asset-title">
                        {file ? file.name : 'Current Active Logo'}
                      </p>
                      <span className={`asset-status-tag ${file ? 'new-draft' : 'uploaded'}`}>
                        {file ? 'Draft (Unsaved)' : 'Live on Cloudinary'}
                      </span>
                    </div>
                  </div>

                  <div className="asset-actions">
                    <button
                      type="button"
                      className="btn-asset-action"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FaFileImage /> Replace
                    </button>
                    {file && (
                      <button
                        type="button"
                        className="btn-asset-action remove"
                        onClick={handleRemoveDraftFile}
                        title="Revert draft image"
                      >
                        <FaTrashAlt />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Dropzone Container */}
              <div
                className={`dropzone-container ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="file-input-hidden"
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                  onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
                />
                <div className="dropzone-icon-circle">
                  <FaCloudUploadAlt />
                </div>
                <p className="dropzone-main-text">
                  Drag and drop your emblem or logo here, or <span>Browse Files</span>
                </p>
                <p className="dropzone-sub-text">
                  Recommended transparent PNG, SVG, or high-res JPG (Up to 10MB)
                </p>
              </div>
            </div>

            {/* Panel 3: Login Background Gradient Studio */}
            <div className="branding-panel-card">
              <div className="panel-card-title-group">
                <div>
                  <h3 className="panel-card-title">
                    <FaPalette className="panel-card-title-icon" />
                    Login Background Gradient Studio
                  </h3>
                  <p className="panel-card-subtitle">
                    Select a curated preset or blend custom colors to create your full-bleed login background.
                  </p>
                </div>
              </div>

              {/* Preset Gradients */}
              <div className="field-group">
                <label className="field-label">
                  <span>Curated Gradient Presets</span>
                </label>
                <div className="gradient-presets-grid">
                  {GRADIENT_PRESETS.map((preset) => {
                    const isSelected = loginGradient === preset.css;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`gradient-preset-tile ${isSelected ? 'active' : ''}`}
                        onClick={() => handleSelectPreset(preset)}
                        title={preset.name}
                      >
                        <div
                          className="gradient-tile-swatch"
                          style={{ background: preset.css }}
                        >
                          {isSelected && <FaCheck className="preset-check-icon" />}
                        </div>
                        <span className="gradient-tile-name">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Gradient Pickers */}
              <div className="field-group" style={{ marginTop: '0.5rem' }}>
                <label className="field-label">
                  <span>
                    <FaSlidersH style={{ marginRight: '0.35rem', verticalAlign: '-1px' }} />
                    Custom Gradient Controls
                  </span>
                </label>

                <div className="custom-gradient-row">
                  {/* Color 1 */}
                  <div className="color-picker-box">
                    <span className="color-picker-label">Start Color</span>
                    <div className="color-picker-input-wrap">
                      <input
                        type="color"
                        value={color1.length === 7 ? color1 : '#0b3c7a'}
                        onChange={(e) => handleColor1Change(e.target.value)}
                        className="color-swatch-input"
                        title="Pick start color"
                      />
                      <input
                        type="text"
                        value={color1}
                        onChange={(e) => handleColor1Change(e.target.value)}
                        className="color-hex-text"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Color 2 */}
                  <div className="color-picker-box">
                    <span className="color-picker-label">End Color</span>
                    <div className="color-picker-input-wrap">
                      <input
                        type="color"
                        value={color2.length === 7 ? color2 : '#0e9aa7'}
                        onChange={(e) => handleColor2Change(e.target.value)}
                        className="color-swatch-input"
                        title="Pick end color"
                      />
                      <input
                        type="text"
                        value={color2}
                        onChange={(e) => handleColor2Change(e.target.value)}
                        className="color-hex-text"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Angle Select */}
                  <div className="color-picker-box">
                    <span className="color-picker-label">Angle / Flow</span>
                    <div className="angle-buttons-wrap">
                      {ANGLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`angle-btn ${angle === opt.value ? 'active' : ''}`}
                          onClick={() => handleAngleChange(opt.value)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 4: Live Interactive Preview */}
            <div className="branding-panel-card">
              <div className="panel-card-title-group">
                <div>
                  <h3 className="panel-card-title">
                    <FaEye className="panel-card-title-icon" />
                    Live Authentication Screen Preview
                  </h3>
                  <p className="panel-card-subtitle">
                    Real-time preview of the login screen with your custom background gradient and centered card insignia.
                  </p>
                </div>
              </div>

              <div
                className="branding-preview-stage"
                style={{ background: loginGradient }}
              >
                <div className="branding-preview-card">
                  {/* Embedded Logo */}
                  {activeImage ? (
                    <div className="preview-logo-container">
                      <img
                        src={activeImage}
                        alt="Preview Logo"
                        className="preview-logo-img"
                      />
                    </div>
                  ) : (
                    <div className="preview-logo-placeholder">
                      <FaImage />
                    </div>
                  )}

                  {/* App Title */}
                  <h4 className="preview-app-title">
                    {appName.trim() || 'LC Application'}
                  </h4>
                  <p className="preview-app-subtitle">
                    Sign in to access your dashboard
                  </p>

                  {/* Mock Form Inputs */}
                  <div className="preview-mock-field">
                    <div className="preview-mock-input">
                      <span>e.g. 9876543210 or user@example.com</span>
                    </div>
                  </div>
                  <div className="preview-mock-field">
                    <div className="preview-mock-input">
                      <span>••••••••••••</span>
                    </div>
                  </div>

                  {/* Mock Button */}
                  <div className="preview-mock-btn">
                    Sign In
                  </div>

                  <span className="preview-mock-footer">
                    Don't have an account? <b>Register Here</b>
                  </span>
                </div>
              </div>

              <p className="preview-notice-tip">
                ✨ <b>Design Note:</b> The uploaded graphic asset is neatly encapsulated inside the login card, while the background radiates your selected gradient.
              </p>
            </div>

            {/* Action Bar */}
            <div className="branding-submit-footer">
              <p className="branding-submit-tip">
                {isDirty ? 'You have unsaved changes.' : 'Branding configuration is up to date.'}
              </p>

              <div className="branding-submit-buttons">
                {isDirty && (
                  <button
                    type="button"
                    className="btn-reset-draft"
                    onClick={handleResetToCurrent}
                    disabled={loading}
                  >
                    <FaUndo style={{ marginRight: '0.35rem' }} />
                    Reset
                  </button>
                )}
                <button
                  type="submit"
                  className="btn-save-branding"
                  disabled={loading}
                  title="Save application branding settings"
                  data-tooltip="Save branding settings"
                >
                  {loading ? (
                    <>
                      <FaSpinner className="spin" style={{ marginRight: '0.35rem' }} /> Saving Changes...
                    </>
                  ) : (
                    <>
                      <FaCheck style={{ marginRight: '0.35rem' }} /> Save Branding
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
