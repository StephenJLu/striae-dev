import { useEffect, useRef, useState } from 'react';
import { Icon } from '~/components/icon/icon';
import { evaluatePasswordPolicy } from '~/utils/auth';
import styles from '~/components/navbar/case-modals/case-modal-shared.module.css';

export interface FirstTimeSetupData {
  company: string;
  badgeId: string;
  newPassword: string;
}

interface FirstTimeSetupModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onSubmit: (data: FirstTimeSetupData) => Promise<void>;
}

const getPolicyFeedback = (password: string, confirmPassword: string): string => {
  const policy = evaluatePasswordPolicy(password, confirmPassword);
  return `Password must contain:
  ${policy.hasMinLength ? '✅' : '❌'} At least 10 characters
  ${policy.hasUpperCase ? '✅' : '❌'} Capital letters
  ${policy.hasNumber ? '✅' : '❌'} Numbers
  ${policy.hasSpecialChar ? '✅' : '❌'} Special characters
  ${policy.passwordsMatch ? '✅' : '❌'} Passwords must match`;
};

const passwordFieldWrapperStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const passwordToggleStyle: React.CSSProperties = {
  position: 'absolute',
  right: '0.5rem',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0.25rem',
  color: '#6c757d',
  display: 'inline-flex',
  alignItems: 'center',
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.35rem',
  color: '#495057',
  fontSize: '0.8rem',
  fontWeight: 600,
};

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: '0.75rem',
};

const passwordFeedbackStyle: React.CSSProperties = {
  marginTop: '0.4rem',
  fontSize: '0.78rem',
  color: '#495057',
  lineHeight: 1.5,
  whiteSpace: 'pre',
  fontFamily: 'inherit',
};

const inputWithPaddingStyle: React.CSSProperties = {
  paddingRight: '2.2rem',
};

export const FirstTimeSetupModal = ({ isOpen, isSubmitting, onSubmit }: FirstTimeSetupModalProps) => {
  const [company, setCompany] = useState('');
  const [badgeId, setBadgeId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState('');
  const [error, setError] = useState('');
  const companyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const id = window.requestAnimationFrame(() => companyRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [isOpen]);

  const canSubmit =
    !isSubmitting &&
    company.trim().length > 0 &&
    badgeId.trim().length > 0 &&
    evaluatePasswordPolicy(newPassword, confirmPassword).isStrong;

  const handleSubmit = async () => {
    setError('');

    const policy = evaluatePasswordPolicy(newPassword, confirmPassword);
    if (!policy.isStrong) {
      setPasswordFeedback(getPolicyFeedback(newPassword, confirmPassword));
      setError('Please fix the password issues above before continuing.');
      return;
    }

    try {
      await onSubmit({ company: company.trim(), badgeId: badgeId.trim(), newPassword });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed. Please try again.');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div
        className={`${styles.modal} ${styles.modalStandard}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-time-setup-title"
      >
        <h3 className={styles.title} id="first-time-setup-title">
          Welcome — Complete Your Profile
        </h3>
        <p className={styles.subtitle}>
          Please complete the fields below before continuing. These details will be
          associated with your work in Striae.
        </p>

        <div className={styles.warningPanel}>
          <p>
            <strong>Lab/Company Name and Badge/ID cannot be changed after they are saved.</strong>{' '}
            These values are permanent and will appear on all reports and audit records.
            Please confirm they are correct before continuing.
          </p>
        </div>

        <div style={fieldGroupStyle}>
          <label htmlFor="fts-company" style={fieldLabelStyle}>
            Lab/Company Name
          </label>
          <input
            ref={companyRef}
            id="fts-company"
            type="text"
            className={styles.input}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Enter your lab or company name"
            disabled={isSubmitting}
            autoComplete="organization"
          />
        </div>

        <div style={fieldGroupStyle}>
          <label htmlFor="fts-badge" style={fieldLabelStyle}>
            Badge/ID #
          </label>
          <input
            id="fts-badge"
            type="text"
            className={styles.input}
            value={badgeId}
            onChange={(e) => setBadgeId(e.target.value)}
            placeholder="Enter your Badge/ID number"
            disabled={isSubmitting}
            autoComplete="off"
          />
        </div>

        <div style={fieldGroupStyle}>
          <label htmlFor="fts-new-password" style={fieldLabelStyle}>
            New Password
          </label>
          <div style={passwordFieldWrapperStyle}>
            <input
              id="fts-new-password"
              type={showNewPassword ? 'text' : 'password'}
              className={styles.input}
              style={inputWithPaddingStyle}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (e.target.value || confirmPassword) {
                  setPasswordFeedback(getPolicyFeedback(e.target.value, confirmPassword));
                }
              }}
              placeholder="Create a new password"
              disabled={isSubmitting}
              autoComplete="new-password"
            />
            <button
              type="button"
              style={passwordToggleStyle}
              onClick={() => setShowNewPassword((v) => !v)}
              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              <Icon icon={showNewPassword ? 'eye-off' : 'eye'} size={18} />
            </button>
          </div>
        </div>

        <div style={fieldGroupStyle}>
          <label htmlFor="fts-confirm-password" style={fieldLabelStyle}>
            Confirm New Password
          </label>
          <div style={passwordFieldWrapperStyle}>
            <input
              id="fts-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              className={styles.input}
              style={inputWithPaddingStyle}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (newPassword || e.target.value) {
                  setPasswordFeedback(getPolicyFeedback(newPassword, e.target.value));
                }
              }}
              placeholder="Confirm your new password"
              disabled={isSubmitting}
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) {
                  void handleSubmit();
                }
              }}
            />
            <button
              type="button"
              style={passwordToggleStyle}
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              tabIndex={-1}
            >
              <Icon icon={showConfirmPassword ? 'eye-off' : 'eye'} size={18} />
            </button>
          </div>
          {passwordFeedback && (
            <pre style={passwordFeedbackStyle}>{passwordFeedback}</pre>
          )}
        </div>

        {error && (
          <p className={styles.emailError}>{error}</p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.confirmButton} ${styles.confirmButtonPrimary}`}
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Saving...' : 'Complete Setup'}
          </button>
        </div>
      </div>
    </div>
  );
};
