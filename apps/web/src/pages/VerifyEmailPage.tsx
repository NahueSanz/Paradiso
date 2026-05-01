import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../api';
import { useAuth } from '../context/AuthContext';

type State = 'loading' | 'success' | 'error';

const courtBg: React.CSSProperties = {
  backgroundImage: [
    'linear-gradient(rgba(4,14,26,0.72), rgba(4,14,26,0.72))',
    'url(/paddle-linea-blanca.png)',
  ].join(', '),
  backgroundSize: 'cover',
  backgroundPosition: 'center',
};

export default function VerifyEmailPage() {
  const [searchParams]     = useSearchParams();
  const navigate           = useNavigate();
  const { user, token, markEmailVerified } = useAuth();
  const token_             = searchParams.get('token');

  const [state, setState]   = useState<State>('loading');
  const [message, setMessage] = useState('');
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    if (!token_) {
      setState('error');
      setMessage('El enlace de verificación no contiene un token válido.');
      return;
    }

    fetch(`${API_URL}/api/auth/verify-email`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token: token_ }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          if (user && token) {
            markEmailVerified();
            navigate('/', { replace: true });
          } else {
            setState('success');
            setMessage((body as { message?: string }).message ?? 'Cuenta verificada.');
          }
        } else {
          setState('error');
          setMessage(
            (body as { message?: string }).message ?? 'El enlace es inválido o ha expirado.',
          );
        }
      })
      .catch(() => {
        setState('error');
        setMessage('Error de conexión. Intentá de nuevo.');
      });
  }, []);  // intentionally empty — runs once on mount

  function handleContinue() {
    navigate('/login', { replace: true, state: { successMessage: 'Email verificado. Ya podés iniciar sesión.' } });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={courtBg}>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-lime-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/60 p-8 text-center">

          <div className="mb-6">
            <img src="/logo-full.svg" alt="ClubFlow" className="h-10 mx-auto" />
          </div>

          {state === 'loading' && (
            <>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 bg-white/[0.05]">
                <svg className="w-7 h-7 text-lime-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Verificando tu cuenta…</h2>
              <p className="text-sm text-white/40">Esto solo tarda un segundo.</p>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="w-14 h-14 bg-lime-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">¡Cuenta verificada!</h2>
              <p className="text-sm text-white/40 mb-8">{message}</p>
              <button
                onClick={handleContinue}
                className="inline-block py-3 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-400 hover:to-lime-500 transition-all duration-200"
              >
                Iniciar sesión
              </button>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Enlace inválido o expirado</h2>
              <p className="text-sm text-white/40 mb-8">{message}</p>
              <Link
                to="/login"
                className="inline-block py-3 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-400 hover:to-lime-500 transition-all duration-200"
              >
                Ir al inicio de sesión
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
