import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import LoginPage from './components/LoginPage';
import WelcomePage from './components/WelcomePage';
import DraftPage from './components/DraftPage';
import AdminDraftPage from './components/AdminDraftPage';
import MyDraftPage from './pages/MyDraftPage';

interface User {
  id: string;
  username: string;
  // Add other fields as needed from your /api/user response
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState<boolean>(true);

  useEffect(() => {
    // Fetch user data on initial load
    fetch('/api/user')
      .then(res => {
        if (res.ok) {
          return res.json();
        } else {
          // Not logged in or other error
          setUser(null);
          throw new Error('Not authenticated');
        }
      })
      .then(data => {
        setUser(data.user);
      })
      .catch(err => {
        console.log('User not logged in or fetch error:', err.message);
        setUser(null);
      })
      .finally(() => {
        setLoadingUser(false);
      });
  }, []);

  // Protected Route for logged-in users
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (loadingUser) {
      return <div>Loading...</div>; // Or a spinner
    }
    if (user) {
      // User is logged in, render the requested component
      return <>{children}</>;
    }
    // User is not logged in, redirect to login
    return <Navigate to="/" replace />;
  };

  // Simple Protected Route Component for Admin
  const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    if (loadingUser) {
      return <div>Loading...</div>; // Or a spinner
    }
    // Check if user is logged in AND is the admin user
    if (user && user.username === 'alex952323') {
      // Wrap children in a fragment to ensure JSX.Element return type
      return <>{children}</>;
    }
    // Otherwise, redirect (no need for else if it's the last statement)
    return <Navigate to="/" replace />;
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route 
            path="/welcome" 
            element={
              <ProtectedRoute>
                <WelcomePage />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/draft" 
            element={
              <ProtectedRoute>
                <DraftPage />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/mydraft" 
            element={
              <ProtectedRoute>
                <MyDraftPage />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <AdminDraftPage />
              </AdminRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
