"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, HeartPulse } from "lucide-react";

export const DEFAULT_CLINIC_SLIDES = [
  "https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=1400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=1400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1584515933487-779824d29309?w=1400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1516302752625-fcc3c50ae61f?w=1400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=1400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1516841273335-e39b37888115?w=1400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1493836512294-502baa1986e2?w=1400&auto=format&fit=crop&q=85"
];

export function HomeHeroSlider({ images }: { images?: string[] }) {
  const items = useMemo(() => {
    const slides = (images || []).filter((value) => typeof value === "string" && value.trim()).slice(0, 10);
    return slides.length ? slides : DEFAULT_CLINIC_SLIDES;
  }, [images]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % items.length), 5500);
    return () => window.clearInterval(timer);
  }, [items]);
  const move = (direction: number) => setActive((value) => (value + direction + items.length) % items.length);
  return <div className="etzan-photo-frame etzan-slider" aria-roledescription="carousel" aria-label="صور العيادة والدعم النفسي">
    {items.map((src, index) => <img key={src + index} src={src} alt={`صورة من العيادة والدعم النفسي ${index + 1}`} className={"etzan-slide-image" + (index === active ? " is-active" : "")} loading={index === 0 ? "eager" : "lazy"}/>)}
    <div className="etzan-slider-shade"/>
    <div className="etzan-photo-caption"><i/> العيادة والدعم النفسي <b><HeartPulse size={14}/> رعاية ووعي واحتواء</b></div>
    {items.length > 1 && <><button type="button" className="etzan-slider-arrow prev" onClick={() => move(-1)} aria-label="الصورة السابقة"><ArrowRight size={18}/></button><button type="button" className="etzan-slider-arrow next" onClick={() => move(1)} aria-label="الصورة التالية"><ArrowLeft size={18}/></button><div className="etzan-slider-dots">{items.map((_, index) => <button key={index} type="button" aria-label={`انتقل للصورة ${index + 1}`} aria-current={index === active} className={index === active ? "active" : ""} onClick={() => setActive(index)}/>)}</div></>}
  </div>;
}
