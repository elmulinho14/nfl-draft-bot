import React from 'react';

const LoginPage: React.FC = () => {
  const handleDiscordLogin = () => {
    window.location.href = '/auth/discord';
  };

  return (
    <div className="login-container">
      <h1>Jags Server Draft Competition</h1>
      <p>Please log in with your Discord account to continue</p>
      <button 
        className="discord-login-btn"
        onClick={handleDiscordLogin}
      >
        Login with Discord
      </button>
    </div>
  );
};

export default LoginPage; 