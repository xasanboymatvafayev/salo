import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// --- Interfeyslar ---
interface Product {
  id: string; // Masalan: '001'
  title: string;
  description: string;
  images: string[];
  stock: number;
  category: 'sale' | 'rent';
  size: string;
  price: number;
  hourlyPrice?: number;
}

interface CartItem extends Product {
  quantity: number;
}

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  location: string;
  items: CartItem[];
  type: 'delivery' | 'booking';
  status: 'pending' | 'confirmed';
  totalPrice: number;
  userTelegram: string;
}

interface PromoCode {
  code: string;
  discountPercent: number;
}

// --- API Xizmati ---
// Diqqat: Bu frontend qismi. PostgreSQL ulanish stringingizni backend (masalan Express.js) da ishlatishingiz kerak.
const API_BASE_URL = "https://your-backend-server.railway.app"; 

const api = {
  getProducts: async (): Promise<Product[]> => {
    try {
      const r = await fetch(`${API_BASE_URL}/products`);
      return r.ok ? await r.json() : JSON.parse(localStorage.getItem('db_products') || '[]');
    } catch { return JSON.parse(localStorage.getItem('db_products') || '[]'); }
  },
  addProduct: async (p: Product) => {
    try {
      await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      });
    } catch {
      const current = JSON.parse(localStorage.getItem('db_products') || '[]');
      localStorage.setItem('db_products', JSON.stringify([...current, p]));
    }
  },
  deleteProduct: async (id: string) => {
    try { await fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' }); }
    catch {
      const current = JSON.parse(localStorage.getItem('db_products') || '[]');
      localStorage.setItem('db_products', JSON.stringify(current.filter((p: any) => p.id !== id)));
    }
  },
  confirmOrder: async (orderId: string, items: CartItem[]) => {
    try {
      await fetch(`${API_BASE_URL}/orders/${orderId}/confirm`, { method: 'PATCH' });
    } catch {
      const products = JSON.parse(localStorage.getItem('db_products') || '[]');
      const updated = products.map((p: Product) => {
        const item = items.find(i => i.id === p.id);
        if (item) return { ...p, stock: p.stock - item.quantity };
        return p;
      }).filter((p: Product) => p.stock > 0);
      localStorage.setItem('db_products', JSON.stringify(updated));
    }
  }
};

// --- Komponentlar ---

