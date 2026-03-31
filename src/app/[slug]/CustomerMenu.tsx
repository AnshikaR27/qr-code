'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { SlidersHorizontal, ChevronDown, X, ChevronUp, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { buildMenuTokens } from '@/lib/tokens';
import MenuNavbar from '@/components/menu/MenuNavbar';
import CategoryTabs from '@/components/menu/CategoryTabs';
import SectionHeading from '@/components/menu/SectionHeading';
import DishCard from '@/components/menu/DishCard';
import DishDetailSheet from '@/components/menu/DishDetailSheet';
import CartBar from '@/components/menu/CartBar';
import CartSheet from '@/components/menu/CartSheet';
import CallWaiterButton from '@/components/menu/CallWaiterButton';
import SplashScreen from '@/components/menu/SplashScreen';
import { useCart } from '@/hooks/useCart';
import type { CartItem, Category, Product, Restaurant } from '@/types';

type ActiveFilter = 'all' | 'veg' | 'non_veg' | 'bestseller';
type SortBy = 'default' | 'popular' | 'price_asc' | 'price_desc';
type Lang = 'en' | 'hi';

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  tableId: string | null;
}

export default function CustomerMenu({ restaurant, categories, products, tableId }: Props) {
  const tokens = useMemo(
    () => buildMenuTokens(restaurant.design_tokens),
    [restaurant.design_tokens]
  );

  useEffect(() => {
    document.documentElement.style.setProperty('--toast-success', tokens.success);
    document.documentElement.style.setProperty('--toast-error', tokens.error);
    document.documentElement.style.setProperty('--text-muted-placeholder', tokens.textMuted);
    return () => {
      document.documentElement.style.removeProperty('--toast-success');
      document.documentElement.style.removeProperty('--toast-error');
      document.documentElement.style.removeProperty('--text-muted-placeholder');
    };
  }, [tokens.success, tokens.error, tokens.textMuted]);

  const reduced = useReducedMotion();
  const [activeTab, setActiveTab] = useState(categories[0]?.id ?? '');
  const [sortBy] = useState<SortBy>('default');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [selectedDish, setSelectedDish] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('en');

  const { items: cartItems, addItem, clearCart, getTotal, getItemCount } = useCart();

  // Splash screen — shown once per session on first QR scan
  const [showSplash, setShowSplash] = useState(false);
  useEffect(() => {
    const key = `splash-seen-${restaurant.slug}`;
    if (!sessionStorage.getItem(key)) setShowSplash(true);
  }, [restaurant.slug]);

  function handleSplashEnter() {
    sessionStorage.setItem(`splash-seen-${restaurant.slug}`, '1');
    setShowSplash(false);
  }

  // Long press image zoom
  const [zoomedImage, setZoomedImage] = useState<{ url: string; name: string } | null>(null);

  // Repeat last order
  const [repeatOrder, setRepeatOrder] = useState<{ items: Omit<CartItem, 'name_hindi'>[]; total: number } | null>(null);
  const [showRepeat, setShowRepeat] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);

  // Filter dropdown state
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterDropRef = useRef<HTMLDivElement>(null);

  // Scroll state
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Top 3 bestsellers by order_count
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

  // Product counts per category (for tabs)
  const productCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach((cat) => {
      counts[cat.id] = products.filter((p) => p.category_id === cat.id && p.is_available).length;
    });
    return counts;
  }, [products, categories]);

  // 5-6 random dish names for animated placeholder
  const sampledNames = useMemo(() => {
    const names = products.map((p) => p.name).filter(Boolean);
    const shuffled = [...names].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
  }, [products]);

  // Load repeat order from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`last-order-${restaurant.slug}`);
      if (!stored) return;
      const data = JSON.parse(stored) as { items: Omit<CartItem, 'name_hindi'>[]; total: number; savedAt: number };
      // Only offer repeat within 24 hours
      if (Date.now() - data.savedAt < 86_400_000 && data.items.length > 0) {
        setRepeatOrder(data);
        setShowRepeat(true);
      }
    } catch { /* ignore */ }
  }, [restaurant.slug]);

  // Combo suggestion toast — fires when a new main-course item is added
  const prevCartRef = useRef<CartItem[]>([]);
  useEffect(() => {
    const prev = prevCartRef.current;
    const newlyAdded = cartItems.filter((item) => !prev.find((p) => p.product_id === item.product_id));
    if (newlyAdded.length > 0) {
      for (const added of newlyAdded) {
        const product = products.find((p) => p.id === added.product_id);
        if (!product?.category_id) continue;
        const cat = categories.find((c) => c.id === product.category_id);
        if (!cat) continue;
        const isMain = /\b(main|mains|curry|dal|rice|biryani|thali|sabji|sabzi|entree)\b/i.test(cat.name);
        if (!isMain) continue;
        const drinkCat = categories.find((c) => /\b(drink|drinks|beverage|juice|shake|lassi|chai|tea|coffee|soda)\b/i.test(c.name));
        if (!drinkCat) continue;
        const drinks = products.filter((p) => p.category_id === drinkCat.id && p.is_available);
        if (drinks.length === 0) continue;
        const suggestion = drinks[Math.floor(Math.random() * drinks.length)];
        toast(`🥤 Pair it with a drink?`, {
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
      if (saved.quantity > 1) {
        // addItem sets qty to 1; updateQuantity will be called after
      }
    }
    // Set correct quantities in a second pass (addItem always adds 1)
    for (const saved of repeatOrder.items) {
      if (saved.quantity > 1) {
        const liveProduct = products.find((p) => p.id === saved.product_id);
        if (liveProduct?.is_available) {
          // Zustand's updateQuantity is not imported here; we'll call addItem multiple times instead
          for (let i = 1; i < saved.quantity; i++) addItem(liveProduct);
        }
      }
    }
    setShowRepeat(false);
    toast.success('Items added to your cart!');
  }

  // Scroll tracking: progress bar + back-to-top + header collapse
  useEffect(() => {
    function handleScroll() {
      const y = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? y / total : 0);
      setShowBackToTop(y > 300);
      setIsScrolled(y > 60);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cycle placeholder every 3s when idle
  useEffect(() => {
    if (searchFocused || searchQuery || sampledNames.length <= 1) return;
    const id = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIdx((i) => (i + 1) % sampledNames.length);
        setPlaceholderVisible(true);
      }, 280);
    }, 3000);
    return () => clearInterval(id);
  }, [searchFocused, searchQuery, sampledNames.length]);

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!filterOpen) return;
    function onDown(e: MouseEvent) {
      if (
        !filterBtnRef.current?.contains(e.target as Node) &&
        !filterDropRef.current?.contains(e.target as Node)
      ) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterOpen]);

  // Section refs for scroll tracking + scroll-to
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (categories.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-category-id');
            if (id) setActiveTab(id);
          }
        }
      },
      { rootMargin: '-25% 0px -65% 0px', threshold: 0 }
    );
    const refs = sectionRefs.current;
    refs.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [categories]);

  const scrollToCategory = useCallback((id: string) => {
    if (!reduced) {
      setJumpTarget(id);
      setTimeout(() => setJumpTarget(null), 300);
    }
    const el = sectionRefs.current.get(id);
    if (el) {
      const offset = 177;
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
    setActiveTab(id);
  }, [reduced]);

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
    if (sortBy === 'popular') ps = [...ps].sort((a, b) => b.order_count - a.order_count);
    else if (sortBy === 'price_asc') ps = [...ps].sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') ps = [...ps].sort((a, b) => b.price - a.price);
    return ps;
  }

  const itemCount = getItemCount();
  const total = getTotal();

  const isFiltering = activeFilter !== 'all' || searchQuery.trim().length > 0;
  const hasAnyResults = isFiltering
    ? categories.some((cat) => getFilteredProducts(cat.id).length > 0)
    : true;

  // Filter button label / appearance
  const filterActive = activeFilter !== 'all';
  const filterLabel: Record<ActiveFilter, string> = {
    all: 'Filters',
    veg: 'Veg',
    non_veg: 'Non-Veg',
    bestseller: 'Popular',
  };

  const FILTER_OPTIONS: { v: ActiveFilter; label: string; dot?: string; icon?: string }[] = [
    { v: 'all', label: 'All' },
    { v: 'veg', label: 'Veg', dot: tokens.veg },
    { v: 'non_veg', label: 'Non-Veg', dot: tokens.nonveg },
    { v: 'bestseller', label: 'Popular', icon: '🔥' },
  ];

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '0 auto',
        minHeight: '100vh',
        backgroundColor: tokens.bg,
        backgroundImage: `radial-gradient(circle, ${tokens.primary}0f 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
        position: 'relative',
      }}
    >
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .cat-tab-btn {
          transition: color 0.2s ease, border-color 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        .menu-search-input { caret-color: var(--text-muted-placeholder); }
        .menu-search-input:focus { outline: none; }
        .filter-drop-item:hover { opacity: 0.75; }
      `}</style>

      {/* ── Splash screen (first scan only) ── */}
      {showSplash && (
        <SplashScreen
          restaurant={restaurant}
          tokens={tokens}
          onEnter={handleSplashEnter}
        />
      )}

      {/* ── Scroll progress bar (fixed, top of page) ── */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 200, pointerEvents: 'none' }}>
        <div
          style={{
            height: '100%',
            width: `${scrollProgress * 100}%`,
            backgroundColor: tokens.accent,
            transition: reduced ? 'none' : 'width 0.08s linear',
          }}
        />
      </div>

      {/* ── Sticky header: Navbar + Tabs + Search/Filter row ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <MenuNavbar
          restaurant={restaurant}
          tokens={tokens}
          itemCount={itemCount}
          onCartOpen={() => setCartOpen(true)}
          lang={lang}
          onLangToggle={() => setLang((l) => l === 'en' ? 'hi' : 'en')}
          isScrolled={isScrolled}
        />
        <CategoryTabs
          categories={categories}
          activeTab={activeTab}
          tokens={tokens}
          onSelect={scrollToCategory}
          productCounts={productCounts}
          lang={lang}
        />

        {/* Search + Filter button row */}
        <div
          style={{
            backgroundColor: tokens.navBg,
            padding: '8px 16px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Search input with animated placeholder */}
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            {/* Search icon */}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={tokens.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            {/* Animated placeholder overlay */}
            {!searchQuery && !searchFocused && sampledNames.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: 30,
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  fontFamily: tokens.fontBody,
                  fontSize: 13,
                  color: tokens.textMuted,
                  opacity: placeholderVisible ? 1 : 0,
                  transition: 'opacity 0.28s ease',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  zIndex: 1,
                }}
              >
                Search &ldquo;{sampledNames[placeholderIdx]}&rdquo;
              </div>
            )}

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="menu-search-input"
              style={{
                width: '100%',
                padding: '8px 28px 8px 30px',
                borderRadius: 20,
                border: `1px solid ${tokens.border}`,
                backgroundColor: tokens.cardBg,
                color: tokens.text,
                fontFamily: tokens.fontBody,
                fontSize: 13,
                boxSizing: 'border-box',
              } as React.CSSProperties}
            />

            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: 2, display: 'flex', alignItems: 'center', color: tokens.textMuted,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter button */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              ref={filterBtnRef}
              onClick={() => setFilterOpen((o) => !o)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '7px 10px',
                borderRadius: 20,
                border: `1px solid ${filterActive ? 'transparent' : tokens.border}`,
                backgroundColor: filterActive ? tokens.accent : tokens.cardBg,
                color: filterActive ? tokens.bg : tokens.textMuted,
                fontFamily: tokens.fontBody,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
            >
              {filterActive ? (
                <>
                  {activeFilter === 'veg' && <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: tokens.veg, display: 'inline-block', flexShrink: 0 }} />}
                  {activeFilter === 'non_veg' && <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: tokens.nonveg, display: 'inline-block', flexShrink: 0 }} />}
                  {activeFilter === 'bestseller' && <span style={{ fontSize: 11, lineHeight: 1 }}>🔥</span>}
                  {filterLabel[activeFilter]}
                  <span
                    onClick={(e) => { e.stopPropagation(); setActiveFilter('all'); setFilterOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', marginLeft: 1 }}
                  >
                    <X size={11} strokeWidth={2.5} />
                  </span>
                </>
              ) : (
                <>
                  <SlidersHorizontal size={13} strokeWidth={2} />
                  Filters
                  <ChevronDown size={11} strokeWidth={2.5} />
                </>
              )}
            </button>

            {/* Dropdown */}
            {filterOpen && (
              <div
                ref={filterDropRef}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  minWidth: 140,
                  backgroundColor: tokens.cardBg,
                  border: `1px solid ${tokens.border}`,
                  borderRadius: 12,
                  boxShadow: `0 8px 24px ${tokens.text}18`,
                  overflow: 'hidden',
                  zIndex: 50,
                }}
              >
                {FILTER_OPTIONS.map(({ v, label, dot, icon }) => {
                  const isActive = activeFilter === v;
                  return (
                    <button
                      key={v}
                      className="filter-drop-item"
                      onClick={() => { setActiveFilter(v); setFilterOpen(false); }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 14px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontFamily: tokens.fontBody,
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? tokens.text : tokens.textMuted,
                        textAlign: 'left',
                        transition: 'opacity 0.1s ease',
                      }}
                    >
                      {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dot, flexShrink: 0, display: 'inline-block' }} />}
                      {icon && <span style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>}
                      {!dot && !icon && <span style={{ width: 8 }} />}
                      {label}
                      {isActive && (
                        <span style={{ marginLeft: 'auto', color: tokens.accent, display: 'flex', alignItems: 'center' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrolling content ── */}
      <div style={{ paddingBottom: itemCount > 0 ? 100 : 40 }}>

        {/* Repeat last order banner */}
        {showRepeat && repeatOrder && (
          <div
            style={{
              margin: '12px 16px 0',
              padding: '12px 14px',
              backgroundColor: tokens.cardBg,
              borderRadius: 14,
              border: `1.5px solid ${tokens.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <RotateCcw size={18} color={tokens.primary} strokeWidth={2} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: tokens.fontBody, fontSize: 13, fontWeight: 700, color: tokens.text, margin: 0 }}>
                Repeat last order?
              </p>
              <p style={{ fontFamily: tokens.fontBody, fontSize: 11, color: tokens.textMuted, margin: '2px 0 0' }}>
                {repeatOrder.items.length} item{repeatOrder.items.length !== 1 ? 's' : ''} · {formatPrice(repeatOrder.total)}
              </p>
            </div>
            <button
              onClick={handleRepeatOrder}
              style={{
                padding: '7px 12px',
                borderRadius: 20,
                border: 'none',
                backgroundColor: tokens.primary,
                color: '#fff',
                fontFamily: tokens.fontBody,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Repeat
            </button>
            <button
              onClick={() => setShowRepeat(false)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: tokens.textMuted, padding: 4, display: 'flex', flexShrink: 0 }}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {isFiltering && !hasAnyResults && (
          <div
            style={{
              padding: '48px 16px',
              textAlign: 'center',
              fontFamily: tokens.fontBody,
              fontSize: 14,
              color: tokens.textMuted,
            }}
          >
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
              className={jumpTarget === cat.id ? 'section-blur-enter' : undefined}
            >
              <SectionHeading category={cat} tokens={tokens} />

              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: '8px 16px 16px',
                    fontFamily: tokens.fontBody,
                    fontSize: 13,
                    color: tokens.textMuted,
                    textAlign: 'center',
                  }}
                >
                  No dishes in this category
                </div>
              ) : (
                filtered.map((dish, i) => (
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    tokens={tokens}
                    index={i}
                    isBestseller={topDishIds.has(dish.id)}
                    lang={lang}
                    onTap={() => setSelectedDish(dish)}
                    onLongPressImage={dish.image_url
                      ? (url, name) => setZoomedImage({ url, name })
                      : undefined}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* ── Call Waiter (bottom-left) ── */}
      <CallWaiterButton
        restaurantId={restaurant.id}
        tableId={tableId}
        tokens={tokens}
        cartVisible={itemCount > 0}
      />

      {/* ── Back to Top button (bottom-right) ── */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}
          style={{
            position: 'fixed',
            bottom: itemCount > 0 ? 80 : 24,
            right: 16,
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: tokens.primary,
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            zIndex: 47,
            opacity: showBackToTop ? 1 : 0,
            transition: 'opacity 0.2s ease, bottom 0.25s ease',
          }}
          aria-label="Back to top"
        >
          <ChevronUp size={20} strokeWidth={2.5} />
        </button>
      )}

      {/* ── Cart bar (fixed bottom) ── */}
      <CartBar
        tokens={tokens}
        itemCount={itemCount}
        total={total}
        onOpen={() => setCartOpen(true)}
      />

      {/* ── Dish detail bottom sheet ── */}
      <DishDetailSheet
        product={selectedDish}
        tokens={tokens}
        isBestseller={selectedDish ? topDishIds.has(selectedDish.id) : false}
        lang={lang}
        onClose={() => setSelectedDish(null)}
      />

      {/* ── Cart sheet ── */}
      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurant={restaurant}
        tableId={tableId}
        tokens={tokens}
      />

      {/* ── Long press image zoom overlay ── */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.92)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomedImage.url}
            alt={zoomedImage.name}
            style={{ maxWidth: '94%', maxHeight: '78vh', objectFit: 'contain', borderRadius: 12 }}
          />
          <p style={{ color: 'rgba(255,255,255,0.75)', fontFamily: tokens.fontBody, fontSize: 14, fontWeight: 600, margin: 0 }}>
            {zoomedImage.name}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: tokens.fontBody, fontSize: 12, margin: 0 }}>
            Tap anywhere to close
          </p>
        </div>
      )}
    </div>
  );
}
