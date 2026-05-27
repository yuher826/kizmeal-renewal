export default function Loading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '3px solid #E8F5E9',
          borderTop: '3px solid #2D6A4F',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
