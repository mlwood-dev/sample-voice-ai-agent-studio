import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { isFederateEnabled, loginWithMidway } from '../config/auth';
import styles from '../studio/studio.module.css';

function Login() {
  const { login, completeNewPassword, requiresNewPassword, error, isLoading } =
    useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      // error is set in context
    }
    setSubmitting(false);
  };

  const handleNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      await completeNewPassword(newPassword);
    } catch {
      // error is set in context
    }
    setSubmitting(false);
  };

  const brand = (
    <div className={styles.loginBrand}>
      <img src="/favicon.svg" alt="" width={36} height={36} />
      <div>
        <div className={styles.brandName} style={{ fontSize: 16 }}>Everwood Technologies</div>
        <div className={styles.brandSub}>x AWS-Sample</div>
      </div>
    </div>
  );

  if (requiresNewPassword) {
    return (
      <div className={styles.loginShell}>
        <div className={styles.loginCard}>
          {brand}
          <h1 className={styles.title}>Set a new password</h1>
          <p className={styles.subtitle}>Your temporary password needs to be changed before you can continue.</p>
          {(error || localError) && <p className={styles.error}>{localError || error}</p>}
          <form onSubmit={handleNewPassword}>
            <label className={styles.fieldLabel} htmlFor="newPassword">New password</label>
            <input id="newPassword" className={styles.input} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            <label className={styles.fieldLabel} htmlFor="confirmPassword" style={{ marginTop: 12 }}>Confirm password</label>
            <input id="confirmPassword" className={styles.input} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`} style={{ marginTop: 16 }} disabled={submitting}>
              {submitting ? 'Setting password…' : 'Set password and continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginShell}>
      <div className={styles.loginCard}>
        {brand}
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Sign in to configure and test voice agents.</p>
        {(error || localError) && <p className={styles.error}>{localError || error}</p>}
        <form onSubmit={handleLogin}>
          <label className={styles.fieldLabel} htmlFor="email">Username or email</label>
          <input id="email" className={styles.input} type="text" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          <label className={styles.fieldLabel} htmlFor="password" style={{ marginTop: 12 }}>Password</label>
          <input id="password" className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`} style={{ marginTop: 16 }} disabled={submitting || isLoading}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {isFederateEnabled && (
          <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnBlock}`} style={{ marginTop: 8 }} onClick={() => loginWithMidway()}>
            Sign in with SSO
          </button>
        )}
        <p className={styles.hintDark}>Need access? Contact <a href="mailto:mike@everwood.tech" style={{ color: 'var(--brand-ink)', fontWeight: 600 }}>mike@everwood.tech</a></p>
        <p className={styles.hintDark}>Based on an AWS Sample · Amazon Bedrock</p>
      </div>
    </div>
  );
}

export default Login;
