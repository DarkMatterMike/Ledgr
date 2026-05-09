/**
 * components/MerchantIcon.jsx
 * Merchant logo with two-tier fallback:
 *   1. Plaid logo_url (accurate, hosted by Plaid)
 *   2. Initials avatar (always works, no network request)
 *
 * Google favicon services are omitted — they 404 loudly on
 * non-real domains constructed from transaction name strings.
 */
import PropTypes from 'prop-types';
import { useState } from 'react';

function getInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function getColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 40%, 55%)`;
}

function MerchantIcon({ name, logoUrl, size = 24 }) {
  const [logoErr, setLogoErr] = useState(false);

  const initials = getInitials(name);
  const color    = getColor(name || '');

  const initialsAvatar = (
    <span style={{
      width: size, height: size, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.42), fontWeight: 700,
      color: '#fff', backgroundColor: color,
      borderRadius: '50%', userSelect: 'none', lineHeight: 1,
    }}>
      {initials}
    </span>
  );

  if (logoUrl && !logoErr) {
    return (
      <div style={{ width: size, height: size, flexShrink: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          onError={() => setLogoErr(true)}
          style={{ objectFit: 'contain', borderRadius: 4 }}
        />
      </div>
    );
  }

  return initialsAvatar;
}

MerchantIcon.propTypes = {
  name:    PropTypes.string,
  logoUrl: PropTypes.string,
  size:    PropTypes.number,
};

export default MerchantIcon;
