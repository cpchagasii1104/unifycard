import React, { useEffect, useState } from 'react';

const ProfessionalStep = ({ editable, setEditable }) => {
  const [sectors, setSectors] = useState([]);
  const [areas, setAreas] = useState([]);
  const [functions, setFunctions] = useState([]);

  const [selectedSector, setSelectedSector] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedFunction, setSelectedFunction] = useState('');

  const [functionLabels, setFunctionLabels] = useState({});

  useEffect(() => {
    fetch('/api/enums/profession-sector')
      .then(res => res.json())
      .then(data => setSectors(data || []))
      .catch(() => setSectors([]));
  }, []);

  useEffect(() => {
    if (selectedSector) {
      fetch(`/api/enums/profession-areas?sector_code=${selectedSector}`)
        .then(res => res.json())
        .then(data => setAreas(data || []))
        .catch(() => setAreas([]));
    } else {
      setAreas([]);
    }

    setSelectedArea('');
    setSelectedFunction('');
    setFunctions([]);
  }, [selectedSector]);

  useEffect(() => {
    if (selectedArea) {
      fetch(`/api/enums/profession-functions?area_code=${selectedArea}`)
        .then(res => res.json())
        .then(data => {
          setFunctions(data || []);
          const labelMap = {};
          data.forEach(f => { labelMap[f.code] = f.label_pt || f.label || f.code; });
          setFunctionLabels(prev => ({ ...prev, ...labelMap }));
        })
        .catch(() => setFunctions([]));
    } else {
      setFunctions([]);
    }

    setSelectedFunction('');
  }, [selectedArea]);

  const handleAddFunction = () => {
    if (!selectedFunction) return;
    const current = editable.function_codes || [];
    if (!current.includes(selectedFunction)) {
      setEditable(prev => ({
        ...prev,
        function_codes: [...current, selectedFunction],
      }));
    }
  };

  const handleRemoveFunction = (code) => {
    setEditable(prev => ({
      ...prev,
      function_codes: prev.function_codes?.filter(c => c !== code),
    }));
  };

  return (
    <div>
      <label>Setor profissional:</label>
      <select
        value={selectedSector}
        onChange={e => setSelectedSector(e.target.value)}
      >
        <option value="">Selecione um setor</option>
        {sectors.map(sector => (
          <option key={sector.code} value={sector.code}>
            {sector.label_pt || sector.label || sector.code}
          </option>
        ))}
      </select>

      {areas.length > 0 && (
        <>
          <label>Área profissional:</label>
          <select
            value={selectedArea}
            onChange={e => setSelectedArea(e.target.value)}
          >
            <option value="">Selecione uma área</option>
            {areas.map(area => (
              <option key={area.code} value={area.code}>
                {area.label_pt || area.label || area.code}
              </option>
            ))}
          </select>
        </>
      )}

      {functions.length > 0 && (
        <>
          <label>Função profissional:</label>
          <select
            value={selectedFunction}
            onChange={e => setSelectedFunction(e.target.value)}
          >
            <option value="">Selecione uma função</option>
            {functions.map(func => (
              <option key={func.code} value={func.code}>
                {func.label_pt || func.label || func.code}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleAddFunction}>
            Adicionar profissão
          </button>
        </>
      )}

      {editable.function_codes?.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <p><strong>Funções adicionadas:</strong></p>
          <ul>
            {editable.function_codes.map(code => (
              <li key={code}>
                {functionLabels[code] || code}{' '}
                <button type="button" onClick={() => handleRemoveFunction(code)}>
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ProfessionalStep;
