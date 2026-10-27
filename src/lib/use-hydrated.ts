"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return function unsubscribe() {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

/** Prevent SSR controls from accepting input before their handlers are hydrated. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
