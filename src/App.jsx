import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import './App.css'

const demoQuestions = [
  { id: 'demo-1', message: 'What is something you are excited about lately?', created_at: '2026-10-27T18:30:00Z', status: 'pending' },
  { id: 'demo-2', message: 'What advice would you give your younger self?', created_at: '2026-10-26T14:10:00Z', status: 'pending' },
]

function getRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const parts = hash.split('/').filter(Boolean)
  return { page: parts[0] || 'home', username: parts[1] }
}

function App() {
  const [route, setRoute] = useState(getRoute)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (route.page === 'profile' && route.username) loadProfile(route.username)
    if (route.page === 'dashboard' && session?.user) loadDashboard(session.user.id)
    if (route.page === 'answer' && route.username) loadAnswer(route.username)
  }, [route, session])

  async function loadProfile(username) {
    setLoading(true)
    setNotice('')
    if (!supabase) {
      setProfile({ id: 'demo-profile', username: 'mabed', display_name: 'Mabed', bio: 'Ask me anything. No pressure.' })
      setLoading(false)
      return
    }
    const { data, error } = await supabase.from('profiles').select('id, username, display_name, bio, avatar_url').eq('username', username).maybeSingle()
    setProfile(data)
    setNotice(error ? error.message : data ? '' : 'This profile does not exist yet.')
    setLoading(false)
  }

  async function loadDashboard(userId) {
    setLoading(true)
    if (!supabase) {
      setQuestions(demoQuestions)
      setLoading(false)
      return
    }

    const { data: ownProfile } = await supabase.from('profiles').select('id, username, display_name, bio').eq('id', userId).maybeSingle()
    if (ownProfile) setProfile(ownProfile)
    const { data, error } = ownProfile
      ? await supabase.from('questions').select('id, message, answer, status, created_at').eq('profile_id', ownProfile.id).order('created_at', { ascending: false })
      : { data: [], error: null }
    setQuestions(data || [])
    if (error) setNotice(error.message)
    setLoading(false)
  }

  async function loadAnswer(questionId) {
    setLoading(true)
    setNotice('')
    if (!supabase) {
      setNotice('Connect Supabase to load shared answers.')
      setLoading(false)
      return
    }
    const { data, error } = await supabase.from('questions').select('id, message, answer, created_at, profiles(display_name, username)').eq('id', questionId).eq('status', 'answered').maybeSingle()
    setProfile(data?.profiles || null)
    setQuestions(data ? [data] : [])
    setNotice(error ? error.message : data ? '' : 'This answer is not available.')
    setLoading(false)
  }

  async function submitQuestion(message, isAnonymous) {
    if (!profile) return
    if (!supabase) {
      setNotice('Demo mode: add your Supabase values to .env.local to save questions.')
      return
    }

    const { error } = await supabase.from('questions').insert({ profile_id: profile.id, message, sender_id: session?.user?.id || null, is_anonymous: isAnonymous })
    if (error) throw error
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    window.location.hash = '#/'
  }

  const appReady = isSupabaseConfigured

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#/"><span className="brand-mark">?</span> ask<span>mabed</span></a>
        <nav>
          {session ? <><a href="#/dashboard">Inbox</a><button className="text-button" onClick={signOut}>Sign out</button></> : <a className="button button-small" href="#/login">Create your page</a>}
        </nav>
      </header>

      {!appReady && <div className="setup-banner">Setup mode — add your Supabase values to <code>.env.local</code> to enable accounts and saving.</div>}

      <main>
        {route.page === 'home' && <Home />}
        {route.page === 'profile' && <Profile profile={profile} loading={loading} notice={notice} onSubmit={submitQuestion} />}
        {route.page === 'answer' && <PublicAnswer answer={questions[0]} profile={profile} loading={loading} notice={notice} />}
        {route.page === 'login' && <Auth onNotice={setNotice} notice={notice} />}
        {route.page === 'dashboard' && <Dashboard session={session} profile={profile} questions={questions} loading={loading} notice={notice} onNotice={setNotice} onRefresh={() => session && loadDashboard(session.user.id)} />}
      </main>
      <footer><span>askmabed</span><span>Questions, without the awkwardness.</span></footer>
    </div>
  )
}

