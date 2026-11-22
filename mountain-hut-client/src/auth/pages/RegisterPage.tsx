import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { register } from '../api/auth-api.ts'
import { ApiError } from '../../shared/api/client.ts'
import { useAuth } from '../hooks/useAuth.ts'
import AuthShell from '../../shared/components/AuthShell.tsx'
import AuthField from '../components/AuthField.tsx'
import Icon from '../../shared/components/Icon.tsx'

const primaryButton =
  'w-full inline-flex items-center justify-center gap-2 px-7 py-3 text-base font-semibold text-white bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-xl shadow-lg transition-all hover:shadow-xl active:scale-[0.99] disabled:opacity-50 cursor-pointer'

const MIN_PASSWORD_LENGTH = 8 // TODO: align with registerSchema in auth.schema.ts

export default function RegisterPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // already logged in: nothing to register
  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (![name, surname, email, phone, password].every((v) => v.trim())) {
      return setError('Please fill in all fields.')
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    }
    if (password !== confirm) {
      return setError('Passwords do not match.')
    }

    setError(null)
    setSubmitting(true)
    try {
      await register({
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        phoneNumber: phone.trim(),
        password,
        type: 'HIKER', // only hikers sign up themselves; staff accounts are created by a manager
      })
      // registering doesn't start a session, so log in right away
      await login(email.trim(), password)
      navigate(from ?? '/booking', { replace: true })
    } catch (err) {
      console.error('Registration error:', err)
      if (err instanceof ApiError && err.status === 409) {
        setError('An error occurred while trying to register your account, try with a different email')
      } else if (err instanceof ApiError && err.status === 400) {
        setError('Some fields are invalid. Please check your email, phone number and password.')
      } else if (err instanceof ApiError && err.message) {
        setError(err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      width="2xl"
      badge="Join the Hut"
      title="Create your account"
      subtitle="Book tables, manage your reservations and share your dietary needs."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-white underline hover:text-green-200">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          <AuthField
            id="name"
            required
            label="Name"
            icon="user"
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <AuthField
            id="surname"
            required
            label="Surname"
            icon="user"
            autoComplete="family-name"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
          />
          <AuthField
            id="email"
            required
            label="Email"
            icon="mail"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <AuthField
            id="phone"
            required
            label="Phone number"
            icon="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+39 333 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <AuthField
            id="password"
            required
            label="Password"
            icon="lock"
            type="password"
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <AuthField
            id="confirm"
            required
            label="Confirm password"
            icon="lock"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            <Icon name="warning" className="w-5 h-5" />
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting} className={primaryButton}>
          <Icon name="check" className="w-5 h-5" />
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-sm text-stone-500">
          <span aria-hidden="true" className="text-red-600">*</span> Required fields
        </p>
      </form>
    </AuthShell>
  )
}