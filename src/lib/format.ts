import { SPEED } from '../constants';
import type { EventType } from '../types';

const WD = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
export function fmtDate(iso: string, long = false): string {
  const d = new Date(iso + 'T12:00:00');
  const s = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  return long ? WD[d.getDay()] + ' ' + s : s + '/' + d.getFullYear();
}
export const km = (m: number) => (m / 1000).toFixed(1).replace('.', ',') + ' km';
export function addMin(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m + Math.round(min / 5) * 5;
  return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}
export const walkMin = (type: EventType, meters: number) => (meters / 1000 / SPEED[type]) * 60;
export function durTxt(min: number): string {
  const r = Math.round(min / 5) * 5;
  return r < 60 ? r + ' min' : Math.floor(r / 60) + ' h' + (r % 60 ? ' ' + (r % 60) : '');
}
export function todayISO(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
