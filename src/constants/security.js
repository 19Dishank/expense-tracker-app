// How long the app can stay in the background before the biometric lock asks again.
// Quickly switching to another app (for example to check a payment) does not lock the app.
export const LOCK_AFTER_SECONDS = 30;
export const LOCK_AFTER_MS = LOCK_AFTER_SECONDS * 1000;

