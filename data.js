/* data.js — base spots + mapping caméra (SOURCE UNIQUE)
   - slug unique partout (spot.html, camera.html, favoris, carte)
   - cameraUrl optionnel
   - fallback caméra = recherche Google viewsurf + nom du spot
*/

window.OCEANLY = window.OCEANLY || {};

window.OCEANLY.SPOTS = [
  // Gironde
  { slug:"lacanau-ocean",        name:"Lacanau Océan",                 lat:44.994, lon:-1.210, region:"Gironde",     cameraUrl:"https://m.viewsurf.com/univers/surf/vue/7168-france-nouvelle-aquitaine-gironde-lacanau-panorama-lacanau" },
  { slug:"le-porge-ocean",       name:"Le Porge (Océan)",              lat:44.889, lon:-1.253, region:"Gironde",     cameraUrl:null },
  { slug:"carcans-plage",        name:"Carcans Plage",                 lat:45.080, lon:-1.220, region:"Gironde",     cameraUrl:null },

  // Landes
  { slug:"biscarrosse",          name:"Biscarrosse Plage",             lat:44.441, lon:-1.252, region:"Landes",      cameraUrl:null },
  { slug:"mimizan",              name:"Mimizan Plage",                 lat:44.213, lon:-1.295, region:"Landes",      cameraUrl:null },
  { slug:"seignosse-estagnots",  name:"Seignosse (Les Estagnots)",     lat:43.703, lon:-1.448, region:"Landes",      cameraUrl:null },
  { slug:"hossegor-graviere",    name:"Hossegor (La Gravière)",        lat:43.674, lon:-1.444, region:"Landes",      cameraUrl:null },
  { slug:"capbreton-santocha",   name:"Capbreton (Santocha)",          lat:43.648, lon:-1.433, region:"Landes",      cameraUrl:null },

  // Pays Basque
  { slug:"anglet-cavaliers",     name:"Anglet (Les Cavaliers)",        lat:43.514, lon:-1.542, region:"Pays Basque", cameraUrl:null },
  { slug:"biarritz",             name:"Biarritz (Côte des Basques)",   lat:43.478, lon:-1.571, region:"Pays Basque", cameraUrl:null },

  // Bretagne
  { slug:"la-torche",            name:"La Torche",                     lat:47.837, lon:-4.359, region:"Bretagne",    cameraUrl:null },
  { slug:"penhors",              name:"Penhors",                       lat:47.930, lon:-4.392, region:"Bretagne",    cameraUrl:"https://viewsurf.com/univers/surf/vue/3807-france-bretagne-finistere-penmarch-pors-carn-penhors" },
  { slug:"crozon-palue",         name:"Crozon (La Palue)",             lat:48.195, lon:-4.546, region:"Bretagne",    cameraUrl:null },
];

window.OCEANLY.getSpotBySlug = function(slug){
  return (window.OCEANLY.SPOTS || []).find(s => s.slug === slug) || null;
};

window.OCEANLY.cameraLinkFor = function(spot){
  if (spot && spot.cameraUrl) return spot.cameraUrl;
  const q = encodeURIComponent(`viewsurf webcam ${spot ? spot.name : ""}`);
  return `https://www.google.com/search?q=${q}`;
};
