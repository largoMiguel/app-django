import { useState } from "react";
import { useNavigate, Navigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Eye, EyeOff, Lock, Mail, Loader2 } from "lucide-react";
import { authApi } from "@/core/auth/api";
import { useAuthStore, homeForRole } from "@/core/auth/store";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Requerido"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const { accessToken, user, setTokens, setUser } = useAuthStore();
  const [showPwd, setShowPwd] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: { email: "", password: "" },
  });

  if (accessToken && user) {
    return <Navigate to={homeForRole(user)} replace />;
  }

  async function onSubmit(values: FormData) {
    const parsed = schema.safeParse(values);
    if (!parsed.success) return;

    setSubmitting(true);
    setServerError(null);
    try {
      const data = await authApi.login(parsed.data);
      setTokens(data.access, data.refresh);
      setUser(data.user);
      navigate(from || homeForRole(data.user), { replace: true });
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } };
      if (err.response?.status === 429) {
        setServerError("Demasiados intentos. Espera un momento.");
      } else {
        setServerError("Credenciales inválidas.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel izquierdo: marca */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <span className="text-xl font-bold">S1</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">
              SoftOne
            </span>
          </div>
          <div>
            <h1 className="text-4xl font-bold leading-tight">
              Gestiona tu operación
              <br /> con una sola plataforma.
            </h1>
            <p className="mt-4 max-w-md text-white/80">
              Acceso seguro, control por roles y todo lo que tu equipo necesita
              en un solo lugar.
            </p>
          </div>
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} SoftOne 360 · app.softone360.com
          </p>
        </div>
      </div>

      {/* Panel derecho: formulario */}
      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
                <span className="font-bold">S1</span>
              </div>
              <span className="text-xl font-semibold text-slate-900">
                SoftOne
              </span>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900">
            Iniciar sesión
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Ingresa con tu cuenta para continuar.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  {...register("email")}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  placeholder="tu@empresa.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Contraseña
                </label>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  {...register("password")}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Mostrar/ocultar contraseña"
                >
                  {showPwd ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            {serverError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-500">
            Acceso protegido · Conexión cifrada
          </p>
        </div>
      </div>
    </div>
  );
}
