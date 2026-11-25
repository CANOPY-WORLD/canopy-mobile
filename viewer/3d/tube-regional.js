// London Tube · regional data path. Where the Scenario's `underground` entry declares checksummed rail files, the London
// Tube view is served from the Scenario's own data in place of the pinned four-station source: "Network overview" is the
// corridor network with its scheduled trains on a service clock (tube-service.js), and, where `underground.stations`
// declares a station file, the menu lists every built station (tube-stations.js). The object returned has the interface
// of the layer of tube-layer.js (stations, selection, select, journey, platform, pose, setVisible, dispose), so the
// controller treats both alike. Selecting a station is asynchronous here: the station file is fetched on the first
// choice and one station is built at a time; select() then returns a promise. Every station uses the same locate-and-enter platform journey.
import * as THREE from 'three';
import {createCameraJourney} from './camera-journey.mjs';
import {createTubeService} from './tube-service.js';
import {loadTubeStations} from './tube-stations.js';
import {createTubeCutaway} from './tube-cutaway.js';

export async function createRegionalTubeLayer({scene, camera, config, url, signal}) {
  const cutaway = createTubeCutaway(scene);
  const service = await createTubeService({scene, config, url, signal});
  const declared = config.stations, dir = config.dir.replace(/\/?$/, '/');
  const stationsConfig = declared?.file && declared.list?.length ? {source: url(dir + declared.file), sha256: config.files?.[declared.file]?.sha256, list: declared.list} : null;
  const stations = (stationsConfig?.list ?? []).map(([id, label]) => ({id, label}));
  const overview = () => ({pose: service.pose, journey: createCameraJourney([{time: 2.6, position: service.pose.pos.toArray(), target: service.pose.target.toArray()}])});
  let catalog = null, loading = null, chosen = null, selection = 'network', pending = null, visible = false, current = overview();
  let savedBackground, skyActive = false;
  const sky = new THREE.Color(0xb9d7e8);
  const updateSky = on => {
    if (on && !skyActive) { savedBackground = scene.background; scene.background = sky; skyActive = true; }
    else if (!on && skyActive) { scene.background = savedBackground; skyActive = false; }
  };
  const isNetwork = () => selection === 'network';
  const apply = () => { updateSky(visible && !isNetwork() && chosen?.station.environment === 'open'); cutaway.set(visible && !isNetwork() ? chosen?.group : null); service.setVisible(visible && isNetwork()); chosen?.setVisible(visible && !isNetwork()); };
  const show = layer => { current.journey.playing = false; selection = layer.station.id; layer.frameView(camera); current = {platform: {station: layer.station.name, station_id: layer.station.id}, pose: layer.pose, journey: layer.journey ?? createCameraJourney([{time: 1.8, position: layer.pose.pos.toArray(), target: layer.pose.target.toArray()}])}; apply(); };
  return {
    regional: true, group: service.group, network: service.group, service, stations, source: 'Scenario data',
    get stationData() { return catalog; }, get station() { return selection === 'network' ? null : chosen?.station ?? null; },
    get networkView() { return isNetwork(); },
    get cutawayActive() { return cutaway.active; },
    get alone() { return false; },
    get entry() { return null; },
    get stationGroup() { return chosen?.group ?? null; },
    get selection() { return selection; }, get journey() { return current.journey; }, get platform() { return current.platform ?? null; }, get pose() { return current.pose; },
    select(id) {
      pending?.abort(); pending = null;
      if (id === 'network') { current.journey.playing = false; selection = 'network'; current = overview(); apply(); return undefined; }
      if (!stations.some(station => station.id === id)) throw Error('Unknown Tube view: ' + id);
      if (chosen?.station.id === id) { show(chosen); return undefined; }
      const own = pending = new AbortController();
      return (async () => {
        // A failed fetch of the station file is not kept: the next choice tries again.
        catalog ??= await (loading ??= loadTubeStations({config: stationsConfig}).finally(() => { loading = null; }));
        for (const station of stations) station.label = catalog.stations.find(item => item.id === station.id)?.label ?? station.label;
        const layer = await catalog.build(scene, id, own.signal);
        if (own.signal.aborted) { layer.dispose(); own.signal.throwIfAborted(); }
        if (pending === own) pending = null;
        chosen?.dispose(); chosen = layer; show(layer);           // one station is in the scene at a time
      })();
    },
    /**
     * Recompute the view on screen for the camera as it stands (a resize, or coming back to London Tube). Unlike
     * select(), this leaves a station that is still loading alone; that station is fitted to the camera when it arrives.
     */
    refit() { if (selection === 'network') { current.journey.playing = false; current = overview(); } else if (chosen) show(chosen); },
    setVisible(on) { visible = on; apply(); },
    dispose() { pending?.abort(); updateSky(false); cutaway.dispose(); chosen?.dispose(); service.dispose(); },
  };
}
