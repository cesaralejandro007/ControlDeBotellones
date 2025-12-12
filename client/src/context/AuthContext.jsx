import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext()

export function AuthProvider({ children }){
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch(e){ return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('token'))

  const login = (userData, token) => {
    setUser(userData)
    setToken(token)
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  const logout = () => {
    setUser(null); setToken(null); localStorage.removeItem('token'); localStorage.removeItem('user')
    delete axios.defaults.headers.common['Authorization']
  }

  useEffect(()=>{
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }, [token])

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
