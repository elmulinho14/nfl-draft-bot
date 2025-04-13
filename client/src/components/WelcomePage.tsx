import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface UserData {
  id: string;
  username: string;
  avatar: string;
  email: string;
}

const WelcomePage: React.FC = () => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/user', {
          withCredentials: true
        });
        
        if (response.data && response.data.user) {
          setUserData(response.data.user);
        }
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch user data. Please try logging in again.');
        setLoading(false);
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await axios.get('http://localhost:5000/api/logout', {
        withCredentials: true
      });
      navigate('/');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  if (loading) {
    return <div>Loading user data...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="welcome-container">
      {userData && (
        <div className="user-profile">
          <h1>Welcome, {userData.username}!</h1>
          {userData.avatar && (
            <img 
              src={`https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`} 
              alt="User avatar" 
              className="user-avatar" 
            />
          )}
          <p>You've successfully logged in with Discord</p>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default WelcomePage; 