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
  FaSpinner
} from 'react-icons/fa';
import type { User } from '../types';
import { API_URL } from '../config';
import './Branding.css';

type Props = {
  user: User;
};

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/settings/branding`)
      .then((res) => res.json())
      .then((data) => {
        if (data.appName) {
          setAppName(data.appName);
          setInitialAppName(data.appName);
        }
        if (data.wallpaperUrl) {
          setWallpaperUrl(data.wallpaperUrl);
        }
      })
      .catch((err) => console.error('Error fetching branding:', err));
  }, []);

  // Compute the live display image (newly picked file preview or server wallpaper)
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

  const handleResetToCurrent = () => {
    setAppName(initialAppName);
    handleRemoveDraftFile();
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('appName', appName.trim() || 'LC Platform');
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
        if (data.wallpaperUrl) setWallpaperUrl(data.wallpaperUrl);
        setFile(null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        setToastMessage('Branding and login wallpaper updated successfully!');
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
    return appName !== initialAppName || file !== null;
  }, [appName, initialAppName, file]);

  return (
    <div className="branding-page-container">
      {/* Page Header */}
      <div className="branding-header">
        <div className="branding-header-icon-badge">
          <FaPaintBrush />
        </div>
        <div className="branding-header-text">
          <h2>Application Branding & Visual Identity</h2>
          <p>Configure custom platform naming, logos, and login background wallpaper.</p>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="branding-studio-grid">
        {/* Left Column: Configuration Forms */}
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
            {/* Panel 1: Application Title & Preset Ideas */}
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

            {/* Panel 2: Wallpaper / Logo Uploader */}
            <div className="branding-panel-card">
              <div className="panel-card-title-group">
                <div>
                  <h3 className="panel-card-title">
                    <FaImage className="panel-card-title-icon" />
                    Login Wallpaper & Graphic Asset
                  </h3>
                  <p className="panel-card-subtitle">
                    Full-bleed photographic background or Railway insignia for the portal authentication screen.
                  </p>
                </div>
              </div>

              {/* Active Asset Card if present */}
              {activeImage && (
                <div className="active-asset-card">
                  <div className="asset-card-left">
                    <div className="asset-thumbnail-wrap">
                      <img src={activeImage} alt="Active Branding" className="asset-thumbnail-img" />
                    </div>
                    <div className="asset-info">
                      <p className="asset-title">
                        {file ? file.name : 'Current Active Wallpaper'}
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
                  Drag and drop your image here, or <span>Browse Files</span>
                </p>
                <p className="dropzone-sub-text">
                  Supports High-Res JPG, PNG, WEBP, or SVG (Up to 10MB)
                </p>
              </div>
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
