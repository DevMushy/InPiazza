import { POI_TYPES } from '../constants';
import type { PoiType } from '../types';

export default function Badge({ type, big }: { type: PoiType; big?: boolean }) {
  return <span className={`badge ${type}${big ? ' big-badge' : ''}`} aria-hidden="true">{POI_TYPES[type].g}</span>;
}
