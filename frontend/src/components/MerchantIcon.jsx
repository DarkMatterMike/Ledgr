/**
 * components/MerchantIcon.jsx
 * Merchant logo with three-tier fallback:
 *   1. Plaid logo_url (accurate, hosted by Plaid)
 *   2. Google faviconV2 (guessed from merchant name)
 *   3. Initials avatar (always works)
 */
import { useState } from 'react';
import PropTypes from 'prop-types';

function getInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function getColor(name = '') {
  // Deterministic pastel color from name so it's stable across renders
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 40%, 55%)`;
}

function MerchantIcon({ name, logoUrl, size = 24 }) {
  const [plaidErr, setPlaidErr]   = useState(false);
  const [faviconErr, setFaviconErr] = useState(false);

  const initials = getInitials(name);
  const color    = getColor(name || '');

  const initialsAvatar = (
    <span style={{
      width: size, height: size, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.42), fontWeight: 700,
      color: '#fff', backgroundColor: color,
      borderRadius: '50%', userSelect: 'none',
      lineHeight: 1,
    }}>
      {initials}
    </span>
  );

  // Tier 1: Plaid logo_url
  if (logoUrl && !plaidErr) {
    return (
      <div style={{ width: size, height: size, flexShrink: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          onError={() => setPlaidErr(true)}
          style={{ objectFit: 'contain', borderRadius: 4 }}
        />
      </div>
    );
  }

  // Tier 2: Google faviconV2 (silent 404 — returns blank pixel instead of erroring)
  if (name && !faviconErr) {
    const cleaned = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '').slice(0, 30);
    const domain  = cleaned + '.com';
    const faviconUrl = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=${size * 2}`;
    return (
      <div style={{ width: size, height: size, flexShrink: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={faviconUrl}
          alt=""
          width={size}
          height={size}
          onError={() => setFaviconErr(true)}
          style={{ objectFit: 'contain' }}
        />
      </div>
    );
  }

  // Tier 3: Initials avatar
  return initialsAvatar;
}

MerchantIcon.propTypes = {
  name:    PropTypes.string,
  logoUrl: PropTypes.string,
  size:    PropTypes.number,
};

export default MerchantIcon;
