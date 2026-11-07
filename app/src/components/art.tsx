// Original SVG illustrations for Stakehold (no third-party art).

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="lg-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--flame)" />
          <stop offset="1" stopColor="var(--gold)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="11" fill="var(--ink)" />
      <path
        className="flicker"
        d="M20 8c1.2 4.2 6.8 6.6 6.8 13.2A6.8 6.8 0 0 1 20 28a6.8 6.8 0 0 1-6.8-6.8c0-2.9 1.4-4.5 2.9-5.9.3 1.9 1.2 3.1 2.5 3.6-.5-4 .4-7.9 1.4-10.9Z"
        fill="url(#lg-flame)"
      />
      <rect x="11" y="30" width="18" height="3" rx="1.5" fill="var(--gold)" />
    </svg>
  );
}

export function Flame({ className, size = 18, dim = false }: { className?: string; size?: number; dim?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        className={dim ? undefined : "flicker"}
        d="M12 2c1 3.6 6 5.6 6 11.2A6 6 0 0 1 12 19a6 6 0 0 1-6-5.8c0-2.5 1.2-3.9 2.5-5.1.3 1.6 1 2.7 2.2 3.1-.4-3.4.3-6.8 1.3-9.2Z"
        fill={dim ? "var(--muted)" : "var(--flame)"}
        opacity={dim ? 0.35 : 1}
      />
      {!dim && <path d="M12 11c.6 1.9 3 2.8 3 5.2a3 3 0 0 1-6 0c0-1.2.6-1.9 1.2-2.4.2.8.6 1.2 1 1.4-.2-1.6.3-3.1.8-4.2Z" fill="var(--gold)" />}
    </svg>
  );
}

