import type { EventType, PoiType } from './types';

export const POI_TYPES: Record<PoiType, { label: string; g: string }> = {
  palco: { label: 'Palco', g: 'P' },
  ristoro: { label: 'Ristoro', g: 'R' },
  soccorso: { label: 'Soccorso', g: '+' },
  info: { label: 'Info', g: 'i' },
  wc: { label: 'Bagni', g: 'WC' }
};
export const POI_KEYS = Object.keys(POI_TYPES) as PoiType[];

export const TYPE_LABEL: Record<EventType, string> = {
  corteo: 'Corteo', festa: 'Festa', fiaccolata: 'Fiaccolata', presidio: 'Presidio'
};
export const TYPE_PLURAL: Record<EventType, string> = {
  corteo: 'Cortei', festa: 'Feste', fiaccolata: 'Fiaccolate', presidio: 'Presìdi'
};
/** velocità media a piedi in km/h, per stimare gli orari */
export const SPEED: Record<EventType, number> = { corteo: 2.4, festa: 3, fiaccolata: 2.8, presidio: 2.4 };
