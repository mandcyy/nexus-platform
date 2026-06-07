import React from 'react';
import { MessageSquare, Users, Phone, Compass, Settings, LogOut } from 'lucide-react';

const Sidebar: React.FC = () => (
  <nav style={{ width: 64, background: '#0a0a0f', borderRight: '1px solid #1e1e24', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem 0', gap: '0.25rem' }}>
    <div style={{ width: 40, height: 40, background: '#0066ff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.5rem' }}>N</div>
    {[
      { icon: <MessageSquare size={22} />, label: 'Chats' },
      { icon: <Users size={22} />, label: 'Contacts' },
      { icon: <Phone size={22} />, label: 'Calls' },
      { icon: <Compass size={22} />, label: 'Discover' },
      { icon: <Settings size={22} />, label: 'Settings' },
    ].map(item => (
      <button key={item.label} title={item.label} style={{ ...navBtn, background: item.label === 'Chats' ? '#1e1e24' : 'transparent' }}>
        {item.icon}
      </button>
    ))}
    <div style={{ flex: 1 }} />
    <button title="Logout" style={{ ...navBtn, color: '#ff1744' }}><LogOut size={22} /></button>
  </nav>
);

const navBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#a0a0a8', cursor: 'pointer', padding: 10, borderRadius: 10, display: 'flex', transition: 'all 0.15s' };
export default Sidebar;