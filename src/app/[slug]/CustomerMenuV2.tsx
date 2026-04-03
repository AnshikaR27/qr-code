'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { X, ChevronUp, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { buildMenuTokens } from '@/lib/tokens';
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

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  tableId: string | null;
}

export default function CustomerMenuV2({ restaurant, categories, products, tableId }: Props) {
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
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [selectedDish, setSelectedDish] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('en');

  const { items: cartItems, addItem, clearCart, getTotal, getItemCount } = useCart();

  const [zoomedImage, setZoomedImage] = useState<{ url: string; name: string } | null>(null);

  // Repeat last order
  const [repeatOrder, setRepeatOrder] = useState<{ items: Omit<CartItem, 'name_hindi'>[]; total: number } | null>(null);
  const [showRepeat, setShowRepeat] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

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

  // Combo suggestion toast
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
        const drinkCat = categories.find((c) =>
          /\b(drink|drinks|beverage|juice|shake|lassi|chai|tea|coffee|soda)\b/i.test(c.name)
        );
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

  // Section refs for scroll/IntersectionObserver
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
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 }
    );
    const refs = sectionRefs.current;
    refs.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [categories]);

  const scrollToCategory = useCallback(
    (id: string) => {
      if (!reduced) {
        setJumpTarget(id);
        setTimeout(() => setJumpTarget(null), 300);
      }
      const el = sectionRefs.current.get(id);
      if (el) {
        // navbar ~56px + tabs ~40px = ~100px offset
        const offset = 110;
        const y = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
      setActiveTab(id);
    },
    [reduced]
  );

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
    { v: 'all', label: 'All' },
    { v: 'veg', label: 'Veg' },
    { v: 'non_veg', label: 'Non-Veg' },
    { v: 'bestseller', label: 'Popular' },
  ];

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '0 auto',
        minHeight: '100vh',
        backgroundColor: tokens.bg,
        position: 'relative',
      }}
    >
      <style>{`* { -webkit-tap-highlight-color: transparent; }`}</style>

      {/* ── Sticky header ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <MenuNavbarV2
          restaurant={restaurant}
          tokens={tokens}
          itemCount={itemCount}
          onCartOpen={() => setCartOpen(true)}
          lang={lang}
          onLangToggle={() => setLang((l) => (l === 'en' ? 'hi' : 'en'))}
          isScrolled={isScrolled}
        />
        <CategoryTabsV2
          categories={categories}
          activeTab={activeTab}
          tokens={tokens}
          onSelect={scrollToCategory}
          lang={lang}
        />

        {/* Search + filter row */}
        <div
          style={{
            backgroundColor: tokens.navBg,
            padding: '8px 16px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: `1px solid ${tokens.border}`,
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke={tokens.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={searchFocused ? '' : 'Search dishes…'}
              style={{
                width: '100%',
                padding: '8px 28px 8px 30px',
                borderRadius: 8,
                border: `1px solid ${tokens.border}`,
                backgroundColor: tokens.cardBg,
                color: tokens.text,
                fontFamily: tokens.fontBody,
                fontSize: 13,
                outline: 'none',
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
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {FILTER_OPTIONS.slice(1).map(({ v, label }) => {
              const active = activeFilter === v;
              return (
                <button
                  key={v}
                  onClick={() => setActiveFilter(active ? 'all' : v)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: `1px solid ${active ? tokens.primary : tokens.border}`,
                    backgroundColor: active ? tokens.primary : 'transparent',
                    color: active ? '#fff' : tokens.textMuted,
                    fontFamily: tokens.fontBody,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background 0.12s ease, color 0.12s ease',
                  }}
                >
                  {label}
                </button>
              );
            })}
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
              borderRadius: 12,
              border: `1px solid ${tokens.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <RotateCcw size={17} color={tokens.primary} strokeWidth={2} style={{ flexShrink: 0 }} />
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
                borderRadius: 999,
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
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: tokens.textMuted, padding: 4, flexShrink: 0 }}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {isFiltering && !hasAnyResults && (
          <div style={{ padding: '48px 16px', textAlign: 'center', fontFamily: tokens.fontBody, fontSize: 14, color: tokens.textMuted }}>
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
            >
              {/* Section heading */}
              <div
                style={{
                  padding: '28px 16px 10px',
                  borderBottom: `1px solid ${tokens.border}`,
                }}
              >
                <div
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: 20,
                    fontWeight: 800,
                    color: tokens.text,
                    lineHeight: 1.2,
                  }}
                >
                  {lang === 'hi' && cat.name_hindi ? cat.name_hindi : cat.name}
                </div>
                {cat.name_hindi && lang === 'en' && (
                  <div style={{ fontFamily: tokens.fontBody, fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
                    {cat.name_hindi}
                  </div>
                )}
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: '16px', fontFamily: tokens.fontBody, fontSize: 13, color: tokens.textMuted }}>
                  No dishes in this category
                </div>
              ) : (
                filtered.map((dish, i) => (
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
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Call waiter */}
      <CallWaiterButton
        restaurantId={restaurant.id}
        tableId={tableId}
        tokens={tokens}
        cartVisible={itemCount > 0}
      />

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}
          style={{
            position: 'fixed',
            bottom: itemCount > 0 ? 80 : 24,
            right: 16,
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: tokens.text,
            color: tokens.cardBg,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            zIndex: 47,
          }}
          aria-label="Back to top"
        >
          <ChevronUp size={18} strokeWidth={2.5} />
        </button>
      )}

      {/* Cart bar */}
      <CartBarV2
        tokens={tokens}
        itemCount={itemCount}
        total={total}
        onOpen={() => setCartOpen(true)}
      />

      {/* Dish detail sheet */}
      <DishDetailSheetV2
        product={selectedDish}
        tokens={tokens}
        isBestseller={selectedDish ? topDishIds.has(selectedDish.id) : false}
        lang={lang}
        onClose={() => setSelectedDish(null)}
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

      {/* Long press image zoom overlay */}
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
