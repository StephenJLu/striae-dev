import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { auth } from '~/services/firebase';
import { handleAuthError } from '~/services/firebase/errors';
import {
  evaluatePasswordPolicy,
  getAllowedContinueDestinationFromActionCode,
  getSafeContinueDestination,
} from '~/utils/auth';
import { auditService } from '~/services/audit';
import { Icon } from '~/components/icon/icon';
import paths from '~/config/config.json';
import styles from './emailActionHandler.module.css';

interface EmailActionHandlerProps {
  mode: string | null;
  oobCode: string | null;
  continueUrl: string | null;
  lang: string | null;
}

type HandlerState = 'loading' | 'ready-reset' | 'success' | 'error' | 'unsupported';

const getUserAgent = (): string | undefined => {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  return navigator.userAgent;
};

const getPolicyFeedback = (password: string, confirmPassword: string): string => {
  const policy = evaluatePasswordPolicy(password, confirmPassword);

  return `Password must contain:
      ${!policy.hasMinLength ? '❌' : '✅'} At least 10 characters
      ${!policy.hasUpperCase ? '❌' : '✅'} Capital letters
      ${!policy.hasNumber ? '❌' : '✅'} Numbers
      ${!policy.hasSpecialChar ? '❌' : '✅'} Special characters
      ${!policy.passwordsMatch ? '❌' : '✅'} Passwords must match`;
};