/** Hero: a pot of coins guarded by flames, with check-in cards orbiting. */
export function HeroArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 360" className={className} aria-hidden>
      <defs>
        <linearGradient id="h-pot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--surface)" />
          <stop offset="1" stopColor="var(--surface-2)" />
        </linearGradient>
        <linearGradient id="h-coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--gold)" />
          <stop offset="1" stopColor="var(--flame-2)" />
        </linearGradient>
        <linearGradient id="h-fl" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--flame)" />
          <stop offset="1" stopColor="var(--gold)" />
        </linearGradient>
        <filter id="h-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>
      <ellipse cx="210" cy="300" rx="150" ry="22" fill="var(--flame)" opacity="0.12" filter="url(#h-soft)" />
      {/* coin stack */}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(0 ${-i * 16})`}>
          <ellipse cx="210" cy="270" rx="70" ry="18" fill="color-mix(in oklab, var(--gold) 70%, black)" />
          <rect x="140" y="258" width="140" height="12" fill="color-mix(in oklab, var(--gold) 70%, black)" />
          <ellipse cx="210" cy="258" rx="70" ry="18" fill="url(#h-coin)" />
          <ellipse cx="210" cy="258" rx="46" ry="10" fill="none" stroke="var(--surface)" strokeOpacity="0.45" strokeWidth="2" />
        </g>
      ))}
      {/* big flame */}
      <g className="flicker" style={{ transformOrigin: "210px 200px" }}>
        <path d="M210 70c8 28 46 44 46 90a46 46 0 0 1-92 0c0-20 9-31 19-40 2 13 8 21 17 25-3-27 2-53 10-75Z" fill="url(#h-fl)" />
        <path d="M210 128c4 14 22 21 22 39a22 22 0 0 1-44 0c0-9 4-15 9-19 1 6 4 9 8 11-1-12 1-23 5-31Z" fill="var(--gold)" opacity="0.9" />
      </g>
      {/* survivor card */}
      <g transform="translate(18 70) rotate(-8)">
        <rect width="128" height="74" rx="16" fill="url(#h-pot)" stroke="var(--line)" />
        <circle cx="26" cy="26" r="11" fill="var(--alive)" opacity="0.18" />
        <path d="m21 26 4 4 7-8" stroke="var(--alive)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="44" y="18" width="62" height="7" rx="3.5" fill="var(--ink)" opacity="0.8" />
        <rect x="44" y="30" width="40" height="6" rx="3" fill="var(--muted)" opacity="0.5" />
        <rect x="16" y="50" width="96" height="8" rx="4" fill="var(--alive)" opacity="0.25" />
        <rect x="16" y="50" width="70" height="8" rx="4" fill="var(--alive)" />
      </g>
      {/* eliminated card */}
      <g transform="translate(290 40) rotate(7)">
        <rect width="118" height="70" rx="16" fill="url(#h-pot)" stroke="var(--line)" />
        <circle cx="25" cy="25" r="11" fill="var(--out)" opacity="0.18" />
        <path d="m20 20 10 10m0-10-10 10" stroke="var(--out)" strokeWidth="3" strokeLinecap="round" />
        <rect x="42" y="17" width="56" height="7" rx="3.5" fill="var(--ink)" opacity="0.35" />
        <rect x="42" y="29" width="36" height="6" rx="3" fill="var(--muted)" opacity="0.4" />
        <text x="16" y="56" fontSize="11" fontWeight="700" fill="var(--out)" fontFamily="var(--font-body)">OUT · DAY 2</text>
      </g>
      {/* pose card */}
      <g transform="translate(300 190) rotate(-5)">
        <rect width="104" height="92" rx="18" fill="var(--ink)" />
        <text x="12" y="24" fontSize="9" fontWeight="700" fill="var(--flame)" fontFamily="var(--font-body)" letterSpacing="1">TODAY&apos;S POSE</text>
        <text x="14" y="62" fontSize="30" fontFamily="var(--font-body)">✋👈</text>
        <text x="14" y="80" fontSize="10" fill="var(--bg)" opacity="0.7" fontFamily="var(--font-body)">5 fingers · left</text>
      </g>
      {/* slot hash chip */}
      <g transform="translate(26 210)">
        <rect width="136" height="42" rx="21" fill="var(--surface)" stroke="var(--line)" />
        <circle cx="21" cy="21" r="9" fill="var(--violet)" opacity="0.2" />
        <rect x="16" y="16" width="10" height="10" rx="2" fill="var(--violet)" />
        <text x="38" y="25" fontSize="11" fontFamily="var(--font-code)" fill="var(--muted)">slot 4f2a…9c1e</text>
      </g>
    </svg>
  );
}

/** Coming-soon art: arena with two players and a shared pot. */
export function StakeArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} aria-hidden>
      <defs>
        <linearGradient id="s-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--violet)" />
          <stop offset="1" stopColor="var(--flame)" />
        </linearGradient>
      </defs>
      <ellipse cx="200" cy="250" rx="170" ry="28" fill="var(--violet)" opacity="0.12" />
      <rect x="40" y="60" width="120" height="150" rx="24" fill="var(--surface)" stroke="var(--line)" />
      <rect x="240" y="60" width="120" height="150" rx="24" fill="var(--surface)" stroke="var(--line)" />
      <circle cx="100" cy="110" r="26" fill="var(--violet)" opacity="0.2" />
      <circle cx="300" cy="110" r="26" fill="var(--flame)" opacity="0.2" />
      <text x="88" y="120" fontSize="26">🧠</text>
      <text x="288" y="120" fontSize="26">⚡</text>
      <rect x="62" y="152" width="76" height="10" rx="5" fill="var(--violet)" />
      <rect x="62" y="170" width="50" height="8" rx="4" fill="var(--muted)" opacity="0.4" />
      <rect x="262" y="152" width="60" height="10" rx="5" fill="var(--flame)" />
      <rect x="262" y="170" width="70" height="8" rx="4" fill="var(--muted)" opacity="0.4" />
      <circle cx="200" cy="135" r="34" fill="url(#s-g)" />
      <text x="200" y="146" fontSize="28" textAnchor="middle" fontWeight="800" fill="white" fontFamily="var(--font-display)">VS</text>
      <g transform="translate(150 215)">
        <ellipse cx="50" cy="20" rx="46" ry="12" fill="var(--gold)" />
        <ellipse cx="50" cy="12" rx="46" ry="12" fill="color-mix(in oklab, var(--gold) 80%, white)" />
      </g>
    </svg>
  );
}

/** Coming-soon art: a sponsor dropping a pot onto a group of runners. */
export function SponsorArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} aria-hidden>
      <defs>
        <linearGradient id="sp-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--gold)" />
          <stop offset="1" stopColor="var(--flame)" />
        </linearGradient>
      </defs>
      <ellipse cx="200" cy="262" rx="160" ry="22" fill="var(--gold)" opacity="0.14" />
      <g className="flicker" style={{ transformOrigin: "200px 90px" }}>
        <path d="M150 52h100l-14 70a36 36 0 0 1-72 0Z" fill="url(#sp-g)" />
        <rect x="140" y="40" width="120" height="16" rx="8" fill="var(--ink)" />
        <text x="200" y="104" fontSize="26" textAnchor="middle" fontWeight="800" fill="white" fontFamily="var(--font-display)">◎</text>
      </g>
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${185 + i * 15} 150 l0 ${28 + i * 6}`} stroke="var(--gold)" strokeWidth="4" strokeLinecap="round" strokeDasharray="4 8" opacity="0.8" />
      ))}
      {[70, 140, 210, 280].map((x, i) => (
        <g key={x} transform={`translate(${x} 200)`}>
          <circle cx="25" cy="10" r="12" fill={["var(--violet)", "var(--alive)", "var(--flame)", "var(--violet)"][i]} opacity="0.85" />
          <rect x="10" y="26" width="30" height="34" rx="12" fill={["var(--violet)", "var(--alive)", "var(--flame)", "var(--violet)"][i]} opacity="0.35" />
          <circle cx="25" cy="70" r="9" fill="var(--alive)" opacity="0.2" />
          <path d="m20 70 3.5 3.5 6-7" stroke="var(--alive)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

/** Empty-state art */
export function EmptyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <ellipse cx="80" cy="104" rx="56" ry="8" fill="var(--muted)" opacity="0.15" />
      <path d="M80 18c4 14 22 22 22 44a22 22 0 0 1-44 0c0-10 4-15 9-20 1 7 4 10 8 12-1-13 1-26 5-36Z" fill="var(--muted)" opacity="0.25" />
      <path d="M80 50c2 7 10 10 10 19a10 10 0 0 1-20 0c0-4 2-7 4-9 0 3 2 5 4 6-1-6 0-11 2-16Z" fill="var(--flame)" />
    </svg>
  );
}
