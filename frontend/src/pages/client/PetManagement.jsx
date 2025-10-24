import React, { useState } from 'react';

const PetManagement = () => {
  const [pets, setPets] = useState([]);
  const [isAddingPet, setIsAddingPet] = useState(false);
  const [newPet, setNewPet] = useState({
    name: '',
    species: 'dog',
    breed: '',
    age: '',
    weight: '',
    specialNeeds: ''
  });

  const handleAddPet = (e) => {
    e.preventDefault();
    // Aquí iría la lógica para agregar la mascota
    setPets([...pets, { ...newPet, id: Date.now() }]);
    setIsAddingPet(false);
    setNewPet({
      name: '',
      species: 'dog',
      breed: '',
      age: '',
      weight: '',
      specialNeeds: ''
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Mis Mascotas</h1>
          <button
            onClick={() => setIsAddingPet(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Añadir Mascota
          </button>
        </div>

        {/* Lista de mascotas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pets.map(pet => (
            <div key={pet.id} className="bg-white rounded-lg shadow p-4">
              <div className="mb-4">
                <img
                  src={pet.image || 'placeholder-pet.jpg'}
                  alt={pet.name}
                  className="w-full h-48 object-cover rounded-lg"
                />
              </div>
              <h3 className="text-xl font-semibold mb-2">{pet.name}</h3>
              <p className="text-gray-600">{pet.breed}</p>
              <div className="mt-4">
                <button className="text-blue-500 mr-4">Editar</button>
                <button className="text-red-500">Eliminar</button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal para agregar mascota */}
        {isAddingPet && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">Añadir Nueva Mascota</h2>
              <form onSubmit={handleAddPet}>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Nombre</label>
                  <input
                    type="text"
                    value={newPet.name}
                    onChange={(e) => setNewPet({...newPet, name: e.target.value})}
                    className="w-full border rounded-lg p-2"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Especie</label>
                  <select
                    value={newPet.species}
                    onChange={(e) => setNewPet({...newPet, species: e.target.value})}
                    className="w-full border rounded-lg p-2"
                  >
                    <option value="dog">Perro</option>
                    <option value="cat">Gato</option>
                  </select>
                </div>
                {/* Más campos del formulario */}
                <div className="flex justify-end gap-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsAddingPet(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PetManagement;