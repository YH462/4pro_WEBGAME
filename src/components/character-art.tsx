type Props = { element: string; className?: string; muted?: boolean };
// Original SVG illustrations; no network assets or font downloads are required.
export function CharacterArt({ element, className = "", muted = false }: Props) {
  const colors: Record<string, string[]> = { FOREST: ["#9ad3a5", "#355b4a", "#d8f6ad"], THUNDER: ["#ffd475", "#d68a33", "#fff6cb"], FLAME: ["#ff9e7d", "#b64c51", "#ffe0b5"], AQUA: ["#9bdce9", "#398dad", "#d9fbfc"], LEGEND: ["#d8c3ff", "#8266bf", "#fff1b5"] };
  const [light, dark, eye] = colors[element] || colors.LEGEND;
  return <svg viewBox="0 0 240 200" aria-hidden="true" className={`${className} ${muted ? "art-muted" : ""}`}>
    <ellipse cx="120" cy="177" rx="65" ry="9" fill="currentColor" opacity=".10" />
    <circle cx="120" cy="99" r="76" fill={light} opacity=".12" />
    <circle cx="120" cy="99" r="65" fill="none" stroke={light} opacity=".28" strokeDasharray="3 8" />
    {element === "FOREST" ? <g stroke={dark} strokeWidth="3" strokeLinejoin="round">
      <path d="M74 91 51 108 44 145 66 152 85 127M164 91 189 108 196 145 174 152 155 127" fill={dark}/>
      <path d="M86 132 81 170 106 172 116 136M125 136 134 172 160 170 153 130" fill={dark}/>
      <path d="M80 92 100 79 145 80 166 94 154 140 88 140Z" fill={light}/>
      <path d="M88 57 106 44 144 50 154 79 137 99 104 96 85 80Z" fill={light}/>
      <path d="M96 52 98 31 116 43 139 30 142 53" fill={dark}/>
      <path d="M106 108 120 99 134 108 120 127Z" fill={eye} stroke="none"/>
      <path d="M101 72h10m18 0h10" stroke={eye} strokeWidth="6"/>
      <path d="m62 120 10 7m95-8 11 7" stroke={light}/>
    </g> : element === "THUNDER" ? <g stroke={dark} strokeWidth="3" strokeLinejoin="round">
      <path d="M146 134q69-8 49-69l-22 27-17-5 10 22-28 2Z" fill={light}/>
      <path d="M93 111 89 158 107 170 138 168 155 145 143 110Z" fill={light}/>
      <path d="M90 83 81 38 113 59 138 59 164 36 158 87 126 113Z" fill={light}/>
      <path d="m90 84 36 29 28-29-27 8Z" fill={eye} stroke="none"/>
      <path d="m94 51 6 24 10-11m31 1 12-12-4 24" fill={dark}/>
      <path d="m102 84 9 3m29-3-9 3" stroke={dark} strokeWidth="5"/>
      <path d="m119 96 7 5 7-5" fill={dark}/>
      <path d="m106 131 18 13-6 13 15-9-17-15" fill={eye} stroke="none"/>
    </g> : element === "FLAME" ? <g stroke={dark} strokeWidth="3" strokeLinejoin="round">
      <path d="M99 100 54 55 40 116 80 100 87 135M143 100 186 55 204 116 165 99 153 133" fill={dark}/>
      <path d="m54 67 27 30-30 9m133-39-25 30 32 9" fill={light}/>
      <path d="M98 92 82 142 93 168 147 168 159 143 143 92" fill={light}/>
      <path d="M100 114 110 161 134 161 143 114" fill={eye} stroke="none"/>
      <path d="M94 56 94 36 112 51 134 50 151 34 150 66 157 86 140 104 104 102 87 83Z" fill={light}/>
      <path d="m102 75 11 4m26-4-10 4" stroke={eye} strokeWidth="6"/>
      <path d="M162 137q37-5 25-27m1-1-5-17 13 7 1 15Z" fill={eye}/>
    </g> : element === "AQUA" ? <g stroke={dark} strokeWidth="3" strokeLinejoin="round">
      <path d="M120 28q-45 49-43 84c-30 6-32 21-17 26l25-7c-5 28 13 42 35 42s43-13 34-43l24 9c19-5 11-22-15-26q2-38-43-85Z" fill={light}/>
      <path d="M120 48q-23 29-27 48" fill="none" stroke={eye} strokeWidth="8" strokeLinecap="round"/>
      <path d="M98 112h10m24 0h10" stroke={dark} strokeWidth="6" strokeLinecap="round"/>
      <path d="M113 125q7 7 14 0" fill="none" strokeLinecap="round"/>
      <path d="M101 148q20 9 39-1" fill="none" stroke={eye} strokeWidth="6"/>
      <circle cx="59" cy="82" r="9" fill={light}/><circle cx="181" cy="65" r="6" fill={light}/>
    </g> : <g stroke={dark} strokeWidth="3" strokeLinejoin="round">
      <path d="M82 95 63 132 82 142 93 120m64-25 21 37-20 10-11-22" fill={dark}/>
      <path d="M93 95 84 154 105 173 120 160 137 173 158 154 146 95Z" fill={light}/>
      <path d="M88 64 94 92 119 108 148 92 154 64 136 45 106 45Z" fill={light}/>
      <path d="m94 50-9-20 23 10 12-18 13 18 23-11-11 22Z" fill={eye}/>
      <path d="M102 75h10m17 0h10" stroke={eye} strokeWidth="6"/>
      <path d="m120 112 17 18-17 20-17-20Z" fill={eye}/>
      <path d="m120 119v22m-7-11h14" stroke={dark}/>
      <path d="m66 64 3-10 4 10 10 3-10 4-4 10-3-10-10-4ZM174 76l3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" fill={eye} stroke="none"/>
    </g>}
  </svg>;
}
