'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { X, ChevronUp, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { buildMenuTokens } from '@/lib/tokens';
import WelcomeScreenV2 from '@/components/menu/WelcomeScreenV2';
import MenuNavbarV2 from '@/components/menu/MenuNavbarV2';
import CategoryTabsV2 from '@/components/menu/CategoryTabsV2';
import DishCardV2 from '@/components/menu/DishCardV2';
import DishDetailSheetV2 from '@/components/menu/DishDetailSheetV2';
import CartBarV2 from '@/components/menu/CartBarV2';
import CartSheetV2 from '@/components/menu/CartSheetV2';
import CallWaiterButton from '@/components/menu/CallWaiterButton';
import { useCart } from '@/hooks/useCart';
import type { CartItem, Category, Product, Restaurant } from '@/types';

type ActiveFilter = 'all' | 'veg' | 'non_veg' | 'bestseller';
type Lang = 'en' | 'hi';
type View = 'welcome' | 'menu' | 'pay';

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  tableId: string | null;
}

/* ── Custom Toast Component ─────────────────────────────────────────── */
function SundayToast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);

  /* cart bar at 12px + safe, 52px tall → toast 12px above = 76px + safe */
  const bottom = 'calc(76px + env(safe-area-inset-bottom, 0px))';

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[60] max-w-[400px] w-[calc(100%-32px)] sunday-toast-in"
      style={{ bottom }}
    >
      <div className="text-white font-body text-[13px] sm:text-sm font-medium px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl flex items-center justify-between shadow-lg" style={{ backgroundColor: 'var(--sunday-primary, #1A1A1A)' }}>
        <span>{message}</span>
        <button onClick={onClose} className="ml-3 text-white/60 bg-transparent border-none cursor-pointer">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default function CustomerMenuV2({ restaurant, categories, products, tableId }: Props) {
  const tokens = useMemo(
    () => buildMenuTokens(restaurant.design_tokens),
    [restaurant.design_tokens]
  );

  // Primary = structural color (bottom nav background)
  // Accent = pop/CTA color (buttons, active tabs, cart bar)
  const primaryColor = tokens.primary ?? '#1A1A1A';
  const accentColor = tokens.accent ?? tokens.primary ?? '#1A1A1A';

  function contrastText(hex: string) {
    const h = hex.replace('#', '');
    if (h.length !== 6) return '#FFFFFF';
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#1A1A1A' : '#FFFFFF';
  }

  const primaryTextColor = contrastText(primaryColor);
  const accentTextColor = contrastText(accentColor);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--sunday-primary', primaryColor);
    root.style.setProperty('--sunday-primary-text', primaryTextColor);
    root.style.setProperty('--sunday-accent', accentColor);
    root.style.setProperty('--sunday-accent-text', accentTextColor);
    root.style.setProperty('--sunday-bg', tokens.bg);
    root.style.setProperty('--sunday-card-bg', tokens.cardBg);
    root.style.setProperty('--sunday-nav-bg', tokens.navBg);
    root.style.setProperty('--sunday-surface-low', tokens.surfaceLow);
    root.style.setProperty('--sunday-text', tokens.text);
    root.style.setProperty('--sunday-text-muted', tokens.textMuted);
    root.style.setProperty('--sunday-border', tokens.border);
    console.log('Setting --sunday-accent to:', accentColor); // temporary debug log
    return () => {
      root.style.removeProperty('--sunday-primary');
      root.style.removeProperty('--sunday-primary-text');
      root.style.removeProperty('--sunday-accent');
      root.style.removeProperty('--sunday-accent-text');
      root.style.removeProperty('--sunday-bg');
      root.style.removeProperty('--sunday-card-bg');
      root.style.removeProperty('--sunday-nav-bg');
      root.style.removeProperty('--sunday-surface-low');
      root.style.removeProperty('--sunday-text');
      root.style.removeProperty('--sunday-text-muted');
      root.style.removeProperty('--sunday-border');
    };
  }, [tokens, accentColor, accentTextColor, primaryColor, primaryTextColor]);

  const reduced = useReducedMotion();
  const [view, setView] = useState<View>('welcome');
  const [activeTab, setActiveTab] = useState(categories[0]?.id ?? '');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [selectedDish, setSelectedDish] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('en');

  const { items: cartItems, addItem, clearCart, getTotal, getItemCount } = useCart();

  const [zoomedImage, setZoomedImage] = useState<{ url: string; name: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Repeat last order
  const [repeatOrder, setRepeatOrder] = useState<{ items: Omit<CartItem, 'name_hindi'>[]; total: number } | null>(null);
  const [showRepeat, setShowRepeat] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Scroll state
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Top 3 bestsellers
  const topDishIds = useMemo(
    () =>
      new Set(
        [...products]
          .filter((p) => p.order_count > 0)
          .sort((a, b) => b.order_count - a.order_count)
          .slice(0, 3)
          .map((p) => p.id)
      ),
    [products]
  );

  // Load repeat order from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`last-order-${restaurant.slug}`);
      if (!stored) return;
      const data = JSON.parse(stored) as { items: Omit<CartItem, 'name_hindi'>[]; total: number; savedAt: number };
      if (Date.now() - data.savedAt < 86_400_000 && data.items.length > 0) {
        setRepeatOrder(data);
        setShowRepeat(true);
      }
    } catch { /* ignore */ }
  }, [restaurant.slug]);

  // Show custom toast when item added
  const prevCartRef = useRef<CartItem[]>([]);
  useEffect(() => {
    const prev = prevCartRef.current;
    const newlyAdded = cartItems.filter((item) => !prev.find((p) => p.product_id === item.product_id));
    if (newlyAdded.length > 0) {
      const added = newlyAdded[0];
      setToastMessage(`1 ${added.name} has been added`);

      // Combo suggestion
      for (const item of newlyAdded) {
        const product = products.find((p) => p.id === item.product_id);
        if (!product?.category_id) continue;
        const cat = categories.find((c) => c.id === product.category_id);
        if (!cat) continue;
        const isMain = /\b(main|mains|curry|dal|rice|biryani|thali|sabji|sabzi|entree)\b/i.test(cat.name);
        if (!isMain) continue;
        const drinkCat = categories.find((c) =>
          /\b(drink|drinks|beverage|juice|shake|lassi|chai|tea|coffee|soda)\b/i.test(c.name)
        );
        if (!drinkCat) continue;
        const drinks = products.filter((p) => p.category_id === drinkCat.id && p.is_available);
        if (drinks.length === 0) continue;
        const suggestion = drinks[Math.floor(Math.random() * drinks.length)];
        toast(`Pair it with a drink?`, {
          description: `${suggestion.name} · ₹${suggestion.price}`,
          action: { label: 'Add', onClick: () => addItem(suggestion) },
          duration: 7000,
        });
        break;
      }
    }
    prevCartRef.current = cartItems;
  }, [cartItems, products, categories, addItem]);

  function handleRepeatOrder() {
    if (!repeatOrder) return;
    clearCart();
    for (const saved of repeatOrder.items) {
      const liveProduct = products.find((p) => p.id === saved.product_id);
      if (!liveProduct || !liveProduct.is_available) continue;
      addItem(liveProduct);
    }
    for (const saved of repeatOrder.items) {
      if (saved.quantity > 1) {
        const liveProduct = products.find((p) => p.id === saved.product_id);
        if (liveProduct?.is_available) {
          for (let i = 1; i < saved.quantity; i++) addItem(liveProduct);
        }
      }
    }
    setShowRepeat(false);
    toast.success('Items added to your basket!');
  }

  // Scroll tracking
  useEffect(() => {
    function handleScroll() {
      const y = window.scrollY;
      setShowBackToTop(y > 300);
      setIsScrolled(y > 60);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Section refs for IntersectionObserver
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (categories.length === 0 || view !== 'menu') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-category-id');
            if (id) setActiveTab(id);
          }
        }
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 }
    );
    const refs = sectionRefs.current;
    refs.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [categories, view]);

  const scrollToCategory = useCallback(
    (id: string) => {
      if (!reduced) {
        setJumpTarget(id);
        setTimeout(() => setJumpTarget(null), 300);
      }
      const el = sectionRefs.current.get(id);
      if (el) {
        const offset = 110;
        const y = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
      setActiveTab(id);
    },
    [reduced]
  );

  function handleCategoryFromWelcome(categoryId: string) {
    setView('menu');
    setActiveTab(categoryId);
    // Wait for menu to render, then scroll
    setTimeout(() => scrollToCategory(categoryId), 100);
  }

  function getFilteredProducts(categoryId: string): Product[] {
    let ps = products.filter((p) => p.category_id === categoryId);
    if (activeFilter === 'veg') ps = ps.filter((p) => p.is_veg);
    else if (activeFilter === 'non_veg') ps = ps.filter((p) => !p.is_veg);
    else if (activeFilter === 'bestseller') ps = ps.filter((p) => topDishIds.has(p.id));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      ps = ps.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.name_hindi ?? '').toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q)
      );
    }
    return ps;
  }

  const itemCount = getItemCount();
  const total = getTotal();
  const isFiltering = activeFilter !== 'all' || searchQuery.trim().length > 0;
  const hasAnyResults = isFiltering
    ? categories.some((cat) => getFilteredProducts(cat.id).length > 0)
    : true;

  const FILTER_OPTIONS: { v: ActiveFilter; label: string }[] = [
    { v: 'veg', label: 'Veg' },
    { v: 'non_veg', label: 'Non-Veg' },
    { v: 'bestseller', label: 'Popular' },
  ];

  // Get current active category name for navbar
  const activeCategoryName = categories.find((c) => c.id === activeTab)?.name;

  return (
    <div className="max-w-[480px] mx-auto min-h-screen relative" style={{ backgroundColor: 'var(--sunday-bg, #fdf9f0)' }}>
      <style>{`* { -webkit-tap-highlight-color: transparent; }`}</style>

      {/* Welcome screen */}
      {view === 'welcome' && (
        <WelcomeScreenV2
          restaurant={restaurant}
          categories={categories}
          products={products}
          onCategorySelect={handleCategoryFromWelcome}
        />
      )}

          {/* Menu screen */}
          {view === 'menu' && (
            <>
              {/* Sticky header */}
              <div className="sticky top-0 z-30">
                <MenuNavbarV2
                  restaurant={restaurant}
                  tokens={tokens}
                  itemCount={itemCount}
                  onCartOpen={() => setCartOpen(true)}
                  lang={lang}
                  onLangToggle={() => setLang((l) => (l === 'en' ? 'hi' : 'en'))}
                  isScrolled={isScrolled}
                  onSearch={() => { setSearchOpen(!searchOpen); if (searchOpen) { setSearchQuery(''); setActiveFilter('all'); } }}
                  currentCategory={activeCategoryName}
                />
                <CategoryTabsV2
                  categories={categories}
                  activeTab={activeTab}
                  tokens={tokens}
                  onSelect={scrollToCategory}
                  lang={lang}
                />

                {/* Search + filter row — only visible when search icon tapped */}
                {searchOpen && (
                  <div
                    className="px-4 py-2 flex items-center gap-2 border-b"
                    style={{ backgroundColor: 'var(--sunday-nav-bg, #efebe2)', borderColor: 'var(--sunday-border, #E8D5B0)' }}
                  >
                    {/* Search */}
                    <div className="relative flex-1 min-w-0">
                      <svg
                        width="13" height="13" viewBox="0 0 24 24" fill="none"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ stroke: 'var(--sunday-text-muted, #7A6040)' }}
                      >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search dishes..."
                        autoFocus
                        className="w-full py-2 pl-8 pr-7 rounded-lg font-body text-[13px] outline-none"
                        style={{
                          border: '1px solid var(--sunday-border, #E8D5B0)',
                          backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
                          color: 'var(--sunday-text, #1c1c17)',
                        }}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-0.5"
                          style={{ color: 'var(--sunday-text-muted, #7A6040)' }}
                        >
                          <X size={12} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>

                    {/* Filter chips */}
                    <div className="flex gap-1 shrink-0">
                      {FILTER_OPTIONS.map(({ v, label }) => {
                        const active = activeFilter === v;
                        return (
                          <button
                            key={v}
                            onClick={() => setActiveFilter(active ? 'all' : v)}
                            className="px-2.5 py-1.5 rounded-md font-body text-[11px] font-semibold whitespace-nowrap transition-colors duration-100 border"
                            style={active
                              ? { backgroundColor: accentColor, borderColor: accentColor, color: accentTextColor }
                              : { backgroundColor: 'var(--sunday-card-bg, #FFFFFF)', borderColor: 'var(--sunday-border, #E8D5B0)', color: 'var(--sunday-text-muted, #7A6040)' }
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Scrolling content */}
              {/* cart bar at 12px + safe, 52px tall → need 12+52+16=80px + safe */}
              <div style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}>
                {/* Repeat order banner */}
                {showRepeat && repeatOrder && (
                  <div
                    className="mx-4 mt-3 p-3 rounded-xl flex items-center gap-2.5"
                    style={{ backgroundColor: 'var(--sunday-card-bg, #FFFFFF)', border: '1px solid var(--sunday-border, #E8D5B0)' }}
                  >
                    <RotateCcw size={17} strokeWidth={2} className="shrink-0" style={{ color: 'var(--sunday-primary, #361f1a)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-[13px] font-bold m-0" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
                        Repeat last order?
                      </p>
                      <p className="font-body text-[11px] mt-0.5 m-0" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
                        {repeatOrder.items.length} item{repeatOrder.items.length !== 1 ? 's' : ''} · {formatPrice(repeatOrder.total)}
                      </p>
                    </div>
                    <button
                      onClick={handleRepeatOrder}
                      className="px-3 py-1.5 rounded-full border-none font-body text-xs font-bold cursor-pointer shrink-0 text-white"
                      style={{ background: `linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))` }}
                    >
                      Repeat
                    </button>
                    <button
                      onClick={() => setShowRepeat(false)}
                      className="bg-transparent border-none cursor-pointer p-1 shrink-0"
                      style={{ color: 'var(--sunday-text-muted, #7A6040)' }}
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                )}

                {isFiltering && !hasAnyResults && (
                  <div className="py-12 px-4 text-center font-body text-sm" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
                    No items found
                  </div>
                )}

                {categories.map((cat) => {
                  const filtered = getFilteredProducts(cat.id);
                  if (filtered.length === 0 && isFiltering) return null;

                  return (
                    <div
                      key={cat.id}
                      ref={(el) => {
                        if (el) sectionRefs.current.set(cat.id, el);
                        else sectionRefs.current.delete(cat.id);
                      }}
                      data-category-id={cat.id}
                      style={{ scrollMarginTop: '110px' }}
                    >
                      {/* Section heading */}
                      <div className="pt-5 sm:pt-6 pb-2 sm:pb-2.5 px-3.5 sm:px-4">
                        <h2 className="font-body text-lg sm:text-xl font-semibold leading-tight" style={{ color: 'var(--sunday-text, #1c1c17)' }}>
                          {lang === 'hi' && cat.name_hindi ? cat.name_hindi : cat.name}
                        </h2>
                        {cat.name_hindi && lang === 'en' && (
                          <p className="font-body text-xs mt-0.5" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
                            {cat.name_hindi}
                          </p>
                        )}
                      </div>

                      {filtered.length === 0 ? (
                        <div className="px-4 py-4 font-body text-[13px]" style={{ color: 'var(--sunday-text-muted, #7A6040)' }}>
                          No dishes in this category
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3.5 sm:gap-5 px-3.5 sm:px-4">
                          {filtered.map((dish, i) => (
                            <DishCardV2
                              key={dish.id}
                              dish={dish}
                              tokens={tokens}
                              index={i}
                              isBestseller={topDishIds.has(dish.id)}
                              lang={lang}
                              onTap={() => setSelectedDish(dish)}
                              onLongPressImage={
                                dish.image_url
                                  ? (url, name) => setZoomedImage({ url, name })
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* TODO: Re-enable Call Waiter — commented out to fix bottom bar overlap */}
              {/* <CallWaiterButton
                restaurantId={restaurant.id}
                tableId={tableId}
                tokens={tokens}
                cartVisible={itemCount > 0}
              /> */}

              {/* Back to top */}
              {showBackToTop && (
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}
                  className="fixed right-4 w-10 h-10 rounded-full border-none cursor-pointer flex items-center justify-center shadow-lg z-[39]"
                  style={{
                    bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
                    backgroundColor: accentColor,
                    color: accentTextColor,
                  }}
                  aria-label="Back to top"
                >
                  <ChevronUp size={18} strokeWidth={2.5} />
                </button>
              )}

              {/* Dish detail sheet */}
              <DishDetailSheetV2
                product={selectedDish}
                tokens={tokens}
                isBestseller={selectedDish ? topDishIds.has(selectedDish.id) : false}
                lang={lang}
                onClose={() => setSelectedDish(null)}
                allProducts={products}
                categories={categories}
              />

              {/* Cart sheet */}
              <CartSheetV2
                open={cartOpen}
                onClose={() => setCartOpen(false)}
                restaurant={restaurant}
                tableId={tableId}
                tokens={tokens}
                products={products}
              />
            </>
          )}

      {/* ── Custom Toast ── */}
      {toastMessage && (
        <SundayToast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* ── Cart Bar — always visible ── */}
      <CartBarV2
        itemCount={itemCount}
        total={total}
        onOpen={() => { setView('menu'); setCartOpen(true); }}
      />

      {/* Bottom nav removed — cart bar is the only fixed bottom element */}

      {/* Long press image zoom overlay */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-[9999] bg-black/92 flex flex-col items-center justify-center gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomedImage.url}
            alt={zoomedImage.name}
            className="max-w-[94%] max-h-[78vh] object-contain rounded-xl"
          />
          <p className="text-white/75 font-body text-sm font-semibold m-0">
            {zoomedImage.name}
          </p>
          <p className="text-white/40 font-body text-xs m-0">
            Tap anywhere to close
          </p>
        </div>
      )}
    </div>
  );
}
