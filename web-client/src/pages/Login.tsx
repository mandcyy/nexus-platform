import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, User, Eye, EyeOff } from 'lucide-react';

const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div style={container}>
      <div style={card}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0066ff', marginBottom: '0.5rem', textAlign: 'center' }}>Nexus</h1>
        <p style={{ color: '#a0a0a8', textAlign: 'center', marginBottom: '2rem' }}>Sign in to your account</p>
        <div style={{ marginBottom: '1rem' }}>
          <label style={label}>Email or Username</label>
          <div style={inputWrap}><User size={18} style={{ color: '#a0a0a8' }} /><input style={input} placeholder="Enter your email" /></div>
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={label}>Password</label>
          <div style={inputWrap}>
            <Lock size={18} style={{ color: '#a0a0a8' }} />
            <input type={showPassword ? 'text' : 'password'} style={input} placeholder="Enter your password" />
            <button onClick={() => setShowPassword(!showPassword)} style={{ ...iconBtn, marginLeft: 'auto' }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <button style={btn}>Sign In</button>
        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#a0a0a8' }}>
          Don&apos;t have an account? <Link to="/register" style={{ color: '#0066ff', textDecoration: 'none' }}>Sign Up</Link>
        </p>
      </div>
    </div>
  );
};

const container: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' };
const card: React.CSSProperties = { background: '#141419', border: '1px solid #2e2e36', borderRadius: 16, padding: '2.5rem', width: 400, maxWidth: '90vw' };
const label: React.CSSProperties = { display: 'block', fontSize: '0.875rem', color: '#a0a0a8', marginBottom: '0.5rem' };
const inputWrap: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e1e24', borderRadius: 10, padding: '0 12px' };
const input: React.CSSProperties = { flex: 1, background: 'none', border: 'none', padding: '12px 0', color: '#e8e8ec', fontSize: '0.95rem', outline: 'none' };
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#a0a0a8', cursor: 'pointer', padding: 4 };
const btn: React.CSSProperties = { width: '100%', padding: '12px', background: '#0066ff', color: 'white', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' };
export default Login;