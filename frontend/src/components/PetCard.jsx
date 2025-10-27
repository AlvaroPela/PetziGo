import React from "react";

function speciesMeta(species) {
  switch (species) {
    case "DOG":
      return { label: "Perro", color: "bg-blue-50 text-blue-700 ring-blue-200", emoji: "🐶" };
    case "CAT":
      return { label: "Gato", color: "bg-purple-50 text-purple-700 ring-purple-200", emoji: "🐱" };
    default:
      return { label: "Otro", color: "bg-emerald-50 text-emerald-700 ring-emerald-200", emoji: "🐾" };
  }
}

function calcAge(birthDate) {
  if (!birthDate) return null;
  const bd = new Date(birthDate);
  if (Number.isNaN(bd.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - bd.getFullYear();
  let months = now.getMonth() - bd.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0 && months <= 0) return "recién nacid@";
  if (years <= 0) return `${months} mes${months !== 1 ? "es" : ""}`;
  if (months === 0) return `${years} año${years !== 1 ? "s" : ""}`;
  return `${years}a ${months}m`;
}

export default function PetCard({ pet, onClick, actions }) {
  const [imgError, setImgError] = React.useState(false);
  const meta = speciesMeta(pet.species);
  const age = calcAge(pet.birth_date);

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg hover:-translate-y-0.5"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      {/* Top banner */}
      <div className="h-24 w-full bg-gradient-to-r from-indigo-100 via-sky-100 to-emerald-100" />

      {/* Avatar */}
      <div className="absolute left-4 top-4">
        {pet.photo_url && !imgError ? (
          <img
            src={pet.photo_url}
            alt={pet.name}
            className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white shadow-md"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="h-16 w-16 rounded-2xl ring-2 ring-white shadow-md grid place-items-center bg-white/80">
            <span className="text-2xl" aria-hidden>
              {meta.emoji}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{pet.name}</h3>
            {pet.breed && (
              <p className="mt-0.5 text-sm text-slate-500">{pet.breed}</p>
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.color}`}
            title={meta.label}
          >
            {meta.emoji} {meta.label}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          {age && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 ring-1 ring-slate-200">
              <span>🗓️</span>
              <span>{age}</span>
            </span>
          )}
          {pet.special_needs && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 ring-1 ring-rose-200">
              <span>⚕️</span>
              <span>Cuidados especiales</span>
            </span>
          )}
        </div>

        {actions && (
          <div className="mt-4 flex justify-end gap-2 border-t pt-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