function Home() {
  return <section className="hero-section">
    <div className="eyebrow"><span className="pulse"></span> A softer place to be curious</div>
    <h1>Ask freely.<br /><em>Answer honestly.</em></h1>
    <p className="hero-copy">A personal space for the questions you have been meaning to ask. Share your link, open your inbox, and let the conversation begin.</p>
    <div className="hero-actions"><a className="button" href="#/login">Make your page <span>↗</span></a><a className="under-link" href="#/profile/mabed">See a sample page →</a></div>
    <div className="hero-note"><span>✦</span> Anonymous by default · Always in your control</div>
    <div className="floating-card card-one"><span className="card-icon">✦</span><p>What is a small thing that made you smile today?</p><small>anonymous · just now</small></div>
    <div className="floating-card card-two"><span className="card-icon accent">↗</span><p>What would you tell your past self?</p><small>anonymous · 2 min ago</small></div>
  </section>
}

function Profile({ profile, loading, notice, onSubmit }) {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    if (message.trim().length < 3) return setError('Write at least 3 characters.')
    try { await onSubmit(message.trim(), isAnonymous); setMessage(''); setSent(true); setError('') } catch (submitError) { setError(submitError.message) }
  }
  if (loading) return <div className="center-state">Loading profile…</div>
  if (!profile) return <div className="center-state"><h2>Profile not found</h2><p>{notice}</p><a className="button" href="#/">Go home</a></div>
  return <section className="profile-page">
    <div className="profile-heading"><div className="avatar">{profile.display_name?.[0] || '?'}</div><div><span className="eyebrow">YOU FOUND THEM</span><h1>{profile.display_name}</h1><p>@{profile.username} · {profile.bio || 'Ask me anything.'}</p></div></div>
    <div className="question-panel">
      <span className="eyebrow">A QUESTION FOR {profile.display_name?.toUpperCase()}</span>
      {sent ? <div className="sent-state"><div className="sent-icon">✓</div><h2>Sent with care.</h2><p>Your question is on its way. Ask another one?</p><button className="button button-outline" onClick={() => setSent(false)}>Ask another</button></div> : <form onSubmit={submit}><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength="500" placeholder="Type something you have always wanted to ask…" /><div className="form-footer"><label className="check-label"><input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} /> Send anonymously</label><span>{message.length}/500</span></div>{(error || notice) && <p className="error">{error || notice}</p>}<button className="button" type="submit">Send question <span>↗</span></button></form>}
    </div>
    <a className="under-link" href="#/">← Create your own page</a>
  </section>
}

function Auth({ notice, onNotice }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    if (!supabase) return onNotice('Add Supabase values to .env.local first.')
    const redirectUrl = `${window.location.origin}${window.location.pathname}`
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl } })
    if (error) return onNotice(error.message)
    setSent(true)
  }
  return <section className="auth-page"><span className="eyebrow">YOUR SPACE AWAITS</span><h1>Start a page<br /><em>worth asking.</em></h1><p>Sign in with a magic link. No password to remember.</p>{sent ? <div className="success-box">Check <strong>{email}</strong> for your sign-in link.</div> : <form onSubmit={submit} className="auth-form"><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /><button className="button" type="submit">Send magic link <span>↗</span></button>{notice && <p className="error">{notice}</p>}</form>}<a className="under-link" href="#/">← Back home</a></section>
}

