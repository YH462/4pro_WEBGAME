import { useId } from "react";

/** Small vector illustrations keep the guide crisp at every phone size. */
export function GuideArt({ kind }: { kind: "collect" | "grow" | "battle" }) {
  const id = useId().replace(/:/g, "");
  const red = `${id}-red`, white = `${id}-white`, side = `${id}-side`, shadow = `${id}-shadow`;
  return <svg viewBox="0 0 150 130" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={red} x1="36" y1="20" x2="102" y2="102" gradientUnits="userSpaceOnUse"><stop stopColor="#ff788d"/><stop offset=".35" stopColor="#fa2047"/><stop offset="1" stopColor="#b00028"/></linearGradient>
      <linearGradient id={white} x1="52" y1="44" x2="103" y2="118" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset=".6" stopColor="#f1f0f4"/><stop offset="1" stopColor="#b7b8c3"/></linearGradient>
      <linearGradient id={side} x1="20" y1="109" x2="133" y2="109" gradientUnits="userSpaceOnUse"><stop stopColor="#b5b5bf"/><stop offset=".35" stopColor="#faf9fc"/><stop offset=".8" stopColor="#747783"/><stop offset="1" stopColor="#444651"/></linearGradient>
      <filter id={shadow} x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#37303f" floodOpacity=".25"/></filter>
    </defs>
    <g filter={`url(#${shadow})`}>
      <path d="M20 99 74 80 131 99v11L77 128l-57-18Z" fill={`url(#${side})`}/>
      <path d="m20 99 54-20 57 20-54 20Z" fill={`url(#${white})`} stroke="#fff" strokeWidth="1.5"/>
    </g>
    {kind === "collect" ? <>
      <path d="M40 27v-9q0-5 5-5h12m36 0h12q5 0 5 5v9" stroke={`url(#${red})`} strokeWidth="6" strokeLinecap="round"/>
      <g fill={`url(#${white})`} stroke="#aeb0ba" strokeWidth=".6"><circle cx="43" cy="55" r="9"/><path d="M32 75q0-10 11-10t11 10v21l-22-2Z"/><circle cx="108" cy="55" r="9"/><path d="M97 75q0-10 11-10t11 10v19l-22 2Z"/></g>
      <g fill={`url(#${red})`} stroke="#ff7285" strokeWidth=".8" filter={`url(#${shadow})`}><circle cx="75" cy="43" r="13"/><path d="M57 75q0-17 18-17t18 17v27q-18 6-36 0Z"/></g>
      <path d="M63 70q2-7 9-8" stroke="#ffb6c0" strokeWidth="2" strokeLinecap="round"/>
    </> : kind === "grow" ? <>
      <ellipse cx="75" cy="97" rx="17" ry="7" fill="#d7d5db"/><ellipse cx="75" cy="95" rx="13" ry="5" fill="#fff"/>
      <path d="M74 94V66q0-17-11-24m12 35q0-22 18-35" stroke="#b8002d" strokeWidth="5" strokeLinecap="round"/>
      <path d="M67 66Q35 61 36 32q33 0 31 34Zm14-3Q78 28 111 20q3 35-30 43Z" fill={`url(#${red})`} stroke="#ff617e"/>
      <path d="M40 36 65 61m18-3 23-31" stroke="#ffb7c5" strokeWidth="1.6"/>
      <path d="m107 85 12-15 12 15h-8v20h-9V85Z" fill={`url(#${red})`} stroke="#ff7b91"/>
    </> : <g filter={`url(#${shadow})`}>
      <g transform="rotate(-44 75 65)"><path d="m70 15 5-8 5 8v73H70Z" fill={`url(#${white})`} stroke="#b6b8c3"/><path d="M75 9v77" stroke="#fff" strokeWidth="2"/><path d="M58 85h34v7H58Z" fill={`url(#${red})`}/><path d="M70 92h10v22H70Z" fill={`url(#${red})`}/><circle cx="75" cy="116" r="7" fill={`url(#${red})`}/></g>
      <g transform="rotate(44 75 65)"><path d="m69 15 6-8 6 8v73H69Z" fill={`url(#${red})`} stroke="#ff768c"/><path d="M74 12v72" stroke="#ffb2c1" strokeWidth="2"/><path d="M57 85h36v7H57Z" fill={`url(#${red})`}/><path d="M70 92h10v22H70Z" fill={`url(#${red})`}/><circle cx="75" cy="116" r="7" fill={`url(#${red})`}/></g>
    </g>}
  </svg>;
}
