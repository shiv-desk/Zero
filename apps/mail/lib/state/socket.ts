import type { PartySocket } from 'partysocket';
import { atom } from 'jotai';

export const socketAtom = atom<PartySocket | null>(null);

export const sendMessageAtom = atom(null, (get, _set, message: object) => {
  const socket = get(socketAtom);
  if (socket) {
    socket.send(JSON.stringify(message));
  } else {
    console.warn('Socket not available. Message not sent.', message);
  }
});
