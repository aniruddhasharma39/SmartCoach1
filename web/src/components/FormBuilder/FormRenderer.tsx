import { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import type { FormField, FormSchema } from '../../types/form';

type Props = {
  schema: FormSchema;
  roles?: any[]; // if allowRoles is true
  onSubmit: (data: any) => void;
  isSubmitting?: boolean;
  requirePassword?: boolean;
};

export default function FormRenderer({ schema, roles, onSubmit, isSubmitting, requirePassword = true }: Props) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isExcludedField = (field: FormField) => {
    return requirePassword && (field.name === 'password' || field.name === 'confirmPassword');
  };

  const validateField = (field: FormField, val: any): string | null => {
    if (field.required && (!val || val.length === 0)) return 'This field is required';
    if (!val) return null;

    if (field.validation) {
      const { minLength, maxLength, pattern, customError } = field.validation;
      if (minLength && val.length < minLength) return customError || `Minimum length is ${minLength}`;
      if (maxLength && val.length > maxLength) return customError || `Maximum length is ${maxLength}`;
      if (pattern && !new RegExp(pattern).test(val)) return customError || 'Invalid format';
    } else {
      // Default validations if no custom rules
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Invalid email format (must include @ and valid domain)';
      if (field.type === 'phone' && !/^[6-9]\d{9}$/.test(val)) return 'Mobile number must be a 10-digit Indian number starting with 6, 7, 8, or 9';
    }
    return null;
  };

  const handleChange = (field: FormField, val: any) => {
    setFormData(prev => ({ ...prev, [field.name]: val }));
    setErrors(prev => ({ ...prev, [field.name]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let hasErrors = false;
    const newErrors: Record<string, string> = {};

    const checkFields = (list: FormField[]) => {
      for (const f of list) {
        if (isExcludedField(f)) continue;
        if (f.type === 'section') {
          if (f.children) checkFields(f.children);
          continue;
        }
        const err = validateField(f, formData[f.name]);
        if (err) {
          hasErrors = true;
          newErrors[f.name] = err;
        }
      }
    };
    checkFields(schema.fields);

    if (schema.allowRoles && !formData.roleId) {
      hasErrors = true;
      newErrors['roleId'] = 'Role selection is required';
    }

    if (requirePassword) {
      if (!password || password.trim().length === 0) {
        hasErrors = true;
        newErrors['password'] = 'Password is required';
      } else if (password.length < 6) {
        hasErrors = true;
        newErrors['password'] = 'Password must be at least 6 characters';
      }

      if (!confirmPassword || confirmPassword.trim().length === 0) {
        hasErrors = true;
        newErrors['confirmPassword'] = 'Confirm Password is required';
      } else if (password !== confirmPassword) {
        hasErrors = true;
        newErrors['confirmPassword'] = 'Passwords do not match';
      }
    }

    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      ...formData,
      ...(requirePassword ? { password } : {})
    };
    onSubmit(payload);
  };

  const renderField = (field: FormField) => {
    if (isExcludedField(field)) return null;

    if (field.type === 'section') {
      const visibleChildren = field.children?.filter(c => !isExcludedField(c));
      return (
        <div key={field.id} style={{ marginBottom: 24 }}>
          <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 16 }}>{field.label}</h3>
          {field.helperText && <p className="text-muted text-sm mb-4">{field.helperText}</p>}
          <div className="flex-col gap-4">
            {visibleChildren?.map(renderField)}
          </div>
        </div>
      );
    }

    const value = formData[field.name] || '';
    const err = errors[field.name];

    return (
      <div key={field.id} className="form-group" style={{ marginBottom: 16 }}>
        <label>
          {field.label} {field.required && <span className="text-danger">*</span>}
        </label>
        {field.helperText && <div className="text-sm text-muted mb-1">{field.helperText}</div>}
        
        {['text', 'email', 'phone', 'number', 'password', 'date'].includes(field.type) && (
          <input 
            type={field.type === 'phone' ? 'tel' : field.type} 
            placeholder={field.placeholder}
            value={value}
            maxLength={field.type === 'phone' ? 10 : undefined}
            onChange={(e) => {
              let val = e.target.value;
              if (field.type === 'phone') {
                val = val.replace(/\D/g, '').slice(0, 10);
              }
              handleChange(field, val);
            }}
            style={{ borderColor: err ? 'var(--danger)' : undefined, width: '100%', padding: '10px' }}
          />
        )}
        
        {field.type === 'textarea' && (
          <textarea 
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleChange(field, e.target.value)}
            style={{ borderColor: err ? 'var(--danger)' : undefined, width: '100%', padding: '10px', minHeight: 100 }}
          />
        )}
        
        {field.type === 'dropdown' && (
          <select 
            value={value} 
            onChange={(e) => handleChange(field, e.target.value)}
            style={{ borderColor: err ? 'var(--danger)' : undefined, width: '100%', padding: '10px' }}
          >
            <option value="">{field.placeholder || 'Select an option'}</option>
            {field.options?.map(o => (
              <option key={o.id} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        {field.type === 'radio' && (
          <div className="flex gap-4 flex-wrap mt-2">
            {field.options?.map(o => (
              <label key={o.id} className="flex items-center gap-2 m-0 cursor-pointer">
                <input 
                  type="radio" 
                  name={field.name} 
                  value={o.value} 
                  checked={value === o.value}
                  onChange={(e) => handleChange(field, e.target.value)}
                />
                {o.label}
              </label>
            ))}
          </div>
        )}

        {field.type === 'checkbox' && (
          <div className="flex-col gap-2 mt-2">
            {field.options?.map(o => {
              const currentList = Array.isArray(value) ? value : [];
              return (
                <label key={o.id} className="flex items-center gap-2 m-0 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={currentList.includes(o.value)}
                    onChange={(e) => {
                      if (e.target.checked) handleChange(field, [...currentList, o.value]);
                      else handleChange(field, currentList.filter(v => v !== o.value));
                    }}
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        )}

        {field.type === 'image' && (
          <div className="file-input-wrapper">
            <input 
              type="file" 
              accept={field.imageSettings?.acceptedTypes?.join(',') || 'image/*'} 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleChange(field, e.target.files[0]);
                }
              }}
            />
            {value instanceof File && <div className="text-sm text-primary mt-1">Selected: {value.name}</div>}
          </div>
        )}

        {err && <div className="text-danger text-sm mt-1">{err}</div>}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {schema.fields.map(renderField)}

      {schema.allowRoles && (
        <div className="form-group" style={{ marginBottom: 16, padding: 16, backgroundColor: 'var(--background)', borderRadius: 8 }}>
          <label>Request Role <span className="text-danger">*</span></label>
          <div className="text-sm text-muted mb-2">Select the role you are requesting access for. This will require admin approval.</div>
          <select 
            value={formData.roleId || ''} 
            onChange={e => {
              setFormData(p => ({ ...p, roleId: e.target.value }));
              setErrors(p => ({ ...p, roleId: '' }));
            }}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="">Select a role...</option>
            {roles?.filter(r => schema.allowedRoles ? schema.allowedRoles.includes(r.id.toString()) : true).map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {errors.roleId && <div className="text-danger text-sm mt-1">{errors.roleId}</div>}
        </div>
      )}

      {requirePassword && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
              Password <span className="text-danger">*</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                placeholder="Create a password (min 6 characters)"
                value={password}
                autoComplete="new-password"
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) {
                    setErrors(p => ({ ...p, password: '' }));
                  }
                }}
                style={{ 
                  borderColor: errors.password ? 'var(--danger)' : undefined, 
                  width: '100%', 
                  padding: '10px 42px 10px 12px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{
                  position: 'absolute',
                  right: 10,
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.05rem',
                  lineHeight: 1
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {errors.password && <div className="text-danger text-sm mt-1">{errors.password}</div>}
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
              Confirm Password <span className="text-danger">*</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showConfirmPassword ? 'text' : 'password'} 
                placeholder="Re-enter password to confirm"
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) {
                    setErrors(p => ({ ...p, confirmPassword: '' }));
                  }
                }}
                style={{ 
                  borderColor: errors.confirmPassword ? 'var(--danger)' : undefined, 
                  width: '100%', 
                  padding: '10px 42px 10px 12px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(p => !p)}
                style={{
                  position: 'absolute',
                  right: 10,
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.05rem',
                  lineHeight: 1
                }}
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {errors.confirmPassword && <div className="text-danger text-sm mt-1">{errors.confirmPassword}</div>}
          </div>
        </div>
      )}

      <button type="submit" className="primary" disabled={isSubmitting} style={{ padding: '12px', fontSize: '1.1rem', marginTop: 16 }}>
        {isSubmitting ? 'Submitting...' : 'Submit Registration'}
      </button>
    </form>
  );
}