function Dashboard({ session, profile, questions, loading, notice, onNotice, onRefresh }) {
  const [localQuestions, setLocalQuestions] = useState(questions)
  if (!session) return <Auth notice={notice} onNotice={onNotice} />
  if (loading) return <div className="center-state">Loading your inbox…</div>
  if (!profile) return <CreateProfile notice={notice} onCreated={onRefresh} />
  const displayedQuestions = localQuestions.length ? localQuestions : questions
  const unansweredCount = displayedQuestions.filter((question) => question.status === 'pending').length
  async function saveAnswer(questionId, answer) {
    if (!supabase) {
      setLocalQuestions((current) => current.map((question) => question.id === questionId ? { ...question, answer, status: 'answered' } : question))
      return
    }
    const { error } = await supabase.from('questions').update({ answer, status: 'answered' }).eq('id', questionId)
    if (error) throw error
    onRefresh()
  }
  return <section className="dashboard"><div className="dashboard-head"><div><span className="eyebrow">YOUR INBOX</span><h1>Good to see you, {profile?.display_name || 'friend'}.</h1><p>Share your page and let the good questions in.</p></div>{profile?.username && <a className="button button-outline" href={`#/profile/${profile.username}`}>View my page ↗</a>}</div>{notice && <p className="error">{notice}</p>}<div className="inbox-bar"><strong>{unansweredCount} unanswered {unansweredCount === 1 ? 'question' : 'questions'}</strong><button className="text-button" onClick={onRefresh}>Refresh</button></div><div className="question-list">{displayedQuestions.length ? displayedQuestions.map((question) => <article className={`inbox-card ${question.status}`} key={question.id}><div className="question-meta"><span className="anon-dot">◌</span> anonymous <time>{question.created_at.slice(0, 10)}</time></div><p>{question.message}</p>{question.answer ? <div className="answer"><b>Your answer</b><p>{question.answer}</p><ShareAnswer questionId={question.id} /></div> : <AnswerEditor onSave={(answer) => saveAnswer(question.id, answer)} />}<div className="card-status">{question.status === 'pending' ? 'Waiting for your answer' : question.status}</div></article>) : <div className="empty-state"><span>✦</span><h2>Your inbox is quiet.</h2><p>Share your profile link to start receiving questions.</p></div>}</div></section>
}

function PublicAnswer({ answer, profile, loading, notice }) {
  if (loading) return <div className="center-state">Loading answer…</div>
  if (!answer) return <div className="center-state"><h2>Answer not found</h2><p>{notice}</p><a className="button" href="#/">Go home</a></div>
  return <section className="public-answer"><span className="eyebrow">A THOUGHT FROM {profile?.display_name?.toUpperCase()}</span><div className="answer-card"><div className="question-mark">?</div><p className="public-question">{answer.message}</p><div className="public-divider"></div><p className="public-answer-text">{answer.answer}</p><small>answered by @{profile?.username}</small></div><ShareAnswer questionId={answer.id} /><a className="under-link" href={`#/profile/${profile?.username}`}>Ask your own question →</a></section>
}

function ShareAnswer({ questionId }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}${window.location.pathname}#/answer/${questionId}`
  async function share() {
    if (navigator.share) await navigator.share({ title: 'An answer from Ask Mabed', text: 'Someone answered a question on Ask Mabed', url })
    else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    }
  }
  return <div className="share-row"><button className="button button-small" onClick={share}>{copied ? 'Link copied ✓' : 'Share answer ↗'}</button><a className="social-link" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=An%20answer%20from%20Ask%20Mabed&url=${encodeURIComponent(url)}`}>𝕏</a><a className="social-link" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}>f</a></div>
}

function AnswerEditor({ onSave }) {
  const [answer, setAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (answer.trim().length < 1) return setError('Write an answer first.')
    setSaving(true)
    setError('')
    try {
      await onSave(answer.trim())
      setAnswer('')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }
  return <form className="answer-editor" onSubmit={submit}><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength="1000" placeholder="Write your answer…" /><div className="answer-editor-footer"><span>{answer.length}/1000</span><button className="button button-small" disabled={saving} type="submit">{saving ? 'Saving…' : 'Answer question ↗'}</button></div>{error && <p className="error">{error}</p>}</form>
}

function CreateProfile({ notice, onCreated }) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState(notice)
  const submit = async (event) => {
    event.preventDefault()
    if (!supabase) return setError('Add Supabase values to .env.local first.')
    const { data: userData } = await supabase.auth.getUser()
    const { error: createError } = await supabase.from('profiles').insert({ id: userData.user.id, username: username.toLowerCase(), display_name: displayName.trim(), bio: bio.trim() || 'Ask me anything.' })
    if (createError) return setError(createError.message.includes('profiles_username_key') ? 'That username is already taken.' : createError.message)
    onCreated()
  }
  return <section className="auth-page"><span className="eyebrow">ONE LAST THING</span><h1>Make it<br /><em>yours.</em></h1><p>Choose the public identity people will use to ask you questions.</p><form onSubmit={submit} className="profile-form"><input required pattern="[a-zA-Z0-9_]{3,30}" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username (3–30 letters)" /><input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your display name" /><input value={bio} onChange={(event) => setBio(event.target.value)} placeholder="A short bio (optional)" /><button className="button" type="submit">Create my page <span>↗</span></button>{error && <p className="error">{error}</p>}</form></section>
}

export default App
