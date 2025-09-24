import React, { useState, useEffect } from 'react';
import styles from './dashboard-page.module.css';
import { useAuth } from '../../../contexts/auth-context';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/unifycard/cards', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => {
        setCards(data.cards || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1>UnifyCard Admin Panel</h1>
        <button onClick={handleLogout}>Logout</button>
      </header>

      <main className={styles.main}>
        <h2>Issued Cards</h2>

        {loading ? (
          <p>Loading...</p>
        ) : cards.length === 0 ? (
          <p>No cards found.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Issued At</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.card_id}>
                  <td>{card.user_name}</td>
                  <td>{card.status}</td>
                  <td>{new Date(card.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
