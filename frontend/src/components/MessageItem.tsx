import React from 'react';

interface MessageData {
  id: number;
  content: string;
  username: string;
  senderName: string;
  createdAt: string;
}

interface Props {
  message: MessageData;
  isOwn: boolean;
}

export default function MessageItem({ message, isOwn }: Props) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwn ? 'flex-end' : 'flex-start',
        marginBottom: '10px',
      }}
    >
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
        {message.senderName || message.username} · {formatTime(message.createdAt)}
      </div>
      <div
        style={{
          maxWidth: '70%',
          padding: '8px 12px',
          borderRadius: '12px',
          backgroundColor: isOwn ? '#0084ff' : '#e4e6ea',
          color: isOwn ? 'white' : 'black',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
      </div>
    </div>
  );
}
