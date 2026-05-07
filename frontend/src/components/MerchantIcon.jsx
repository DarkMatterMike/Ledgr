/**
 * components/MerchantIcon.jsx
 * Merchant logo via Google favicon service with initials fallback.
 */
import { useState } from 'react';
import PropTypes from 'prop-types';

function MerchantIcon({ name, size = 24 }) {
  const [err, setErr] = useState(false);
  if (!name || err) return (
    <span style={{width:size,height:size,flexShrink:0,display:"flex",alignItems:"center",
      justifyContent:"center",fontSize:Math.round(size*0.5),color:"var(--t3)"}}>💳</span>
  );
  const domain = name.toLowerCase().replace(/[^a-z0-9\s]/g,"").replace(/\s+/g,"").slice(0,30)+".com";
  return (
    <div style={{width:size,height:size,flexShrink:0,overflow:"hidden",
      display:"flex",alignItems:"center",justifyContent:"center"}}>
      <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${size*2}`}
        alt="" width={size} height={size}
        onError={()=>setErr(true)} style={{objectFit:"contain"}}/>
    </div>
  );
}

MerchantIcon.propTypes = {
  name: PropTypes.string,
  size: PropTypes.number,
};

export default MerchantIcon;
