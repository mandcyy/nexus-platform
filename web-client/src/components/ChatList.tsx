import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Settings, Edit, Users, MessageSquare, Pin, BellOff } from 'lucide-react';
import { useStore } from '../hooks/useStore';

const ChatList: React.FC = () => {
  const { chats } = useStore();
  const navigate = useNavigate();
  const { chatId } = useParams();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #2e2e36' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Chats</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={iconBtn}><Edit size={18} /></button>
            <button style={iconBtn}><Settings size={18} /></button>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: '#a0a0a8' }} />
          <input placeholder="Search conversations..." style={searchInput} />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {Array.from({ length: 15 }, (_, i) => ({
          id: `chat_${i}`, name: ['Team Alpha', 'Design Squad', 'Engineering', 'Marketing', 'Sales', 'Support', 'Product', 'Random', 'Announcements', 'DevOps', 'QA Team', 'Leadership', 'Client A', 'Client B', 'Fun'][i],
          lastMessage: ['Hey everyone!', 'Can you review the designs?', 'PR #234 is ready', 'Campaign live tomorrow', 'Q3 numbers are in', 'Ticket #4567 resolved', 'Sprint planning at 2pm', 'lol check this out 😂', 'Server maintenance tonight', 'All tests passing', 'Meeting notes updated', 'Budget approved', 'Contract signed!', 'Following up on proposal'][i],
          time: ['10:24', '09:15', 'Yesterday', 'Yesterday', 'Mon', 'Mon', 'Sun', 'Sun', 'Sat', 'Fri', 'Thu', 'Wed', 'Tue', 'Mon'][i],
          unread: i < 3 ? (i + 1) * 2 : 0,
        })).map(chat => (
          <div
            key={chat.id}
            onClick={() => navigate(`/chat/${chat.id}`)}
            style={{
              padding: '0.75rem 1rem', cursor: 'pointer',
              background: chatId === chat.id ? '#1e1e24' : 'transparent',
              borderBottom: '1px solid #1e1e24',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={avatar}>{chat.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: chat.unread ? 700 : 500, fontSize: '0.95rem' }}>{chat.name}</span>
                  <span style={{ fontSize: '0.75rem', color: '#a0a0a8' }}>{chat.time}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ fontSize: '0.85rem', color: '#a0a0a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                    {chat.lastMessage}
                  </span>
                  {chat.unread > 0 && (
                    <span style={badge}>{chat.unread}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#a0a0a8', cursor: 'pointer', padding: 4, borderRadius: 6 };
const searchInput: React.CSSProperties = { width: '100%', background: '#1e1e24', border: 'none', borderRadius: 8, padding: '10px 12px 10px 36px', color: '#e8e8ec', fontSize: '0.9rem', outline: 'none' };
const avatar: React.CSSProperties = { width: 44, height: 44, borderRadius: '50%', background: '#0066ff20', color: '#0066ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0 };
const badge: React.CSSProperties = { background: '#0066ff', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 };
export default ChatList;