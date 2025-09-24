import React, { useEffect, useState } from 'react';
import axios from 'axios';

const ProfessionalStep = () => {
  const [sectors, setSectors] = useState([]);
  const [selectedSector, setSelectedSector] = useState('');
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState('');

  // Carrega setores profissionais ao iniciar
  useEffect(() => {
    axios.get('/api/enums/profession-sector')
      .then((res) => setSectors(res.data))
      .catch((err) => console.error('Erro ao buscar setores:', err));
  }, []);

  // Carrega áreas profissionais sempre que um setor for selecionado
  useEffect(() => {
    if (selectedSector) {
      axios.get(`/api/enums/profession-areas?sector_code=${selectedSector}`)
        .then((res) => setAreas(res.data))
        .catch((err) => console.error('Erro ao buscar áreas:', err));
    } else {
      setAreas([]);
      setSelectedArea('');
    }
  }, [selectedSector]);

  return (
    <div>
      {/* Primeiro nível: Setor */}
      <label htmlFor="sector">Setor profissional:</label>
      <select
        id="sector"
        value={selectedSector}
        onChange={(e) => setSelectedSector(e.target.value)}
      >
        <option value="">Selecione o setor</option>
        {sectors.map((s) => (
          <option key={s.code} value={s.code}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Segundo nível: Área */}
      {selectedSector && (
        <>
          <label htmlFor="area">Área profissional:</label>
          <select
            id="area"
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
          >
            <option value="">Selecione a área</option>
            {areas.map((a) => (
              <option key={a.code} value={a.code}>
                {a.label}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
};

export default ProfessionalStep;
