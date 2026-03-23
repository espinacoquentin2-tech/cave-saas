"use client";
import React, { useEffect } from "react"; //
import { useTheme } from "../lib/store";

export function FillBar({ pct, color }: any) {
  const T = useTheme();
  const c = pct > 90 ? T.red : pct > 60 ? color : T.accentDim;
  return (
    <div style={{ background:T.border, borderRadius:2, height:4, overflow:"hidden" }}>
      <div style={{ width:`${Math.min(pct,100)}%`, height:"100%", background:c, borderRadius:2, transition:"width .6s" }} />
    </div>
  );
}

export function Badge({ label, color }: any) {
  const T = useTheme();
  const c = color || T.accent;
  return (
    <span style={{ fontSize:10, fontFamily:"monospace", letterSpacing:1, padding:"2px 6px", borderRadius:2, background:c+"22", color:c, border:`1px solid ${c}44`, textTransform:"uppercase", whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

export function KpiCard({ value, label, sub, accent }: any) {
  const T = useTheme();
  const a = accent || T.accent;
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, padding:"20px 24px", borderRadius:4, flex:1, minWidth:130, borderTop:`2px solid ${a}` }}>
      <div style={{ fontSize:24, fontFamily:"Georgia,serif", color:T.textStrong, letterSpacing:-1 }}>{value}</div>
      <div style={{ fontSize:11, color:T.textDim, textTransform:"uppercase", letterSpacing:2, marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:a, marginTop:4 }}>{sub}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: any) {
  const T = useTheme();
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:T.surface, border:`1px solid ${T.borderLight}`, borderRadius:4, padding:28, width: wide ? 820 : 520, maxWidth:"96vw", maxHeight:"90vh", overflowY:"auto", borderTop:`2px solid ${T.accent}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontFamily:"Georgia,serif", fontSize:18, color:T.textStrong }}>{title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.textDim, cursor:"pointer", fontSize:22, lineHeight:1, padding:"0 4px" }}>x</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FF({ label, children }: any) {
  const T = useTheme();
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:2, marginBottom:5 }}>{label}</label>
      {children}
    </div>
  );
}

export function Input({ value, onChange, type, placeholder, readOnly, disabled, style: extra }: any) {
  const T = useTheme();
  return (
    <input 
      type={type || "text"} 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder} 
      readOnly={readOnly}
      disabled={disabled}
      style={{ 
        width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:3, 
        padding:"8px 10px", color:T.text, fontSize:13, fontFamily:"monospace", 
        outline:"none", boxSizing:"border-box",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "text",
        ...extra 
      }} 
    />
  );
}

export function Select({ value, onChange, children, disabled, style: extra }: any) {
  const T = useTheme();
  return (
    <select 
      value={value} 
      onChange={onChange}
      disabled={disabled}
      style={{ 
        width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:3, 
        padding:"8px 10px", color:T.text, fontSize:13, fontFamily:"monospace", 
        outline:"none", boxSizing:"border-box", 
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...extra 
      }}
    >
      {children}
    </select>
  );
}

export function Btn({ onClick, disabled, children, variant, style: extra }: any) {
  const T = useTheme();
  const base = { 
    border:"none", padding:"9px 18px", borderRadius:3, 
    cursor: disabled ? "not-allowed" : "pointer", 
    fontSize:12, fontFamily:"monospace", letterSpacing:1, 
    textTransform:"uppercase", fontWeight:"bold", 
    opacity: disabled ? 0.5 : 1, transition:"opacity .2s" 
  };
  
  const styles: any = {
    primary:   { ...base, background:T.accent, color:"#000" },
    secondary: { ...base, background:"none", color:T.accent, border:`1px solid ${T.accent}44` },
    danger:    { ...base, background:"none", color:T.red,   border:`1px solid ${T.red}44` },
    ghost:     { ...base, background:T.surfaceHigh, color:T.text, border:`1px solid ${T.border}` },
  };
  
  return (
    <button 
      onClick={disabled ? undefined : onClick} 
      disabled={disabled}
      style={{ ...styles[variant || "primary"], ...extra }}
    >
      {children}
    </button>
  );
}

// 1. Le sous-composant qui gère le chrono pour UN seul toast
function ToastItem({ t, dispatch }: { t: any, dispatch: any }) {
  useEffect(() => {
    // Le timer de 3 secondes (3000 ms)
    const timer = setTimeout(() => {
      dispatch({ type: "TOAST_REMOVE", payload: t.id });
    }, 3000);

    // Sécurité : on nettoie le chrono si l'utilisateur clique sur la croix avant la fin
    return () => clearTimeout(timer);
  }, [t.id, dispatch]);

  return (
    <div style={{ background: t.color || "#2d6640", color:"#fff", padding:"10px 16px", borderRadius:4, fontSize:13, fontFamily:"monospace", display:"flex", alignItems:"center", gap:12, boxShadow:"0 4px 16px rgba(0,0,0,.4)", animation:"fadeIn .2s ease" }}>
      <span>{t.msg}</span>
      <button onClick={() => dispatch({ type:"TOAST_REMOVE", payload:t.id })} style={{ background:"none", border:"none", color:"#fff", cursor:"pointer", fontSize:16, lineHeight:1, padding:0, opacity:.7 }}>x</button>
    </div>
  );
}

// 2. Votre composant principal modifié
export function Toast({ toasts, dispatch }: any) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:300, display:"flex", flexDirection:"column", gap:8 }}>
      {toasts.map((t: any) => (
        <ToastItem key={t.id} t={t} dispatch={dispatch} />
      ))}
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}