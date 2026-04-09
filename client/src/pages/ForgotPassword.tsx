import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-indigo-700 tracking-tight">Padel Paradiso</h1>
          <p className="text-sm text-gray-500 mt-1">Recuperar contraseña</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Próximamente disponible</h2>
          <p className="text-sm text-gray-500">
            La recuperación de contraseña estará disponible en una próxima versión.
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          <Link to="/login" className="text-indigo-600 hover:underline font-medium">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
