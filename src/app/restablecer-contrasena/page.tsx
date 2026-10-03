'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RestablecerContrasenaPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ready, setReady] = useState(false)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('Validando enlace...')

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    const init = async () => {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          if (mounted) setMessage('El enlace no es válido o ya expiró. Solicita uno nuevo.')
          return
        }
      }

      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      if (data.session) {
        setReady(true)
        setMessage('')
      } else {
        setMessage('El enlace no es válido o ya expiró. Solicita uno nuevo.')
      }
    }

    init()
    return () => { mounted = false }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setMessage('La contraseña debe tener al menos 8 caracteres.')
    if (password !== confirm) return setMessage('Las contraseñas no coinciden.')

    setLoading(true)
    setMessage('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setMessage(`No se pudo cambiar la contraseña: ${error.message}`)

    await supabase.auth.signOut()
    setReady(false)
    setSuccess(true)
    setMessage('Contraseña actualizada correctamente. Ya puedes iniciar sesión con la nueva contraseña.')
  }

  return (
    <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#f5f7f8'}}>
      <section style={{width:'100%',maxWidth:430,background:'#fff',borderRadius:18,padding:28,boxShadow:'0 16px 50px rgba(0,0,0,.10)'}}>
        <h1 style={{margin:0,fontSize:28}}>UP AND DOWN</h1>
        <h2 style={{marginTop:10,marginBottom:8,fontSize:20}}>Cambiar contraseña</h2>
        <p style={{color:'#59636e',marginTop:0}}>Crea una nueva contraseña para tu acceso administrativo.</p>
        {ready ? <form onSubmit={handleSubmit} style={{display:'grid',gap:14}}>
          <label><span style={{display:'block',marginBottom:6}}>Nueva contraseña</span><input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} style={{width:'100%',boxSizing:'border-box',padding:12,border:'1px solid #ccd3d9',borderRadius:10}} /></label>
          <label><span style={{display:'block',marginBottom:6}}>Confirmar contraseña</span><input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required minLength={8} style={{width:'100%',boxSizing:'border-box',padding:12,border:'1px solid #ccd3d9',borderRadius:10}} /></label>
          <button disabled={loading} type="submit" style={{border:0,borderRadius:10,padding:13,fontWeight:700,cursor:'pointer'}}>{loading?'Actualizando...':'Guardar nueva contraseña'}</button>
        </form> : null}
        {message ? <p style={{marginTop:18}}>{message}</p> : null}
        {success ? <a href="/login">Ir a iniciar sesión</a> : null}
      </section>
    </main>
  )
}
