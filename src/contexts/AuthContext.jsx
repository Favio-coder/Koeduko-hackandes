import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '@/services/firebase'
import { FIRESTORE_COLLECTIONS, USER_ROLES } from '@/shared/constants/contracts'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setProfile(null)
      return
    }
    try {
      const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.USERS, firebaseUser.uid))
      setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null)
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    let active = true
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!active) return
      setUser(firebaseUser)
      await loadProfile(firebaseUser)
      if (active) setLoading(false)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [loadProfile])

  /**
   * El rol NO se acepta desde el formulario publico.
   * Se solicita a un callable/funcion privilegiada o se asigna manualmente
   * por un administrador en Firestore. Ver docs/FIRESTORE_SCHEMA.md.
   */
  const register = useCallback(
    async ({ email, password, displayName }) => {
      setError(null)
      const { user: created } = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(created, { displayName })
      await setDoc(
        doc(db, FIRESTORE_COLLECTIONS.USERS, created.uid),
        {
          email: created.email,
          displayName,
          // Rol por defecto: estudiante. La promocion a docente la realiza
          // una funcion privilegiada o un administrador, nunca el navegador.
          role: USER_ROLES.STUDENT,
          classroomId: null,
          emailVerified: created.emailVerified,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      )
      return created
    },
    [],
  )

  const login = useCallback(async ({ email, password }) => {
    setError(null)
    return signInWithEmailAndPassword(auth, email, password)
  }, [])

  const logout = useCallback(async () => {
    await signOut(auth)
  }, [])

  const resetPassword = useCallback(async (email) => {
    setError(null)
    return sendPasswordResetEmail(auth, email)
  }, [])

  const value = useMemo(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      error,
      isAuthenticated: Boolean(user),
      isTeacher: profile?.role === USER_ROLES.TEACHER,
      isStudent: profile?.role === USER_ROLES.STUDENT,
      register,
      login,
      logout,
      resetPassword,
    }),
    [user, profile, loading, error, register, login, logout, resetPassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}