const ImageSlider = ({ images }: { images: string[] }) => {
  const [idx, setIdx] = useState(0);
  if (!images || !images.length) return <div className="h-64 bg-gray-100 rounded-2xl flex items-center justify-center">Rasm yo'q</div>;
  return (
    <div className="relative group h-80 overflow-hidden rounded-3xl shadow-xl bg-gray-50">
      <img src={images[idx]} className="w-full h-full object-cover transition-all duration-700" alt="Product" />
      {images.length > 1 && (
        <>
          <button onClick={() => setIdx(idx === 0 ? images.length - 1 : idx - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/50 backdrop-blur-md p-2 rounded-full hover:bg-white"><i className="fas fa-chevron-left text-xs"></i></button>
          <button onClick={() => setIdx(idx === images.length - 1 ? 0 : idx + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/50 backdrop-blur-md p-2 rounded-full hover:bg-white"><i className="fas fa-chevron-right text-xs"></i></button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => <div key={i} className={`h-1 rounded-full transition-all ${i === idx ? 'w-6 bg-pink-600' : 'w-1.5 bg-white/50'}`} />)}
          </div>
        </>
      )}
    </div>
  );
};

const App = () => {
  const [view, setView] = useState<'user' | 'admin'>('user');
  const [tab, setTab] = useState<'sale' | 'rent'>('sale');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  
  // Admin Wizard
  const [adminStep, setAdminStep] = useState(0);
  const [newP, setNewP] = useState<Partial<Product>>({ images: [], stock: 1, category: 'sale', title: '', id: '', description: '', size: 'M', price: 0 });

  useEffect(() => {
    const init = async () => {
      const p = await api.getProducts();
      setProducts(p);
      setOrders(JSON.parse(localStorage.getItem('db_orders') || '[]'));
    };
    init();
  }, []);

  const handleOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const order: Order = {
      id: Math.random().toString(36).substr(2, 5).toUpperCase(),
      customerName: fd.get('name') as string,
      customerPhone: fd.get('phone') as string,
      location: fd.get('location') as string,
      type: fd.get('type') as any,
      items: [...cart],
      status: 'pending',
      totalPrice: cart.reduce((a, b) => a + (b.price * b.quantity), 0),
      userTelegram: "@foydalanuvchi"
    };
    const currentOrders = JSON.parse(localStorage.getItem('db_orders') || '[]');
    const updatedOrders = [...currentOrders, order];
    localStorage.setItem('db_orders', JSON.stringify(updatedOrders));
    setOrders(updatedOrders);
    setCart([]);
    setIsCartOpen(false);
    alert("Buyurtmangiz yuborildi!");
  };

  const confirmOrder = async (id: string, items: CartItem[]) => {
    await api.confirmOrder(id, items);
    const currentOrders = JSON.parse(localStorage.getItem('db_orders') || '[]');
    const updated = currentOrders.map((o: any) => o.id === id ? { ...o, status: 'confirmed' } : o);
    localStorage.setItem('db_orders', JSON.stringify(updated));
    setOrders(updated);
    setProducts(await api.getProducts());
    alert("Tasdiqlandi va zaxira yangilandi!");
  };

  const filtered = products.filter(p => p.category === tab && (p.id.includes(searchTerm) || p.title.toLowerCase().includes(searchTerm.toLowerCase())));

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl relative font-sans">
      {/* Header */}
      <header className="p-5 flex justify-between items-center bg-white/80 backdrop-blur-lg sticky top-0 z-50 border-b">
        <div onClick={() => setView('user')} className="cursor-pointer">
          <h1 className="text-2xl font-black italic tracking-tighter">BOUTIQUE<span className="text-pink-600">.</span></h1>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">PostgreSQL Active</span>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          {view === 'user' && (
            <button onClick={() => setIsCartOpen(true)} className="relative p-2 bg-gray-50 rounded-full">
              <i className="fas fa-shopping-bag text-lg"></i>
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-pink-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-lg">{cart.length}</span>}
            </button>
          )}
          <button onClick={() => { setView(view === 'user' ? 'admin' : 'user'); setIsAdminAuth(false); setAdminStep(0); }} className={`p-2 rounded-full ${view === 'admin' ? 'bg-pink-100 text-pink-600' : 'bg-gray-50'}`}>
            <i className={`fas ${view === 'user' ? 'fa-user-lock' : 'fa-home'}`}></i>
          </button>
        </div>
      </header>

      <main className="p-5 pb-28">
        {view === 'user' ? (
          <>
            <div className="flex bg-gray-100 p-1 rounded-2xl mb-6 shadow-inner">
              <button onClick={() => setTab('sale')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${tab === 'sale' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-400'}`}>SOTUVDA</button>
              <button onClick={() => setTab('rent')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${tab === 'rent' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-400'}`}>PROKAT</button>
            </div>

            <div className="relative mb-8">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"></i>
              <input type="text" placeholder="ID yoki nom bilan qidirish..." className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-pink-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>

            <div className="space-y-12">
              {filtered.map(p => (
                <div key={p.id} className="animate-fade-in">
                  <ImageSlider images={p.images} />
                  <div className="mt-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">{p.title}</h3>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-1">ID: {p.id} • Razmer: {p.size}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-pink-600">{p.price.toLocaleString()} <span className="text-xs">UZS{p.category === 'rent' && '/soat'}</span></p>
                        <p className={`text-[10px] font-bold uppercase mt-1 ${p.stock <= 2 ? 'text-red-500' : 'text-gray-400'}`}>Omborda: {p.stock} ta</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-4 leading-relaxed line-clamp-2">{p.description}</p>
                    <button onClick={() => {
                      const ex = cart.find(i => i.id === p.id);
                      if (ex && ex.quantity >= p.stock) return alert("Hozircha omborda boshqa qolmagan!");
                      setCart(ex ? cart.map(i => i.id === p.id ? {...i, quantity: i.quantity + 1} : i) : [...cart, {...p, quantity: 1}]);
                    }} className="w-full mt-6 bg-black text-white py-5 rounded-2xl font-bold hover:bg-pink-600 transition-colors shadow-xl active:scale-95 transform">SAVATGA QO'SHISH</button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className="text-center py-20 text-gray-300 font-bold uppercase tracking-widest text-xs">Hech narsa topilmadi</div>}
            </div>
          </>
        ) : (
          /* Admin View */
          <div className="space-y-8">
            {!isAdminAuth ? (
              <div className="py-20 text-center space-y-6">
                <i className="fas fa-fingerprint text-5xl text-gray-200"></i>
                <h2 className="text-xl font-black uppercase tracking-widest">Admin Access</h2>
                <input type="password" placeholder="Parol" className="w-full p-4 bg-gray-50 border-none rounded-2xl text-center font-bold tracking-widest" onKeyDown={e => { if(e.key==='Enter' && (e.target as any).value==='netlify1') setIsAdminAuth(true) }} />
                <p className="text-[10px] text-gray-400 font-bold uppercase">Enter bossangiz kiritiladi</p>
              </div>
            ) : (
              <div className="animate-fade-in space-y-8">
                <div className="flex justify-between items-end">
                  <h2 className="text-2xl font-black italic underline decoration-pink-600 decoration-4">BOSHQARUV</h2>
                  <div className="flex gap-4">
                    <button className="text-[10px] font-bold text-gray-400 uppercase tracking-widest"><i className="fas fa-chart-line mr-1"></i> STATS</button>
                    <button className="text-[10px] font-bold text-pink-600 uppercase tracking-widest"><i className="fas fa-ticket-alt mr-1"></i> PROMO</button>
                  </div>
                </div>

                {/* Add Product Step-by-Step */}
                <div className="bg-gray-50 p-6 rounded-3xl border-2 border-dashed border-gray-200">
                  <h3 className="font-bold mb-6 flex items-center gap-2"><i className="fas fa-plus-circle text-pink-600"></i> Yangi kiyim qo'shish</h3>
                  
                  {/* Step Indicators */}
                  <div className="flex gap-2 mb-6">
                    {[0,1,2,3,4].map(s => <div key={s} className={`h-1 flex-1 rounded-full ${s <= adminStep ? 'bg-pink-600' : 'bg-gray-200'}`} />)}
                  </div>

                  {adminStep === 0 && (
                    <div className="space-y-4 animate-fade-in">
                      <input placeholder="Kiyim ID (Masalan: 001)" className="w-full p-4 rounded-xl border-none shadow-sm" onChange={e => setNewP({...newP, id: e.target.value})} />
                      <input placeholder="Kiyim nomi" className="w-full p-4 rounded-xl border-none shadow-sm" onChange={e => setNewP({...newP, title: e.target.value})} />
                      <button onClick={() => setAdminStep(1)} className="w-full bg-pink-600 text-white py-4 rounded-xl font-bold shadow-lg">KEYINGI QADAM</button>
                    </div>
                  )}

                  {adminStep === 1 && (
                    <div className="space-y-4 animate-fade-in">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">3-4 ta rasm URL manzili (Enter bosing)</p>
                      <input placeholder="URL..." className="w-full p-4 rounded-xl border-none shadow-sm" onKeyDown={e => {
                        if(e.key === 'Enter') {
                          const val = (e.target as any).value;
                          if(val) setNewP({...newP, images: [...(newP.images||[]), val]});
                          (e.target as any).value = '';
                        }
                      }} />
                      <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
                        {newP.images?.map((img, i) => (
                          <div key={i} className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border">
                            <img src={img} className="w-full h-full object-cover" />
                            <button onClick={() => setNewP({...newP, images: newP.images?.filter((_, idx) => idx !== i)})} className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 text-[8px]">×</button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setAdminStep(0)} className="flex-1 bg-gray-200 py-4 rounded-xl font-bold">ORQAGA</button>
                        <button onClick={() => setAdminStep(2)} className="flex-1 bg-pink-600 text-white py-4 rounded-xl font-bold">ZAXIRA</button>
                      </div>
                    </div>
                  )}

                  {adminStep === 2 && (
                    <div className="space-y-4 animate-fade-in">
                      <input type="number" placeholder="Nechta bor? (Stock)" className="w-full p-4 rounded-xl border-none shadow-sm" onChange={e => setNewP({...newP, stock: Number(e.target.value)})} />
                      <textarea placeholder="Tavsif (Kiyim haqida qisqacha)" className="w-full p-4 rounded-xl border-none shadow-sm h-24" onChange={e => setNewP({...newP, description: e.target.value})} />
                      <div className="flex gap-3">
                        <button onClick={() => setAdminStep(1)} className="flex-1 bg-gray-200 py-4 rounded-xl font-bold">ORQAGA</button>
                        <button onClick={() => setAdminStep(3)} className="flex-1 bg-pink-600 text-white py-4 rounded-xl font-bold">BO'LIM</button>
                      </div>
                    </div>
                  )}

                  {adminStep === 3 && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex bg-white p-1 rounded-xl shadow-sm">
                        <button onClick={() => setNewP({...newP, category: 'sale'})} className={`flex-1 py-3 text-xs font-black rounded-lg ${newP.category === 'sale' ? 'bg-pink-600 text-white' : 'text-gray-400'}`}>SOTUV</button>
                        <button onClick={() => setNewP({...newP, category: 'rent'})} className={`flex-1 py-3 text-xs font-black rounded-lg ${newP.category === 'rent' ? 'bg-pink-600 text-white' : 'text-gray-400'}`}>PROKAT</button>
                      </div>
                      <input placeholder="Razmer (M, L, XL, S...)" className="w-full p-4 rounded-xl border-none shadow-sm" onChange={e => setNewP({...newP, size: e.target.value})} />
                      <div className="flex gap-3">
                        <button onClick={() => setAdminStep(2)} className="flex-1 bg-gray-200 py-4 rounded-xl font-bold">ORQAGA</button>
                        <button onClick={() => setAdminStep(4)} className="flex-1 bg-pink-600 text-white py-4 rounded-xl font-bold">NARX</button>
                      </div>
                    </div>
                  )}

                  {adminStep === 4 && (
                    <div className="space-y-4 animate-fade-in">
                      <input type="number" placeholder={newP.category === 'sale' ? "Narxi (UZS)" : "1 soatlik narxi (UZS)"} className="w-full p-4 rounded-xl border-none shadow-sm" onChange={e => setNewP({...newP, price: Number(e.target.value)})} />
                      
                      <div className="bg-white p-5 rounded-2xl border-2 border-pink-100 mt-6 shadow-xl">
                        <h4 className="text-[10px] font-black uppercase text-pink-600 mb-4 tracking-widest">Yakuniy ko'rinish</h4>
                        <div className="flex gap-4">
                           <img src={newP.images?.[0]} className="w-16 h-16 object-cover rounded-lg" />
                           <div>
                              <p className="font-bold text-sm">{newP.title} (ID: {newP.id})</p>
                              <p className="text-xs text-gray-400">{newP.category?.toUpperCase()} • {newP.size} • {newP.stock} ta</p>
                              <p className="text-pink-600 font-black text-sm mt-1">{newP.price?.toLocaleString()} UZS</p>
                           </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button onClick={() => setAdminStep(0)} className="flex-1 bg-red-100 text-red-600 py-4 rounded-xl font-bold uppercase text-[10px]">O'chirish</button>
                        <button onClick={() => setAdminStep(0)} className="flex-1 bg-gray-200 py-4 rounded-xl font-bold uppercase text-[10px]">Tahrirlash</button>
                        <button onClick={async () => {
                          if(!newP.id || !newP.title || !newP.price) return alert("To'liq to'ldiring!");
                          await api.addProduct(newP as Product);
                          setProducts(await api.getProducts());
                          setAdminStep(0);
                          setNewP({ images: [], stock: 1, category: 'sale', title: '', id: '', description: '', size: 'M', price: 0 });
                          alert("Web-appga muvaffaqiyatli qo'shildi!");
                        }} className="flex-2 bg-green-600 text-white py-4 rounded-xl font-black italic shadow-xl uppercase text-xs">Tasdiqlash</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Orders Section */}
                <div className="space-y-4">
                  <h3 className="font-black text-sm uppercase text-gray-400 tracking-widest">Yangi Buyurtmalar</h3>
                  {orders.filter(o => o.status === 'pending').map(order => (
                    <div key={order.id} className="bg-white p-5 rounded-3xl border-2 border-pink-50 shadow-lg animate-fade-in">
                      <div className="flex justify-between items-center mb-4">
                        <span className="bg-pink-600 text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest">#{order.id}</span>
                        <span className="text-[10px] font-bold text-pink-600 uppercase tracking-tighter">{order.type}</span>
                      </div>
                      <div className="space-y-1 mb-4 border-b pb-4">
                        <p className="font-black text-lg">{order.customerName}</p>
                        <p className="text-sm font-bold text-gray-500"><i className="fas fa-phone mr-2"></i>{order.customerPhone}</p>
                        <p className="text-xs text-gray-400 italic mt-2"><i className="fas fa-map-marker-alt mr-2 text-pink-500"></i>{order.location}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl space-y-2 mb-6">
                        {order.items.map(i => (
                          <div key={i.id} className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                               <img src={i.images[0]} className="w-8 h-8 rounded object-cover" />
                               <span className="text-xs font-bold">{i.title} (x{i.quantity})</span>
                            </div>
                            <span className="text-xs font-black">{(i.price * i.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="border-t pt-2 flex justify-between font-black text-sm text-pink-600 uppercase tracking-tighter">
                          <span>Jami:</span>
                          <span>{order.totalPrice.toLocaleString()} UZS</span>
                        </div>
                      </div>
                      <button onClick={() => confirmOrder(order.id, order.items)} className="w-full bg-black text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-transform">TASDIQLASH VA BOTGA YUBORISH</button>
                    </div>
                  ))}
                  {orders.filter(o => o.status === 'pending').length === 0 && <p className="text-center text-gray-300 py-10 font-bold uppercase text-[10px]">Hozircha buyurtmalar yo'q</p>}
                </div>

                {/* Inventory List with Search by ID */}
                <div className="space-y-4">
                  <h3 className="font-black text-sm uppercase text-gray-400 tracking-widest">Ombor (ID Qidiruv)</h3>
                  <div className="relative mb-4">
                    <input type="text" placeholder="ID orqali qidirish (Masalan: 001)..." className="w-full p-4 bg-gray-50 border-none rounded-xl text-sm" onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                  <div className="grid gap-3">
                    {products.filter(p => p.id.includes(searchTerm)).map(p => (
                      <div key={p.id} className="flex items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-gray-100 group">
                        <img src={p.images[0]} className="w-14 h-14 object-cover rounded-xl" />
                        <div className="flex-1">
                          <h4 className="text-xs font-black">{p.title}</h4>
                          <p className="text-[10px] text-gray-300 font-bold uppercase mt-1">ID: {p.id} • Razmer: {p.size}</p>
                          <p className={`text-[10px] font-black mt-1 ${p.stock <= 2 ? 'text-red-500' : 'text-green-500'}`}>OMBORDA: {p.stock} TA</p>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button className="text-gray-400 hover:text-blue-500 p-2"><i className="fas fa-edit"></i></button>
                           <button onClick={async () => {
                              if(confirm("Bazadan butunlay o'chirilsinmi?")) {
                                await api.deleteProduct(p.id);
                                setProducts(await api.getProducts());
                              }
                           }} className="text-gray-400 hover:text-red-500 p-2"><i className="fas fa-trash-alt"></i></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md animate-fade-in flex justify-end">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col slide-in-right">
            <div className="p-6 flex justify-between items-center border-b">
              <h2 className="text-2xl font-black italic tracking-tighter">SAVATCHA</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-3xl text-gray-300">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {cart.map(item => (
                <div key={item.id} className="flex gap-4 p-4 bg-gray-50 rounded-3xl relative animate-fade-in shadow-sm">
                  <img src={item.images[0]} className="w-20 h-20 object-cover rounded-2xl" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold leading-tight">{item.title}</h4>
                    <p className="text-xs text-pink-600 font-black mt-1">{item.price.toLocaleString()} UZS</p>
                    <div className="flex items-center gap-4 mt-3">
                      <button onClick={() => setCart(cart.map(i => i.id === item.id && i.quantity > 1 ? {...i, quantity: i.quantity - 1} : i))} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-xs active:bg-gray-200 transition-colors">-</button>
                      <span className="text-xs font-black">{item.quantity}</span>
                      <button onClick={() => { if(item.quantity < item.stock) setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i)); else alert("Omborda ortiqcha qolmagan!"); }} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-xs active:bg-gray-200 transition-colors">+</button>
                    </div>
                    <p className="text-[8px] text-gray-300 font-bold uppercase mt-2">ID: {item.id} • Skladda: {item.stock}</p>
                  </div>
                  <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="absolute top-2 right-2 text-gray-300 hover:text-red-500"><i className="fas fa-times-circle"></i></button>
                </div>
              ))}
              {cart.length === 0 && (
                 <div className="text-center py-20">
                    <i className="fas fa-shopping-basket text-6xl text-gray-100 mb-6"></i>
                    <p className="text-gray-300 uppercase tracking-widest text-xs font-black">Savat bo'sh</p>
                 </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-6 bg-white border-t space-y-4 shadow-2xl">
                <form onSubmit={handleOrder} className="space-y-3">
                  <input name="name" required placeholder="Ism sharifingiz" className="w-full p-4 rounded-2xl bg-gray-50 border-none shadow-inner text-sm focus:ring-2 focus:ring-pink-500" />
                  <input name="phone" required placeholder="Telefon (+998)" className="w-full p-4 rounded-2xl bg-gray-50 border-none shadow-inner text-sm focus:ring-2 focus:ring-pink-500" />
                  <input name="location" required placeholder="Shahar, tuman, ko'cha" className="w-full p-4 rounded-2xl bg-gray-50 border-none shadow-inner text-sm focus:ring-2 focus:ring-pink-500" />
                  <div className="flex gap-2">
                     <label className="flex-1 flex items-center justify-center p-4 rounded-2xl bg-gray-50 cursor-pointer transition-all hover:bg-pink-50 has-[:checked]:bg-pink-600 has-[:checked]:text-white">
                        <input type="radio" name="type" value="delivery" defaultChecked className="hidden" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Dastavka</span>
                     </label>
                     <label className="flex-1 flex items-center justify-center p-4 rounded-2xl bg-gray-50 cursor-pointer transition-all hover:bg-pink-50 has-[:checked]:bg-pink-600 has-[:checked]:text-white">
                        <input type="radio" name="type" value="booking" className="hidden" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Band qilish</span>
                     </label>
                  </div>
                  <div className="pt-4 border-t mt-4">
                    <div className="flex justify-between items-center text-xl font-black italic mb-6">
                       <span>JAMI:</span>
                       <span className="text-pink-600">{cart.reduce((a, b) => a + (b.price * b.quantity), 0).toLocaleString()} UZS</span>
                    </div>
                    <button type="submit" className="w-full bg-pink-600 text-white py-5 rounded-3xl font-black tracking-widest shadow-xl shadow-pink-100 active:scale-95 transition-transform uppercase italic">BUYURTMA BERISH</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation (User/Admin toggle is in Header, but this is for persistent access) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-xl text-white px-8 py-4 rounded-full flex gap-12 shadow-2xl z-40 border border-white/10">
         <button onClick={() => { setView('user'); setIsCartOpen(false); }} className={`flex flex-col items-center gap-1 ${view === 'user' ? 'text-pink-500' : 'text-gray-400'}`}>
            <i className="fas fa-gem text-lg"></i>
            <span className="text-[7px] font-black uppercase tracking-widest">Collection</span>
         </button>
         <button onClick={() => setIsCartOpen(true)} className="flex flex-col items-center gap-1 text-gray-400 relative">
            <i className="fas fa-shopping-bag text-lg"></i>
            <span className="text-[7px] font-black uppercase tracking-widest">Basket</span>
            {cart.length > 0 && <div className="absolute -top-1 -right-1 w-2 h-2 bg-pink-600 rounded-full"></div>}
         </button>
         <button onClick={() => { setView('admin'); setIsAdminAuth(false); }} className={`flex flex-col items-center gap-1 ${view === 'admin' ? 'text-pink-500' : 'text-gray-400'}`}>
            <i className="fas fa-lock text-lg"></i>
            <span className="text-[7px] font-black uppercase tracking-widest">Admin</span>
         </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .slide-in-right { animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
