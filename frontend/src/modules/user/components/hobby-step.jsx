import React, { useEffect, useState } from 'react';

const CATEGORY_LABELS = {
  movies_and_series: 'Filmes e Séries',
  food_and_drinks: 'Comes e Bebes',
  sports: 'Esportes',
  music: 'Música',
  reading: 'Leitura',
  technology: 'Tecnologia',
  events: 'Eventos',
  travel: 'Viagens',
  wellness: 'Bem-estar',
  gastronomy: 'Gastronomia',
  art: 'Arte',
  nerd_stuff: 'Cultura Nerd',
  around_the_city: 'Pela Cidade',
};

const HobbyStep = ({ editable, setEditable }) => {
  const [categories, setCategories] = useState([]);
  const [topics, setTopics] = useState([]);
  const [hobbies, setHobbies] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedHobby, setSelectedHobby] = useState('');

  const [hobbyLabels, setHobbyLabels] = useState({});

  useEffect(() => {
    fetch('/api/hobbies/categories')
      .then(res => res.json())
      .then(data => setCategories(data || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetch(`/api/hobbies/topics?category=${selectedCategory}`)
        .then(res => res.json())
        .then(data => setTopics(data || []))
        .catch(() => setTopics([]));
    } else {
      setTopics([]);
    }
    setSelectedTopic('');
    setSelectedHobby('');
    setHobbies([]);
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedTopic) {
      fetch(`/api/hobbies/details?topic_code=${selectedTopic}`)
        .then(res => res.json())
        .then(data => {
          setHobbies(data || []);
          const labelMap = {};
          data.forEach(h => {
            labelMap[h.hobby_code] = h.label_pt;
          });
          setHobbyLabels(prev => ({ ...prev, ...labelMap }));
        })
        .catch(() => setHobbies([]));
    } else {
      setHobbies([]);
    }
    setSelectedHobby('');
  }, [selectedTopic]);

  const handleAddHobby = () => {
    if (!selectedHobby) return;
    const current = editable.hobby_codes || [];
    if (!current.includes(selectedHobby)) {
      setEditable(prev => ({
        ...prev,
        hobby_codes: [...current, selectedHobby],
      }));
    }
  };

  const handleRemoveHobby = (code) => {
    setEditable(prev => ({
      ...prev,
      hobby_codes: prev.hobby_codes?.filter(c => c !== code),
    }));
  };

  return (
    <div>
      <label>Categoria de hobby:</label>
      <select
        value={selectedCategory}
        onChange={e => setSelectedCategory(e.target.value)}
      >
        <option value="">Selecione uma categoria</option>
        {categories.map(category => (
          <option key={category} value={category}>
            {CATEGORY_LABELS[category] || category}
          </option>
        ))}
      </select>

      {topics.length > 0 && (
        <>
          <label>Tópico de hobby:</label>
          <select
            value={selectedTopic}
            onChange={e => setSelectedTopic(e.target.value)}
          >
            <option value="">Selecione um tópico</option>
            {topics.map(topic => (
              <option key={topic.topic_code} value={topic.topic_code}>
                {topic.label_pt}
              </option>
            ))}
          </select>
        </>
      )}

      {hobbies.length > 0 && (
        <>
          <label>Hobby:</label>
          <select
            value={selectedHobby}
            onChange={e => setSelectedHobby(e.target.value)}
          >
            <option value="">Selecione um hobby</option>
            {hobbies.map(h => (
              <option key={h.hobby_code} value={h.hobby_code}>
                {h.label_pt}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleAddHobby}>
            Adicionar hobby
          </button>
        </>
      )}

      {editable.hobby_codes?.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <p><strong>Hobbies adicionados:</strong></p>
          <ul>
            {editable.hobby_codes.map(code => (
              <li key={code}>
                {hobbyLabels[code] || code}{' '}
                <button type="button" onClick={() => handleRemoveHobby(code)}>
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

export default HobbyStep;
