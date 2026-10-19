import { useEffect, useState } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, doc, addDoc, setDoc, deleteDoc, serverTimestamp,
  writeBatch, deleteField, type Firestore
} from 'firebase/firestore';
import { db } from '../firebase';
import { hydrate } from '../lib/geo';
import { todayISO } from '../lib/format';
import type { EventData, EventItem } from '../types';
import { SAMPLE_EVENTS } from './sample';

export interface Feed { events: EventItem[]; loading: boolean; error: string | null; demo: boolean }

/** Manifestazioni pubblicate da oggi in poi. Nessun login necessario. */
export function usePublicEvents(): Feed {
  const [f, setF] = useState<Feed>({ events: [], loading: !!db, error: null, demo: !db });
  useEffect(() => {
    if (!db) { setF({ events: SAMPLE_EVENTS, loading: false, error: null, demo: true }); return; }
    const q = query(collection(db, 'events'), where('published', '==', true), where('date', '>=', todayISO()), orderBy('date'));
    return onSnapshot(q,
      snap => setF({ events: snap.docs.map(d => hydrate(d.id, d.data() as EventData)).sort(byDateTime), loading: false, error: null, demo: false }),
      err => setF(p => ({ ...p, loading: false, error: err.message })));
  }, []);
  return f;
}

export function useMyEvents(uid: string | undefined): EventItem[] {
  const [list, setList] = useState<EventItem[]>([]);
  useEffect(() => {
    if (!db || !uid) return;
    const q = query(collection(db, 'events'), where('ownerUid', '==', uid), orderBy('date', 'desc'));
    return onSnapshot(q, snap => setList(snap.docs.map(d => hydrate(d.id, d.data() as EventData))));
  }, [uid]);
  return list;
}

const byDateTime = (a: EventItem, b: EventItem) => (a.date + a.time).localeCompare(b.date + b.time);

function need(): Firestore { if (!db) throw new Error('Firebase non configurato'); return db; }

export async function saveEvent(id: string | null, data: Omit<EventData, 'updatedAt'>): Promise<string> {
  const d = { ...data, updatedAt: serverTimestamp() };
  if (id) { await setDoc(doc(need(), 'events', id), d); return id; }
  const ref = await addDoc(collection(need(), 'events'), d);
  return ref.id;
}
export async function removeEvent(id: string) { await deleteDoc(doc(need(), 'events', id)); }

// ---- admin ----
export interface PendingRequest { uid: string; orgName: string; note: string; email?: string }
export function usePendingRequests(enabled: boolean): PendingRequest[] {
  const [list, setList] = useState<PendingRequest[]>([]);
  useEffect(() => {
    if (!db || !enabled) return;
    const q = query(collection(db, 'accessRequests'), where('status', '==', 'pending'));
    return onSnapshot(q, snap => setList(snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<PendingRequest, 'uid'>) }))));
  }, [enabled]);
  return list;
}
/** Approva: crea il ruolo e cancella la richiesta (quindi anche l'email) */
export async function approveRequest(r: PendingRequest) {
  const b = writeBatch(need());
  b.set(doc(need(), 'organizers', r.uid), { orgName: r.orgName, approvedAt: serverTimestamp() });
  b.delete(doc(need(), 'accessRequests', r.uid));
  await b.commit();
}
/** Rifiuta: tiene solo lo stato, l'email viene cancellata */
export async function rejectRequest(r: PendingRequest) {
  await setDoc(doc(need(), 'accessRequests', r.uid), { status: 'rejected', email: deleteField(), decidedAt: serverTimestamp() }, { merge: true });
}
