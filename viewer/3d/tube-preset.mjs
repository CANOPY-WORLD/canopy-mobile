// Presentation-only source; no timetable or live passenger simulation is implied.
export const TUBE_PRESETS = Object.freeze({
  imperial_corridor_8km: {
    id: 'londonTube', label: 'London Tube', after: 'interior',
    source: 'https://raw.githubusercontent.com/SRST-by722/london-tube-walk-preview/45845adb854f2e14a19a4150b5266cf07cf75a92/scene_data.js',
    sha256: '01697290c7b3018b4a7a48b1394294e491a288bd758f493d3926147192462db6',
    line: 'piccadilly', defaultView: 'network',
    stations: [
      {id:'940GZZLUECT',label:"Earl's Court"},
      {id:'940GZZLUGTR',label:'Gloucester Road'},
      {id:'940GZZLUSKS',label:'South Kensington'},
      {id:'940GZZLUKNB',label:'Knightsbridge'},
    ],
    attribution: 'https://srst-by722.github.io/london-tube-walk-preview/sources.html',
  },
});
