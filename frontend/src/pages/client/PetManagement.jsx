import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { toast } from 'react-toastify';
import Modal from '../../components/Modal';
import { Input, Select, Textarea, Button } from '../../components/FormComponents';
import PetCard from '../../components/PetCard';

const PetManagement = () => {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddingPet, setIsAddingPet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editPet, setEditPet] = useState(null); // objeto mascota en edición o null
  const [deletingId, setDeletingId] = useState(null); // id de mascota para confirmar borrado
  const [newPet, setNewPet] = useState({
    name: '',
    species: 'DOG',
    breed: '',
    birth_date: '',
    special_needs: '',
    photo_url: ''
  });
  const [addImgError, setAddImgError] = useState(false);
  const [editImgError, setEditImgError] = useState(false);

  // Cargar mascotas del usuario
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api('/users/pets');
        if (!active) return;
        setPets(Array.isArray(data?.pets) ? data.pets : []);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'No se pudieron cargar las mascotas');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleAddPet = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: newPet.name.trim(),
        species: newPet.species,
        breed: newPet.breed?.trim() || null,
        birth_date: newPet.birth_date || null,
        special_needs: newPet.special_needs?.trim() || null,
        photo_url: newPet.photo_url?.trim() || null,
      };
      const res = await api('/users/pets', { method: 'POST', body: payload });
      const created = res?.pet || null;
      if (created) {
        setPets((prev) => [created, ...prev]);
        toast.success('Mascota creada');
      }
      setIsAddingPet(false);
      setNewPet({ name: '', species: 'DOG', breed: '', birth_date: '', special_needs: '', photo_url: '' });
    } catch (err) {
      const msg = err.message || 'No se pudo crear la mascota';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (pet) => {
    setEditPet({
      id: pet.id,
      name: pet.name || '',
      species: pet.species || 'DOG',
      breed: pet.breed || '',
      birth_date: pet.birth_date ? String(pet.birth_date).slice(0, 10) : '',
      special_needs: pet.special_needs || '',
      photo_url: pet.photo_url || ''
    });
  };

  const handleUpdatePet = async (e) => {
    e.preventDefault();
    if (!editPet?.id) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: editPet.name.trim(),
        species: editPet.species,
        breed: editPet.breed?.trim() || null,
        birth_date: editPet.birth_date || null,
        special_needs: editPet.special_needs?.trim() || null,
        photo_url: editPet.photo_url?.trim() || null,
      };
      await api(`/users/pets/${editPet.id}`, { method: 'PUT', body: payload });
      // Actualizar en estado
      setPets((prev) => prev.map((p) => (p.id === editPet.id ? { ...p, ...payload } : p)));
      setEditPet(null);
      toast.success('Mascota actualizada');
    } catch (err) {
      const msg = err.message || 'No se pudo actualizar la mascota';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePet = async () => {
    if (!deletingId) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/users/pets/${deletingId}`, { method: 'DELETE' });
      setPets((prev) => prev.filter((p) => p.id !== deletingId));
      setDeletingId(null);
      toast.success('Mascota eliminada');
    } catch (err) {
      const msg = err.message || 'No se pudo eliminar la mascota';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const headerSubtitle = useMemo(() => {
    if (loading) return 'Cargando…';
    if (error) return 'Ocurrió un problema';
    if (!pets?.length) return 'Aún no has agregado mascotas';
    return `${pets.length} mascota${pets.length !== 1 ? 's' : ''}`;
  }, [loading, error, pets]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Mis Mascotas</h1>
            <p className="text-slate-500">{headerSubtitle}</p>
          </div>
          <Button onClick={() => setIsAddingPet(true)}>
            <span>＋</span> Añadir Mascota
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Lista de mascotas */}
        {loading ? (
          <div className="text-slate-500">Cargando mascotas…</div>
        ) : pets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
            No hay mascotas aún. ¡Agrega la primera!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pets.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                actions={
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartEdit(pet); }}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(pet.id); }}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
                    >
                      🗑️ Eliminar
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}

        {/* Modal para agregar mascota */}
        <Modal isOpen={isAddingPet} onClose={() => setIsAddingPet(false)} ariaLabel="Añadir Mascota">
          <h2 className="mb-4 text-2xl font-bold">Añadir Nueva Mascota</h2>
          <form onSubmit={handleAddPet} className="space-y-4">
            <Input
              label="Nombre"
              value={newPet.name}
              onChange={(v) => setNewPet({ ...newPet, name: v })}
              required
              placeholder="Firulais"
            />

            <Select
              label="Especie"
              value={newPet.species}
              onChange={(v) => setNewPet({ ...newPet, species: v })}
              options={[
                { value: 'DOG', label: 'Perro' },
                { value: 'CAT', label: 'Gato' },
                { value: 'OTHER', label: 'Otro' },
              ]}
            />

            <Input
              label="Raza (opcional)"
              value={newPet.breed}
              onChange={(v) => setNewPet({ ...newPet, breed: v })}
              placeholder="Labrador, criollo, etc."
            />

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Fecha de nacimiento (opcional)</span>
              <input
                type="date"
                value={newPet.birth_date}
                onChange={(e) => setNewPet({ ...newPet, birth_date: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>

            <Textarea
              label="Cuidados especiales (opcional)"
              value={newPet.special_needs}
              onChange={(v) => setNewPet({ ...newPet, special_needs: v })}
              rows={3}
              placeholder="Medicamentos, alergias, etc."
            />

            <Input
              label="Foto (URL pública, opcional)"
              type="url"
              value={newPet.photo_url}
              onChange={(v) => { setNewPet({ ...newPet, photo_url: v }); setAddImgError(false); }}
              placeholder="https://..."
            />

            {newPet.photo_url && (
              <div className="mt-2">
                <span className="text-sm font-medium text-gray-700">Vista previa</span>
                <div className="mt-2 h-32 w-32 overflow-hidden rounded-xl ring-1 ring-slate-200 grid place-items-center bg-white">
                  {!addImgError ? (
                    <img
                      src={newPet.photo_url}
                      alt="Vista previa"
                      className="h-full w-full object-cover"
                      onError={() => setAddImgError(true)}
                    />
                  ) : (
                    <span className="text-3xl" aria-hidden>
                      {newPet.species === 'DOG' ? '🐶' : newPet.species === 'CAT' ? '🐱' : '🐾'}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsAddingPet(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={saving || !newPet.name}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
      {/* Modal para editar mascota */}
      <Modal isOpen={!!editPet} onClose={() => setEditPet(null)} ariaLabel="Editar Mascota">
        <h2 className="mb-4 text-2xl font-bold">Editar Mascota</h2>
        {editPet && (
          <form onSubmit={handleUpdatePet} className="space-y-4">
            <Input
              label="Nombre"
              value={editPet.name}
              onChange={(v) => setEditPet({ ...editPet, name: v })}
              required
            />
            <Select
              label="Especie"
              value={editPet.species}
              onChange={(v) => setEditPet({ ...editPet, species: v })}
              options={[
                { value: 'DOG', label: 'Perro' },
                { value: 'CAT', label: 'Gato' },
                { value: 'OTHER', label: 'Otro' },
              ]}
            />
            <Input
              label="Raza (opcional)"
              value={editPet.breed}
              onChange={(v) => setEditPet({ ...editPet, breed: v })}
            />
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Fecha de nacimiento (opcional)</span>
              <input
                type="date"
                value={editPet.birth_date}
                onChange={(e) => setEditPet({ ...editPet, birth_date: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <Textarea
              label="Cuidados especiales (opcional)"
              value={editPet.special_needs}
              onChange={(v) => setEditPet({ ...editPet, special_needs: v })}
              rows={3}
            />
            <Input
              label="Foto (URL pública, opcional)"
              type="url"
              value={editPet.photo_url}
              onChange={(v) => { setEditPet({ ...editPet, photo_url: v }); setEditImgError(false); }}
            />
            {editPet.photo_url && (
              <div className="mt-2">
                <span className="text-sm font-medium text-gray-700">Vista previa</span>
                <div className="mt-2 h-32 w-32 overflow-hidden rounded-xl ring-1 ring-slate-200 grid place-items-center bg-white">
                  {!editImgError ? (
                    <img
                      src={editPet.photo_url}
                      alt="Vista previa"
                      className="h-full w-full object-cover"
                      onError={() => setEditImgError(true)}
                    />
                  ) : (
                    <span className="text-3xl" aria-hidden>
                      {editPet.species === 'DOG' ? '🐶' : editPet.species === 'CAT' ? '🐱' : '🐾'}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditPet(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={saving || !editPet.name}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirmación de borrado */}
      <Modal isOpen={!!deletingId} onClose={() => setDeletingId(null)} ariaLabel="Eliminar Mascota">
        <h2 className="mb-2 text-xl font-semibold text-slate-900">Eliminar mascota</h2>
        <p className="text-slate-600">Esta acción no se puede deshacer. ¿Deseas continuar?</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setDeletingId(null)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={handleDeletePet} disabled={saving}>
            {saving ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default PetManagement;