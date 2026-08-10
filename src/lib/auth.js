import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth'
import { auth } from './firebase'

export function onAuthChange(cb) {
  return onAuthStateChanged(auth, cb)
}

export async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signOut() {
  return fbSignOut(auth)
}
