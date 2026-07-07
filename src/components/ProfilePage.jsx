import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const AVATARS = [
  { emoji: '\u{1F9D1}', label: 'Person' },
  { emoji: '\u{1F468}', label: 'Man' },
  { emoji: '\u{1F469}', label: 'Woman' },
  { emoji: '\u{1F9D4}', label: 'Beard' },
  { emoji: '\u{1F9D2}', label: 'Child' },
  { emoji: '\u{1F47D}', label: 'Alien' },
  { emoji: '\u{1F916}', label: 'Robot' },
  { emoji: '\u{1F431}', label: 'Cat' },
  { emoji: '\u{1F436}', label: 'Dog' },
  { emoji: '\u{1F98A}', label: 'Fox' },
  { emoji: '\u{1F42F}', label: 'Tiger' },
  { emoji: '\u{1F434}', label: 'Horse' },
  { emoji: '\u{1F985}', label: 'Eagle' },
  { emoji: '\u{1F419}', label: 'Octopus' },
  { emoji: '\u{1F33F}', label: 'Flower' },
  { emoji: '\u{1F4A5}', label: 'Boom' },
  { emoji: '\u{2600}', label: 'Sun' },
  { emoji: '\u{1F319}', label: 'Moon' },
  { emoji: '\u{2B50}', label: 'Star' },
  { emoji: '\u{1F680}', label: 'Rocket' },
];

export default function ProfilePage({ onClose }) {
  const { user, profile, updateProfile, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [avatar, setAvatar] = useState(profile?.avatar || '\u{1F9D1}');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const tabRefs = useRef({});

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await updateProfile({ display_name: displayName, avatar });
      setMessage('Profile saved!');
    } catch (err) {
      setMessage('Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onClose?.();
  };

  if (!user) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal profile-modal">
        <button className="modal-close-btn" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <h3>Profile</h3>
        <p>Manage your FlashShare profile</p>

        <div className="profile-section">
          <div className="avatar-section">
            <button className="avatar-preview" onClick={() => setShowAvatarPicker(!showAvatarPicker)} title="Change avatar">
              <span className="avatar-emoji">{avatar}</span>
            </button>
            <span className="avatar-hint">Tap to change</span>
          </div>

          {showAvatarPicker && (
            <div className="avatar-grid">
              {AVATARS.map((a) => (
                <button
                  key={a.emoji}
                  className={`avatar-option${avatar === a.emoji ? ' selected' : ''}`}
                  onClick={() => { setAvatar(a.emoji); setShowAvatarPicker(false); }}
                  title={a.label}
                >
                  {a.emoji}
                </button>
              ))}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="profile-name">Display Name</label>
            <input id="profile-name" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" />
          </div>

          <div className="form-group">
            <label>Email</label>
            <div className="profile-email">{user.email}</div>
          </div>

          {message && <div className={`form-message ${message === 'Profile saved!' ? 'success' : ''}`}>{message}</div>}

          <button onClick={handleSave} className="btn primary" disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>

          <div className="profile-actions">
            <button onClick={handleSignOut} className="btn small danger" style={{ width: '100%' }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
