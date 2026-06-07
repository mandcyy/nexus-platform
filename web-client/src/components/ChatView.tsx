import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Phone, Video, Info, Paperclip, Smile, Send, Mic, ArrowLeft } from 'lucide-react';
import { useStore } from '../hooks/useStore';

const ChatView: React.FC = () => {
  const { chatId } = useParams();
  const [message, setMessage] = useState('');
  const [messages] = useState(Array.from({ length: 20 }, (_, i) => ({
    id: `msg_${i}`, text: ['Hey!', 'How are you?', 'Working on the new feature', 'Looks great!', 'Can we ship tomorrow?', 'Sure thing', 'I'll review the PR', 'Deploying now', 'All tests passed ✅', 'Amazing work everyone!', 'Meeting at 3pm?', 'Yes, confirmed', 'Updated the docs', 'Thanks!', 'No problem', 'Let me check', 'Found the bug', 'Fixed in latest commit', 'LGTM 👍', 'Merging now'][i],
    isMine: i % 2 === 0,
    time: `${10 + Math.floor(i / 2)}:${String(i * 3 % 60).padStart(2, '0')}`,
  })).reverse());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { navigate } = useStore() as any;

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    setMessage('');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => (window as any).history.back()} style={iconBtn}>
            <ArrowLeft size={20} />
          </button>
          <div style={avatar}>T</div>
          <div>
            <div style={{ fontWeight: 600 }}>Team Alpha</div>
            <div style={{ fontSize: '0.75rem', color: '#00c853' }}>12 members • 3 online</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={iconBtn}><Phone size={18} /></button>
          <button style={iconBtn}><Video size={18} /></button>
          <button style={iconBtn}><Info size={18} /></button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.isMine ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
            <div style={{
              maxWidth: '70%', padding: '8px 14px', borderRadius: msg.isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.isMine ? '#0066ff' : '#1e1e24', color: msg.isMine ? 'white' : '#e8e8ec',
              fontSize: '0.95rem', lineHeight: 1.4,
            }}>
              {msg.text}
              <div style={{ fontSize: '0.65rem', marginTop: 2, opacity: 0.6, textAlign: 'right' }}>{msg.time}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={inputBar}>
        <button style={iconBtn}><Paperclip size={20} /></button>
        <input
          value={message} onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          style={msgInput}
        />
        <button style={iconBtn}><Smile size={20} /></button>
        {message.trim() ? (
          <button onClick={handleSend} style={{ ...iconBtn, color: '#0066ff' }}><Send size={20} /></button>
        ) : (
          <button style={iconBtn}><Mic size={20} /></button>
        )}
      </div>
    </div>
  );
};

const header: React.CSSProperties = { padding: '0.75rem 1rem', borderBottom: '1px solid #2e2e36', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#141419' };
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#a0a0a8', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const inputBar: React.CSSProperties = { padding: '0.75rem 1rem', borderTop: '1px solid #2e2e36', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#141419' };
const msgInput: React.CSSProperties = { flex: 1, background: '#1e1e24', border: 'none', borderRadius: 24, padding: '10px 16px', color: '#e8e8ec', fontSize: '0.95rem', outline: 'none' };
const avatar: React.CSSProperties = { width: 36, height: 36, borderRadius: '50%', background: '#0066ff20', color: '#0066ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' };
export default ChatView;