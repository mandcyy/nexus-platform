import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, MessageSquare, BarChart3,
  Shield, Settings, Activity, TrendingUp, AlertTriangle,
  DollarSign, Server, Database, Globe, LogOut
} from 'lucide-react';

type Metric = { label: string; value: string; change: string; icon: React.ReactNode };

const Dashboard: React.FC = () => {
  const [metrics] = useState<Metric[]>([
    { label: 'Total Users', value: '1,247,892', change: '+12.3%', icon: <Users /> },
    { label: 'Online Now', value: '45,231', change: '+5.7%', icon: <Activity /> },
    { label: 'Messages/Day', value: '3.2M', change: '+18.2%', icon: <MessageSquare /> },
    { label: 'Revenue', value: '$284,500', change: '+24.5%', icon: <DollarSign /> },
    { label: 'Server Load', value: '34%', change: '-2.1%', icon: <Server /> },
    { label: 'Active Chats', value: '892,341', change: '+8.9%', icon: <MessageSquare /> },
  ]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0f', color: '#e8e8ec' }}>
      {/* Sidebar */}
      <nav style={{ width: 240, background: '#141419', padding: '1.5rem', borderRight: '1px solid #2e2e36' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0066ff', marginBottom: '2rem' }}>
          Nexus Admin
        </h1>
        {[
          { icon: <LayoutDashboard />, label: 'Dashboard' },
          { icon: <Users />, label: 'Users' },
          { icon: <MessageSquare />, label: 'Chats' },
          { icon: <BarChart3 />, label: 'Analytics' },
          { icon: <Shield />, label: 'Security' },
          { icon: <Database />, label: 'Database' },
          { icon: <Globe />, label: 'CDN' },
          { icon: <Settings />, label: 'Settings' },
        ].map(item => (
          <div key={item.label} style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem', borderRadius: 8, marginBottom: '0.25rem',
            cursor: 'pointer', color: '#a0a0a8'
          }}>
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', color: '#ff1744', cursor: 'pointer' }}>
          <LogOut />
          <span>Logout</span>
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Platform Overview</h2>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {metrics.map(m => (
            <div key={m.label} style={{ background: '#141419', padding: '1.25rem', borderRadius: 12, border: '1px solid #2e2e36' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ color: '#a0a0a8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{m.label}</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{m.value}</div>
                  <div style={{ color: '#00c853', fontSize: '0.8rem', marginTop: '0.25rem' }}>{m.change}</div>
                </div>
                <div style={{ color: '#0066ff' }}>{m.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Realtime Chart Area */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <div style={{ background: '#141419', padding: '1.25rem', borderRadius: 12, border: '1px solid #2e2e36', minHeight: 300 }}>
            <h3 style={{ marginBottom: '1rem' }}>Messages per Minute</h3>
            <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
              {Array.from({ length: 60 }, (_, i) => (
                <div key={i} style={{
                  flex: 1, background: '#0066ff',
                  height: `${20 + Math.random() * 80}%`,
                  borderRadius: '2px 2px 0 0',
                  opacity: 0.6 + Math.random() * 0.4,
                }} />
              ))}
            </div>
          </div>
          <div style={{ background: '#141419', padding: '1.25rem', borderRadius: 12, border: '1px solid #2e2e36', minHeight: 300 }}>
            <h3 style={{ marginBottom: '1rem' }}>Active Services</h3>
            {['Auth Service', 'Chat Service', 'Media Service', 'Search Service', 'AI Service', 'Payment Service'].map(svc => (
              <div key={svc} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #2e2e36' }}>
                <span>{svc}</span>
                <span style={{ color: '#00c853' }}>● Online</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;