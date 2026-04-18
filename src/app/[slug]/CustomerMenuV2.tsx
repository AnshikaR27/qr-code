'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { X, ChevronUp, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { buildMenuTokens } from '@/lib/tokens';
import { typeScale, sizeScale, spacingScale } from '@/lib/sunday-scale';
import WelcomeScreenV2 from '@/components/menu/WelcomeScreenV2';
import MenuNavbarV2 from '@/components/menu/MenuNavbarV2';
import CategoryTabsV2 from '@/components/menu/CategoryTabsV2';
import DishCardV2 from '@/components/menu/DishCardV2';
import DishDetailSheetV2 from '@/components/menu/DishDetailSheetV2';
import CartBarV2 from '@/components/menu/CartBarV2';
import CartSheetV2 from '@/components/menu/CartSheetV2';
import AddonSheet from '@/components/menu/AddonSheet';
import { useCart } from '@/hooks/useCart';
import type { AddonGroup, CartItem, Category, Product, Restaurant } from '@/types';

type ActiveFilter = 'all' | 'veg' | 'non_veg' | 'bestseller';
type Lang = 'en' | 'hi';
type View = 'welcome' | 'menu' | 'pay';

interface Props {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
  tableId: string | null;
  addonGroupMap?: Record<string, AddonGroup[]>;
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
      className="fixed left-1/2 z-[60] max-w-[400px] w-[calc(100%-32px)] sunday-toast-in"
      style={{ bottom }}
    >
      <div
        className="text-white font-medium flex items-center justify-between"
        style={{
          fontSize: typeScale.body,
          paddingLeft: spacingScale.px,
          paddingRight: spacingScale.px,
          paddingTop: spacingScale.cardPad,
          paddingBottom: spacingScale.cardPad,
          backgroundColor: 'var(--sunday-primary, #1A1A1A)',
          borderRadius: 'var(--sunday-radius, 12px)',
          boxShadow: 'var(--sunday-shadow-lg)',
          fontFamily: 'var(--sunday-font-body)',
        }}
      >
        <span>{message}</span>
        <button onClick={onClose} aria-label="Dismiss" className="ml-3 text-white/60 bg-transparent border-none cursor-pointer">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default function CustomerMenuV2({ restaurant, categories, products, tableId, addonGroupMap = {} }: Props) {
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
    const vars: Record<string, string> = {
      '--sunday-primary': primaryColor,
      '--sunday-primary-text': primaryTextColor,
      '--sunday-secondary': tokens.secondary,
      '--sunday-accent': accentColor,
      '--sunday-accent-text': accentTextColor,
      '--sunday-bg': tokens.bg,
      '--sunday-card-bg': tokens.cardBg,
      '--sunday-nav-bg': tokens.navBg,
      '--sunday-surface-low': tokens.surfaceLow,
      '--sunday-text': tokens.text,
      '--sunday-text-muted': tokens.textMuted,
      '--sunday-border': tokens.border,
      '--sunday-badge-bg': tokens.badgeBg,
      '--sunday-badge-text': tokens.badgeText,
      '--sunday-veg': tokens.veg,
      '--sunday-nonveg': tokens.nonveg,
      '--sunday-font-heading': tokens.fontHeading,
      '--sunday-font-body': tokens.fontBody,
      '--sunday-radius': tokens.radius,
      '--sunday-shadow-sm': tokens.shadowSm,
      '--sunday-shadow-md': tokens.shadowMd,
      '--sunday-shadow-lg': tokens.shadowLg,
    };
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
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

  // AddonSheet state
  const [addonProduct, setAddonProduct] = useState<Product | null>(null);

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
    // Detect newly added cart lines by cart_key
    const newlyAdded = cartItems.filter((item) => !prev.find((p) => p.cart_key === item.cart_key));
    if (newlyAdded.length > 0) {
      const added = newlyAdded[0];
      setToastMessage(`1 ${added.name} has been added`);
    }
    prevCartRef.current = cartItems;
  }, [cartItems]);

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

  function handleDishAdd(dish: Product) {
    const groups = addonGroupMap[dish.id] ?? [];
    if (groups.length > 0) {
      setAddonProduct(dish);
    } else {
      addItem(dish);
      navigator.vibrate?.(50);
    }
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
    <div className="max-w-[480px] mx-auto min-h-[100dvh] relative" style={{ backgroundColor: 'var(--sunday-bg, #fdf9f0)' }}>
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
                  onSelect={scrollToCategory}
                  lang={lang}
                />

                {/* Search + filter row — only visible when search icon tapped */}
                {searchOpen && (
                  <div
                    className="flex items-center gap-2 border-b"
                    style={{
                      paddingLeft: spacingScale.px,
                      paddingRight: spacingScale.px,
                      paddingTop: spacingScale.tabPy,
                      paddingBottom: spacingScale.tabPy,
                      backgroundColor: 'var(--sunday-nav-bg, #efebe2)',
                      borderColor: 'color-mix(in srgb, var(--sunday-border, #E8D5B0) 50%, transparent)',
                    }}
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
                        className="w-full py-2 pl-8 pr-7 font-body outline-none transition-colors duration-150"
                        style={{
                          borderRadius: 'var(--sunday-radius, 12px)',
                          border: '1px solid color-mix(in srgb, var(--sunday-border, #E8D5B0) 75%, transparent)',
                          backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
                          color: 'var(--sunday-text, #1c1c17)',
                          fontFamily: 'var(--sunday-font-body)',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--sunday-accent, #b12d00)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--sunday-border, #E8D5B0) 75%, transparent)'; }}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
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
                            className="font-body font-semibold whitespace-nowrap transition-all duration-100 border active:scale-95"
                            style={{
                              fontSize: typeScale.xs,
                              borderRadius: 'calc(var(--sunday-radius, 12px) * 0.5)',
                              padding: '6px 10px',
                              ...(active
                                ? { backgroundColor: 'var(--sunday-accent, #b12d00)', borderColor: 'var(--sunday-accent, #b12d00)', color: 'var(--sunday-accent-text, #fff)' }
                                : { backgroundColor: 'var(--sunday-card-bg, #FFFFFF)', borderColor: 'var(--sunday-border, #E8D5B0)', color: 'var(--sunday-text-muted, #7A6040)' }),
                            }}
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
              <div style={{ paddingBottom: `calc(${sizeScale.cartBarH} + env(safe-area-inset-bottom, 0px) + 24px)` }}>
                {/* Repeat order banner */}
                {showRepeat && repeatOrder && (
                  <div
                    className="mt-3 flex items-center gap-2.5"
                    style={{
                      marginLeft: spacingScale.px,
                      marginRight: spacingScale.px,
                      padding: spacingScale.cardPad,
                      borderRadius: 'var(--sunday-radius, 12px)',
                      backgroundColor: 'var(--sunday-card-bg, #FFFFFF)',
                      border: '1px solid var(--sunday-border, #E8D5B0)',
                      boxShadow: 'var(--sunday-shadow-sm)',
                    }}
                  >
                    <RotateCcw size={17} strokeWidth={2} className="shrink-0" style={{ color: 'var(--sunday-primary, #361f1a)' }} />
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-bold m-0"
                        style={{ fontSize: typeScale.body, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-body)' }}
                      >
                        Repeat last order?
                      </p>
                      <p
                        className="mt-0.5 m-0"
                        style={{ fontSize: typeScale.xs, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
                      >
                        {repeatOrder.items.length} item{repeatOrder.items.length !== 1 ? 's' : ''} · {formatPrice(repeatOrder.total)}
                      </p>
                    </div>
                    <button
                      onClick={handleRepeatOrder}
                      aria-label="Repeat last order"
                      className="px-3 py-1.5 border-none font-bold cursor-pointer shrink-0 text-white"
                      style={{
                        fontSize: typeScale.sm,
                        borderRadius: 'calc(var(--sunday-radius, 12px) * 2)',
                        background: `linear-gradient(135deg, var(--sunday-primary, #361f1a), var(--sunday-accent, #b12d00))`,
                        fontFamily: 'var(--sunday-font-body)',
                      }}
                    >
                      Repeat
                    </button>
                    <button
                      onClick={() => setShowRepeat(false)}
                      aria-label="Dismiss repeat order"
                      className="bg-transparent border-none cursor-pointer p-1 shrink-0"
                      style={{ color: 'var(--sunday-text-muted, #7A6040)' }}
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                )}

                {isFiltering && !hasAnyResults && (
                  <div
                    className="py-16 px-6 text-center flex flex-col items-center gap-2"
                    style={{ fontFamily: 'var(--sunday-font-body)' }}
                  >
                    <p
                      className="font-bold m-0"
                      style={{ fontSize: typeScale.md, color: 'var(--sunday-text, #1c1c17)' }}
                    >
                      No dishes found
                    </p>
                    <p
                      className="m-0"
                      style={{ fontSize: typeScale.body, color: 'var(--sunday-text-muted, #7A6040)' }}
                    >
                      Try a different search or filter
                    </p>
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
                      style={{ scrollMarginTop: '110px', marginTop: spacingScale.sectionGap }}
                    >
                      {/* Section heading */}
                      <div
                        style={{
                          paddingTop: spacingScale.px,
                          paddingBottom: spacingScale.cardPad,
                          paddingLeft: spacingScale.px,
                          paddingRight: spacingScale.px,
                        }}
                      >
                        <h2
                          className="font-semibold leading-tight"
                          style={{ fontSize: typeScale.xl, color: 'var(--sunday-text, #1c1c17)', fontFamily: 'var(--sunday-font-heading)' }}
                        >
                          {lang === 'hi' && cat.name_hindi ? cat.name_hindi : cat.name}
                        </h2>
                        {cat.name_hindi && lang === 'en' && (
                          <p
                            className="mt-0.5"
                            style={{ fontSize: typeScale.xs, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
                          >
                            {cat.name_hindi}
                          </p>
                        )}
                      </div>

                      {filtered.length === 0 ? (
                        <div
                          className="py-6 text-center"
                          style={{ fontSize: typeScale.body, color: 'var(--sunday-text-muted, #7A6040)', fontFamily: 'var(--sunday-font-body)' }}
                        >
                          Coming soon
                        </div>
                      ) : (
                        <div
                          className="flex flex-col pb-2"
                          style={{
                            gap: spacingScale.dishGap,
                            paddingLeft: spacingScale.px,
                            paddingRight: spacingScale.px,
                          }}
                        >
                          {filtered.map((dish, i) => (
                            <DishCardV2
                              key={dish.id}
                              dish={dish}
                              index={i}
                              isBestseller={topDishIds.has(dish.id)}
                              lang={lang}
                              onTap={() => setSelectedDish(dish)}
                              onLongPressImage={
                                dish.image_url
                                  ? (url, name) => setZoomedImage({ url, name })
                                  : undefined
                              }
                              onAdd={handleDishAdd}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

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
                products={products}
              />

              {/* Addon customization sheet */}
              <AddonSheet
                product={addonProduct}
                preloadedGroups={addonProduct ? (addonGroupMap[addonProduct.id] ?? []) : undefined}
                onClose={() => setAddonProduct(null)}
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

      {/* Long press image zoom overlay */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          role="dialog"
          aria-label={`Zoomed image of ${zoomedImage.name}`}
          className="fixed inset-0 z-[9999] bg-black/92 flex flex-col items-center justify-center gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomedImage.url}
            alt={zoomedImage.name}
            className="max-w-[94%] max-h-[78vh] object-contain rounded-xl"
          />
          <p className="text-white/75 font-body font-semibold m-0" style={{ fontSize: typeScale.sm }}>
            {zoomedImage.name}
          </p>
          <p className="text-white/40 font-body m-0" style={{ fontSize: typeScale.xs }}>
            Tap anywhere to close
          </p>
        </div>
      )}
    </div>
  );
}