export const EmailActionHandler = ({ mode, oobCode, continueUrl, lang }: EmailActionHandlerProps) => {
  const navigate = useNavigate();
  const [safeContinueDestination, setSafeContinueDestination] = useState({
    path: '/',
    url: '/',
    isCrossOrigin: false,
    isDefault: true,
  });

  const [state, setState] = useState<HandlerState>('loading');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState('');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const resolveContinueDestination = async () => {
      const resolvedDestination = await getSafeContinueDestination(continueUrl);
      if (!isMounted) {
        return;
      }

      setSafeContinueDestination(resolvedDestination);
    };

    void resolveContinueDestination();

    return () => {
      isMounted = false;
    };
  }, [continueUrl]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      if (!mode || !oobCode) {
        if (!isMounted) {
          return;
        }

        setError('Invalid email action link.');
        setState('error');
        return;
      }

      setState('loading');
      setError('');
      setSuccess('');

      if (mode === 'resetPassword') {
        try {
          const accountEmail = await verifyPasswordResetCode(auth, oobCode);
          if (!isMounted) {
            return;
          }

          setResolvedEmail(accountEmail);
          setState('ready-reset');
        } catch (err) {
          const { message } = handleAuthError(err);
          if (!isMounted) {
            return;
          }

          setError(message);
          setState('error');

          try {
            await auditService.logPasswordReset(
              'unknown-email',
              'email',
              'failure',
              undefined,
              'email-link',
              1,
              undefined,
              undefined,
              undefined,
              [`Password reset link validation failed: ${message}`]
            );
          } catch (auditError) {
            console.error('Failed to log password reset link validation failure:', auditError);
          }
        }

        return;
      }

      if (mode === 'verifyEmail') {
        let verificationEmail = '';

        try {
          const codeInfo = await checkActionCode(auth, oobCode);
          verificationEmail = codeInfo.data.email ?? '';

          await applyActionCode(auth, oobCode);

          if (auth.currentUser) {
            await auth.currentUser.reload();
          }

          await auditService.logEmailVerificationByEmail(
            verificationEmail || 'unknown-email',
            'success',
            'email-link',
            1,
            undefined,
            getUserAgent(),
            []
          );

          if (!isMounted) {
            return;
          }

          setResolvedEmail(verificationEmail);
          setSuccess('Email verified successfully. You can continue.');
          setState('success');
        } catch (err) {
          const { message } = handleAuthError(err);

          try {
            await auditService.logEmailVerificationByEmail(
              verificationEmail || 'unknown-email',
              'failure',
              'email-link',
              1,
              undefined,
              getUserAgent(),
              [message]
            );
          } catch (auditError) {
            console.error('Failed to log unauthenticated email verification failure:', auditError);
          }

          if (!isMounted) {
            return;
          }

          setError(message);
          setState('error');
        }

        return;
      }

      if (mode === 'recoverEmail') {
        if (!isMounted) {
          return;
        }

        setState('unsupported');
        setError('Email change recovery is not supported for Striae accounts.');
        return;
      }

      if (!isMounted) {
        return;
      }

      setError('Unsupported email action.');
      setState('error');
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [mode, oobCode]);

  const handlePasswordResetSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!oobCode) {
      setError('Invalid password reset code.');
      setState('error');
      return;
    }

    const policy = evaluatePasswordPolicy(newPassword, confirmPassword);
    setPasswordFeedback(getPolicyFeedback(newPassword, confirmPassword));

    if (!policy.isStrong) {
      setError('Password does not meet requirements.');
      return;
    }

    setError('');
    setIsSubmittingReset(true);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);

      await auditService.logPasswordReset(
        resolvedEmail || 'unknown-email',
        'email',
        'success',
        undefined,
        'email-link',
        1,
        true,
        undefined,
        undefined,
        []
      );

      setSuccess('Password updated successfully. You can now log in with your new password.');
      setState('success');
    } catch (err) {
      const { message } = handleAuthError(err);
      setError(message);
      const errorCode = err && typeof err === 'object' && 'code' in err
        ? String(err.code)
        : '';

      try {
        await auditService.logPasswordReset(
          resolvedEmail || 'unknown-email',
          'email',
          'failure',
          undefined,
          'email-link',
          1,
          true,
          undefined,
          undefined,
          [message]
        );
      } catch (auditError) {
        console.error('Failed to log password reset completion failure:', auditError);
      }

      if (errorCode === 'auth/invalid-action-code' || errorCode === 'auth/expired-action-code') {
        setState('error');
      } else {
        setState('ready-reset');
      }
    } finally {
      setIsSubmittingReset(false);
    }
  };

  const title = mode === 'resetPassword'
    ? 'Reset Password'
    : mode === 'verifyEmail'
      ? 'Verify Email Address'
      : 'Email Action';

  const resolveLoginTarget = () => {
    const configuredBaseUrl = paths.url?.trim().length ? paths.url : 'https://localhost';
    const fallbackOrigin = new URL(configuredBaseUrl).origin;
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : fallbackOrigin;

    try {
      const actionCodeDestination = getAllowedContinueDestinationFromActionCode(continueUrl);
      const preferredDestination = safeContinueDestination.isDefault && actionCodeDestination
        ? actionCodeDestination
        : safeContinueDestination;
      const destinationUrl = new URL(preferredDestination.url, currentOrigin);
      const loginUrl = `${destinationUrl.origin}/`;

      return {
        url: loginUrl,
        isCrossOrigin: destinationUrl.origin !== currentOrigin,
      };
    } catch {
      return {
        url: `${currentOrigin}/`,
        isCrossOrigin: false,
      };
    }
  };

  const handleContinue = () => {
    if (safeContinueDestination.isCrossOrigin && typeof window !== 'undefined') {
      window.location.assign(safeContinueDestination.url);
      return;
    }

    navigate(safeContinueDestination.path);
  };

  const handleLogin = () => {
    const loginTarget = resolveLoginTarget();

    if (loginTarget.isCrossOrigin && typeof window !== 'undefined') {
      window.location.assign(loginTarget.url);
      return;
    }

    navigate('/');
  };

  const loginTarget = resolveLoginTarget();
  const logoLoginHref = loginTarget.url;

  const showContinueButton = state === 'success' && !safeContinueDestination.isDefault;
  const showLanguageHint = !!lang && lang.toLowerCase() !== 'en';

  return (
    <div className={styles.container}>
      <Link
        viewTransition
        prefetch="intent"
        to={logoLoginHref}
        className={styles.logoLink}
      >
        <div className={styles.logo} />
      </Link>

      <div className={styles.formWrapper}>
        <h1 className={styles.title}>{title}</h1>

        {resolvedEmail && (
          <p className={styles.description}>Account: {resolvedEmail}</p>
        )}

        {showLanguageHint && (
          <p className={styles.hint}>This page is currently shown in English.</p>
        )}

        {state === 'loading' && (
          <p className={styles.description}>Validating email action link...</p>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}

        {state === 'ready-reset' && (
          <form className={styles.form} onSubmit={handlePasswordResetSubmit}>
            <div className={styles.passwordField}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                name="newPassword"
                placeholder="New Password"
                autoComplete="new-password"
                className={styles.input}
                required
                value={newPassword}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setNewPassword(nextValue);
                  setPasswordFeedback(getPolicyFeedback(nextValue, confirmPassword));
                }}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                <Icon icon={showNewPassword ? 'eye-off' : 'eye'} />
              </button>
            </div>
            <div className={styles.passwordField}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="Confirm New Password"
                autoComplete="new-password"
                className={styles.input}
                required
                value={confirmPassword}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setConfirmPassword(nextValue);
                  setPasswordFeedback(getPolicyFeedback(newPassword, nextValue));
                }}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                <Icon icon={showConfirmPassword ? 'eye-off' : 'eye'} />
              </button>
            </div>
            {passwordFeedback && (
              <div className={styles.passwordFeedback}>
                <pre>{passwordFeedback}</pre>
              </div>
            )}
            <button
              type="submit"
              className={styles.button}
              disabled={isSubmittingReset}
            >
              {isSubmittingReset ? 'Updating...' : 'Update Password'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleLogin}
            >
              Back to Login
            </button>
          </form>
        )}

        {(state === 'success' || state === 'error' || state === 'unsupported') && (
          <div className={styles.actions}>
            {showContinueButton && (
              <button
                type="button"
                className={styles.button}
                onClick={handleContinue}
              >
                Continue
              </button>
            )}
            <button
              type="button"
              className={styles.loginToStriaeButton}
              onClick={handleLogin}
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
