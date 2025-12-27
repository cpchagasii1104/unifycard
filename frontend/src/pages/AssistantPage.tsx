// frontend/src/pages/AssistantPage.tsx
import { useState } from 'react';
import AIChat from '../components/ai/AIChat';
import './AssistantPage.css';

export default function AssistantPage() {
  const [activeTab, setActiveTab] = useState('home');

  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'professional', label: 'Profissional' },
    { id: 'personal', label: 'Pessoal' },
    { id: 'advance', label: 'Avanço' },
    { id: 'engineering', label: 'Engenharia' },
  ];

  return (
    <div className="assistant-page">
      <h1>Assistente</h1>
      <div className="assistant-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`assistant-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="assistant-content">
        <AIChat tab={activeTab} />
      </div>
    </div>
  );
}


