import { UserButton } from "@clerk/react";

/** Usuario autenticado sin ningún módulo asignado (p. ej. secretario sin módulos). */
export default function SinAccesoPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-800">Sin módulos asignados</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        Tu cuenta no tiene módulos habilitados. Contacta al administrador de tu entidad
        para que te asigne los módulos correspondientes.
      </p>
      <div className="mt-6">
        <UserButton />
      </div>
    </div>
  );
}
